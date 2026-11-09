import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { customerAuthMiddleware } from '../middleware/customerAuth.js';
import { logAudit } from '../services/audit.js';
import { locationScope, scopedLocationCondition } from '../middleware/location.js';
import {
  encryptPii,
  decryptPii,
  phoneHash,
  emailHash,
  decryptCustomerRow,
} from '../services/piiCrypto.js';

export function isVerifiedFirebaseCustomer(decoded) {
  return decoded?.email_verified === true &&
    typeof decoded?.email === 'string' &&
    decoded.email.trim().length > 0;
}

// Split a Google/Firebase profile into customer name fields: the display
// name keeps the full string, first/last split on the first space, and the
// email local-part is the fallback when Google has no name at all.
export function deriveCustomerNames(decoded) {
  const displayName = String(decoded?.name || '').trim();
  const email = String(decoded?.email || '').trim();
  if (displayName) {
    const parts = displayName.split(/\s+/);
    return {
      displayName,
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
    };
  }
  const local = email ? email.split('@')[0] : '';
  const firstName = (local || 'erlbrew').charAt(0).toUpperCase() +
    (local || 'erlbrew').slice(1);
  return { displayName: firstName, firstName, lastName: null };
}

// Deterministic placeholder phone for Google-provisioned accounts — the
// customers.phone column is NOT NULL UNIQUE and Google has no number. The
// SHA-1 keeps it stable per Firebase user (retries stay idempotent), short
// enough for VARCHAR(32), and outside real phone formats so loyalty
// phone-lookups never match it.
export function sentinelPhoneForUid(uid) {
  const hash = crypto.createHash('sha1').update(String(uid)).digest('hex');
  return `g-${hash.slice(0, 12)}`;
}

