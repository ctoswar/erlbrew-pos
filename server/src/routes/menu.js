import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

// Validation helper per FIX 5
function validate(req, res, rules){
  for (const [field, check] of Object.entries(rules||{})){
    const val = req.body?.[field];
    if (check?.required && (val === undefined || val === null || val === '')) {
      return res.status(400).json({ error: `${field} is required` });
    }
    if (check?.type && typeof val !== check.type) {
      return res.status(400).json({ error: `${field} must be a ${check.type}` });
    }
    if (check?.enum && !check.enum.includes(val)) {
      return res.status(400).json({ error: `${field} must be one of: ${check.enum.join(', ')}` });
    }
    if (check?.minLen && typeof val === 'string' && val.length < check.minLen) {
      return res.status(400).json({ error: `${field} must be at least ${check.minLen} characters` });
    }
    if (check?.maxLen && typeof val === 'string' && val.length > check.maxLen) {
      return res.status(400).json({ error: `${field} must be at most ${check.maxLen} characters` });
    }
  }
  return null;
}

export default function menuRouter(pool){
  const router = express.Router();

  // GET all menu items (public)
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM menu_items');
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Create item (admin only)
  router.post('/', authMiddleware, async (req, res) => {
    const { id, name, category, price, badge, description, emoji, popular } = req.body;
    const err = validate(req, res, {
      id: { required: true, type: 'string', maxLen: 64 },
      name: { required: true, type: 'string', maxLen: 128 },
      category: { required: true, type: 'string' },
      price: { required: true, type: 'number' },
    });
    if (err) return err;
    try {
      const [r] = await pool.query('INSERT INTO menu_items (id, name, category, price, badge, description, emoji, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, name, category, price, badge, description, emoji, popular]);
      res.json({ id: r.insertId });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Update item (admin only)
  router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, category, price, badge, description, emoji, popular } = req.body;
const err = validate(req, res, {
    name: { required: true, type: 'string', maxLen: 128 },
    category: { required: true, type: 'string' },
    price: { required: true, type: 'number' },
  });
  if (err) return err;
  try {
    await pool.query('UPDATE menu_items SET name=?, category=?, price=?, badge=?, description=?, emoji=?, popular=? WHERE id=?', [name, category, price, badge, description, emoji, popular, id]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Delete item (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.length > 64) {
    return res.status(400).json({ error: 'id is required and must be a string' });
  }
  try {
    // Delete child order_items first, then the menu item
    await pool.query('DELETE FROM order_items WHERE menu_item_id = ?', [id]);
    await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

  return router;
}
