import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

export default function customersRouter(pool) {
  const router = Router();

  // GET /api/customers — list/search customers
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { search, limit = 50 } = req.query;
      let sql = 'SELECT * FROM customers';
      const values = [];
      if (search) {
        sql += ' WHERE phone LIKE ? OR name LIKE ?';
        values.push(`%${search}%`, `%${search}%`);
      }
      sql += ' ORDER BY total_spent DESC LIMIT ?';
      values.push(Number(limit));
      const [rows] = await pool.query(sql, values);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/top — top customers by order count / spend
  router.get('/top', authMiddleware, async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const [rows] = await pool.query(
        'SELECT * FROM customers ORDER BY total_spent DESC LIMIT ?',
        [Number(limit)]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/:id — single customer
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/:id/orders — order history
  router.get('/:id/orders', authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.pay_method, o.created_at, o.completed_at,
                s.name AS staff_name
         FROM orders o
         LEFT JOIN staff s ON o.staff_id = s.id
         WHERE o.customer_id = ?
         ORDER BY o.created_at DESC`,
        [req.params.id]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers — create or update by phone
  router.post('/', authMiddleware, async (req, res) => {
    const { phone, name, email, notes } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }
    try {
      const normalizedPhone = phone.trim();
      // Upsert: if phone exists, update name/email/notes; otherwise insert
      const [existing] = await pool.query('SELECT id FROM customers WHERE phone = ?', [normalizedPhone]);
      if (existing.length > 0) {
        const fields = [];
        const values = [];
        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (email !== undefined) { fields.push('email = ?'); values.push(email); }
        if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
        if (fields.length > 0) {
          values.push(normalizedPhone);
          await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE phone = ?`, values);
        }
        const [updated] = await pool.query('SELECT * FROM customers WHERE phone = ?', [normalizedPhone]);
        return res.json(updated[0]);
      }
      const [r] = await pool.query(
        'INSERT INTO customers (phone, name, email, notes) VALUES (?, ?, ?, ?)',
        [normalizedPhone, name || null, email || null, notes || null]
      );
      const [inserted] = await pool.query('SELECT * FROM customers WHERE id = ?', [r.insertId]);
      res.json(inserted[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/customers/:id — update customer
  router.put('/:id', authMiddleware, async (req, res) => {
    const { name, email, notes } = req.body;
    try {
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (email !== undefined) { fields.push('email = ?'); values.push(email); }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(req.params.id);
      await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
