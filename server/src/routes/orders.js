import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';

export default function ordersRouter(pool, googleSheets) {
  const router = express.Router();

  // Simple input-validation helper (per FIX 5)
  function validate(req, res, rules){
    for (const [field, check] of Object.entries(rules||{})){
      const val = req.body?.[field];
      if (check?.required && (val === undefined || val === null || val === '')) {
        return res.status(400).json({ error: `${field} is required` });
      }
      if (check?.type && typeof val !== check.type) {
        return res.status(400).json({ error: `${field} must be a ${check.type}` });
      }
      if (check?.enum && !check.enum.includes(val)) {
        return res.status(400).json({ error: `${field} must be one of: ${check.enum.join(', ')}` });
      }
      if (check?.minLen && typeof val === 'string' && val.length < check.minLen) {
        return res.status(400).json({ error: `${field} must be at least ${check.minLen} characters` });
      }
      if (check?.maxLen && typeof val === 'string' && val.length > check.maxLen) {
        return res.status(400).json({ error: `${field} must be at most ${check.maxLen} characters` });
      }
      if (check?.positive && typeof val === 'number' && val <= 0) {
        return res.status(400).json({ error: `${field} must be positive` });
      }
      if (check?.nonNeg && typeof val === 'number' && val < 0) {
        return res.status(400).json({ error: `${field} must be non-negative` });
      }
      if (check?.array && !Array.isArray(val)) {
        return res.status(400).json({ error: `${field} must be an array` });
      }
    }
    return null;
  }

  // Helper: fetch order_items for a list of order IDs
  async function fetchOrderItems(orderIds) {
    if (!orderIds.length) return [];
    const [items] = await pool.query(`
      SELECT oi.order_id, oi.menu_item_id, oi.qty, oi.notes, oi.price,
             mi.name AS menu_item_name, mi.category, mi.emoji, mi.badge
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id IN (?)
    `, [orderIds]);
    return items;
  }

  // Helper: attach items to orders
  function attachItems(orders, items) {
    const itemMap = {};
    for (const it of items) {
      if (!itemMap[it.order_id]) itemMap[it.order_id] = [];
      itemMap[it.order_id].push(it);
    }
    return orders.map(o => ({ ...o, items: itemMap[o.id] || [] }));
  }

  // GET all orders (public - for kitchen/dashboard)
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT o.id, o.status, o.subtotal, o.tax, o.total,
               o.table_name, o.type, o.pay_method,
               o.created_at, o.completed_at,
               s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
        FROM orders o
        LEFT JOIN staff s ON o.staff_id = s.id
        ORDER BY o.created_at DESC
      `);
      const ids = rows.map(r => r.id);
      const items = ids.length ? await fetchOrderItems(ids) : [];
      res.json(attachItems(rows, items));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET today's orders (public)
  router.get('/today', async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT o.id, o.status, o.subtotal, o.tax, o.total,
               o.table_name, o.type, o.pay_method,
               o.created_at, o.completed_at,
               s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
        FROM orders o
        LEFT JOIN staff s ON o.staff_id = s.id
        WHERE DATE(o.created_at) = CURDATE()
        ORDER BY o.created_at DESC
      `);
      const ids = rows.map(r => r.id);
      const items = ids.length ? await fetchOrderItems(ids) : [];
      res.json(attachItems(rows, items));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Create order and append to Google Sheets (public) -> now protected by auth
  router.post('/', authMiddleware, async (req, res) => {
    const { staff_id, staff_name, items, type, table_name, pay_method } = req.body;
    // Validation per FIX 5
    const err = validate(req, res, {
      items: { required: true, type: 'object', array: true },
      type: { enum: ['dine-in', 'takeout'] },
      pay_method: { enum: ['cash', 'card', 'ewallet'] },
    });
    if (err) return err;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items must be a non-empty array' });
    for (const it of items) {
      if (typeof it.id !== 'string' || it.id.length > 64) return res.status(400).json({ error: 'Each item id must be a string up to 64 chars' });
      if (!Number.isInteger(it.qty) || it.qty <= 0) return res.status(400).json({ error: 'Each item qty must be a positive integer' });
      if (typeof it.price !== 'number' || it.price < 0) return res.status(400).json({ error: 'Each item price must be a non-negative number' });
    }
    try {
      let subtotal = 0;
      const itemsOut = items || [];
      for (const it of itemsOut) subtotal += (Number(it.price) || 0) * (Number(it.qty) || 0);
const tax = 0;
    const total = subtotal;
      const id = uuidv4();

      // Look up staff id from rfid if provided
      let staffDbId = null;
      if (staff_id) {
        const [staffRows] = await pool.query('SELECT id FROM staff WHERE rfid = ?', [staff_id]);
        if (staffRows.length) staffDbId = staffRows[0].id;
      }

      await pool.query(
        'INSERT INTO orders (id, staff_id, status, subtotal, tax, total, table_name, type, pay_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, staffDbId, 'preparing', subtotal, tax, total, table_name || null, type || 'dine-in', pay_method || 'cash']
      );
      for (const it of itemsOut) {
        await pool.query('INSERT INTO order_items (order_id, menu_item_id, qty, notes, price) VALUES (?, ?, ?, ?, ?)', [id, it.id, it.qty, it.notes || '', it.price]);
      }

if (googleSheets) {
      try {
        await googleSheets.appendOrder({ orderId: id, staffName: staff_name || '', items: itemsOut, subtotal, tax, total, payMethod: pay_method, status: 'preparing' });
      } catch (e) {
        console.error('Sheets write failed', e);
      }
    }

    // ── Auto-deduct inventory based on recipes ───────────────────────────────
    try {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        // Collect all menu_item_ids and their ordered quantities
        const itemQtyMap = {};
        for (const it of itemsOut) { itemQtyMap[it.id] = (itemQtyMap[it.id] || 0) + (Number(it.qty) || 0); }
        const menuItemIds = Object.keys(itemQtyMap);

        if (menuItemIds.length > 0) {
          // Fetch all recipes for ordered menu items in one query
          const [recipes] = await conn.query(
            `SELECT r.menu_item_id, r.inventory_item_id, r.quantity,
                    i.stock, i.low_stock_threshold
             FROM recipes r
             JOIN inventory i ON i.id = r.inventory_item_id
             WHERE r.menu_item_id IN (?)`,
            [menuItemIds]
          );

          // Deduct stock — skip if not enough stock (log warning, don't fail order)
          for (const recipe of recipes) {
            const qtyOrdered = itemQtyMap[recipe.menu_item_id] || 0;
            const deduction = recipe.quantity * qtyOrdered;
            if (deduction > 0) {
              const newStock = Number(recipe.stock) - deduction;
              await conn.query(
                "UPDATE inventory SET stock = ? WHERE id = ? AND stock >= ?",
                [newStock, recipe.inventory_item_id, deduction]
              );
              // If stock went below threshold, log it (could notify via webhook later)
              if (newStock <= Number(recipe.low_stock_threshold)) {
                console.warn(`[LOW STOCK] ${recipe.inventory_item_id}: ${newStock} remaining`);
              }
            }
          }
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        console.error('Inventory deduction failed (order still placed):', e);
      } finally {
        conn.release();
      }
    } catch (e) {
      // Never fail the order if inventory deduction fails
      console.error('Inventory deduction error:', e);
    }

    res.json({ id, subtotal, tax, total, status: 'preparing' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

// Update order status (admin only)
router.put('/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['pending','preparing','ready','completed'];
  if (typeof id !== 'string' || id.length < 1) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    await pool.query('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?', [status, status === 'completed' ? new Date() : null, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete / void order (admin only — removes from kitchen board)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (typeof id !== 'string' || id.length < 1) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  try {
    await pool.query('DELETE FROM order_items WHERE order_id = ?', [id]);
    await pool.query('DELETE FROM orders WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

  // New: Cost of Goods Sold (COGS) endpoint
  router.get('/cogs', authMiddleware, async (req, res) => {
    try {
      const { start, end } = req.query;
      const today = new Date();
      const toDate = (d) => {
        const dt = d ? new Date(d) : today;
        dt.setHours(0, 0, 0, 0);
        return dt.toISOString().slice(0, 10);
      };
      const startStr = toDate(start);
      const endStr = toDate(end);

      // Check if purchase_cost column exists in inventory table
      let costColumnsExist = false;
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        costColumnsExist = Array.isArray(cols) && cols.length >= 2;
      } catch (_) {
        costColumnsExist = false;
      }

      // If migration not yet applied, return zeros instead of crashing
      if (!costColumnsExist) {
        return res.json({
          cogs: 0,
          orderCount: 0,
          start: startStr,
          end: endStr,
          details: [],
          warning: 'Cost columns not yet migrated. Run the init.sql migration to enable COGS.',
        });
      }

      // 1) Total COGS in range
      const sqlCogs = `SELECT COALESCE(SUM(oi.qty * r.quantity * i.purchase_cost), 0) AS cogs
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN recipes r ON oi.menu_item_id = r.menu_item_id
        JOIN inventory i ON r.inventory_item_id = i.id
        WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
      const [tot] = await pool.query(sqlCogs, [startStr, endStr]);
      const cogs = Number((tot && tot[0] && tot[0].cogs) || 0);

      // 2) Count of orders in range
      const sqlCount = `SELECT COUNT(*) AS count
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
      const [cnt] = await pool.query(sqlCount, [startStr, endStr]);
      const orderCount = Number((cnt && cnt[0] && cnt[0].count) || 0);

      // 3) Per-order breakdown (total, cogs, profit)
      const sqlDetails = `SELECT o.id AS order_id, o.total AS total,
        SUM(oi.qty * r.quantity * i.purchase_cost) AS cogs
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN recipes r ON oi.menu_item_id = r.menu_item_id
        JOIN inventory i ON r.inventory_item_id = i.id
        WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY o.id`;
      const [detailsRows] = await pool.query(sqlDetails, [startStr, endStr]);
      const details = (detailsRows || []).map(r => {
        const total = Number(r.total) || 0;
        const c = Number(r.cogs) || 0;
        return {
          order_id: r.order_id,
          total,
          cogs: c,
          profit: total - c,
        };
      });

      res.json({ cogs, orderCount, start: startStr, end: endStr, details });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
