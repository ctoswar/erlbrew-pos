import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { customerAuthMiddleware } from '../middleware/customerAuth.js';
import { logAudit } from '../services/audit.js';

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
        await logAudit(pool, req, { action: 'customer_update', entityType: 'customer', entityId: String(existing[0].id), details: { phone: normalizedPhone, name } });
        return res.json(updated[0]);
      }
      const [r] = await pool.query(
        'INSERT INTO customers (phone, name, email, notes) VALUES (?, ?, ?, ?)',
        [normalizedPhone, name || null, email || null, notes || null]
      );
      const [inserted] = await pool.query('SELECT * FROM customers WHERE id = ?', [r.insertId]);
      await logAudit(pool, req, { action: 'customer_create', entityType: 'customer', entityId: String(r.insertId), details: { phone: normalizedPhone, name } });
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
      await logAudit(pool, req, { action: 'customer_update', entityType: 'customer', entityId: req.params.id });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // ── Customer Auth Endpoints ──────────────────────────────────────────

  // POST /api/customers/register — Create customer account
  router.post('/register', async (req, res) => {
    const { phone, name, email, password } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    try {
      const normalizedPhone = phone.trim();
      // Check if phone already exists
      const [existing] = await pool.query('SELECT id FROM customers WHERE phone = ?', [normalizedPhone]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      // Create customer
      const [r] = await pool.query(
        'INSERT INTO customers (phone, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [normalizedPhone, name || null, email || null, passwordHash]
      );
      // Generate JWT
      const token = jwt.sign(
        { sub: r.insertId, phone: normalizedPhone, name: name || '', customer: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      const [inserted] = await pool.query(
        'SELECT id, phone, name, email, loyalty_points, loyalty_tier, created_at FROM customers WHERE id = ?',
        [r.insertId]
      );
      await logAudit(pool, req, { action: 'customer_register', entityType: 'customer', entityId: String(r.insertId), details: { phone: normalizedPhone, name } });
      res.json({ token, customer: inserted[0] });
    } catch (e) {
      console.error('Customer register error:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers/login — Customer login
  router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }
    try {
      const normalizedPhone = phone.trim();
      const [rows] = await pool.query(
        'SELECT id, phone, name, email, password_hash, loyalty_points, loyalty_tier, created_at FROM customers WHERE phone = ?',
        [normalizedPhone]
      );
      if (!rows.length) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const customer = rows[0];
      // Verify password
      if (!customer.password_hash) {
        return res.status(401).json({ error: 'Account not set up with password. Please register.' });
      }
      const ok = await bcrypt.compare(password, customer.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      // Generate JWT
      const token = jwt.sign(
        { sub: customer.id, phone: customer.phone, name: customer.name || '', customer: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      // Remove password_hash from response
      const { password_hash, ...customerData } = customer;
      await logAudit(pool, req, { action: 'customer_login', entityType: 'customer', entityId: String(customer.id), details: { phone: normalizedPhone } });
      res.json({ token, customer: customerData });
    } catch (e) {
      console.error('Customer login error:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/me — Get current customer profile (requires customer auth)
  router.get('/me', customerAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, phone, name, email, loyalty_points, loyalty_tier, last_points_update, total_orders, total_spent, created_at FROM customers WHERE id = ?',
        [req.customer.sub]
      );
      if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/customers/me — Update current customer profile
  router.put('/me', customerAuthMiddleware, async (req, res) => {
    const { name, email } = req.body;
    try {
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (email !== undefined) { fields.push('email = ?'); values.push(email); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(req.customer.sub);
      await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      const [rows] = await pool.query(
        'SELECT id, phone, name, email, loyalty_points, loyalty_tier, total_orders, total_spent, created_at FROM customers WHERE id = ?',
        [req.customer.sub]
      );
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/me/points — Get points balance + history
  router.get('/me/points', customerAuthMiddleware, async (req, res) => {
    try {
      const [customer] = await pool.query(
        'SELECT loyalty_points, loyalty_tier FROM customers WHERE id = ?',
        [req.customer.sub]
      );
      if (!customer.length) return res.status(404).json({ error: 'Customer not found' });

      const [history] = await pool.query(
        `SELECT id, points, type, reference_type, reference_id, notes, created_at
         FROM loyalty_points_log
         WHERE customer_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.customer.sub]
      );

      res.json({
        points: customer[0].loyalty_points,
        tier: customer[0].loyalty_tier,
        history,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/me/orders — Order history for current customer
  router.get('/me/orders', customerAuthMiddleware, async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const [rows] = await pool.query(
        `SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.pay_method, o.created_at, o.completed_at,
                s.name AS staff_name
         FROM orders o
         LEFT JOIN staff s ON o.staff_id = s.id
         WHERE o.customer_id = ?
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.customer.sub, Number(limit), Number(offset)]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
