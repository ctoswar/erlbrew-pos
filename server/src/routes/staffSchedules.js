import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function staffSchedulesRouter(pool) {
  const router = Router();

  // GET all schedule templates with their days (admin only)
  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [templates] = await pool.query('SELECT * FROM staff_schedules ORDER BY name');
      const [days] = await pool.query('SELECT * FROM staff_schedule_days ORDER BY schedule_id, FIELD(day_of_week, "mon","tue","wed","thu","fri","sat")');

      const dayMap = {};
      for (const d of days) {
        if (!dayMap[d.schedule_id]) dayMap[d.schedule_id] = {};
        dayMap[d.schedule_id][d.day_of_week] = {
          shift_start: d.shift_start,
          shift_end: d.shift_end,
          lunch_start: d.lunch_start,
          lunch_end: d.lunch_end,
          snack_start: d.snack_start,
          snack_end: d.snack_end,
        };
      }

      const result = templates.map((t) => ({
        id: t.id,
        name: t.name,
        days: dayMap[t.id] || {},
      }));
      res.json(result);
    } catch (e) {
      console.error('Failed to fetch staff schedules:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET single schedule template with days (admin only)
  router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      const [templates] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [id]);
      if (!templates.length) return res.status(404).json({ error: 'Schedule not found' });

      const [days] = await pool.query('SELECT * FROM staff_schedule_days WHERE schedule_id = ? ORDER BY FIELD(day_of_week, "mon","tue","wed","thu","fri","sat")', [id]);
      const dayMap = {};
      for (const d of days) {
        dayMap[d.day_of_week] = {
          shift_start: d.shift_start,
          shift_end: d.shift_end,
          lunch_start: d.lunch_start,
          lunch_end: d.lunch_end,
          snack_start: d.snack_start,
          snack_end: d.snack_end,
        };
      }
      res.json({ ...templates[0], days: dayMap });
    } catch (e) {
      console.error('Failed to fetch schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST create schedule template with days (admin only)
  router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { name, days } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Schedule name is required' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query('INSERT INTO staff_schedules (name) VALUES (?)', [name]);
      const scheduleId = result.insertId;

      if (days && typeof days === 'object') {
        for (const day of DAYS) {
          const d = days[day];
          if (d && (d.shift_start || d.shift_end || d.lunch_start || d.lunch_end || d.snack_start || d.snack_end)) {
            await conn.query(
              'INSERT INTO staff_schedule_days (schedule_id, day_of_week, shift_start, shift_end, lunch_start, lunch_end, snack_start, snack_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [scheduleId, day, d.shift_start || null, d.shift_end || null, d.lunch_start || null, d.lunch_end || null, d.snack_start || null, d.snack_end || null]
            );
          }
        }
      }

      await conn.commit();
      // Audit: schedule created
      await logAudit(pool, req, { action: 'schedule_create', entityType: 'staff_schedule', entityId: String(scheduleId), details: { name } });
      const [templates] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [scheduleId]);
      const [dayRows] = await pool.query('SELECT * FROM staff_schedule_days WHERE schedule_id = ?', [scheduleId]);
      const dayMap = {};
      for (const d of dayRows) {
        dayMap[d.day_of_week] = {
          shift_start: d.shift_start, shift_end: d.shift_end,
          lunch_start: d.lunch_start, lunch_end: d.lunch_end,
          snack_start: d.snack_start, snack_end: d.snack_end,
        };
      }
      res.json({ ...templates[0], days: dayMap });
    } catch (e) {
      await conn.rollback();
      console.error('Failed to create schedule:', e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // PUT update schedule template with days (admin only)
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, days } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (name !== undefined) {
        await conn.query('UPDATE staff_schedules SET name = ? WHERE id = ?', [name, id]);
      }

      if (days && typeof days === 'object') {
        await conn.query('DELETE FROM staff_schedule_days WHERE schedule_id = ?', [id]);
        for (const day of DAYS) {
          const d = days[day];
          if (d && (d.shift_start || d.shift_end || d.lunch_start || d.lunch_end || d.snack_start || d.snack_end)) {
            await conn.query(
              'INSERT INTO staff_schedule_days (schedule_id, day_of_week, shift_start, shift_end, lunch_start, lunch_end, snack_start, snack_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [id, day, d.shift_start || null, d.shift_end || null, d.lunch_start || null, d.lunch_end || null, d.snack_start || null, d.snack_end || null]
            );
          }
        }
      }

      await conn.commit();
      // Audit: schedule updated
      await logAudit(pool, req, { action: 'schedule_update', entityType: 'staff_schedule', entityId: id, details: { name } });
      const [templates] = await pool.query('SELECT * FROM staff_schedules WHERE id = ?', [id]);
      const [dayRows] = await pool.query('SELECT * FROM staff_schedule_days WHERE schedule_id = ?', [id]);
      const dayMap = {};
      for (const d of dayRows) {
        dayMap[d.day_of_week] = {
          shift_start: d.shift_start, shift_end: d.shift_end,
          lunch_start: d.lunch_start, lunch_end: d.lunch_end,
          snack_start: d.snack_start, snack_end: d.snack_end,
        };
      }
      res.json({ ...templates[0], days: dayMap });
    } catch (e) {
      await conn.rollback();
      console.error('Failed to update schedule:', e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // DELETE schedule template (admin only)
  router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM staff_schedules WHERE id = ?', [id]);
      await logAudit(pool, req, { action: 'schedule_delete', entityType: 'staff_schedule', entityId: id });
      res.json({ ok: true });
    } catch (e) {
      console.error('Failed to delete schedule:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
