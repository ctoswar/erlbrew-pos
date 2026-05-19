import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

// Simple input-validation helper (shared-style per task spec)
function validate(req, res, rules){
  for (const [field, check] of Object.entries(rules||{})){
    const val = req.body?.[field];
    if (check?.required && (val === undefined || val === null || val === '')) {
      return res.status(400).json({ error: `${field} is required` });
    }
    if (check?.type && typeof val !== check.type) {
      return res.status(400).json({ error: `${field} must be a ${check.type}` });
    }
    if (check?.minLen && typeof val === 'string' && val.length < check.minLen) {
      return res.status(400).json({ error: `${field} must be at least ${check.minLen} characters` });
    }
    if (check?.maxLen && typeof val === 'string' && val.length > check.maxLen) {
      return res.status(400).json({ error: `${field} must be at most ${check.maxLen} characters` });
    }
    if (check?.enum && !check.enum.includes(val)) {
      return res.status(400).json({ error: `${field} must be one of: ${check.enum.join(', ')}` });
    }
  }
return null;
  }

  // Helpers for Asia/Taipei time (UTC+8)
  function taipeiNow() { return new Date(Date.now() + 8 * 60 * 60 * 1000); }
  function toMysqlDatetime(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }

export default function staffRouter(pool){
  // Auto clock-in when staff logs in with RFID
  // Only clocks IN — never clocks out. Logout should not be a clock-out action.
  async function autoClockIn(staffId, rfid) {
    const now = taipeiNow();
    const today = now.toISOString().slice(0, 10);
    const clockInTime = toMysqlDatetime(now);
    const [open] = await pool.query(
      'SELECT id FROM time_records WHERE staff_id = ? AND DATE(clock_in) = ? AND clock_out IS NULL LIMIT 1',
      [staffId, today]
    );
    if (open.length) {
      // Already clocked in — do nothing, don't clock them out
      return null;
    } else {
      await pool.query(
        'INSERT INTO time_records (staff_id, rfid, clock_in) VALUES (?, ?, ?)',
        [staffId, rfid, clockInTime]
      );
      return 'clock_in';
    }
  }
  const router = express.Router();

  // GET /staff/rfid/:rfid — public, used by LoginScreen for card-lookup
  router.get('/rfid/:rfid', async (req, res) => {
    try {
      const rfid = (req.params.rfid || '').replace(/[\x00-\x1f]/g, '').trim().toUpperCase();
      const [rows] = await pool.query(
        'SELECT id, rfid, rfid_alt, name, role, initials, color, created_at FROM staff WHERE rfid = ? OR rfid_alt = ?',
        [rfid, rfid]
      );
      return res.json(rows[0] || null);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /staff/me — protected, returns current staff info from JWT
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      // req.user is set by authMiddleware (decoded JWT payload has { sub: id, name, role })
      const [rows] = await pool.query(
        'SELECT id, rfid, name, role, initials, color FROM staff WHERE id = ?',
        [req.user.sub]
      );
      if (!rows.length) return res.status(404).json({ error: 'Staff not found' });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET all staff (protected)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT s.id, s.rfid, s.rfid_alt, s.name, s.role, s.initials, s.color,
               s.pay_basis, s.daily_rate, s.monthly_salary, s.schedule_id,
               ss.name AS schedule_name,
               ss.shift_start, ss.shift_end, ss.lunch_start, ss.lunch_end, ss.snack_start, ss.snack_end,
               s.created_at
        FROM staff s
        LEFT JOIN staff_schedules ss ON s.schedule_id = ss.id
        ORDER BY s.name
      `);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

// Create staff (admin only, token required)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { rfid, rfid_alt, pin, name, role, initials, color } = req.body;
    // Validation: required fields and constraints per FIX 5
    const err = validate(req, res, {
      rfid: { required: true, type: 'string', maxLen: 64 },
      name: { required: true, type: 'string', maxLen: 128 },
      role: { required: true, type: 'string' },
      pin: { type: 'string', minLen: 0, maxLen: 4 }, // optional, but if provided must be 4 digits
    });
    if (err) return err;
    if (pin !== undefined && pin !== null) {
      const pinStr = String(pin);
      if (!/^\d{4}$/.test(pinStr)) {
        return res.status(400).json({ error: 'pin must be exactly 4 digits' });
      }
    }
    try {
      const [r] = await pool.query('INSERT INTO staff (rfid, rfid_alt, pin, name, role, initials, color) VALUES (?, ?, ?, ?, ?, ?, ?)', [rfid, rfid_alt || null, pin, name, role, initials, color]);
      await logAudit(pool, req, { action: 'staff_create', entityType: 'staff', entityId: String(r.insertId), details: { name, role } });
      res.json({ id: r.insertId });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

// GET staff by id
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT id, rfid, name, role, initials, color FROM staff WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

// PUT update staff (admin only)
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { rfid, rfid_alt, name, role, initials, color, password, pay_basis, daily_rate, monthly_salary, schedule_id } = req.body;
    try {
      const fields = [];
      const values = [];
      if (rfid !== undefined) { fields.push('rfid = ?'); values.push(rfid || null); }
      if (rfid_alt !== undefined) { fields.push('rfid_alt = ?'); values.push(rfid_alt || null); }
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (role !== undefined) { fields.push('role = ?'); values.push(role); }
      if (initials !== undefined) { fields.push('initials = ?'); values.push(initials); }
      if (color !== undefined) { fields.push('color = ?'); values.push(color); }
      if (pay_basis !== undefined) { fields.push('pay_basis = ?'); values.push(pay_basis); }
      if (daily_rate !== undefined) { fields.push('daily_rate = ?'); values.push(daily_rate || null); }
      if (monthly_salary !== undefined) { fields.push('monthly_salary = ?'); values.push(monthly_salary || null); }
      if (schedule_id !== undefined) { fields.push('schedule_id = ?'); values.push(schedule_id || null); }
      if (password !== undefined) {
        const pw = String(password);
        if (pw.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
        const hash = await bcrypt.hash(pw, 10);
        fields.push('pin = ?');
        values.push(hash);
      }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(id);
      await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query(`
      SELECT s.id, s.rfid, s.rfid_alt, s.name, s.role, s.initials, s.color,
             s.pay_basis, s.daily_rate, s.monthly_salary, s.schedule_id,
             ss.name AS schedule_name,
             ss.shift_start, ss.shift_end, ss.lunch_start, ss.lunch_end, ss.snack_start, ss.snack_end
      FROM staff s
      LEFT JOIN staff_schedules ss ON s.schedule_id = ss.id
      WHERE s.id = ?
    `, [id]);
    await logAudit(pool, req, { action: 'staff_update', entityType: 'staff', entityId: id, details: { name, role } });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RFID already assigned to another staff member' });
    res.status(500).json({ error: 'DB error' });
  }
});

// LOGIN (PIN-only for POS staff - bcrypt hashed PINs)
router.post('/login', async (req, res) => {
  let { username, password, rfid, pin } = req.body;
  if (rfid && typeof rfid === 'string') rfid = rfid.replace(/[\x00-\x1f]/g, '').trim().toUpperCase();
  // Basic validation per FIX 5
  if (!((rfid && pin) || username)) {
    return res.status(400).json({ error: 'Either RFID+PIN or username must be provided' });
  }
  try {
    // RFID + PIN login (from card scan)
if (rfid && pin) {
      const [rows] = await pool.query('SELECT id, name, role, pin FROM staff WHERE rfid = ? OR rfid_alt = ?', [rfid, rfid]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const user = rows[0];
// Verify PIN — supports both bcrypt-hashed and plain-text PINs
      let ok = false;
      if (user.pin && (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$'))) {
        ok = await bcrypt.compare(pin, user.pin);
      } else {
        ok = pin === user.pin;
      }
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Auto clock-in / clock-out on login
    let clockAction = null;
    try { clockAction = await autoClockIn(user.id, rfid); } catch (e) { console.error('Auto clock-in failed:', e); }

    const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token, clockAction });
  }
  // Username + Password login (admin with password hash OR PIN login)
    if (username) {
      const [rows] = await pool.query('SELECT id, name, role, pin, password_hash FROM staff WHERE name = ?', [username]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const user = rows[0];
      if (user.password_hash) {
        // Admin has a separate password hash — verify with bcrypt
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      } else {
        // No separate password — verify against bcrypt-hashed PIN in pin column
        const ok = await bcrypt.compare(password, user.pin);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token });
    }
    res.status(400).json({ error: 'Invalid login payload' });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'DB error' });
  }
});

  return router;
}
