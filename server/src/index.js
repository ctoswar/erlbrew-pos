import { resolve } from 'path';
import http from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import cron from 'node-cron';
import staffRoutes from './routes/staff.js';
import menuRoutes from './routes/menu.js';
import ordersRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import recipesRouter from './routes/recipes.js';
import clockRouter from './routes/clock.js';
import supplierInvoiceRoutes from './routes/supplierInvoices.js';
import companySettingsRoutes from './routes/companySettings.js';
import uploadRouter from './routes/upload.js';
import { googleSheetsClientInit } from './services/googleSheets.js';
import { authMiddleware } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

const HARDCODED_PRINT_SERVER = 'https://192.168.75.101:9100';

dotenv.config();

// Security hardening: ensure JWT secret is set
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with insecure defaults.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 3: Restrict CORS origins via env var — MUST be set in production
const rawCors = process.env.CORS_ORIGINS || '';
if (!rawCors) {
  console.warn('WARNING: CORS_ORIGINS not set — defaulting to same-origin only. Set CORS_ORIGINS=https://yourdomain.com in production!');
}
const corsOrigins = rawCors ? rawCors.split(',').map(s => s.trim()) : [];
app.use(cors({
  origin(origin, callback) {
    // Allow no-origin requests (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    // In dev / local file:// access, allow everything
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production, never allow wildcard when origins are explicitly set
    if (corsOrigins.includes('*')) return callback(new Error('CORS wildcard (*) is not allowed in production — set CORS_ORIGINS=https://yourdomain.com'));
    if (corsOrigins.length > 0 && corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

// 6: Rate limiting for login and general API
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(express.json({ limit: '10mb' }));

// Apply login-specific limiter early (before login route handling)
app.use('/api/staff/login', loginLimiter);
// Apply a general API rate limiter for all /api/ routes
app.use('/api/', apiLimiter);

// DB pool (single pool for app) — force Asia/Taipei timezone for all queries
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: '+08:00',
  dateStrings: false,
});

// Print server URL resolver: env var › DB company_settings › hardcoded default
async function resolvePrintServer() {
  const fromEnv = process.env.PRINT_SERVER_URL;
  if (fromEnv) return fromEnv;
  try {
    const [settings] = await pool.execute(
      `SELECT setting_value FROM company_settings WHERE setting_key = 'print_server_url'`
    );
    if (settings.length > 0 && settings[0].setting_value) return settings[0].setting_value;
  } catch (_) { /* table may not exist yet */ }
  return HARDCODED_PRINT_SERVER;
}

const MENU_SEED = [
  ['m1','Smoked Sea Salt Mocha','Signature Brews',6.75,'SIGNATURE','Single-origin dark chocolate, espresso, steamed oat milk, topped with house-smoked Maldon sea salt.','☕',1],
  ['m2','Velvet Matcha Latte','Signature Brews',6.25,'SIGNATURE','Ceremonial grade Uji matcha whisked with Madagascar vanilla bean and creamy macadamia milk.','🍵',1],
  ['m3','Honey Lavender Cortado','Signature Brews',5.50,'SIGNATURE','Local wildflower honey, dried culinary lavender, and a double shot of our house Heritage roast.','🌼',0],
  ['m4','Cold Brew Reserve','Signature Brews',5.75,'HAND-POURED','24-hour slow steeped concentrate. Served over a single clear ice sphere.','🧊',0],
  ['m5','Heritage Double Espresso','Espresso',4.00,'CLASSIC','Two shots of our house Heritage blend. Clean, balanced, with a honey-toned finish.','☕',0],
  ['m6','Flat White','Espresso',4.75,'CLASSIC','Velvety micro-foam poured over a ristretto double shot.','☕',0],
  ['m7','Spiced Americano','Espresso',4.25,'SEASONAL','Cardamom and Ceylon cinnamon infused hot water, finished with a Heritage espresso shot.','🫖',0],
  ['m8','Macchiato Lungo','Espresso',4.50,'CLASSIC','Long pull espresso with a delicate cloud of steamed milk.','☕',0],
  ['m9','Kouign-Amann','Pastries',4.25,'BAKED DAILY','Buttery, caramelized Breton pastry. Crisp outside, tender within.','🥐',1],
  ['m10','Cardamom Knot','Pastries',3.75,'BAKED DAILY','Soft brioche twisted with house-ground cardamom sugar.','🍞',0],
  ['m11','Almond Financier','Pastries',3.50,'BAKED DAILY','Brown butter almond cake with flaked Marcona almonds on top.','🧁',0],
  ['m12','Seasonal Tart','Pastries',5.00,'SEASONAL','Chefs daily selection using locally sourced seasonal produce.','🥧',0],
  ['m13','Hibiscus Fizz','Cold Drinks',5.25,'HOUSE-MADE','Dried hibiscus flowers steeped overnight with citrus zest, topped with sparkling water.','🌺',0],
  ['m14','Cascara Lemonade','Cold Drinks',5.50,'RARE','Coffee cherry husks brewed into sweet tea blended with fresh Meyer lemon.','🍋',0],
  ['m15','Oat Horchata Cold Brew','Cold Drinks',6.00,'SIGNATURE','House oat horchata swirled through our cold brew concentrate.','🥤',1],
  ['m16','Still Water','Cold Drinks',1.50,'','Filtered still water.','💧',0],
];

async function initDb() {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected');

    // Ensure required tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS z_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id INT,
        report_date DATE NOT NULL,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        total_sales DECIMAL(12,2) DEFAULT 0,
        total_orders INT DEFAULT 0,
        total_cash DECIMAL(12,2) DEFAULT 0,
        total_card DECIMAL(12,2) DEFAULT 0,
        total_ewallet DECIMAL(12,2) DEFAULT 0,
        total_refunds DECIMAL(12,2) DEFAULT 0,
        total_voids INT DEFAULT 0,
        total_cogs DECIMAL(12,2) DEFAULT 0,
        gross_profit DECIMAL(12,2) DEFAULT 0,
        printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('z_reports table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_drawer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shift_date DATE NOT NULL,
        status ENUM('open','closed') DEFAULT 'open',
        opening_float DECIMAL(10,2) DEFAULT 0,
        cash_sales DECIMAL(10,2) DEFAULT 0,
        cash_payouts DECIMAL(10,2) DEFAULT 0,
        closing_amount DECIMAL(10,2) DEFAULT 0,
        expected_amount DECIMAL(10,2) DEFAULT 0,
        variance DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        closed_at DATETIME DEFAULT NULL,
        printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add missing columns to existing cash_drawer table (one by one for MySQL 5.x compatibility)
    const addCol = (col, def) => pool.query(`ALTER TABLE cash_drawer ADD COLUMN ${col} ${def}`).catch(() => {});
    await addCol('status', "ENUM('open','closed') DEFAULT 'open'");
    await addCol('cash_payouts', 'DECIMAL(10,2) DEFAULT 0');
    await addCol('closed_at', 'DATETIME DEFAULT NULL');
    console.log('cash_drawer table ready');

await pool.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(128) UNIQUE NOT NULL,
        setting_value MEDIUMTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Ensure setting_value is MEDIUMTEXT (not just TEXT) for large base64 logos
    await pool.query(`ALTER TABLE company_settings MODIFY setting_value MEDIUMTEXT`).catch(() => {});
    console.log('company_settings table ready');

    // Add rfid_alt column for tablet RFID reader compatibility (reversed byte order)
    await pool.query(`ALTER TABLE staff ADD COLUMN rfid_alt VARCHAR(64) DEFAULT NULL AFTER rfid`).catch(() => {});

    // Add image column to menu_items
    await pool.query(`ALTER TABLE menu_items ADD COLUMN image VARCHAR(512) DEFAULT NULL AFTER emoji`).catch(() => {});
    // Auto-populate rfid_alt with reversed rfid for existing staff
    await pool.query(`UPDATE staff SET rfid_alt = REVERSE(rfid) WHERE rfid IS NOT NULL AND rfid_alt IS NULL`).catch(() => {});
    console.log('staff rfid_alt column ready');

    // Auto-seed menu_items if empty
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM menu_items');
    if (rows[0].cnt === 0) {
      console.log('Seeding menu_items...');
      for (const item of MENU_SEED) {
        await pool.query(
          'INSERT INTO menu_items (id, name, category, price, badge, description, emoji, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
          item
        );
      }
      console.log('Menu items seeded');
    }

    // Auto-seed menu_modifiers if empty
    const [modRows] = await pool.query('SELECT COUNT(*) AS cnt FROM menu_modifiers');
    if (modRows[0].cnt === 0) {
      console.log('Seeding menu_modifiers...');
      const MODIFIER_SEED = [
        // Espresso drinks (m5, m6, m7, m8)
        ['m5', 'Extra Shot', 0.75, false],
        ['m5', 'Soy Milk', 0.50, false],
        ['m5', 'Breve (Half & Half)', 0.50, false],
        ['m6', 'Extra Shot', 0.75, false],
        ['m6', 'Soy Milk', 0.50, false],
        ['m6', 'Oat Milk', 0.50, true],
        ['m7', 'Extra Shot', 0.75, false],
        ['m7', 'Extra Spiced', 0.50, false],
        ['m8', 'Extra Shot', 0.75, false],
        ['m8', 'Soy Milk', 0.50, false],
        // Signature Brews (m1, m2, m3, m4)
        ['m1', 'Extra Shot', 0.75, false],
        ['m1', 'Soy Milk', 0.50, false],
        ['m1', 'Oat Milk', 0.50, true],
        ['m1', 'Extra Sea Salt', 0.25, false],
        ['m2', 'Extra Matcha Shot', 1.00, false],
        ['m2', 'Macadamia Milk', 0.50, true],
        ['m2', 'Oat Milk', 0.50, false],
        ['m3', 'Extra Honey', 0.50, false],
        ['m3', 'Oat Milk', 0.50, true],
        ['m3', 'Almond Milk', 0.50, false],
        ['m4', 'With Sweet Cream', 0.75, false],
        ['m4', 'With Oat Milk', 0.50, false],
        // Cold Drinks (m13, m14, m15)
        ['m13', 'Add Mint', 0.50, false],
        ['m13', 'Add Ginger', 0.50, false],
        ['m14', 'Add Mint', 0.50, false],
        ['m14', 'Extra Tart', 0.25, false],
        ['m15', 'Extra Sweet Cream', 0.75, false],
        ['m15', 'Soy Milk', 0.50, false],
      ];
      for (const [menuId, name, price, isDefault] of MODIFIER_SEED) {
        await pool.query(
          'INSERT INTO menu_modifiers (menu_item_id, name, price, is_default) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
          [menuId, name, price, isDefault]
        );
      }
      console.log('Menu modifiers seeded');
    }
  } catch (e) {
    console.error('DB connection failed', e);
  }
}
initDb();

// Initialize Google Sheets client (on demand)
const gs = googleSheetsClientInit(pool);

// ── SSE: Real-time event broadcaster ─────────────────────────────────────────
const sseClients = new Set();

function broadcastEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (e) { clearInterval(heartbeat); }
  }, 30000);

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
  });
});

