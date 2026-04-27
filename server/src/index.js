import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import staffRoutes from './routes/staff.js';
import menuRoutes from './routes/menu.js';
import ordersRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import recipesRouter from './routes/recipes.js';
import { googleSheetsClientInit } from './services/googleSheets.js';
import { authMiddleware } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

// Security hardening: ensure JWT secret is set
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start with insecure defaults.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 3: Restrict CORS origins via env var
const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin(origin, callback) {
    // Allow non-origin requests (curl, mobile apps) and same-origin
    if (!origin) return callback(null, true);
    if (corsOrigins.includes('*')) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
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
app.use(express.json());

// Apply login-specific limiter early (before login route handling)
app.use('/api/staff/login', loginLimiter);
// Apply a general API rate limiter for all /api/ routes
app.use('/api/', apiLimiter);

// DB pool (single pool for app)
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
});
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
  } catch (e) {
    console.error('DB connection failed', e);
  }
}
initDb();

// Initialize Google Sheets client (on demand)
const gs = googleSheetsClientInit(pool);

// Routes
app.use('/api/staff', staffRoutes(pool));
// Menu: public reads, admin writes (auth applied inline per route)
app.use('/api/menu', menuRoutes(pool));
// Orders: public creates and reads, admin status updates (auth applied inline)
app.use('/api/orders', ordersRoutes(pool, gs));
// Inventory: admin only
app.use('/api/inventory', inventoryRoutes(pool));
app.use('/api/recipes', recipesRouter(pool));

const server = app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the old process or change PORT in .env`);
    process.exit(1);
  } else {
    throw e;
  }
});
