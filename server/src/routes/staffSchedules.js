import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

export default function staffSchedulesRouter(pool) {
  const router = Router();

  // GET all schedule templates (admin only)
  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM staff_schedules ORDER BY name');
      res.json(rows);
    } catch (e) {
      console.error('Failed to fetch staff schedules:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET single schedule template (admin only)
  router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
      res.json(rows[0]);
    } catch (e) {
      console.error('Failed to fetch schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST create schedule template (admin only)
  router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { name, shift_start, shift_end, lunch_start, lunch_end, snack_start, snack_end } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Schedule name is required' });
    }
    try {
      const [result] = await pool.query(
        'INSERT INTO staff_schedules (name, shift_start, shift_end, lunch_start, lunch_end, snack_start, snack_end) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, shift_start || null, shift_end || null, lunch_start || null, lunch_end || null, snack_start || null, snack_end || null]
      );
      const [rows] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [result.insertId]);
      res.json(rows[0]);
    } catch (e) {
      console.error('Failed to create schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT update schedule template (admin only)
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, shift_start, shift_end, lunch_start, lunch_end, snack_start, snack_end } = req.body;
    try {
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (shift_start !== undefined) { fields.push('shift_start = ?'); values.push(shift_start || null); }
      if (shift_end !== undefined) { fields.push('shift_end = ?'); values.push(shift_end || null); }
      if (lunch_start !== undefined) { fields.push('lunch_start = ?'); values.push(lunch_start || null); }
      if (lunch_end !== undefined) { fields.push('lunch_end = ?'); values.push(lunch_end || null); }
      if (snack_start !== undefined) { fields.push('snack_start = ?'); values.push(snack_start || null); }
      if (snack_end !== undefined) { fields.push('snack_end = ?'); values.push(snack_end || null); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE staff_schedules SET ${fields.join(', ')} WHERE id = ?`, values);
      const [rows] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [id]);
      res.json(rows[0]);
    } catch (e) {
      console.error('Failed to update schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // DELETE schedule template (admin only)
  router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM staff_schedules WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('Failed to delete schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
