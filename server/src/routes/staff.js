import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

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
  async function autoClockIn(staffId, rfid) {
    const now = taipeiNow();
    const today = now.toISOString().slice(0, 10);
    const clockInTime = toMysqlDatetime(now);
    const [open] = await pool.query(
      'SELECT id FROM time_records WHERE staff_id = ? AND DATE(clock_in) = ? AND clock_out IS NULL LIMIT 1',
      [staffId, today]
    );
    if (open.length) {
      const clockOutTime = toMysqlDatetime(taipeiNow());
      await pool.query(
        'UPDATE time_records SET clock_out = ?, total_hours = TIMESTAMPDIFF(MINUTE, clock_in, ?) / 60.0 WHERE id = ?',
        [clockOutTime, clockOutTime, open[0].id]
      );
      return 'clock_out';
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
      const [rows] = await pool.query(
        'SELECT id, rfid, name, role, initials, color, created_at FROM staff WHERE rfid = ?',
        [req.params.rfid]
      );
      return res.json(rows[0] || null);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET all staff (protected)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, rfid, name, role, initials, color, created_at FROM staff');
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

// Create staff (admin only, token required)
router.post('/', authMiddleware, async (req, res) => {
    const { rfid, pin, name, role, initials, color } = req.body;
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
      const [r] = await pool.query('INSERT INTO staff (rfid, pin, name, role, initials, color) VALUES (?, ?, ?, ?, ?, ?)', [rfid, pin, name, role, initials, color]);
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

// PUT update staff (auth required)
  router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { rfid, name, role, initials, color, password } = req.body;
    try {
      const fields = [];
      const values = [];
      if (rfid !== undefined) { fields.push('rfid = ?'); values.push(rfid || null); }
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (role !== undefined) { fields.push('role = ?'); values.push(role); }
      if (initials !== undefined) { fields.push('initials = ?'); values.push(initials); }
      if (color !== undefined) { fields.push('color = ?'); values.push(color); }
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
    const [rows] = await pool.query('SELECT id, rfid, name, role, initials, color FROM staff WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RFID already assigned to another staff member' });
    res.status(500).json({ error: 'DB error' });
  }
});

// LOGIN (PIN-only for POS staff - bcrypt hashed PINs)
router.post('/login', async (req, res) => {
  const { username, password, rfid, pin } = req.body;
  // Basic validation per FIX 5
  if (!((rfid && pin) || username)) {
    return res.status(400).json({ error: 'Either RFID+PIN or username must be provided' });
  }
  try {
    // RFID + PIN login (from card scan)
    if (rfid && pin) {
      const [rows] = await pool.query('SELECT id, name, role, pin FROM staff WHERE rfid = ?', [rfid]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const user = rows[0];
// Verify PIN against bcrypt hash stored in pin column
    const ok = await bcrypt.compare(pin, user.pin);
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
