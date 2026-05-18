import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

// Helper: log a stock movement to the audit trail
export async function logInventoryMovement(pool, { inventory_item_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes }) {
  try {
    await pool.query(
      `INSERT INTO inventory_movements
        (inventory_item_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [inventory_item_id, movement_type, quantity, stock_before, stock_after, reference_type || null, reference_id || null, notes || null]
    );
  } catch (e) {
    console.error('Failed to log inventory movement:', e);
  }
}

export default function inventoryRouter(pool, googleSheets) {
  const router = Router();

  // Validation helper
  function validate(req, res, rules) {
    for (const [field, check] of Object.entries(rules || {})) {
      const val = req.body?.[field];
      if (check?.required && (val === undefined || val === null || val === '')) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (check?.type && typeof val !== check.type) {
        return res.status(400).json({ error: `${field} must be a ${check.type}` });
      }
      if (check?.min !== undefined && (typeof val !== 'number' || val < check.min)) {
        return res.status(400).json({ error: `${field} must be >= ${check.min}` });
      }
      if (check?.maxLen && typeof val === 'string' && val.length > check.maxLen) {
        return res.status(400).json({ error: `${field} must be at most ${check.maxLen} characters` });
      }
    }
    return null;
  }

  // GET all inventory
  router.get('/', async (req, res) => {
    try {
      // Check if cost columns exist before selecting them (graceful if migration not applied)
      let hasCost = false;
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        hasCost = Array.isArray(cols) && cols.length >= 2;
      } catch (_) { hasCost = false; }

      const baseCols = 'id, name, category, unit, stock, low_stock_threshold, created_at';
      const sql = hasCost
        ? `SELECT ${baseCols}, purchase_cost, unit_cost FROM inventory ORDER BY category, name`
        : `SELECT ${baseCols} FROM inventory ORDER BY category, name`;
      const [rows] = await pool.query(sql);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

// POST create inventory item (admin only)
router.post('/', authMiddleware, async (req, res) => {
    const { id, name, category, unit, stock, low_stock_threshold, purchase_cost, unit_cost } = req.body;
    const err = validate(req, res, {
      id: { required: true, type: 'string', maxLen: 32 },
      name: { required: true, type: 'string', maxLen: 128 },
      category: { required: true, type: 'string', maxLen: 64 },
      unit: { type: 'string', maxLen: 32 },
      stock: { type: 'number', min: 0 },
      low_stock_threshold: { type: 'number', min: 0 },
      purchase_cost: { type: 'number', min: 0 },
      unit_cost: { type: 'number', min: 0 },
    });
    if (err) return err;
    try {
      // Only insert cost columns if they exist in the DB (migration may not be applied yet)
      const baseCols = '(id, name, category, unit, stock, low_stock_threshold)';
      const baseVals = [id, name, category, unit || 'pcs', stock ?? 0, low_stock_threshold ?? 10];
      let sql = `INSERT INTO inventory ${baseCols}`;
      let vals = baseVals;

      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        // cols is [{ COLUMN_NAME: 'purchase_cost' }, { COLUMN_NAME: 'unit_cost' }]
        const hasCost = Array.isArray(cols) && cols.length >= 2;
        if (hasCost) {
          sql = `INSERT INTO inventory ${baseCols.replace(')', ', purchase_cost, unit_cost)')}`;
          vals = [...baseVals, purchase_cost ?? 0, unit_cost ?? 0];
        }
      } catch (_) { /* migration not applied — skip cost columns */ }

      await pool.query(sql, vals);
      await logAudit(pool, req, { action: 'inventory_create', entityType: 'inventory', entityId: id, details: { name, category, stock } });
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Item with this ID already exists' });
      }
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

// PUT update inventory item (including stock adjustment) (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, category, unit, stock, low_stock_threshold, purchase_cost, unit_cost } = req.body;
    if (!id || typeof id !== 'string' || id.length > 32) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      const [existing] = await pool.query('SELECT id, stock FROM inventory WHERE id = ?', [id]);
      if (!existing.length) return res.status(404).json({ error: 'Item not found' });

      const oldStock = Number(existing[0].stock);
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (category !== undefined) { fields.push('category = ?'); values.push(category); }
      if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
      if (stock !== undefined) { fields.push('stock = ?'); values.push(Number(stock)); }
      if (low_stock_threshold !== undefined) { fields.push('low_stock_threshold = ?'); values.push(Number(low_stock_threshold)); }

      // Only update cost columns if they exist in the DB (migration may not be applied yet)
      let costFieldsExist = false;
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        costFieldsExist = Array.isArray(cols) && cols.length >= 2;
      } catch (_) { costFieldsExist = false; }

      if (costFieldsExist) {
        if (purchase_cost !== undefined) { fields.push('purchase_cost = ?'); values.push(Number(purchase_cost)); }
        if (unit_cost !== undefined) { fields.push('unit_cost = ?'); values.push(Number(unit_cost)); }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      await pool.query(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`, values);

      // Log stock movement if stock changed
      if (stock !== undefined) {
        const newStock = Number(stock);
        const movementType = newStock > oldStock ? 'restock' : newStock < oldStock ? 'adjustment' : null;
        if (movementType) {
          await logInventoryMovement(pool, {
            inventory_item_id: id,
            movement_type: movementType,
            quantity: Math.abs(newStock - oldStock),
            stock_before: oldStock,
            stock_after: newStock,
            notes: 'Manual stock update via admin',
          });
        }
      }

      await logAudit(pool, req, { action: 'inventory_update', entityType: 'inventory', entityId: id });
      const [updated] = await pool.query('SELECT * FROM inventory WHERE id = ?', [id]);
      res.json(updated[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

// DELETE inventory item (admin only)
  router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 32) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    try {
      await pool.query('DELETE FROM inventory WHERE id = ?', [id]);
      await logAudit(pool, req, { action: 'inventory_delete', entityType: 'inventory', entityId: id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Reset all inventory costs to 0
  router.post('/reset-costs', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Check if cost columns exist
      let costFieldsExist = false;
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        costFieldsExist = Array.isArray(cols) && cols.length >= 2;
      } catch (_) { costFieldsExist = false; }

      if (!costFieldsExist) {
        return res.status(400).json({ error: 'Cost columns not migrated yet' });
      }

      await pool.query('UPDATE inventory SET purchase_cost = 0, unit_cost = 0');
      res.json({ ok: true, message: 'All inventory costs reset to 0' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Clear all inventory + related data (admin only - for fresh start)
  router.delete('/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await pool.query('DELETE FROM inventory_movements');
      await pool.query('DELETE FROM recipes');
      await pool.query('DELETE FROM inventory');
      return res.json({ ok: true, message: 'All inventory items, recipes, and movement logs cleared. Auto-seed on restart.' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/inventory/movements — list movements with filters
  router.get('/movements', authMiddleware, async (req, res) => {
    try {
      const { itemId, type, start, end, limit } = req.query;
      const where = [];
      const params = [];

      if (itemId) {
        where.push('im.inventory_item_id = ?');
        params.push(itemId);
      }
      if (type) {
        where.push('im.movement_type = ?');
        params.push(type);
      }
      if (start) {
        where.push('im.created_at >= ?');
        params.push(start);
      }
      if (end) {
        where.push('im.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(end);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const limitClause = limit ? `LIMIT ${Number(limit)}` : 'LIMIT 500';

      const [rows] = await pool.query(`
        SELECT im.id, im.inventory_item_id, im.movement_type, im.quantity,
               im.stock_before, im.stock_after, im.reference_type, im.reference_id,
               im.notes, im.created_at,
               i.name AS inventory_name, i.category AS inventory_category, i.unit
        FROM inventory_movements im
        JOIN inventory i ON i.id = im.inventory_item_id
        ${whereClause}
        ORDER BY im.created_at DESC
        ${limitClause}
      `, params);

      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/inventory/movements — manual stock adjustment (admin only)
  router.post('/movements', authMiddleware, adminMiddleware, async (req, res) => {
    const { inventory_item_id, movement_type, quantity, notes } = req.body;

    if (!inventory_item_id || !movement_type || quantity === undefined) {
      return res.status(400).json({ error: 'inventory_item_id, movement_type, and quantity are required' });
    }
    if (!['restock', 'adjustment'].includes(movement_type)) {
      return res.status(400).json({ error: 'movement_type must be "restock" or "adjustment"' });
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get current stock
      const [inv] = await conn.query('SELECT id, stock FROM inventory WHERE id = ?', [inventory_item_id]);
      if (!inv.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      const stockBefore = Number(inv[0].stock);
      const stockAfter = movement_type === 'restock'
        ? stockBefore + quantity
        : Math.max(0, stockBefore - quantity);
      const actualQty = movement_type === 'restock' ? quantity : Math.min(quantity, stockBefore);

      // Update stock
      await conn.query('UPDATE inventory SET stock = ? WHERE id = ?', [stockAfter, inventory_item_id]);

      // Log movement
      await logInventoryMovement(pool, {
        inventory_item_id,
        movement_type,
        quantity: actualQty,
        stock_before: stockBefore,
        stock_after: stockAfter,
        notes: notes || null,
      });

      await conn.commit();

      // Sync inventory movement to Google Sheets
      if (googleSheets) {
        try {
          const [itemRow] = await pool.query('SELECT name FROM inventory WHERE id = ?', [inventory_item_id]);
          await googleSheets.appendInventoryMovement({
            itemId: inventory_item_id,
            itemName: itemRow[0]?.name || inventory_item_id,
            movementType: movement_type,
            quantity: actualQty,
            stockBefore,
            stockAfter,
            notes: notes || null,
          });
        } catch (e2) { console.error('[Sheets] Inventory movement sync failed (non-fatal):', e2.message); }
      }

      res.json({ ok: true, stock_before: stockBefore, stock_after: stockAfter });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  return router;
}
