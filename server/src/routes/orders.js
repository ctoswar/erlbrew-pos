import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logInventoryMovement } from './inventory.js';

export default function ordersRouter(pool, googleSheets, broadcastEvent) {
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
             mi.name AS menu_item_name, mi.category, mi.emoji, mi.badge,
             JSON_ARRAYAGG(
               CASE WHEN oim.id IS NOT NULL
                 THEN JSON_OBJECT('name', oim.modifier_name, 'price', oim.modifier_price)
                 ELSE NULL
               END
             ) AS modifiers
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
      WHERE oi.order_id IN (?)
      GROUP BY oi.id
    `, [orderIds]);
    // Parse modifiers JSON and filter out nulls
    const result = [];
    for (const item of items) {
      const modifiers = (() => {
        try { const p = JSON.parse(item.modifiers); return Array.isArray(p) ? p.filter(Boolean) : []; }
        catch { return []; }
      })();
      result.push({ ...item, modifiers });
    }
    return result;
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
               o.customer_name, o.table_name, o.type, o.pay_method, o.reference_number,
               o.created_at, o.completed_at,
               s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
        FROM orders o
        LEFT JOIN staff s ON o.staff_id = s.id
        ORDER BY o.created_at DESC
      `);
      // Log for first order with reference
      const orderWithRef = rows.find(r => r.reference_number);
      if (orderWithRef) {
        console.log('[DEBUG GET] Order with ref found:', orderWithRef.id, 'reference_number:', orderWithRef.reference_number);
      }
      const ids = rows.map(r => r.id);
      const items = ids.length ? await fetchOrderItems(ids) : [];
      const response = attachItems(rows, items);
      // Log first item of response
      const firstWithRef = response.find(r => r.reference_number);
      if (firstWithRef) {
        console.log('[DEBUG GET] Response item with ref:', firstWithRef.id, 'reference_number:', firstWithRef.reference_number);
      }
      res.json(response);
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
               o.customer_name, o.table_name, o.type, o.pay_method, o.reference_number,
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

  // GET /history — paginated order history with search, date range, status filter
  router.get('/history', async (req, res) => {
    try {
      const { start, end, search, status, limit = 50, offset = 0 } = req.query;
      const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 500);
      const off = Math.max(parseInt(String(offset), 10) || 0, 0);

      const conditions = [];
      const params = [];

      if (start) {
        conditions.push('o.created_at >= ?');
        params.push(start);
      }
      if (end) {
        conditions.push('o.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(end);
      }
      if (status) {
        conditions.push('o.status = ?');
        params.push(status);
      }
      if (search) {
        conditions.push('(o.id LIKE ? OR s.name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      if (conditions.length === 0) {
        // Default: last 30 days
        const d = new Date();
        d.setDate(d.getDate() - 30);
        conditions.push('o.created_at >= ?');
        params.push(d.toISOString().slice(0, 10));
      }

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM orders o LEFT JOIN staff s ON o.staff_id = s.id ${where}`,
        params
      );

      const [rows] = await pool.query(`
        SELECT o.id, o.status, o.subtotal, o.tax, o.total,
               o.customer_name, o.table_name, o.type, o.pay_method, o.reference_number,
               o.created_at, o.completed_at,
               s.name AS staff_name, s.initials AS staff_initials,
               s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
        FROM orders o
        LEFT JOIN staff s ON o.staff_id = s.id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, lim, off]);

      const ids = rows.map(r => r.id);
      const items = ids.length ? await fetchOrderItems(ids) : [];

      res.json({
        orders: attachItems(rows, items),
        total: Number(total),
        limit: lim,
        offset: off,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Create order and append to Google Sheets (public) -> now protected by auth
  router.post('/', authMiddleware, async (req, res) => {
    const { staff_id, staff_name, items, type, customer_name, table_name, pay_method, reference_number } = req.body;
    console.log('[DEBUG] Order request - pay_method:', pay_method, 'reference_number:', JSON.stringify(reference_number));
    console.log('[DEBUG] Full body keys:', Object.keys(req.body).join(', '));
    console.log('[DEBUG] Full body:', JSON.stringify(req.body).substring(0, 500));
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
      for (const it of itemsOut) {
        const modifierTotal = (it.modifiers || []).reduce((s, m) => s + (Number(m.price) || 0), 0);
        subtotal += ((Number(it.price) || 0) + modifierTotal) * (Number(it.qty) || 0);
      }
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
        'INSERT INTO orders (id, staff_id, status, subtotal, tax, total, customer_name, table_name, type, pay_method, reference_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, staffDbId, 'preparing', subtotal, tax, total, customer_name || null, table_name || null, type || 'dine-in', pay_method || 'cash', reference_number || null]
      );
      console.log('[DEBUG] DB INSERT completed - id:', id, 'reference_number in DB:', reference_number);
      for (const it of itemsOut) {
        const [itemResult] = await pool.query(
          'INSERT INTO order_items (order_id, menu_item_id, qty, notes, price) VALUES (?, ?, ?, ?, ?)',
          [id, it.id, it.qty, it.notes || '', it.price]
        );
        const orderItemId = itemResult.insertId;
        // Insert modifiers for this order item
        if (it.modifiers && it.modifiers.length > 0) {
          const modifierVals = it.modifiers.map(m => [orderItemId, m.name, Number(m.price) || 0]);
          await pool.query(
            'INSERT INTO order_item_modifiers (order_item_id, modifier_name, modifier_price) VALUES ?',
            [modifierVals]
          );
        }
      }

      // Verify the insert
      const [verify] = await pool.query('SELECT reference_number FROM orders WHERE id = ?', [id]);
      console.log('[DEBUG] DB verify - reference_number:', verify[0]?.reference_number);

      if (googleSheets) {
        try {
          console.log('[DEBUG] About to call googleSheets.appendOrder with referenceNumber:', reference_number);
          await googleSheets.appendOrder({ orderId: id, staffName: staff_name || '', items: itemsOut, subtotal, tax, total, payMethod: pay_method, referenceNumber: reference_number, status: 'preparing' });
          console.log('[DEBUG] googleSheets.appendOrder SUCCESS - no error thrown');
        } catch (e) {
          console.error('Sheets write failed:', e.message, e.stack);
        }
      } else {
        console.log('[DEBUG] googleSheets is NULL/FALSE - not calling');
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
              const stockBefore = Number(recipe.stock);
              const newStock = stockBefore - deduction;
              const [updateResult] = await conn.query(
                "UPDATE inventory SET stock = ? WHERE id = ? AND stock >= ?",
                [newStock, recipe.inventory_item_id, deduction]
              );
              // Only log movement if the update actually changed rows (means stock was sufficient)
              if (updateResult.affectedRows > 0) {
                const stockAfter = Math.max(0, newStock);
                await logInventoryMovement(pool, {
                  inventory_item_id: recipe.inventory_item_id,
                  movement_type: 'sale',
                  quantity: deduction,
                  stock_before: stockBefore,
                  stock_after: stockAfter,
                  reference_type: 'order',
                  reference_id: id,
                  notes: null,
                });
              }
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

    // ── Log cash drawer sale transaction if cash payment ────────────────────
    if (pay_method === 'cash' && total > 0) {
      try {
        const today = toMysqlDate(new Date());
        const [drawers] = await pool.query(
          'SELECT id, opening_float, cash_sales, cash_payouts FROM cash_drawer WHERE shift_date = ? AND status = "open" LIMIT 1',
          [today]
        );
        if (drawers.length) {
          const drawer = drawers[0];
          const balanceBefore = Number(drawer.opening_float) + Number(drawer.cash_sales) - Number(drawer.cash_payouts);
          const balanceAfter = balanceBefore + total;
          await pool.query(
            `INSERT INTO cash_drawer_transactions (drawer_id, transaction_type, amount, balance_before, balance_after, reason, staff_name)
             VALUES (?, 'sale', ?, ?, ?, ?, ?)`,
            [drawer.id, total, balanceBefore, balanceAfter, `Order #${id.slice(0, 8).toUpperCase()}`, staff_name || null]
          );
          // Update cash_sales on the drawer
          const newSales = Number(drawer.cash_sales) + total;
          await pool.query('UPDATE cash_drawer SET cash_sales = ? WHERE id = ?', [newSales, drawer.id]);
        }
      } catch (e) {
        console.error('Failed to log cash sale transaction:', e);
      }
    }

    // Broadcast new order to all SSE clients
    if (broadcastEvent) {
      try {
        const [rows] = await pool.query(`
          SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.table_name, o.type, o.pay_method,
                 o.reference_number, o.created_at,
                 s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
          FROM orders o LEFT JOIN staff s ON o.staff_id = s.id WHERE o.id = ?`, [id]);
        if (rows[0]) {
          broadcastEvent('order:created', rows[0]);
        }
      } catch (e) { /* non-fatal */ }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

  // PUT /api/orders/:id/status — update order status (e.g., preparing→ready→completed)
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

    // Broadcast status change to all SSE clients
    if (broadcastEvent) {
      try {
        const [rows] = await pool.query(`
          SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.table_name, o.type, o.pay_method,
                 o.reference_number, o.created_at, o.completed_at,
                 s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
          FROM orders o LEFT JOIN staff s ON o.staff_id = s.id WHERE o.id = ?`, [id]);
        if (rows[0]) {
          broadcastEvent('order:updated', rows[0]);
        }
      } catch (e) { /* non-fatal */ }
    }
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete / void order (admin only — removes from kitchen board)
// Clear all orders + related data (admin only - for fresh start)
  // MUST be defined BEFORE /:id or Express will match 'all' as an id param
  router.delete('/all', authMiddleware, adminMiddleware, async (req, res) => {
    console.log('[DELETE /orders/all] HIT! User:', req.user?.name, 'Role:', req.user?.role);
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query('DELETE FROM order_item_modifiers');
      await pool.query('DELETE FROM order_items');
      await pool.query('DELETE FROM orders');
      await pool.query('DELETE FROM supplier_invoice_items');
      await pool.query('DELETE FROM supplier_invoices');
      await pool.query('DELETE FROM cash_drawer_transactions');
      await pool.query('DELETE FROM cash_drawer');
      await pool.query('DELETE FROM inventory_movements');
      await pool.query('DELETE FROM z_reports');
      await pool.query('DELETE FROM time_records');
      await pool.query('DELETE FROM recipes');
      await pool.query('DELETE FROM menu_modifiers');
      await pool.query('DELETE FROM menu_items');
      await pool.query('DELETE FROM inventory');
      await pool.query('DELETE FROM company_settings');
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      return res.json({ ok: true, message: 'Fresh start complete — all data cleared except staff accounts. Re-seed menu items and inventory on next restart.' });
    } catch (e) {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (typeof id !== 'string' || id.length < 1) {
      return res.status(400).json({ error: 'Invalid order id' });
    }
    try {
      // Broadcast void before actual deletion so clients can react
      if (broadcastEvent) {
        try {
          const [rows] = await pool.query('SELECT id FROM orders WHERE id = ?', [id]);
          if (rows[0]) {
            broadcastEvent('order:voided', { id });
          }
        } catch (e) { /* non-fatal */ }
      }
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

  // Reset COGS data - sets totals = subtotals AND resets inventory costs to 0
  router.post('/cogs/reset', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { start, end, resetAll } = req.body;

      // First, reset all inventory costs to 0 (this makes all future COGS calculations = 0)
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        const costFieldsExist = Array.isArray(cols) && cols.length >= 2;
        if (costFieldsExist) {
          await pool.query('UPDATE inventory SET purchase_cost = 0, unit_cost = 0');
        }
      } catch (e) {
        console.error('Failed to reset inventory costs:', e);
      }

      // Then set all order totals = subtotals (makes profit = 0 for past orders)
      if (resetAll) {
        await pool.query(`
          UPDATE orders
          SET total = subtotal
          WHERE subtotal IS NOT NULL AND subtotal > 0
        `);
        return res.json({ ok: true, message: 'All COGS and inventory costs reset' });
      }

      if (start && end) {
        await pool.query(`
          UPDATE orders
          SET total = subtotal
          WHERE subtotal IS NOT NULL AND subtotal > 0
            AND DATE(created_at) >= ? AND DATE(created_at) <= ?
        `, [start, end]);
        return res.json({ ok: true, message: `COGS and costs reset for ${start} to ${end}` });
      }

      res.status(400).json({ error: 'Provide start/end dates or resetAll=true' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/orders/:id/void — admin only
  router.post('/:id/void', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'void reason is required' });
    }
    try {
      await pool.query('UPDATE orders SET status = ?, void_reason = ? WHERE id = ?', ['voided', reason.trim(), id]);

      // Restore inventory — reverse the order's recipe deductions
      try {
        const [orderItems] = await pool.query(
          'SELECT menu_item_id, qty FROM order_items WHERE order_id = ?', [id]
        );
        if (orderItems.length > 0) {
          const itemQtyMap = {};
          for (const oi of orderItems) { itemQtyMap[oi.menu_item_id] = (itemQtyMap[oi.menu_item_id] || 0) + Number(oi.qty); }
          const menuItemIds = Object.keys(itemQtyMap);

          const [recipes] = await pool.query(
            `SELECT r.menu_item_id, r.inventory_item_id, r.quantity, i.stock
             FROM recipes r JOIN inventory i ON i.id = r.inventory_item_id
             WHERE r.menu_item_id IN (?)`, [menuItemIds]
          );

          for (const recipe of recipes) {
            const qtyOrdered = itemQtyMap[recipe.menu_item_id] || 0;
            const restoreQty = recipe.quantity * qtyOrdered;
            if (restoreQty > 0) {
              const stockBefore = Number(recipe.stock);
              const stockAfter = stockBefore + restoreQty;
              await pool.query('UPDATE inventory SET stock = ? WHERE id = ?', [stockAfter, recipe.inventory_item_id]);
              await logInventoryMovement(pool, {
                inventory_item_id: recipe.inventory_item_id,
                movement_type: 'void',
                quantity: restoreQty,
                stock_before: stockBefore,
                stock_after: stockAfter,
                reference_type: 'order',
                reference_id: id,
                notes: `Void restored stock: ${reason.trim()}`,
              });
            }
          }
        }
      } catch (e) {
        console.error('Inventory restore on void failed (order still voided):', e);
      }

      if (broadcastEvent) {
        broadcastEvent('order:voided', { id, reason: reason.trim() });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/orders/:id/refund — admin only
  router.post('/:id/refund', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'refund reason is required' });
    }
    try {
      await pool.query('UPDATE orders SET status = ?, refund_reason = ? WHERE id = ?', ['refunded', reason.trim(), id]);
      if (broadcastEvent) {
        broadcastEvent('order:updated', { id, status: 'refunded' });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Helper for MySQL DATETIME format
  function toMysqlDT(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // Helper
  function toMysqlDT(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ── Reusable Z-Report generator (used by route AND cron) ──────────────────
  // targetDate: YYYY-MM-DD string. Defaults to today if omitted.
  async function buildZReportData(pool, targetDate) {
    const now = new Date();

    let periodStart, periodEnd, reportDateStr;
    if (targetDate) {
      // Cron: cover the full day 00:00:00 → 23:59:59 of the target date
      periodStart = new Date(targetDate + 'T00:00:00');
      periodEnd = new Date(targetDate + 'T23:59:59');
      reportDateStr = targetDate;
    } else {
      // Manual trigger: today from midnight to now
      reportDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      periodStart = new Date(`${reportDateStr}T00:00:00`);
      periodEnd = now;
    }

    const periodStartStr = toMysqlDT(periodStart);
    const periodEndStr = toMysqlDT(periodEnd);
    const [salesRows] = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN pay_method = 'cash' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN pay_method = 'card' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN pay_method = 'ewallet' THEN total ELSE 0 END), 0) AS total_ewallet
      FROM orders WHERE DATE(created_at) = ${targetDate ? '?' : 'CURDATE()'} AND status = 'completed'
    `, targetDate ? [targetDate] : []);
    const [refundRows] = await pool.query(`
      SELECT COUNT(*) AS total_refunds, COALESCE(SUM(total), 0) AS refund_total
      FROM orders WHERE DATE(created_at) = ${targetDate ? '?' : 'CURDATE()'} AND status = 'refunded'
    `, targetDate ? [targetDate] : []);
    const [voidRows] = await pool.query(`
      SELECT COUNT(*) AS total_voids FROM orders WHERE DATE(created_at) = ${targetDate ? '?' : 'CURDATE()'} AND status = 'voided'
    `, targetDate ? [targetDate] : []);
    const [cogsRows] = await pool.query(`
      SELECT COALESCE(SUM(oi.qty * i.unit_cost), 0) AS total_cogs
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN inventory i ON m.id = i.id
      WHERE DATE(o.created_at) = ${targetDate ? '?' : 'CURDATE()'} AND o.status = 'completed' AND i.unit_cost > 0
    `, targetDate ? [targetDate] : []);

    const totalSales = Number(salesRows[0]?.total_sales) || 0;
    const totalCOGS = Number(cogsRows[0]?.total_cogs) || 0;
    const grossProfit = totalSales - totalCOGS;

    return {
      staff_id: null,
      report_date: reportDateStr,
      period_start: periodStartStr,
      period_end: periodEndStr,
      total_sales: totalSales,
      total_orders: Number(salesRows[0]?.total_orders) || 0,
      total_cash: Number(salesRows[0]?.total_cash) || 0,
      total_card: Number(salesRows[0]?.total_card) || 0,
      total_ewallet: Number(salesRows[0]?.total_ewallet) || 0,
      total_refunds: Number(refundRows[0]?.refund_total) || 0,
      total_voids: Number(voidRows[0]?.total_voids) || 0,
      total_cogs: totalCOGS,
      gross_profit: grossProfit,
    };
  }

  // POST /api/orders/z-report — generate Z-Report for today
  router.post('/z-report', async (req, res) => {
    try {
      const report = await buildZReportData(pool);
      const [ins] = await pool.query(`
        INSERT INTO z_reports (staff_id, report_date, period_start, period_end, total_sales, total_orders,
          total_cash, total_card, total_ewallet, total_refunds, total_voids, total_cogs, gross_profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [report.staff_id, report.report_date, report.period_start, report.period_end,
          report.total_sales, report.total_orders, report.total_cash, report.total_card,
          report.total_ewallet, report.total_refunds, report.total_voids, report.total_cogs, report.gross_profit]);
      report.id = ins.insertId;
      res.json(report);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/orders/z-reports — retrieve recent Z-Reports
  router.get('/z-reports', async (req, res) => {
    const limit = parseInt(String(req.query.limit || '10'), 10);
    try {
      const [rows] = await pool.query(
        'SELECT * FROM z_reports ORDER BY printed_at DESC LIMIT ?',
        [limit]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // ── Cash Drawer ──────────────────────────────────────────────────────────

  // Helper
  function toMysqlDate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // GET /api/orders/cash-drawer — today's open drawer or null
  router.get('/cash-drawer', async (req, res) => {
    try {
      const today = toMysqlDate(new Date());
      const [rows] = await pool.query(
        'SELECT * FROM cash_drawer WHERE shift_date = ? AND status = "open" LIMIT 1',
        [today]
      );
      if (rows.length) return res.json(rows[0]);

      // Auto-calculate today's cash sales from completed cash orders
      const [cashRows] = await pool.query(`
        SELECT COALESCE(SUM(total), 0) AS cash_sales
        FROM orders
        WHERE DATE(created_at) = CURDATE() AND status = 'completed' AND pay_method = 'cash'
      `);

      res.json({
        id: null,
        shift_date: today,
        status: 'open',
        opening_float: 0,
        cash_sales: Number(cashRows[0]?.cash_sales) || 0,
        cash_payouts: 0,
        closing_amount: 0,
        expected_amount: 0,
        variance: 0,
        notes: '',
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/orders/cash-drawer — open (create) today's drawer
  router.post('/cash-drawer', async (req, res) => {
    try {
      const today = toMysqlDate(new Date());
      const { opening_float = 0 } = req.body || {};
      // Close any existing open drawers for today
      await pool.query('UPDATE cash_drawer SET status = "closed", closed_at = NOW() WHERE shift_date = ? AND status = "open"', [today]);
      // Create new open drawer
      const [ins] = await pool.query(`
        INSERT INTO cash_drawer (shift_date, status, opening_float, expected_amount)
        VALUES (?, 'open', ?, ?)
      `, [today, opening_float, opening_float]);
      const [rows] = await pool.query('SELECT * FROM cash_drawer WHERE id = ?', [ins.insertId]);
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/orders/cash-drawer/:id — update/close drawer
  router.put('/cash-drawer/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { closing_amount, cash_payouts, notes, action } = req.body || {};
      const [rows] = await pool.query('SELECT * FROM cash_drawer WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Drawer not found' });
      const drawer = rows[0];
      const closing = Number(closing_amount) || 0;
      const payouts = Number(cash_payouts) || 0;
      const expected = Number(drawer.opening_float) + Number(drawer.cash_sales) - payouts;
      const variance = closing - expected;
      const status = action === 'close' ? 'closed' : 'open';
      const closedAt = action === 'close' ? 'NOW()' : 'NULL';
      await pool.query(`
        UPDATE cash_drawer SET
          closing_amount = ?, cash_payouts = ?, expected_amount = ?, variance = ?,
          status = ?, closed_at = ${closedAt}, notes = ?
        WHERE id = ?
      `, [closing, payouts, expected, variance, status, notes || '', id]);
      const [updated] = await pool.query('SELECT * FROM cash_drawer WHERE id = ?', [id]);
      res.json(updated[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/orders/cash-drawer/transactions — list transactions for today's drawer
  router.get('/cash-drawer/transactions', async (req, res) => {
    try {
      const today = toMysqlDate(new Date());
      const [drawers] = await pool.query(
        'SELECT id FROM cash_drawer WHERE shift_date = ? ORDER BY id DESC LIMIT 1',
        [today]
      );
      if (!drawers.length) return res.json([]);
      const [rows] = await pool.query(
        'SELECT * FROM cash_drawer_transactions WHERE drawer_id = ? ORDER BY created_at DESC LIMIT 200',
        [drawers[0].id]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/orders/cash-drawer/transactions — record a cash in/out entry
  router.post('/cash-drawer/transactions', async (req, res) => {
    try {
      const { transaction_type, amount, reason, staff_name } = req.body;
      if (!transaction_type || !['cash_in', 'cash_out'].includes(transaction_type)) {
        return res.status(400).json({ error: 'transaction_type must be cash_in or cash_out' });
      }
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }

      const today = toMysqlDate(new Date());
      const [drawers] = await pool.query(
        'SELECT id, opening_float, cash_sales, cash_payouts FROM cash_drawer WHERE shift_date = ? AND status = "open" LIMIT 1',
        [today]
      );
      if (!drawers.length) {
        return res.status(400).json({ error: 'No open cash drawer for today. Open a shift first.' });
      }

      const drawer = drawers[0];
      const balanceBefore = Number(drawer.opening_float) + Number(drawer.cash_sales) - Number(drawer.cash_payouts);
      const balanceAfter = transaction_type === 'cash_in'
        ? balanceBefore + amount
        : balanceBefore - amount;

      await pool.query(
        `INSERT INTO cash_drawer_transactions (drawer_id, transaction_type, amount, balance_before, balance_after, reason, staff_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [drawer.id, transaction_type, amount, balanceBefore, balanceAfter, reason || null, staff_name || null]
      );

      // Update drawer running totals
      if (transaction_type === 'cash_out') {
        const newPayouts = Number(drawer.cash_payouts) + amount;
        await pool.query('UPDATE cash_drawer SET cash_payouts = ? WHERE id = ?', [newPayouts, drawer.id]);
      }

      // Fetch the inserted transaction
      const [rows] = await pool.query(
        'SELECT * FROM cash_drawer_transactions WHERE drawer_id = ? ORDER BY created_at DESC LIMIT 1',
        [drawer.id]
      );

      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return { buildZReportData, router };
}
