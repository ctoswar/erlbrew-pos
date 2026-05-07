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

  // GET all menu items (public) — with modifiers
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM menu_items');
      // Fetch modifiers separately and attach (compatible with all MySQL versions)
      const [modRows] = await pool.query('SELECT id, menu_item_id, name, price, is_default AS isDefault FROM menu_modifiers');
      const modMap = {};
      for (const mod of modRows) {
        if (!modMap[mod.menu_item_id]) modMap[mod.menu_item_id] = [];
        modMap[mod.menu_item_id].push({
          id: mod.id,
          name: mod.name,
          price: mod.price,
          isDefault: !!mod.isDefault,
        });
      }
      const result = rows.map(row => ({
        ...row,
        modifiers: modMap[row.id] || [],
      }));
      res.json(result);
    } catch (e) {
      console.error(e);
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

  // GET modifiers for a menu item (public)
  router.get('/:id/modifiers', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        'SELECT id, name, price, is_default AS isDefault FROM menu_modifiers WHERE menu_item_id = ?',
        [id]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST a modifier for a menu item (admin only)
  router.post('/:id/modifiers', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, price = 0, isDefault = false } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    try {
      const [r] = await pool.query(
        'INSERT INTO menu_modifiers (menu_item_id, name, price, is_default) VALUES (?, ?, ?, ?)',
        [id, name, Number(price) || 0, Boolean(isDefault)]
      );
      res.json({ id: r.insertId, name, price: Number(price) || 0, isDefault: Boolean(isDefault) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT update a modifier (admin only)
  router.put('/modifiers/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, price, isDefault } = req.body;
    try {
      const fields = [];
      const vals = [];
      if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
      if (price !== undefined) { fields.push('price = ?'); vals.push(Number(price)); }
      if (isDefault !== undefined) { fields.push('is_default = ?'); vals.push(Boolean(isDefault)); }
      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
      vals.push(id);
      await pool.query(`UPDATE menu_modifiers SET ${fields.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // DELETE a modifier (admin only)
  router.delete('/modifiers/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM menu_modifiers WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
