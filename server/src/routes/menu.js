import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

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

  // GET all menu items (public) — with modifiers and sizes
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
          price: Number(mod.price) || 0,
          isDefault: !!mod.isDefault,
        });
      }
      // Fetch sizes (table may not exist yet on first deploy)
      let sizeMap = {};
      try {
        const [sizeRows] = await pool.query('SELECT id, menu_item_id, label, price, sort_order AS sortOrder FROM menu_item_sizes ORDER BY sort_order');
        for (const sz of sizeRows) {
          if (!sizeMap[sz.menu_item_id]) sizeMap[sz.menu_item_id] = [];
          sizeMap[sz.menu_item_id].push({
            id: sz.id,
            label: sz.label,
            price: Number(sz.price) || 0,
            sortOrder: Number(sz.sortOrder) || 0,
          });
        }
      } catch (_) { /* menu_item_sizes table doesn't exist yet */ }
      const result = rows.map(row => ({
        ...row,
        price: Number(row.price) || 0,
        modifiers: modMap[row.id] || [],
        sizes: sizeMap[row.id] || [],
      }));
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET /menu/sync — Optimized menu for Flutter app consumption
  router.get('/sync', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, category, price, badge, description, emoji, popular, image FROM menu_items ORDER BY category, name'
      );
      const [modRows] = await pool.query(
        'SELECT id, menu_item_id, name, price, is_default AS isDefault FROM menu_modifiers'
      );
      const modMap = {};
      for (const mod of modRows) {
        if (!modMap[mod.menu_item_id]) modMap[mod.menu_item_id] = [];
        modMap[mod.menu_item_id].push({
          id: mod.id,
          name: mod.name,
          price: Number(mod.price) || 0,
          isDefault: !!mod.isDefault,
        });
      }
      // Fetch sizes (table may not exist yet on first deploy)
      let sizeMap = {};
      try {
        const [sizeRows] = await pool.query(
          'SELECT id, menu_item_id, label, price, sort_order AS sortOrder FROM menu_item_sizes ORDER BY sort_order'
        );
        for (const sz of sizeRows) {
          if (!sizeMap[sz.menu_item_id]) sizeMap[sz.menu_item_id] = [];
          sizeMap[sz.menu_item_id].push({
            id: sz.id,
            label: sz.label,
            price: Number(sz.price) || 0,
            sortOrder: Number(sz.sortOrder) || 0,
          });
        }
      } catch (_) { /* menu_item_sizes table doesn't exist yet */ }
      // Group by category for Flutter consumption
      const categories = {};
      for (const row of rows) {
        const cat = row.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({
          ...row,
          price: Number(row.price) || 0,
          modifiers: modMap[row.id] || [],
          sizes: sizeMap[row.id] || [],
        });
      }
      res.json({ items: rows.map(r => ({ ...r, price: Number(r.price) || 0, modifiers: modMap[r.id] || [], sizes: sizeMap[r.id] || [] })), categories, modifiers: modMap, sizes: sizeMap });
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
      await logAudit(pool, req, { action: 'menu_create', entityType: 'menu_item', entityId: id, details: { name, category, price } });
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
      await logAudit(pool, req, { action: 'menu_update', entityType: 'menu_item', entityId: id, details: { name, category, price } });
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
      await logAudit(pool, req, { action: 'menu_delete', entityType: 'menu_item', entityId: id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT /api/menu/:id/sizes — replace all sizes for a menu item (admin only)
  router.put('/:id/sizes', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { sizes } = req.body;
    if (!Array.isArray(sizes)) return res.status(400).json({ error: 'sizes must be an array' });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM menu_item_sizes WHERE menu_item_id = ?', [id]);
      if (sizes.length > 0) {
        const vals = sizes
          .filter((s) => s.label && s.price !== undefined)
          .map((s, i) => [id, s.label, Number(s.price), s.sortOrder ?? i]);
        if (vals.length > 0) {
          await conn.query('INSERT INTO menu_item_sizes (menu_item_id, label, price, sort_order) VALUES ?', [vals]);
        }
      }
      await conn.commit();
      await logAudit(pool, req, { action: 'menu_sizes_update', entityType: 'menu_item', entityId: id, details: { sizeCount: sizes.length } });
      const [rows] = await pool.query(
        'SELECT id, label, price, sort_order AS sortOrder FROM menu_item_sizes WHERE menu_item_id = ? ORDER BY sort_order',
        [id]
      );
      res.json(rows);
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res.status(500).json({ error: 'Failed to save sizes' });
    } finally {
      conn.release();
    }
  });

  // POST batch apply modifier to multiple menu items (admin only) — MUST be before /:id/modifiers
  router.post('/modifiers/batch-apply', authMiddleware, async (req, res) => {
    const { modifier, menuItemIds } = req.body;
    if (!modifier || !modifier.name || typeof modifier.name !== 'string') {
      return res.status(400).json({ error: 'modifier.name is required' });
    }
    if (!Array.isArray(menuItemIds) || menuItemIds.length === 0) {
      return res.status(400).json({ error: 'menuItemIds must be a non-empty array' });
    }
    try {
      let created = 0;
      let skipped = 0;
      for (const itemId of menuItemIds) {
        // Check if modifier already exists for this item
        const [existing] = await pool.query(
          'SELECT id FROM menu_modifiers WHERE menu_item_id = ? AND name = ?',
          [itemId, modifier.name]
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        await pool.query(
          'INSERT INTO menu_modifiers (menu_item_id, name, price, is_default) VALUES (?, ?, ?, ?)',
          [itemId, modifier.name, Number(modifier.price) || 0, Boolean(modifier.isDefault)]
        );
        created++;
      }
      await logAudit(pool, req, {
        action: 'modifier_batch_apply',
        entityType: 'menu_modifier',
        entityId: 'batch',
        details: { modifierName: modifier.name, price: Number(modifier.price) || 0, menuItemIds, created, skipped }
      });
      res.json({ ok: true, created, skipped });
    } catch (e) {
      console.error(e);
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
      await logAudit(pool, req, { action: 'modifier_create', entityType: 'menu_modifier', entityId: String(r.insertId), details: { menuItemId: id, name, price: Number(price) || 0 } });
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
      await logAudit(pool, req, { action: 'modifier_update', entityType: 'menu_modifier', entityId: id, details: { name, price } });
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
      await logAudit(pool, req, { action: 'modifier_delete', entityType: 'menu_modifier', entityId: id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}
