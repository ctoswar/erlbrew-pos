import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export default function transfersRouter(pool) {
  const router = Router();

  // GET all transfers — filterable by location, status
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { location_id, status, limit = 50, offset = 0 } = req.query;
      const conditions = [];
      const params = [];

      if (location_id) {
        conditions.push('(t.from_location_id = ? OR t.to_location_id = ?)');
        params.push(location_id, location_id);
      }
      if (status) {
        conditions.push('t.status = ?');
        params.push(status);
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 500);
      const off = Math.max(parseInt(String(offset), 10) || 0, 0);

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM inventory_transfers t ${where}`,
        params
      );

      const [rows] = await pool.query(`
        SELECT t.*,
               fl.name AS from_location_name,
               tl.name AS to_location_name,
               i.name AS item_name, i.unit AS item_unit,
           rb.name AS requested_by_name,
           ab.name AS approved_by_name,
           recb.name AS received_by_name
        FROM inventory_transfers t
        LEFT JOIN locations fl ON t.from_location_id = fl.id
        LEFT JOIN locations tl ON t.to_location_id = tl.id
        LEFT JOIN inventory i ON t.inventory_item_id = i.id
        LEFT JOIN staff rb ON t.requested_by = rb.id
        LEFT JOIN staff ab ON t.approved_by = ab.id
        LEFT JOIN staff recb ON t.received_by = recb.id
        ${where}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, lim, off]);

      res.json({ transfers: rows, total, limit: lim, offset: off });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST create transfer request
  router.post('/', authMiddleware, async (req, res) => {
    const { from_location_id, to_location_id, inventory_item_id, quantity, notes } = req.body;
    if (!from_location_id || !to_location_id || !inventory_item_id || !quantity) {
      return res.status(400).json({ error: 'from_location_id, to_location_id, inventory_item_id, and quantity are required' });
    }
    if (from_location_id === to_location_id) {
      return res.status(400).json({ error: 'Source and destination locations must be different' });
    }
    if (Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check source stock
      const [stockRows] = await conn.query(
        'SELECT stock FROM inventory WHERE id = ? AND location_id = ? FOR UPDATE',
        [inventory_item_id, from_location_id]
      );
      if (!stockRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Item not found at source location' });
      }
      if (Number(stockRows[0].stock) < Number(quantity)) {
        await conn.rollback();
        return res.status(400).json({ error: `Insufficient stock. Available: ${stockRows[0].stock}` });
      }

      const staffId = req.staff?.id || null;
      const [result] = await conn.query(
        `INSERT INTO inventory_transfers
          (from_location_id, to_location_id, inventory_item_id, quantity, status, requested_by, notes)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        [from_location_id, to_location_id, inventory_item_id, quantity, staffId, notes || null]
      );

      await conn.commit();
      await logAudit(pool, req, { action: 'transfer_create', entityType: 'inventory_transfer', entityId: String(result.insertId), details: { from_location_id, to_location_id, inventory_item_id, quantity } });
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // PUT approve transfer (admin only)
  router.put('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT * FROM inventory_transfers WHERE id = ? AND status = ? FOR UPDATE',
        [req.params.id, 'pending']
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Transfer not found or not in pending status' });
      }

      const staffId = req.staff?.id || null;
      await conn.query(
        "UPDATE inventory_transfers SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?",
        [staffId, req.params.id]
      );

      await conn.commit();
      await logAudit(pool, req, { action: 'transfer_approve', entityType: 'inventory_transfer', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // PUT mark in-transit
  router.put('/:id/ship', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT * FROM inventory_transfers WHERE id = ? AND status = ? FOR UPDATE',
        [req.params.id, 'approved']
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Transfer not found or not approved' });
      }

      const transfer = rows[0];

      // Deduct stock from source location
      const [stockRows] = await conn.query(
        'SELECT stock FROM inventory WHERE id = ? AND location_id = ? FOR UPDATE',
        [transfer.inventory_item_id, transfer.from_location_id]
      );
      if (!stockRows.length || Number(stockRows[0].stock) < Number(transfer.quantity)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Insufficient stock at source' });
      }

      const newSourceStock = Number(stockRows[0].stock) - Number(transfer.quantity);
      await conn.query(
        'UPDATE inventory SET stock = ? WHERE id = ? AND location_id = ?',
        [newSourceStock, transfer.inventory_item_id, transfer.from_location_id]
      );

      // Log stock deduction movement
      await conn.query(
        `INSERT INTO inventory_movements (inventory_item_id, location_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes)
         VALUES (?, ?, 'adjustment', ?, ?, ?, 'transfer', ?, ?)`,
        [transfer.inventory_item_id, transfer.from_location_id, -Number(transfer.quantity), Number(stockRows[0].stock), newSourceStock, String(req.params.id), `Transfer #${req.params.id} shipped`]
      );

      await conn.query(
        "UPDATE inventory_transfers SET status = 'in_transit' WHERE id = ?",
        [req.params.id]
      );

      await conn.commit();
      await logAudit(pool, req, { action: 'transfer_ship', entityType: 'inventory_transfer', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // PUT receive transfer
  router.put('/:id/receive', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT * FROM inventory_transfers WHERE id = ? AND status = ? FOR UPDATE',
        [req.params.id, 'in_transit']
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Transfer not found or not in transit' });
      }

      const transfer = rows[0];

      // Add stock to destination location
      const [destRows] = await conn.query(
        'SELECT stock FROM inventory WHERE id = ? AND location_id = ? FOR UPDATE',
        [transfer.inventory_item_id, transfer.to_location_id]
      );
      const prevStock = destRows.length ? Number(destRows[0].stock) : 0;
      const newDestStock = prevStock + Number(transfer.quantity);

      if (destRows.length) {
        await conn.query(
          'UPDATE inventory SET stock = ? WHERE id = ? AND location_id = ?',
          [newDestStock, transfer.inventory_item_id, transfer.to_location_id]
        );
      } else {
        // Item doesn't exist at destination yet — create it
        const [itemInfo] = await conn.query('SELECT name, category, unit, low_stock_threshold FROM inventory WHERE id = ?', [transfer.inventory_item_id]);
        if (itemInfo.length) {
          await conn.query(
            'INSERT INTO inventory (id, name, category, unit, stock, low_stock_threshold, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [transfer.inventory_item_id, itemInfo[0].name, itemInfo[0].category, itemInfo[0].unit, newDestStock, itemInfo[0].low_stock_threshold, transfer.to_location_id]
          );
        }
      }

      // Log stock addition movement
      await conn.query(
        `INSERT INTO inventory_movements (inventory_item_id, location_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes)
         VALUES (?, ?, 'adjustment', ?, ?, ?, 'transfer', ?, ?)`,
        [transfer.inventory_item_id, transfer.to_location_id, Number(transfer.quantity), prevStock, newDestStock, String(req.params.id), `Transfer #${req.params.id} received`]
      );

      const staffId = req.staff?.id || null;
      await conn.query(
        "UPDATE inventory_transfers SET status = 'received', received_by = ?, received_at = NOW() WHERE id = ?",
        [staffId, req.params.id]
      );

      await conn.commit();
      await logAudit(pool, req, { action: 'transfer_receive', entityType: 'inventory_transfer', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // PUT cancel transfer
  router.put('/:id/cancel', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT status FROM inventory_transfers WHERE id = ?',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Transfer not found' });
      if (['received', 'cancelled'].includes(rows[0].status)) {
        return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled transfer' });
      }
      await pool.query("UPDATE inventory_transfers SET status = 'cancelled' WHERE id = ?", [req.params.id]);
      await logAudit(pool, req, { action: 'transfer_cancel', entityType: 'inventory_transfer', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
