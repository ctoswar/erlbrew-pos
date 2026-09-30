import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { analyzeMenu } from '../services/aiEngine/menuAnalytics.js';

const MIN_DAYS = 7;
const MAX_DAYS = 735;
const DEFAULT_DAYS = 90;

/**
 * Phase 3 (issue #181) — Insights API.
 *
 * All numbers are computed by the pure math engine in
 * services/aiEngine/menuAnalytics.js; this router only fetches rows and
 * packages the result. Admin (Manager) only.
 */
export default function insightsRouter(pool) {
  const router = Router();

  // GET /api/insights/menu?days=90 — best/worst sellers, ABC classes,
  // sales-vs-margin matrix and data-quality signals.
  router.get('/menu', authMiddleware, adminMiddleware, async (req, res) => {
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw)
      ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(daysRaw)))
      : DEFAULT_DAYS;

    try {
      // Same guard as the COGS routes: degrade (unknown margins) instead of
      // crashing when the purchase_cost/unit_cost migration hasn't run yet.
      let costColumnsExist = false;
      try {
        const [cols] = await pool.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
            AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
        `);
        costColumnsExist = Array.isArray(cols) && cols.length >= 2;
      } catch (_) {
        costColumnsExist = false;
      }

      // Per-serving ingredient cost = SUM(recipe qty × inventory cost).
      // Inventory rows are averaged per id first so multi-location setups
      // can't double-count (mirrors, but hardens, the COGS join).
      const costJoin = costColumnsExist
        ? `LEFT JOIN (
             SELECT r.menu_item_id AS mid, SUM(r.quantity * ic.cost) AS unit_cogs
             FROM recipes r
             JOIN (SELECT id, AVG(purchase_cost) AS cost FROM inventory GROUP BY id) ic
               ON ic.id = r.inventory_item_id
             GROUP BY r.menu_item_id
           ) c ON c.mid = m.id`
        : '';

      // Every menu item (LEFT JOIN): items with no sales in the window come
      // back with qty 0 and surface as "unsold" in the matrix.
      const [rows] = await pool.query(
        `SELECT m.id, m.name, m.category, m.price, m.emoji,
                COALESCE(s.qty, 0) AS qty,
                COALESCE(s.revenue, 0) AS revenue
                ${costColumnsExist ? ', c.unit_cogs' : ', NULL AS unit_cogs'}
         FROM menu_items m
         LEFT JOIN (
           SELECT oi.menu_item_id AS mid,
                  SUM(oi.qty) AS qty,
                  SUM(oi.qty * oi.price) AS revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.status = 'completed'
             AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY oi.menu_item_id
         ) s ON s.mid = m.id
         ${costJoin}
         ORDER BY revenue DESC, m.name ASC`,
        [days]
      );

      const [[hist]] = await pool.query(
        `SELECT COALESCE(TIMESTAMPDIFF(WEEK, MIN(created_at), NOW()), 0) AS weeks
         FROM orders`
      );
      const [[ord]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM orders
         WHERE status = 'completed'
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
        [days]
      );

      res.json(analyzeMenu({
        rows: rows || [],
        days,
        orderCount: Number(ord?.cnt) || 0,
        weeksOfHistory: Number(hist?.weeks) || 0,
      }));
    } catch (err) {
      console.error('insights/menu error:', err);
      res.status(500).json({ error: 'Failed to build menu insights' });
    }
  });

  return router;
}
