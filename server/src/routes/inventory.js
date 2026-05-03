import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

export default function inventoryRouter(pool) {
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
      const [existing] = await pool.query('SELECT id FROM inventory WHERE id = ?', [id]);
      if (!existing.length) return res.status(404).json({ error: 'Item not found' });

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

      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

      values.push(id);
      await pool.query(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ ok: true });
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
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
