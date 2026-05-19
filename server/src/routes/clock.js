import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

// Helpers for Asia/Taipei time (UTC+8) — server timezone-independent
function taipeiNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}
function toMysqlDatetime(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}
function taipeiToday() {
  return toDateOnly(taipeiNow());
}

export default function clockRouter(pool, googleSheets) {
  const router = Router();

  // POST /api/clock — RFID scan → clock in or clock out
  // Public (no auth) so employees can tap their card directly
  router.post('/', async (req, res) => {
    let { rfid } = req.body;
    if (rfid && typeof rfid === 'string') rfid = rfid.replace(/[\x00-\x1f]/g, '').trim().toUpperCase();
    if (!rfid || typeof rfid !== 'string' || rfid.length > 64) {
      return res.status(400).json({ error: 'Valid RFID required' });
    }

    try {
      // Find staff by RFID — try exact then reversed (handles tablet keyboard layout differences)
      const [staff] = await pool.query(
        'SELECT id, name, role, initials, color FROM staff WHERE rfid = ? OR rfid_alt = ?',
        [rfid, rfid]
      );
      if (!staff.length) return res.status(404).json({ error: 'Unrecognized card' });

      const { id: staff_id, name, role, initials, color } = staff[0];

      // Check if already clocked in today (open record exists)
      const today = taipeiToday(); // YYYY-MM-DD in Asia/Taipei
      const [open] = await pool.query(
        'SELECT id FROM time_records WHERE staff_id = ? AND DATE(clock_in) = ? AND clock_out IS NULL LIMIT 1',
        [staff_id, today]
      );

if (open.length) {
// Clock OUT — close the open record, compute hours
    const clockOutTime = toMysqlDatetime(taipeiNow());
    await pool.query(
      'UPDATE time_records SET clock_out = ?, total_hours = TIMESTAMPDIFF(MINUTE, clock_in, ?) / 60.0 WHERE id = ?',
      [clockOutTime, clockOutTime, open[0].id]
    );

    // Fetch updated record
    const [records] = await pool.query(
      'SELECT id, clock_in, clock_out, total_hours FROM time_records WHERE id = ?',
      [open[0].id]
    );

    // Log to Google Sheets (best-effort — don't fail the clock-out if sheets errors)
    const rec = records[0];
    if (!rec) return res.status(404).json({ error: 'Clock record not found after insert' });
    if (googleSheets) {
      try {
        await googleSheets.appendTimeRecord({
          staffName: name,
          role,
          action: 'Clock Out',
          clockIn: rec.clock_in,
          clockOut: rec.clock_out,
          totalHours: rec.total_hours,
        });
      } catch (e) { console.error('[Clock] Sheets clock-out failed:', e.message); }
    }

    return res.json({
        action: 'clock_out',
        staff: { staff_id, name, role, initials, color },
        record: records[0],
      });
      } else {
// Clock IN — create new record
      const clockInTime = toMysqlDatetime(taipeiNow());
      const [insert] = await pool.query(
        'INSERT INTO time_records (staff_id, rfid, clock_in) VALUES (?, ?, ?)',
        [staff_id, rfid, clockInTime]
      );

const [records] = await pool.query(
      'SELECT id, clock_in, clock_out, total_hours FROM time_records WHERE id = ?',
      [insert.insertId]
    );

    // Log to Google Sheets (best-effort)
    const recIn = records[0];
    if (googleSheets) {
      try {
        await googleSheets.appendTimeRecord({
          staffName: name,
          role,
          action: 'Clock In',
          clockIn: recIn.clock_in,
          clockOut: null,
          totalHours: null,
        });
      } catch (e) { console.error('[Clock] Sheets clock-in failed:', e.message); }
    }

    return res.json({
      action: 'clock_in',
          staff: { staff_id, name, role, initials, color },
          record: records[0],
        });
      }
    } catch (e) {
      console.error('Clock error:', e);
      res.status(500).json({ error: 'Clock operation failed' });
    }
  });

  // GET /api/clock — today's clock records (for TimeKeeping screen)
  // Returns all staff with today's clock status
router.get('/', async (req, res) => {
    try {
      const today = taipeiToday();
      const nowParam = toMysqlDatetime(taipeiNow());

      const [records] = await pool.query(
        `SELECT tr.id, tr.staff_id, tr.clock_in, tr.clock_out,
         TRUNCATE(TIMESTAMPDIFF(MINUTE, tr.clock_in, COALESCE(tr.clock_out, ?)) / 60.0, 2) AS total_hours,
         s.name, s.role, s.initials, s.color,
         ss.shift_start, ss.shift_end, ss.lunch_start, ss.lunch_end, ss.snack_start, ss.snack_end
         FROM time_records tr
         JOIN staff s ON s.id = tr.staff_id
         LEFT JOIN staff_schedules ss ON ss.id = s.schedule_id
         WHERE DATE(tr.clock_in) = ?
         ORDER BY tr.clock_in DESC`,
        [nowParam, today]
      );

      // Group by staff — keep latest record per person
      const staffMap = {};
      for (const r of records) {
        if (!staffMap[r.staff_id]) {
          staffMap[r.staff_id] = r;
        }
      }

      const [allStaff] = await pool.query(
        'SELECT id, name, role, initials, color FROM staff ORDER BY name'
      );

      const result = allStaff.map((s) => {
        const rec = staffMap[s.id];
        return {
          staff_id: s.id,
          name: s.name,
          role: s.role,
          initials: s.initials,
          color: s.color,
          status: rec ? (rec.clock_out ? 'clocked_out' : 'clocked_in') : 'not_in',
          record: rec || null,
        };
      });

      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  // GET /api/clock/summary/:month — all staff who clocked in on each day of a month
  // MUST be before /:staffId or Express matches 'summary' as staffId
  // e.g. GET /api/clock/summary/2026-05 — returns { "2026-05-01": [staff_id,...], "2026-05-02": [...] }
  router.get('/summary/:month', async (req, res) => {
    const { month } = req.params;
    try {
      const [records] = await pool.query(`
        SELECT DISTINCT DATE(tr.clock_in) AS date, tr.staff_id, s.name, s.initials, s.color
        FROM time_records tr
        JOIN staff s ON s.id = tr.staff_id
        WHERE DATE(tr.clock_in) LIKE CONCAT(?, '%')
        ORDER BY date, s.name
      `, [month]);

      const byDate = {};
      for (const r of records) {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push({
          staff_id: r.staff_id,
          name: r.name,
          initials: r.initials,
          color: r.color,
        });
      }
      res.json(byDate);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // GET /api/clock/calendar/:date — all time records for a specific date
  // MUST be before /:staffId or Express matches 'calendar' as staffId
  // e.g. GET /api/clock/calendar/2026-05-13 — returns staff_id, name, clock_in, clock_out, total_hours
  router.get('/calendar/:date', async (req, res) => {
    const { date } = req.params;
    try {
      const [records] = await pool.query(`
        SELECT tr.id, tr.staff_id, tr.clock_in, tr.clock_out, tr.total_hours,
               s.name, s.role, s.initials, s.color
        FROM time_records tr
        JOIN staff s ON s.id = tr.staff_id
        WHERE DATE(tr.clock_in) = ?
        ORDER BY s.name, tr.clock_in
      `, [date]);
      res.json(records);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch date records' });
    }
  });

  // GET /api/clock/:staffId — specific employee's time records (auth required)
  router.get('/:staffId', authMiddleware, async (req, res) => {
    const { staffId } = req.params;
    const { from, to } = req.query;
    try {
      let sql = `SELECT tr.id, tr.staff_id, tr.clock_in, tr.clock_out, tr.total_hours
                 FROM time_records tr WHERE tr.staff_id = ?`;
      const params = [staffId];

      if (from) { sql += ' AND DATE(tr.clock_in) >= ?'; params.push(from); }
      if (to) { sql += ' AND DATE(tr.clock_in) <= ?'; params.push(to); }

      sql += ' ORDER BY tr.clock_in DESC LIMIT 90';

      const [records] = await pool.query(sql, params);
      res.json(records);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  return router;
}