import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export default function locationsRouter(pool) {
  const router = Router();

  // GET all locations (public — needed for selector)
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, address, phone, email, timezone, is_active, is_default, created_at FROM locations ORDER BY is_default DESC, name ASC'
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET single location
  router.get('/:id', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Location not found' });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST create location (admin only)
  router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { name, address, phone, email, timezone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    try {
      const [result] = await pool.query(
        'INSERT INTO locations (name, address, phone, email, timezone) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), address || null, phone || null, email || null, timezone || 'Asia/Manila']
      );
      await logAudit(pool, req, { action: 'location_create', entityType: 'location', entityId: String(result.insertId), details: { name } });
      res.json({ ok: true, id: result.insertId });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT update location (admin only)
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { name, address, phone, email, timezone, is_active } = req.body;
    try {
      const fields = [];
      const vals = [];
      if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
      if (address !== undefined) { fields.push('address = ?'); vals.push(address); }
      if (phone !== undefined) { fields.push('phone = ?'); vals.push(phone); }
      if (email !== undefined) { fields.push('email = ?'); vals.push(email); }
      if (timezone !== undefined) { fields.push('timezone = ?'); vals.push(timezone); }
      if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active); }
      if (!fields.length) return res.json({ ok: true });
      vals.push(req.params.id);
      await pool.query(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`, vals);
      await logAudit(pool, req, { action: 'location_update', entityType: 'location', entityId: req.params.id, details: { fields: fields.map(f => f.split(' =')[0]) } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT set default location (admin only)
  router.put('/:id/set-default', authMiddleware, adminMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE locations SET is_default = FALSE');
      await conn.query('UPDATE locations SET is_default = TRUE WHERE id = ?', [req.params.id]);
      await conn.commit();
      await logAudit(pool, req, { action: 'location_set_default', entityType: 'location', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // DELETE soft-delete location (admin only) — deactivate, don't hard-delete
  router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [check] = await pool.query('SELECT is_default FROM locations WHERE id = ?', [req.params.id]);
      if (!check.length) return res.status(404).json({ error: 'Location not found' });
      if (check[0].is_default) return res.status(400).json({ error: 'Cannot deactivate the default location' });
      await pool.query('UPDATE locations SET is_active = FALSE WHERE id = ?', [req.params.id]);
      await logAudit(pool, req, { action: 'location_deactivate', entityType: 'location', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
