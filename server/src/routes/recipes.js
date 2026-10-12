import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { locationScope, requireLocationId, scopedLocationCondition } from '../middleware/location.js';

export default function recipesRouter(pool) {
  const router = Router();

  // GET /api/recipes/:menuItemId — get all ingredients for a menu item
  router.get('/:menuItemId', authMiddleware, locationScope, async (req, res) => {
    try {
      const sizeId = Number.isInteger(Number(req.query.size_id)) ? Number(req.query.size_id) : 0;
      const scope = scopedLocationCondition(req, 'i.location_id');
      const [rows] = await pool.query(
        `SELECT r.id, r.size_id, r.inventory_item_id, r.quantity,
                i.name AS inventory_name, i.category, i.unit, i.stock, i.low_stock_threshold
         FROM recipes r
         JOIN inventory i ON i.id = r.inventory_item_id
         WHERE r.menu_item_id = ? AND r.size_id = ?${scope.sql}`,
        [req.params.menuItemId, sizeId, ...scope.params]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  // PUT /api/recipes/:menuItemId — replace all ingredients for a menu item
  router.put('/:menuItemId', authMiddleware, adminMiddleware, locationScope, requireLocationId, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { items } = req.body;
      const sizeId = Number.isInteger(Number(req.body?.size_id)) ? Number(req.body.size_id) : 0;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

      await conn.beginTransaction();
      await conn.query('DELETE FROM recipes WHERE menu_item_id = ? AND size_id = ?', [req.params.menuItemId, sizeId]);

      if (items.length > 0) {
        const vals = items
          .filter((it) => it.inventory_item_id && it.quantity > 0)
          .map((it) => [req.params.menuItemId, sizeId, it.inventory_item_id, Number(it.quantity)]);
        if (vals.length > 0) {
          await conn.query('INSERT INTO recipes (menu_item_id, size_id, inventory_item_id, quantity) VALUES ?', [vals]);
        }
      }

      await conn.commit();

      // Audit: recipes updated
      await logAudit(pool, req, { action: 'recipes_update', entityType: 'recipes', entityId: req.params.menuItemId, details: { ingredientCount: items.length } });

      const scope = scopedLocationCondition(req, 'i.location_id');
      const [rows] = await pool.query(
        `SELECT r.id, r.size_id, r.inventory_item_id, r.quantity,
                i.name AS inventory_name, i.category, i.unit, i.stock, i.low_stock_threshold
         FROM recipes r
         JOIN inventory i ON i.id = r.inventory_item_id
         WHERE r.menu_item_id = ? AND r.size_id = ?${scope.sql}`,
        [req.params.menuItemId, sizeId, ...scope.params]
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
  //
  // Optionally scoped to a size profile via `size_label` (e.g. "8OZ").
  // Size IDs are per-menu-item rows, so profiles are matched across items by
  // LABEL, never by id. Only the resolved profile is replaced — other size
  // profiles of the target items are left untouched.
  //
  // Fallback when a target has no matching label:
  //   - item has no sizes at all → write to base (size_id 0, its only profile)
  //   - item has sizes but not this one → skip (reported back to the client)
  router.post('/batch', authMiddleware, adminMiddleware, locationScope, requireLocationId, async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { items, menuItemIds, size_label: sizeLabel } = req.body;
      if (!Array.isArray(items) || !Array.isArray(menuItemIds)) {
        return res.status(400).json({ error: 'items and menuItemIds must be arrays' });
      }

      const validItems = items
        .filter((it) => it.inventory_item_id && it.quantity > 0)
        .map((it) => [it.inventory_item_id, Number(it.quantity)]);

      if (validItems.length === 0) {
        return res.status(400).json({ error: 'No valid ingredients provided' });
      }

      const label = typeof sizeLabel === 'string' && sizeLabel.trim() ? sizeLabel.trim() : null;

      await conn.beginTransaction();

      let applied = 0;
      let toSize = 0;            // written to the matching size profile
      let toBase = 0;            // written to base (size_id 0)
      const skippedItems = [];   // have sizes, but not the requested one

      for (const menuItemId of menuItemIds) {
        let sizeId = 0;
        if (label) {
          const [match] = await conn.query(
            'SELECT id FROM menu_item_sizes WHERE menu_item_id = ? AND UPPER(label) = UPPER(?) LIMIT 1',
            [menuItemId, label]
          );
          if (match.length) {
            sizeId = match[0].id;
          } else {
            const [hasSizes] = await conn.query(
              'SELECT id FROM menu_item_sizes WHERE menu_item_id = ? LIMIT 1',
              [menuItemId]
            );
            if (hasSizes.length) {
              skippedItems.push(menuItemId);
              continue; // don't guess — leave this item's profiles alone
            }
            sizeId = 0; // no sizes on this item → base is its only profile
          }
        }

        await conn.query('DELETE FROM recipes WHERE menu_item_id = ? AND size_id = ?', [menuItemId, sizeId]);
        const vals = validItems.map(([inventory_item_id, quantity]) => [menuItemId, sizeId, inventory_item_id, quantity]);
        await conn.query('INSERT INTO recipes (menu_item_id, size_id, inventory_item_id, quantity) VALUES ?', [vals]);
        applied++;
        if (sizeId === 0) toBase++;
        else toSize++;
      }

      await conn.commit();

      await logAudit(pool, req, {
        action: 'recipes_batch_apply',
        entityType: 'recipes',
        entityId: menuItemIds.join(','),
        details: {
          applied,
          sizeLabel: label || 'base',
          toSize,
          toBase,
          skipped: skippedItems.length,
          ingredientCount: validItems.length,
        },
      });

      res.json({
        ok: true,
        applied,
        sizeLabel: label || 'base',
        toSize,
        toBase,
        skipped: skippedItems.length,
        skippedItems,
      });
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