app.get('/api/events/ping', (req, res) => res.json({ ok: true, clients: sseClients.size }));

// Make broadcastEvent available to routes via app.locals
app.locals.broadcastEvent = broadcastEvent;

// Serve uploaded images
app.use('/uploads', express.static(resolve('server/uploads')));

// Routes
app.use('/api/staff', staffRoutes(pool));
// Menu: public reads, admin writes (auth applied inline per route)
app.use('/api/menu', menuRoutes(pool));
// Orders: public creates and reads, admin status updates (auth applied inline)
const ordersExports = ordersRoutes(pool, gs, broadcastEvent);
app.use('/api/orders', ordersExports.router);
// Inventory: admin only
app.use('/api/inventory', inventoryRoutes(pool));
app.use('/api/recipes', recipesRouter(pool));
app.use('/api/clock', clockRouter(pool, gs));
app.use('/api/supplier-invoices', supplierInvoiceRoutes(pool));
app.use('/api/company-settings', companySettingsRoutes(pool));
app.use('/api', uploadRouter(pool));

// ── Google Sheets sync: write Dashboard to Sheet3 ──────────────────────────
app.post('/api/sheets/sync-dashboard', async (req, res) => {
  if (!gs) return res.status(503).json({ error: 'Sheets not configured' });
  try {
    // Fetch today's orders (same as GET /orders/today)
    const today = new Date().toISOString().slice(0, 10);
    const [orderRows] = await pool.query(`
      SELECT o.id, o.status, o.subtotal, o.tax, o.total,
o.customer_name, o.table_name, o.type, o.pay_method,
               o.created_at, o.completed_at,
             s.name AS staff_name, s.initials AS staff_initials, s.rfid AS staff_rfid, s.role AS staff_role, s.color AS staff_color
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE DATE(o.created_at) = CURDATE()
      ORDER BY o.created_at DESC
    `);

    // Fetch order items
    const ids = orderRows.map((r) => r.id);
    let orderItems = [];
    if (ids.length > 0) {
      const [itemRows] = await pool.query(
        `SELECT oi.order_id, oi.menu_item_id, oi.qty, oi.price, oi.notes,
                m.name AS item_name, m.category
         FROM order_items oi
         JOIN menu_items m ON oi.menu_item_id = m.id
         WHERE oi.order_id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      const itemMap = {};
      (itemRows || []).forEach((it) => {
        if (!itemMap[it.order_id]) itemMap[it.order_id] = [];
        itemMap[it.order_id].push({
          id: it.menu_item_id,
          qty: it.qty,
          price: it.price,
          notes: it.notes,
          item: { name: it.item_name, category: it.category, price: it.price },
        });
      });
      orderItems = itemMap;
    }

    // Attach items + shape like frontend Order type
    const orders = orderRows.map((o) => ({
      id: o.id, status: o.status,
      subtotal: o.subtotal, tax: o.tax, total: o.total,
      type: o.type, payMethod: o.pay_method,
      table: o.customer_name || o.table_name,
      createdAt: o.created_at, completedAt: o.completed_at,
      staff: { name: o.staff_name || '—', initials: o.staff_initials || '?', rfid: o.staff_rfid || '', role: o.staff_role || 'Barista', color: o.staff_color || '#888' },
      items: orderItems[o.id] || [],
    }));

    // Fetch today's COGS
    let cogsData = { cogs: 0, details: [] };
    try {
      const [tot] = await pool.query(`
        SELECT COALESCE(SUM(oi.qty * r.quantity * i.purchase_cost), 0) AS cogs
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN recipes r ON oi.menu_item_id = r.menu_item_id
        JOIN inventory i ON r.inventory_item_id = i.id
        WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
        [today, today]
      );
      const cogs = Number((tot && tot[0] && tot[0].cogs) || 0);
      const [detailsRows] = await pool.query(`
        SELECT o.id AS order_id, o.total AS total,
          SUM(oi.qty * r.quantity * i.purchase_cost) AS cogs
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN recipes r ON oi.menu_item_id = r.menu_item_id
        JOIN inventory i ON r.inventory_item_id = i.id
        WHERE o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY o.id`,
        [today, today]
      );
      cogsData = {
        cogs,
        details: (detailsRows || []).map((r) => ({
          order_id: r.order_id,
          total: Number(r.total) || 0,
          cogs: Number(r.cogs) || 0,
          profit: (Number(r.total) || 0) - (Number(r.cogs) || 0),
        })),
      };
    } catch (_) { /* COGS not available */ }

    await gs.appendDashboard({ orders, cogsData });
    res.json({ ok: true, rowsWritten: orders.length });
  } catch (e) {
    console.error('Sheet sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Print proxy: browser → backend → Pi Bluetooth print server ─────────────────
// Use https.request directly for self-signed cert support (native fetch agent option unreliable)
function printServerRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const bodyStr = options.body || '';
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      rejectUnauthorized: false,
    };
    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        console.log(`[print-proxy] Response ${res.statusCode}:`, body.slice(0, 500));
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => { try { return JSON.parse(body); } catch { return { error: body || 'empty response' }; } },
        });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

app.post('/api/print', async (req, res) => {
  const { lines, paperSize } = req.body || {};
  if (!lines || !Array.isArray(lines)) {
    return res.status(400).json({ error: 'lines array required' });
  }
  const serverUrl = await resolvePrintServer();
  try {
    const br = await printServerRequest(`${serverUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, paperSize: paperSize || '80mm' }),
    });
    const data = await br.json();
    res.status(br.ok ? 200 : 502).json(data);
  } catch (e) {
    console.error(`[print-proxy] Error:`, e);
    res.status(502).json({ error: `Print server unreachable: ${e.message}` });
  }
});

app.post('/api/open-drawer', async (req, res) => {
  const serverUrl = await resolvePrintServer();
  try {
    const br = await printServerRequest(`${serverUrl}/open-drawer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await br.json();
    res.status(br.ok ? 200 : 502).json(data);
  } catch (e) {
    console.error(`[drawer-proxy] Error:`, e);
    res.status(502).json({ error: `Print server unreachable: ${e.message}` });
  }
});

const server = app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// ── Midnight Z-Report cron job ───────────────────────────────────────────────
// Runs at 00:00:00 every day, generates a Z-Report for the previous day
cron.schedule('0 0 0 * * *', async () => {
  // Calculate yesterday's date string
  const yd = new Date(Date.now() - 86400000);
  const pad = n => String(n).padStart(2, '0');
  const yesterdayStr = `${yd.getFullYear()}-${pad(yd.getMonth()+1)}-${pad(yd.getDate())}`;

  console.log(`[cron] Generating Z-Report for ${yesterdayStr}...`);
  try {
    const report = await ordersExports.buildZReportData(pool, yesterdayStr);
    const [ins] = await pool.query(`
      INSERT INTO z_reports (staff_id, report_date, period_start, period_end, total_sales, total_orders,
        total_cash, total_card, total_ewallet, total_refunds, total_voids, total_cogs, gross_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [report.staff_id, report.report_date, report.period_start, report.period_end,
        report.total_sales, report.total_orders, report.total_cash, report.total_card,
        report.total_ewallet, report.total_refunds, report.total_voids, report.total_cogs, report.gross_profit]);
    console.log(`[cron] Z-Report #${ins.insertId} for ${yesterdayStr} saved.`);
  } catch (e) {
    console.error(`[cron] Z-Report generation failed: ${e.message}`);
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the old process or change PORT in .env`);
    process.exit(1);
  } else {
    throw e;
  }
});