export default function customersRouter(pool) {
  const router = Router();
  // Raw columns — encrypted values (AES-256-GCM) for customer PII.
  // phone/email live as *_hash (HMAC lookup keys) + *_enc (display value).
  // Notes are staff free-text that can hold PII — also encrypted.
  const customerColumns = 'id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, notes_enc, username, loyalty_points, loyalty_tier, last_points_update, total_orders, total_spent, created_at, updated_at';
  let firebaseApp;
  if (getApps().length) {
    firebaseApp = getApp();
  } else {
    let serviceAccount = null;
    try {
      serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : process.env.GOOGLE_SERVICE_ACCOUNT_KEY
          ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
          : null;
    } catch {
      serviceAccount = null;
    }
    firebaseApp = serviceAccount
      ? initializeApp({ credential: cert(serviceAccount) })
      : initializeApp();
  }
  const firebaseAuth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // GET /api/customers — list/search customers.
  // PII is encrypted at rest (no LIKE over ciphertext) — the result window is
  // fetched, decrypted, then filtered in JS. Sized for a café-scale customer
  // base; revisit with a search index if listings ever grow orders larger.
  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { search, limit = 50 } = req.query;
      let sql = `SELECT ${customerColumns} FROM customers`;
      const values = [];
      if (search) {
        sql += ' ORDER BY total_spent DESC LIMIT 1000';
      } else {
        sql += ' ORDER BY total_spent DESC LIMIT ?';
        values.push(Number(limit));
      }
      const [rows] = await pool.query(sql, values);
      let customers = rows.map(decryptCustomerRow);
      if (search) {
        const needle = String(search).trim().toLowerCase();
        customers = customers.filter((c) =>
          String(c.name || '').toLowerCase().includes(needle) ||
          String(c.email || '').toLowerCase().includes(needle) ||
          String(c.phone || '').includes(String(search).trim())
        );
        customers = customers.slice(0, Number(limit));
      }
      res.json(customers);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/top — top customers by order count / spend
  router.get('/top', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const [rows] = await pool.query(
        `SELECT ${customerColumns} FROM customers ORDER BY total_spent DESC LIMIT ?`,
        [Number(limit)]
      );
      res.json(rows.map(decryptCustomerRow));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // ── Customer Auth Endpoints (MUST be before /:id routes) ─────────────

  // Password policy — mirrors the signup screen
  // (erlbrew_app/lib/utils/password_policy.dart): at least 8 characters
  // with one capital letter, one number and one special character.
  // Returns the first rule the value breaks, or null when it passes.
  const firstPasswordIssue = (value) => {
    if (typeof value !== 'string' || value.length < 8) {
      return 'password must use at least 8 characters';
    }
    if (!/[A-Z]/.test(value)) {
      return 'password must include at least one capital letter';
    }
    if (!/[0-9]/.test(value)) {
      return 'password must include at least one number';
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      return 'password must include at least one special character (e.g. ! @ #)';
    }
    return null;
  };

  // POST /api/customers/register — Create customer account
  //
  // Username policy — mirrors erlbrew_app/lib/utils/username_policy.dart:
  // 3-20 characters, letters, numbers and underscores. Stored lowercase
  // and unique case-insensitively; a few handles are reserved.
  const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
  const RESERVED_USERNAMES = new Set([
    'admin', 'administrator', 'erlbrew', 'root', 'support',
    'staff', 'moderator', 'owner', 'null', 'undefined',
  ]);

  const usernameTaken = async (value) => {
    const [rows] = await pool.query(
      'SELECT id FROM customers WHERE LOWER(username) = ? LIMIT 1',
      [value]
    );
    return rows.length > 0;
  };

  // Builds a unique lowercase handle from the customer's names when none
  // was chosen, e.g. "Jan" + "Dela Cruz" -> "jandelacruz", then
  // "jandelacruz2", "jandelacruz3", ... if those are taken.
  const generateUniqueUsername = async (firstName, lastName, fallbackName) => {
    let base = `${firstName}${lastName}`.trim() || String(fallbackName || '');
    base = base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 18);
    if (base.length < 3) base = `erl${base}`;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
      if (!RESERVED_USERNAMES.has(candidate) && !(await usernameTaken(candidate))) {
        return candidate;
      }
    }
    // Practically unreachable — fall back to a time-based unique handle.
    return `erl${Date.now().toString(36)}`;
  };

  // Creates a customer row for a verified Google/Firebase identity with no
  // matching email yet — the first-run path of "Continue with Google".
  // Returns the new row, or null when provisioning must be skipped (the
  // Firestore profile lookup failed). Throws an error with code
  // 'STAFF_ACCOUNT' when the Firebase profile is admin/manager — staff
  // accounts must never become customer rows.
  const provisionGoogleCustomer = async (decoded, email) => {
    let staffProfile = {};
    try {
      const snap = await firestore.collection('users').doc(decoded.uid).get();
      staffProfile = snap.exists ? snap.data() || {} : {};
    } catch (e) {
      console.error('[Customers] Google provision: profile lookup failed:', e.message);
      return null;
    }
    const role = String(staffProfile.role || '').toLowerCase();
    if (staffProfile.isAdmin === true || role === 'admin' || role === 'manager') {
      const err = new Error('This Firebase account does not have staff access');
      err.code = 'STAFF_ACCOUNT';
      throw err;
    }
    const { displayName, firstName, lastName } = deriveCustomerNames(decoded);
    const username = await generateUniqueUsername(firstName, lastName || '', email);
    const phone = sentinelPhoneForUid(decoded.uid);
    try {
      await pool.query(
        'INSERT INTO customers (phone_hash, phone_enc, name_enc, email_hash, email_enc, first_name_enc, last_name_enc, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
        [phoneHash(phone), encryptPii(phone), encryptPii(displayName), emailHash(email), encryptPii(email), encryptPii(firstName), encryptPii(lastName)]
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
      // Lost a race (row appeared between SELECT and INSERT) — the
      // re-select below picks it up. Same uid → same sentinel phone, so
      // this stays idempotent.
    }
    const [inserted] = await pool.query(
      'SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, loyalty_points, loyalty_tier, total_orders, total_spent, created_at FROM customers WHERE phone_hash = ? LIMIT 1',
      [phoneHash(phone)]
    );
    return decryptCustomerRow(inserted[0]) || null;
  };

  router.post('/register', async (req, res) => {
    const { phone, email, password } = req.body;
    // Accept both snake_case and camelCase from clients.
    const firstName = String(req.body.first_name ?? req.body.firstName ?? '').trim();
    const lastName = String(req.body.last_name ?? req.body.lastName ?? '').trim();
    const rawName = String(req.body.name ?? '').trim();
    const rawUsername = String(req.body.username ?? '').trim();
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }
    if (!firstName) {
      return res.status(400).json({ error: 'first name is required' });
    }
    const passwordIssue = firstPasswordIssue(password);
    if (passwordIssue) {
      return res.status(400).json({ error: passwordIssue });
    }
    if (rawUsername && !USERNAME_PATTERN.test(rawUsername)) {
      return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores' });
    }
    try {
      const normalizedPhone = phone.trim();
      const [existing] = await pool.query('SELECT id FROM customers WHERE phone_hash = ?', [phoneHash(normalizedPhone)]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
      // Resolve the username: validate the chosen one (reserved words,
      // case-insensitive uniqueness) or auto-generate a free handle.
      let username = null;
      if (rawUsername) {
        const candidate = rawUsername.toLowerCase();
        if (RESERVED_USERNAMES.has(candidate)) {
          return res.status(409).json({ error: 'That username is not available' });
        }
        if (await usernameTaken(candidate)) {
          return res.status(409).json({ error: 'That username is already taken' });
        }
        username = candidate;
      } else {
        username = await generateUniqueUsername(firstName, lastName, rawName);
      }
      const displayName = rawName || `${firstName} ${lastName}`.trim();
      const passwordHash = await bcrypt.hash(password, 10);
      const [r] = await pool.query(
        'INSERT INTO customers (phone_hash, phone_enc, name_enc, email_hash, email_enc, first_name_enc, last_name_enc, password_hash, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [phoneHash(normalizedPhone), encryptPii(normalizedPhone), encryptPii(displayName), email ? emailHash(email) : null, encryptPii(email), encryptPii(firstName), encryptPii(lastName || null), passwordHash, username]
      );
      const token = jwt.sign(
        { sub: r.insertId, phone: normalizedPhone, name: displayName, customer: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      const [inserted] = await pool.query(
        'SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, loyalty_points, loyalty_tier, created_at FROM customers WHERE id = ?',
        [r.insertId]
      );
      await logAudit(pool, req, { action: 'customer_register', entityType: 'customer', entityId: String(r.insertId), details: { phone_norm: phoneHash(normalizedPhone), username } });
      res.json({ token, customer: decryptCustomerRow(inserted[0]) });
    } catch (e) {
      console.error('Customer register error:', e);
      if (e.code === 'ER_DUP_ENTRY') {
        const isUsername = /username/i.test(e.message || '');
        return res.status(409).json({ error: isUsername ? 'That username is already taken' : 'Customer account already registered' });
      }
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers/login — Customer login (supports phone or email)
  router.post('/login', async (req, res) => {
    const { email, phone, password } = req.body;
    const identifierValue = email || phone;
    if (!identifierValue || !password) {
      return res.status(400).json({ error: 'phone/email and password are required' });
    }
    try {
      const identifier = identifierValue.trim();
      const isEmail = identifier.includes('@');
      // Lookup by phone or email — both are HMAC hashes now
      const query = `SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, password_hash, loyalty_points, loyalty_tier, created_at FROM customers WHERE ${isEmail ? 'email_hash' : 'phone_hash'} = ?`;
      const [rows] = await pool.query(query, [isEmail ? emailHash(identifier) : phoneHash(identifier)]);
      if (!rows.length) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const customer = rows[0];
      if (!customer.password_hash) {
        return res.status(401).json({ error: 'Account not set up with password. Please register.' });
      }
      const ok = await bcrypt.compare(password, customer.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const [phone, name] = [decryptPii(customer.phone_enc), decryptPii(customer.name_enc)];
      const token = jwt.sign(
        { sub: customer.id, phone, name: name || '', customer: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      await logAudit(pool, req, { action: 'customer_login', entityType: 'customer', entityId: String(customer.id), details: { identifier_norm: isEmail ? emailHash(identifier) : phoneHash(identifier) } });
      // password_hash never leaves the API even though it rode along in the row
      const { password_hash: _omit, ...customerData } = decryptCustomerRow(customer);
      res.json({ token, customer: customerData });
    } catch (e) {
      console.error('Customer login error:', e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers/firebase-login — Exchange a Firebase customer token for a POS session.
  // With `autoProvision: true` (sent by the Google sign-in flow), a verified
  // identity with no matching customer row gets one created on the fly.
  router.post('/firebase-login', async (req, res) => {
    const idToken = typeof req.body?.idToken === 'string'
      ? req.body.idToken.trim()
      : '';
    const autoProvision = req.body?.autoProvision === true;
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' });
    }
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      if (!isVerifiedFirebaseCustomer(decoded)) {
        return res.status(403).json({ error: 'Email verification is required', code: 'EMAIL_NOT_VERIFIED' });
      }
      const email = String(decoded.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(401).json({ error: 'A verified customer email is required' });
      }
      const [rows] = await pool.query(
        'SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, loyalty_points, loyalty_tier, total_orders, total_spent, created_at FROM customers WHERE email_hash = ? LIMIT 1',
        [emailHash(email)]
      );
      let customer = rows[0] || null;
      let provisioned = false;
      if (!customer && autoProvision) {
        try {
          customer = await provisionGoogleCustomer(decoded, email);
          provisioned = customer != null;
        } catch (e) {
          if (e.code === 'STAFF_ACCOUNT') {
            return res.status(403).json({ error: e.message, code: 'FORBIDDEN' });
          }
          throw e;
        }
      }
      if (!customer) {
        return res.status(404).json({ error: 'Customer profile not found' });
      }
      customer = provisioned ? customer : decryptCustomerRow(customer);
      const token = jwt.sign(
        { sub: customer.id, phone: customer.phone, name: customer.name || '', customer: true },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      await logAudit(pool, req, {
        action: 'customer_login',
        entityType: 'customer',
        entityId: String(customer.id),
        details: {
          method: provisioned ? 'firebase_google' : 'firebase_email',
          email_norm: emailHash(email),
          ...(provisioned ? { provisioned: true } : {}),
        },
      });
      return res.json({ token, customer });
    } catch (e) {
      console.error('Firebase customer login error:', e.message);
      return res.status(401).json({ error: 'Invalid Firebase credentials' });
    }
  });

  // GET /api/customers/me — Get current customer profile
  router.get('/me', customerAuthMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, loyalty_points, loyalty_tier, last_points_update, total_orders, total_spent, created_at FROM customers WHERE id = ?',
        [req.customer.sub]
      );
      if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
      res.json(decryptCustomerRow(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/customers/me — Update current customer profile
  router.put('/me', customerAuthMiddleware, async (req, res) => {
    const { name, email, username } = req.body;
    try {
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name_enc = ?'); values.push(encryptPii(name)); }
      if (email !== undefined) { fields.push('email_enc = ?'); values.push(encryptPii(email)); }
      if (email !== undefined) { fields.push('email_hash = ?'); values.push(email ? emailHash(email) : null); }
      if (username !== undefined) {
        // Same policy as /register (erlbrew_app/lib/utils/username_policy.dart),
        // with uniqueness checked excluding the caller's own row.
        const candidate = String(username ?? '').trim().toLowerCase();
        if (!USERNAME_PATTERN.test(candidate)) {
          return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores' });
        }
        if (RESERVED_USERNAMES.has(candidate)) {
          return res.status(409).json({ error: 'That username is not available' });
        }
        const [clashes] = await pool.query(
          'SELECT id FROM customers WHERE LOWER(username) = ? AND id != ? LIMIT 1',
          [candidate, req.customer.sub]
        );
        if (clashes.length > 0) {
          return res.status(409).json({ error: 'That username is already taken' });
        }
        fields.push('username = ?');
        values.push(candidate);
      }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(req.customer.sub);
      await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      const [rows] = await pool.query(
        'SELECT id, phone_enc, email_enc, name_enc, first_name_enc, last_name_enc, username, loyalty_points, loyalty_tier, total_orders, total_spent, created_at FROM customers WHERE id = ?',
        [req.customer.sub]
      );
      res.json(decryptCustomerRow(rows[0]));
    } catch (e) {
      console.error(e);
      if (e.code === 'ER_DUP_ENTRY' && /username/i.test(e.message || '')) {
        return res.status(409).json({ error: 'That username is already taken' });
      }
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

  // GET /api/customers/me/points/history — Paginated points history
  router.get('/me/points/history', customerAuthMiddleware, async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const [history] = await pool.query(
        `SELECT id, points, type, reference_type, reference_id, notes, created_at
         FROM loyalty_points_log
         WHERE customer_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [req.customer.sub, Number(limit), Number(offset)]
      );
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) AS total FROM loyalty_points_log WHERE customer_id = ?',
        [req.customer.sub]
      );
      res.json({ history, total: Number(total) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers/me/points/adjust — Admin manual points adjustment
  router.post('/me/points/adjust', authMiddleware, adminMiddleware, async (req, res) => {
    const { customer_id, points, reason } = req.body;
    if (!customer_id || typeof customer_id !== 'number') {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    if (!points || typeof points !== 'number' || points === 0) {
      return res.status(400).json({ error: 'points must be a non-zero number' });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verify customer exists and lock row
      const [[customer]] = await conn.query(
        'SELECT id, loyalty_points FROM customers WHERE id = ? FOR UPDATE',
        [customer_id]
      );
      if (!customer) {
        await conn.rollback();
        return res.status(404).json({ error: 'Customer not found' });
      }

      const oldBalance = Number(customer.loyalty_points) || 0;
      const newBalance = Math.max(0, oldBalance + points);
      const actualChange = newBalance - oldBalance;

      await conn.query(
        'UPDATE customers SET loyalty_points = ?, last_points_update = NOW() WHERE id = ?',
        [newBalance, customer_id]
      );
      await conn.query(
        `INSERT INTO loyalty_points_log (customer_id, points, type, reference_type, reference_id, notes, created_at)
         VALUES (?, ?, 'adjusted', 'admin', NULL, ?, NOW())`,
        [customer_id, actualChange, reason.trim()]
      );

      // Recalculate tier based on new balance
      let newTier = 'bronze';
      if (newBalance >= 5000) newTier = 'platinum';
      else if (newBalance >= 2000) newTier = 'gold';
      else if (newBalance >= 500) newTier = 'silver';
      await conn.query('UPDATE customers SET loyalty_tier = ? WHERE id = ?', [newTier, customer_id]);

      await conn.commit();

      const [updated] = await pool.query(
        'SELECT id, loyalty_points, loyalty_tier FROM customers WHERE id = ?',
        [customer_id]
      );
      await logAudit(pool, req, { action: 'points_adjust', entityType: 'customer', entityId: String(customer_id), details: { requested: points, actual: actualChange, newBalance, reason: reason.trim() } });
      res.json({ ok: true, customer: updated[0] });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    } finally {
      conn.release();
    }
  });

  // GET /api/customers/me/orders — Order history for current customer
  router.get('/me/orders', customerAuthMiddleware, async (req, res) => {
    try {
      const { limit = 20, offset = 0, status, from_date, to_date } = req.query;
      let sql = `SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.pay_method,
                        o.created_at, o.completed_at, s.name AS staff_name
                 FROM orders o
                 LEFT JOIN staff s ON o.staff_id = s.id
                 WHERE o.customer_id = ?`;
      const values = [req.customer.sub];

      if (status) {
        sql += ' AND o.status = ?';
        values.push(status);
      }
      if (from_date) {
        sql += ' AND o.created_at >= ?';
        values.push(from_date);
      }
      if (to_date) {
        sql += ' AND o.created_at <= ?';
        values.push(to_date);
      }

      sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
      values.push(Number(limit), Number(offset));

      const [orders] = await pool.query(sql, values);

      // Fetch order items and earned points for each order
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const [items] = await pool.query(
          `SELECT oi.order_id, oi.qty, oi.notes, oi.price,
                  COALESCE(oi.item_name, mi.name) AS item_name, mi.emoji,
                  oi.menu_item_id
           FROM order_items oi
           LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
           WHERE oi.order_id IN (?)`,
          [orderIds]
        );
        const [pointsRows] = await pool.query(
          `SELECT reference_id, points
           FROM loyalty_points_log
           WHERE reference_type = 'order' AND reference_id IN (?)`,
          [orderIds]
        );
        const pointsByOrder = {};
        for (const row of pointsRows) {
          pointsByOrder[row.reference_id] = Number(row.points) || 0;
        }
        // Group items by order_id
        const itemsByOrder = {};
        for (const item of items) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push({
            name: item.item_name,
            menu_item_id: item.menu_item_id,
            emoji: item.emoji,
            qty: item.qty,
            price: Number(item.price),
            notes: item.notes,
          });
        }
        // Attach items and actual earned points to orders
        for (const order of orders) {
          order.items = itemsByOrder[order.id] || [];
          order.points_earned = pointsByOrder[order.id] ?? 0;
        }
      }

      res.json(orders);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/lookup?phone=… — minimal public loyalty lookup (#173)
  // Powers the customer display: returns name + points + tier only, never email/password_hash.
  // Must stay before the /:id routes below.
  router.get('/lookup', authMiddleware, adminMiddleware, async (req, res) => {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ error: 'phone is required' });
    }
    try {
      // Same normalization as order creation (orders.js) so the phone matches
      const normalizedPhone = phone.trim();
      const [rows] = await pool.query(
        'SELECT name_enc, loyalty_points, loyalty_tier FROM customers WHERE phone_hash = ?',
        [phoneHash(normalizedPhone)]
      );
      if (!rows.length) return res.json({ found: false });
      const customer = rows[0];
      res.json({
        found: true,
        name: decryptPii(customer.name_enc),
        loyalty_points: Number(customer.loyalty_points) || 0,
        loyalty_tier: customer.loyalty_tier,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // ── Admin Endpoints (MUST be after /me routes, before /:id) ──────────

  // GET /api/customers/:id — single customer
  router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query(`SELECT ${customerColumns} FROM customers WHERE id = ?`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(decryptCustomerRow(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /api/customers/:id/orders — order history
  router.get('/:id/orders', authMiddleware, adminMiddleware, locationScope, async (req, res) => {
    try {
      const scope = scopedLocationCondition(req, 'o.location_id');
      const [rows] = await pool.query(
        `SELECT o.id, o.status, o.subtotal, o.tax, o.total, o.pay_method, o.created_at, o.completed_at,
                s.name AS staff_name
         FROM orders o
         LEFT JOIN staff s ON o.staff_id = s.id
         WHERE o.customer_id = ?${scope.sql}
         ORDER BY o.created_at DESC`,
        [req.params.id, ...scope.params]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST /api/customers — create or update by phone
  router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const { phone, name, email, notes } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }
    try {
      const normalizedPhone = phone.trim();
      // Upsert: if phone exists, update name/email/notes; otherwise insert
      const [existing] = await pool.query('SELECT id FROM customers WHERE phone_hash = ?', [phoneHash(normalizedPhone)]);
      if (existing.length > 0) {
        const fields = [];
        const values = [];
        if (name !== undefined) { fields.push('name_enc = ?'); values.push(encryptPii(name)); }
        if (email !== undefined) { fields.push('email_enc = ?'); values.push(encryptPii(email)); }
        if (email !== undefined) { fields.push('email_hash = ?'); values.push(email ? emailHash(email) : null); }
        if (notes !== undefined) { fields.push('notes_enc = ?'); values.push(encryptPii(notes)); }
        if (fields.length > 0) {
          values.push(phoneHash(normalizedPhone));
          await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE phone_hash = ?`, values);
        }
        const [updated] = await pool.query(`SELECT ${customerColumns} FROM customers WHERE phone_hash = ?`, [phoneHash(normalizedPhone)]);
        await logAudit(pool, req, { action: 'customer_update', entityType: 'customer', entityId: String(existing[0].id), details: { phone_hash: phoneHash(normalizedPhone) } });
        return res.json(decryptCustomerRow(updated[0]));
      }
      const [r] = await pool.query(
        'INSERT INTO customers (phone_hash, phone_enc, name_enc, email_hash, email_enc, notes_enc) VALUES (?, ?, ?, ?, ?, ?)',
        [phoneHash(normalizedPhone), encryptPii(normalizedPhone), encryptPii(name || null), email ? emailHash(email) : null, encryptPii(email), encryptPii(notes || null)]
      );
      const [inserted] = await pool.query(`SELECT ${customerColumns} FROM customers WHERE id = ?`, [r.insertId]);
      await logAudit(pool, req, { action: 'customer_create', entityType: 'customer', entityId: String(r.insertId), details: { phone_hash: phoneHash(normalizedPhone) } });
      res.json(decryptCustomerRow(inserted[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/customers/:id — update customer
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { name, email, notes } = req.body;
    try {
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name_enc = ?'); values.push(encryptPii(name)); }
      if (email !== undefined) { fields.push('email_enc = ?'); values.push(encryptPii(email)); }
      if (email !== undefined) { fields.push('email_hash = ?'); values.push(email ? emailHash(email) : null); }
      if (notes !== undefined) { fields.push('notes_enc = ?'); values.push(encryptPii(notes)); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
      values.push(req.params.id);
      await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
      const [rows] = await pool.query(`SELECT ${customerColumns} FROM customers WHERE id = ?`, [req.params.id]);
      await logAudit(pool, req, { action: 'customer_update', entityType: 'customer', entityId: req.params.id });
      res.json(decryptCustomerRow(rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
