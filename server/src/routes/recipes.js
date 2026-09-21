import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export default function recipesRouter(pool) {
  const router = Router();

  // GET /api/recipes/:menuItemId — get all ingredients for a menu item
  router.get('/:menuItemId', async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT r.id, r.inventory_item_id, r.quantity,
                i.name AS inventory_name, i.category, i.unit, i.stock, i.low_stock_threshold
         FROM recipes r
         JOIN inventory i ON i.id = r.inventory_item_id
         WHERE r.menu_item_id = ?`,
        [req.params.menuItemId]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  // PUT /api/recipes/:menuItemId — replace all ingredients for a menu item
  router.put('/:menuItemId', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

      await conn.beginTransaction();
      await conn.query('DELETE FROM recipes WHERE menu_item_id = ?', [req.params.menuItemId]);

      if (items.length > 0) {
        const vals = items
          .filter((it) => it.inventory_item_id && it.quantity > 0)
          .map((it) => [req.params.menuItemId, it.inventory_item_id, Number(it.quantity)]);
        if (vals.length > 0) {
          await conn.query('INSERT INTO recipes (menu_item_id, inventory_item_id, quantity) VALUES ?', [vals]);
        }
      }

      await conn.commit();

      // Audit: recipes updated
      await logAudit(pool, req, { action: 'recipes_update', entityType: 'recipes', entityId: req.params.menuItemId, details: { ingredientCount: items.length } });

      const [rows] = await pool.query(
        `SELECT r.id, r.inventory_item_id, r.quantity,
                i.name AS inventory_name, i.category, i.unit, i.stock, i.low_stock_threshold
         FROM recipes r
         JOIN inventory i ON i.id = r.inventory_item_id
         WHERE r.menu_item_id = ?`,
        [req.params.menuItemId]
      );
      res.json(rows);
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to save recipes' });
    } finally {
      conn.release();
    }
  });

  // POST /api/recipes/batch — apply same ingredients to multiple menu items
  router.post('/batch', authMiddleware, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { items, menuItemIds } = req.body;
      if (!Array.isArray(items) || !Array.isArray(menuItemIds)) {
        return res.status(400).json({ error: 'items and menuItemIds must be arrays' });
      }

      const validItems = items
        .filter((it) => it.inventory_item_id && it.quantity > 0)
        .map((it) => [it.inventory_item_id, Number(it.quantity)]);

      if (validItems.length === 0) {
        return res.status(400).json({ error: 'No valid ingredients provided' });
      }

      await conn.beginTransaction();

      let applied = 0;
      for (const menuItemId of menuItemIds) {
        await conn.query('DELETE FROM recipes WHERE menu_item_id = ?', [menuItemId]);
        if (validItems.length > 0) {
          const vals = validItems.map(([inventory_item_id, quantity]) => [menuItemId, inventory_item_id, quantity]);
          await conn.query('INSERT INTO recipes (menu_item_id, inventory_item_id, quantity) VALUES ?', [vals]);
        }
        applied++;
      }

      await conn.commit();

      await logAudit(pool, req, { action: 'recipes_batch_apply', entityType: 'recipes', entityId: menuItemIds.join(','), details: { applied, ingredientCount: validItems.length } });

      res.json({ ok: true, applied });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to batch apply ingredients' });
    } finally {
      conn.release();
    }
  });

  return router;
}