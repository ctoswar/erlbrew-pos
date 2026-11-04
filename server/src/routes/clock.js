import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAuditDirect } from '../services/audit.js';

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
  // Any staff token can reach the router (the RFID tap is staff-accessible),
  // but viewing/adjusting other staff's records stays Manager-only.
  router.use(authMiddleware);

  // POST /api/clock — RFID scan → clock in or clock out
  // Any logged-in staff may tap; the token prevents anonymous/remote spoofing.
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

      // Check for open records today (a record with no clock_out)
      const today = taipeiToday(); // YYYY-MM-DD in Asia/Taipei
      const [open] = await pool.query(
        'SELECT id, clock_in FROM time_records WHERE staff_id = ? AND DATE(clock_in) = ? AND clock_out IS NULL ORDER BY clock_in',
        [staff_id, today]
      );

      if (open.length) {
// Clock OUT — close ALL open records (defensive: past adjustments can leave
// duplicates), computing hours per record. The latest-session record is the response.
    const openIds = open.map((o) => o.id);
    const clockOutTime = toMysqlDatetime(taipeiNow());
    await pool.query(
      'UPDATE time_records SET clock_out = ?, total_hours = TIMESTAMPDIFF(MINUTE, clock_in, ?) / 60.0 WHERE id IN (?)',
      [clockOutTime, clockOutTime, openIds]
    );

    // Fetch updated records and use the most recent session as representative
    const [records] = await pool.query(
      'SELECT id, clock_in, clock_out, total_hours FROM time_records WHERE id IN (?) ORDER BY clock_in DESC',
      [openIds]
    );

    // Log to Google Sheets (best-effort — don't fail the clock-out if sheets errors)
    const rec = records[0];
    if (!rec) return res.status(404).json({ error: 'Clock record not found after insert' });

    // Audit: clock-out (log each closed record)
    for (const o of openIds) {
      const closed = records.find((r) => r.id === o) || rec;
      await logAuditDirect(pool, { staffId: staff_id, staffName: name, action: 'clock_out', entityType: 'time_record', entityId: String(o), details: { hours: closed.total_hours } });
    }

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
      // First: auto-close stale open records left from previous days (missed
      // clock-outs). Clock-out = scheduled shift end for that record's weekday;
      // fallback = 23:59:59 of the clock-in day. Keeps pay bounded and correctable.
      try {
        const [stale] = await pool.query(
          `SELECT tr.id, DATE_FORMAT(tr.clock_in, '%Y-%m-%d') AS cin_date
           FROM time_records tr
           WHERE tr.staff_id = ? AND tr.clock_out IS NULL AND DATE(tr.clock_in) < ?
           LIMIT 20`,
          [staff_id, today]
        );
        for (const st of stale) {
          const [sched] = await pool.query(
            `SELECT ssd.shift_start, ssd.shift_end
             FROM time_records tr
             JOIN staff s ON s.id = tr.staff_id
             LEFT JOIN staff_schedule_days ssd ON ssd.schedule_id = s.schedule_id
               AND ssd.day_of_week = CASE DAYOFWEEK(tr.clock_in)
                 WHEN 1 THEN 'sun' WHEN 2 THEN 'mon' WHEN 3 THEN 'tue' WHEN 4 THEN 'wed'
                 WHEN 5 THEN 'thu' WHEN 6 THEN 'fri' WHEN 7 THEN 'sat'
               END
             WHERE tr.id = ?`,
            [st.id]
          );
          const ss = sched[0]?.shift_start ? String(sched[0].shift_start) : null;
          const se = sched[0]?.shift_end ? String(sched[0].shift_end) : null;
          let outTs = `${st.cin_date} 23:59:59`;
          if (ss && se && se > ss) outTs = `${st.cin_date} ${se}`;
          else if (ss && se && se <= ss) {
            // Overnight shift (end on the next calendar day)
            const nextDay = toDateOnly(new Date(new Date(`${st.cin_date}T00:00:00`).getTime() + 86400000));
            outTs = `${nextDay} ${se}`;
          }
          await pool.query(
            'UPDATE time_records SET clock_out = ?, total_hours = TRUNCATE(TIMESTAMPDIFF(MINUTE, clock_in, ?) / 60.0, 2) WHERE id = ? AND clock_out IS NULL',
            [outTs, outTs, st.id]
          );
          await logAuditDirect(pool, { staffId: staff_id, staffName: name, action: 'clock_out_auto', entityType: 'time_record', entityId: String(st.id), details: { automatic: true, reason: 'missed clock-out auto-closed on next clock-in', clock_out: outTs } });
          if (googleSheets) {
            try {
              await googleSheets.appendTimeRecord({ staffName: name, role, action: 'Clock Out (Auto)', clockIn: `${st.cin_date} (auto-closed)`, clockOut: outTs, totalHours: null });
            } catch (e) { console.error('[Clock] Sheets auto clock-out failed:', e.message); }
          }
        }
      } catch (e) {
        console.error('[Clock] stale open auto-close failed (non-fatal):', e.message);
      }

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

    // Audit: clock-in
    await logAuditDirect(pool, { staffId: staff_id, staffName: name, action: 'clock_in', entityType: 'time_record', entityId: String(insert.insertId) });

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
  // Any logged-in staff can view records
router.get('/', async (req, res) => {
    try {
      const today = taipeiToday();
      const nowParam = toMysqlDatetime(taipeiNow());

      const [records] = await pool.query(
        `SELECT tr.id, tr.staff_id, tr.clock_in, tr.clock_out,
         TRUNCATE(TIMESTAMPDIFF(MINUTE, tr.clock_in, COALESCE(tr.clock_out, ?)) / 60.0, 2) AS total_hours,
         s.name, s.role, s.initials, s.color,
         ssd.shift_start, ssd.shift_end, ssd.lunch_start, ssd.lunch_end, ssd.snack_start, ssd.snack_end
         FROM time_records tr
         JOIN staff s ON s.id = tr.staff_id
         LEFT JOIN staff_schedule_days ssd ON ssd.schedule_id = s.schedule_id
            AND ssd.day_of_week = CASE DAYOFWEEK(tr.clock_in)
              WHEN 1 THEN 'sun' WHEN 2 THEN 'mon' WHEN 3 THEN 'tue' WHEN 4 THEN 'wed'
              WHEN 5 THEN 'thu' WHEN 6 THEN 'fri' WHEN 7 THEN 'sat'
            END
          WHERE DATE(tr.clock_in) = ?
          ORDER BY tr.clock_in DESC`,
         [nowParam, today]
      );

      // Group by staff — prefer an OPEN record (still clocked in) over a newer
      // closed one. Adjusting an open record's clock-in to an earlier time can
      // put it behind newer closed records in the ORDER BY; without this the
      // person wrongly displays as "clocked_out" while still working.
      const staffMap = {};
      for (const r of records) {
        const cur = staffMap[r.staff_id];
        if (!cur || (cur.clock_out && !r.clock_out)) {
          staffMap[r.staff_id] = r;
        }
      }

      const [allStaff] = await pool.query(
        `SELECT s.id, s.name, s.role, s.initials, s.color,
         ssd.shift_start, ssd.shift_end, ssd.lunch_start, ssd.lunch_end, ssd.snack_start, ssd.snack_end
         FROM staff s
         LEFT JOIN staff_schedule_days ssd ON ssd.schedule_id = s.schedule_id
           AND ssd.day_of_week = CASE DAYOFWEEK(CURDATE())
              WHEN 1 THEN 'sun' WHEN 2 THEN 'mon' WHEN 3 THEN 'tue' WHEN 4 THEN 'wed'
              WHEN 5 THEN 'thu' WHEN 6 THEN 'fri' WHEN 7 THEN 'sat'
            END
         ORDER BY s.name`
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
          shift_start: rec?.shift_start || s.shift_start || null,
          shift_end: rec?.shift_end || s.shift_end || null,
          lunch_start: rec?.lunch_start || s.lunch_start || null,
          lunch_end: rec?.lunch_end || s.lunch_end || null,
          snack_start: rec?.snack_start || s.snack_start || null,
          snack_end: rec?.snack_end || s.snack_end || null,
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

  // GET /api/clock/print — all staff with time records for a date range (for print report)
  // MUST be before /:staffId or Express matches 'print' as staffId
  // Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
  router.get('/print', async (req, res) => {
    const { from, to } = req.query;
    console.log('[clock/print] Request:', { from, to });
    if (!from || !to) {
      return res.status(400).json({ error: '"from" and "to" query params required (YYYY-MM-DD)' });
    }
    try {
      // Get all time records in the date range
      const [records] = await pool.query(`
        SELECT tr.id, tr.staff_id, tr.clock_in, tr.clock_out, tr.total_hours,
               DATE_FORMAT(tr.clock_in, '%Y-%m-%d') AS record_date,
               s.name, s.role, s.initials, s.color
        FROM time_records tr
        JOIN staff s ON s.id = tr.staff_id
        WHERE DATE(tr.clock_in) >= ? AND DATE(tr.clock_in) <= ?
        ORDER BY s.name, tr.clock_in
      `, [from, to]);
      console.log('[clock/print] Records found:', records.length);

      // Get all staff
      const [allStaff] = await pool.query(
        `SELECT s.id, s.name, s.role, s.initials, s.color
         FROM staff s
         ORDER BY s.name`
      );

      // Get all schedule assignments for staff in range period (we fetch all schedules, 
      // the frontend will map day_of_week)
      const [allSchedules] = await pool.query(`
        SELECT s.id AS staff_id, ss.name AS schedule_name,
               ssd.day_of_week, ssd.shift_start, ssd.shift_end
        FROM staff s
        JOIN staff_schedule_days ssd ON ssd.schedule_id = s.schedule_id
        JOIN staff_schedules ss ON ss.id = s.schedule_id
        ORDER BY s.id, FIELD(ssd.day_of_week, 'mon','tue','wed','thu','fri','sat')
      `);

      // Index schedules by staff_id -> day_of_week -> { shift_start, shift_end }
      const scheduleMap = {};
      for (const sc of allSchedules) {
        if (!scheduleMap[sc.staff_id]) scheduleMap[sc.staff_id] = {};
        scheduleMap[sc.staff_id][sc.day_of_week] = {
          schedule_name: sc.schedule_name,
          shift_start: sc.shift_start,
          shift_end: sc.shift_end,
        };
      }

      // Group records by date -> staff_id
      const byDate = {};
      const presentStaff = new Set();
      for (const r of records) {
        const d = r.record_date;
        if (!byDate[d]) byDate[d] = {};
        if (!byDate[d][r.staff_id]) byDate[d][r.staff_id] = [];
        byDate[d][r.staff_id].push(r);
        if (r.clock_out) presentStaff.add(r.staff_id);
        else presentStaff.add(r.staff_id);
      }

      // Build date entries in order
      const dates = [];
      const d = new Date(from + 'T00:00:00');
      const endDate = new Date(to + 'T00:00:00');
      while (d <= endDate) {
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }

      // Build per-date summary with staff records
      const dateEntries = dates.map((date) => {
        const dayOfWeek = ['sun','mon','tue','wed','thu','fri','sat'][new Date(date + 'T00:00:00').getDay()];
        const dateRecords = byDate[date] || {};

        const staff = allStaff.map((s) => ({
          staff_id: s.id,
          name: s.name,
          role: s.role,
          initials: s.initials,
          color: s.color,
          shift_start: (scheduleMap[s.id]?.[dayOfWeek]?.shift_start) || null,
          shift_end: (scheduleMap[s.id]?.[dayOfWeek]?.shift_end) || null,
          schedule_name: (scheduleMap[s.id]?.[dayOfWeek]?.schedule_name) || null,
          records: dateRecords[s.id] || [],
        }));

        const dayTotalHours = staff.reduce((acc, s) =>
          acc + s.records.reduce((a, r) => a + Number(r.total_hours || 0), 0), 0);

        return {
          date,
          day_of_week: dayOfWeek,
          staff,
          total_hours: Math.round(dayTotalHours * 100) / 100,
          staff_present: staff.filter((s) => s.records.length > 0).length,
        };
      });

      // Grand totals
      const grandTotalHours = dateEntries.reduce((acc, d) => acc + d.total_hours, 0);
      const uniqueStaffPresent = presentStaff.size;

      res.json({
        from,
        to,
        total_days: dates.length,
        total_staff: allStaff.length,
        unique_staff_present: uniqueStaffPresent,
        grand_total_hours: Math.round(grandTotalHours * 100) / 100,
        dates: dateEntries,
        all_staff: allStaff.map((s) => ({
          staff_id: s.id,
          name: s.name,
          role: s.role,
          initials: s.initials,
          color: s.color,
        })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch print data' });
    }
  });

  // PUT /api/clock/:recordId/adjust — adjust a time record (auth required: Manager+)
  router.put('/:recordId/adjust', authMiddleware, adminMiddleware, async (req, res) => {
    const { recordId } = req.params;
    const { clock_in, clock_out, reason } = req.body;
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) return res.status(400).json({ error: 'Reason is required (min 3 chars)' });
    try {
      // Fetch existing record
      const [rows] = await pool.query('SELECT id, staff_id, clock_in, clock_out FROM time_records WHERE id = ? LIMIT 1', [recordId]);
      if (!rows.length) return res.status(404).json({ error: 'Record not found' });
      const rec = rows[0];

      const oldIn = rec.clock_in ? rec.clock_in : null;
      const oldOut = rec.clock_out ? rec.clock_out : null;

      // Prepare new values — if not provided, keep old
      const newIn = clock_in ? clock_in : oldIn;
      const newOut = (typeof clock_out !== 'undefined') ? clock_out : oldOut;

      // Validate: when both are present, clock_out must be after clock_in
      if (newIn && newOut) {
        const inT = new Date(newIn).getTime();
        const outT = new Date(newOut).getTime();
        if (Number.isNaN(inT) || Number.isNaN(outT)) return res.status(400).json({ error: 'Invalid date format' });
        if (outT <= inT) return res.status(400).json({ error: 'Clock out must be after clock in' });
      }

      // Update the record with new timestamps and recompute total_hours
      const [upd] = await pool.query(
        'UPDATE time_records SET clock_in = ?, clock_out = ?, total_hours = TRUNCATE(TIMESTAMPDIFF(MINUTE, ?, COALESCE(?, ?)) / 60.0, 2) WHERE id = ?',
        [newIn, newOut, newIn, newOut, newOut || newIn, recordId]
      );

      // Insert adjustment audit table if exists (non-fatal)
      try {
        await pool.query(
          `INSERT INTO time_adjustments (time_record_id, adjusted_by, adjusted_by_name, old_clock_in, old_clock_out, new_clock_in, new_clock_out, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [recordId, user.sub || user.id || null, user.name || null, oldIn, oldOut, newIn, newOut, reason.trim()]
        );
      } catch (e) {
        // table might not exist — continue
        console.warn('time_adjustments insert failed (optional):', e.message);
      }

      // Audit log (generic)
      try {
        const details = { recordId: String(recordId), oldClockIn: oldIn, oldClockOut: oldOut, newClockIn: newIn, newClockOut: newOut, reason: reason.trim() };
        await logAudit(pool, req, { action: 'adjust_time_record', entityType: 'time_record', entityId: String(recordId), details });
      } catch (e) { console.warn('audit failed:', e.message); }

      const [updated] = await pool.query('SELECT id, staff_id, clock_in, clock_out, total_hours FROM time_records WHERE id = ?', [recordId]);
      res.json({ success: true, record: updated[0] });
    } catch (e) {
      console.error('Failed to adjust time record:', e);
      res.status(500).json({ error: 'Failed to adjust record' });
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