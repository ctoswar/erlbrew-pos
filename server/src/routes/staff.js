import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
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

export default function staffRouter(pool){
  const router = express.Router();

  // GET all staff
  router.get('/', async (req, res) => {
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
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query('SELECT id, rfid, name, role, initials, color FROM staff WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // LOGIN (PIN-only for POS staff - simple check)
  router.post('/login', async (req, res) => {
    const { username, password, rfid, pin } = req.body;
    // Basic validation per FIX 5
    if (!((rfid && pin) || username)) {
      return res.status(400).json({ error: 'Either RFID+PIN or username must be provided' });
    }
    try {
      // RFID + PIN login (from card scan)
      if (rfid && pin) {
        const [rows] = await pool.query('SELECT id, name, role, pin, password_hash FROM staff WHERE rfid = ?', [rfid]);
        if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
        const user = rows[0];
        // Check PIN
        if (pin !== user.pin) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ sub: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token });
      }
      // Username + Password login (admin or PIN fallback)
      if (username) {
        const [rows] = await pool.query('SELECT id, name, role, pin, password_hash FROM staff WHERE name = ?', [username]);
        if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
        const user = rows[0];
        if (user.password_hash) {
          // Has password hash - verify with bcrypt
          const ok = await bcrypt.compare(password, user.password_hash);
          if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
} else {
      // No password hash - accept PIN only (no hardcoded fallback)
      if (password !== user.pin) return res.status(401).json({ error: 'Invalid credentials' });
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
