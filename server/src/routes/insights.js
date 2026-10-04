import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { locationScope, scopedLocationCondition } from '../middleware/location.js';
import { analyzeMenu } from '../services/aiEngine/menuAnalytics.js';
import {
  calculateInventoryActions,
  forecastSales,
  recommendCombos,
  suggestStaffing,
  suggestPrices,
} from '../services/aiEngine/phase3Analytics.js';
import { createOllamaClient } from '../services/ollamaClient.js';

const MIN_DAYS = 7;
const MAX_DAYS = 735;
const DEFAULT_DAYS = 90;
const MIN_HORIZON_DAYS = 1;
const MAX_HORIZON_DAYS = 90;
const DEFAULT_HORIZON_DAYS = 14;

function boundedDays(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

function readDays(req) {
  return boundedDays(req.query?.days, DEFAULT_DAYS, MIN_DAYS, MAX_DAYS);
}

function readHorizonDays(req) {
  return boundedDays(req.query?.horizonDays, DEFAULT_HORIZON_DAYS, MIN_HORIZON_DAYS, MAX_HORIZON_DAYS);
}

function locationIdForResponse(req) {
  return req.locationId === undefined ? null : req.locationId;
}

async function hasCostColumns(pool) {
  try {
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory'
        AND COLUMN_NAME IN ('purchase_cost', 'unit_cost')
    `);
    return Array.isArray(columns) && columns.length >= 2;
  } catch (error) {
    console.warn('Unable to inspect inventory cost columns:', error.message);
    return false;
  }
}

function whereLocation(req, column) {
  const scope = scopedLocationCondition(req, column);
  return { sql: scope.sql, params: scope.params };
}

async function loadMenuInsights(pool, req, days) {
  const costColumnsExist = await hasCostColumns(pool);
  const salesScope = whereLocation(req, 'o.location_id');
  const costScope = whereLocation(req, 'i.location_id');
  const costJoin = costColumnsExist
    ? `LEFT JOIN (
         SELECT r.menu_item_id AS mid, SUM(r.quantity * ic.cost) AS unit_cogs
         FROM recipes r
         JOIN (
           SELECT id, AVG(purchase_cost) AS cost
           FROM inventory i
           ${costScope.sql ? `WHERE 1 = 1${costScope.sql}` : ''}
           GROUP BY id
         ) ic ON ic.id = r.inventory_item_id
         GROUP BY r.menu_item_id
       ) c ON c.mid = m.id`
    : '';

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
         AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${salesScope.sql}
       GROUP BY oi.menu_item_id
     ) s ON s.mid = m.id
     ${costJoin}
     ORDER BY revenue DESC, m.name ASC`,
    [
      days,
      ...salesScope.params,
      ...(costColumnsExist ? costScope.params : []),
    ],
  );

  const historyScope = whereLocation(req, 'location_id');
  const [[history]] = await pool.query(
    `SELECT COALESCE(TIMESTAMPDIFF(WEEK, MIN(created_at), NOW()), 0) AS weeks
     FROM orders
     WHERE 1 = 1${historyScope.sql}`,
    historyScope.params,
  );
  const [[orderCount]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE status = 'completed'
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${historyScope.sql}`,
    [days, ...historyScope.params],
  );

  return {
    ...analyzeMenu({
      rows: rows || [],
      days,
      orderCount: Number(orderCount?.cnt) || 0,
      weeksOfHistory: Number(history?.weeks) || 0,
    }),
    locationId: locationIdForResponse(req),
  };
}

async function loadForecast(pool, req, days, horizonDays, menuItems) {
  const scope = whereLocation(req, 'o.location_id');
  const [dailyRows] = await pool.query(
    `SELECT DATE(o.created_at) AS sale_date,
            oi.menu_item_id,
            SUM(oi.qty) AS qty,
            SUM(oi.qty * oi.price) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'completed'
       AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${scope.sql}
     GROUP BY DATE(o.created_at), oi.menu_item_id
     ORDER BY sale_date ASC, oi.menu_item_id ASC`,
    [days, ...scope.params],
  );
  const [[todayRow]] = await pool.query('SELECT CURDATE() AS today');
  const asOfDate = String(todayRow?.today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  return forecastSales({
    items: menuItems,
    dailyRows: dailyRows || [],
    historyDays: days,
    horizonDays,
    asOfDate,
  });
}

async function loadInventoryActions(pool, req, forecasts) {
  const inventoryScope = whereLocation(req, 'i.location_id');
  const inventoryWhere = inventoryScope.sql ? `WHERE 1 = 1${inventoryScope.sql}` : '';
  const [inventory] = await pool.query(
    `SELECT i.id, i.name, i.unit, i.stock, i.low_stock_threshold, i.location_id
     FROM inventory i ${inventoryWhere}
     ORDER BY i.name ASC`,
    inventoryScope.params,
  );
  const [recipes] = await pool.query(
    `SELECT menu_item_id, inventory_item_id, quantity
     FROM recipes
     ORDER BY menu_item_id ASC, inventory_item_id ASC`,
  );
  return calculateInventoryActions({
    inventory: inventory || [],
    recipes: recipes || [],
    forecasts,
  });
}

async function loadCombos(pool, req, days) {
  const scope = whereLocation(req, 'o.location_id');
  const [pairs] = await pool.query(
    `SELECT a.menu_item_id AS first_menu_item_id,
            m1.name AS first_name,
            b.menu_item_id AS second_menu_item_id,
            m2.name AS second_name,
            COUNT(DISTINCT a.order_id) AS pair_orders
     FROM order_items a
     JOIN order_items b
       ON b.order_id = a.order_id
      AND a.menu_item_id < b.menu_item_id
     JOIN orders o ON o.id = a.order_id
     LEFT JOIN menu_items m1 ON m1.id = a.menu_item_id
     LEFT JOIN menu_items m2 ON m2.id = b.menu_item_id
     WHERE o.status = 'completed'
       AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${scope.sql}
     GROUP BY a.menu_item_id, m1.name, b.menu_item_id, m2.name
     ORDER BY pair_orders DESC`,
    [days, ...scope.params],
  );
  const [itemOrders] = await pool.query(
    `SELECT oi.menu_item_id, COUNT(DISTINCT o.id) AS order_count
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'completed'
       AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${scope.sql}
     GROUP BY oi.menu_item_id`,
    [days, ...scope.params],
  );
  const [[orderCount]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE status = 'completed'
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${scope.sql}`,
    [days, ...scope.params],
  );
  return recommendCombos({
    pairs: pairs || [],
    itemOrders: itemOrders || [],
    totalOrders: Number(orderCount?.cnt) || 0,
  });
}

async function loadOptimization(pool, req, days, horizonDays) {
  const menu = await loadMenuInsights(pool, req, days);
  const forecasts = await loadForecast(pool, req, days, horizonDays, menu.items);
  const inventoryActions = await loadInventoryActions(pool, req, forecasts);
  const combos = await loadCombos(pool, req, days);
  const staffing = await loadStaffing(pool, req, days);
  return {
    locationId: locationIdForResponse(req),
    windowDays: days,
    horizonDays,
    forecasts,
    inventoryActions,
    combos,
    priceSuggestions: suggestPrices({ items: menu.items, historyDays: days }),
    staffing,
  };
}

async function loadStaffing(pool, req, days) {
  const orderScope = whereLocation(req, 'o.location_id');
  const [hourlyRows] = await pool.query(
    `SELECT DAYOFWEEK(o.created_at) AS day_of_week,
            HOUR(o.created_at) AS hour,
            COUNT(DISTINCT o.id) AS order_count
     FROM orders o
     WHERE o.status = 'completed'
       AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${orderScope.sql}
     GROUP BY DAYOFWEEK(o.created_at), HOUR(o.created_at)`,
    [days, ...orderScope.params],
  );
  const staffScope = whereLocation(req, 's.location_id');
  const [[staffRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM staff s
     WHERE s.role IN ('Barista', 'Manager')${staffScope.sql}`,
    staffScope.params,
  );
  return suggestStaffing({
    hourlyRows: hourlyRows || [],
    staffCount: Number(staffRow?.cnt) || 0,
    historyDays: days,
  });
}

export default function insightsRouter(pool, options = {}) {
  const router = Router();
  const ollamaClient = options.ollamaClient || createOllamaClient(options.ollama);

  // Existing menu analytics is Manager-only and now follows the same
  // location selector/assignment convention as inventory and reports.
  router.get('/menu', authMiddleware, adminMiddleware, locationScope, async (req, res) => {
    const days = readDays(req);
    try {
      res.json(await loadMenuInsights(pool, req, days));
    } catch (error) {
      console.error('insights/menu error:', error);
      res.status(500).json({ error: 'Failed to build menu insights' });
    }
  });

  router.get('/forecast', authMiddleware, adminMiddleware, locationScope, async (req, res) => {
    const days = readDays(req);
    const horizonDays = readHorizonDays(req);
    try {
      const menu = await loadMenuInsights(pool, req, days);
      const forecasts = await loadForecast(pool, req, days, horizonDays, menu.items);
      res.json({ locationId: locationIdForResponse(req), windowDays: days, horizonDays, forecasts });
    } catch (error) {
      console.error('insights/forecast error:', error);
      res.status(500).json({ error: 'Failed to build sales forecast' });
    }
  });

  const inventoryHandler = async (req, res) => {
    const days = readDays(req);
    const horizonDays = readHorizonDays(req);
    try {
      const menu = await loadMenuInsights(pool, req, days);
      const forecasts = await loadForecast(pool, req, days, horizonDays, menu.items);
      const inventoryActions = await loadInventoryActions(pool, req, forecasts);
      res.json({ locationId: locationIdForResponse(req), windowDays: days, horizonDays, inventoryActions });
    } catch (error) {
      console.error('insights/inventory error:', error);
      res.status(500).json({ error: 'Failed to build inventory actions' });
    }
  };
  router.get('/inventory', authMiddleware, adminMiddleware, locationScope, inventoryHandler);
  router.get('/inventory-actions', authMiddleware, adminMiddleware, locationScope, inventoryHandler);

  const optimizationHandler = async (req, res) => {
    const days = readDays(req);
    const horizonDays = readHorizonDays(req);
    try {
      res.json(await loadOptimization(pool, req, days, horizonDays));
    } catch (error) {
      console.error('insights/optimization error:', error);
      res.status(500).json({ error: 'Failed to build menu optimization insights' });
    }
  };
  router.get('/optimization', authMiddleware, adminMiddleware, locationScope, optimizationHandler);
  router.get('/combos', authMiddleware, adminMiddleware, locationScope, optimizationHandler);
  router.get('/pricing', authMiddleware, adminMiddleware, locationScope, optimizationHandler);
  router.get('/staffing', authMiddleware, adminMiddleware, locationScope, async (req, res) => {
    const days = readDays(req);
    try {
      res.json({ locationId: locationIdForResponse(req), windowDays: days, staffing: await loadStaffing(pool, req, days) });
    } catch (error) {
      console.error('insights/staffing error:', error);
      res.status(500).json({ error: 'Failed to build staffing suggestions' });
    }
  });

  const briefingHandler = async (req, res) => {
    const days = readDays(req);
    const horizonDays = readHorizonDays(req);
    try {
      const analytics = await loadOptimization(pool, req, days, horizonDays);
      const briefing = await ollamaClient.generateBriefing({
        locationId: analytics.locationId,
        windowDays: analytics.windowDays,
        horizonDays: analytics.horizonDays,
        forecast: analytics.forecasts,
        inventoryActions: analytics.inventoryActions,
        combos: analytics.combos,
        priceSuggestions: analytics.priceSuggestions,
        staffing: analytics.staffing,
      });
      res.json({
        locationId: analytics.locationId,
        windowDays: days,
        horizonDays,
        ...briefing,
        advisoryOnly: true,
      });
    } catch (error) {
      console.error('insights/briefing error:', error);
      res.status(500).json({ error: 'Failed to build insights briefing' });
    }
  };
  router.get('/briefing', authMiddleware, adminMiddleware, locationScope, briefingHandler);
  router.post('/briefing', authMiddleware, adminMiddleware, locationScope, briefingHandler);

  return router;
}
