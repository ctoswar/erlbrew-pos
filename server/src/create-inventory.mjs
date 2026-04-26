import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '192.168.75.101',
  user: 'root',
  password: 'gameclub11',
  database: 'erlbrew_pos',
});

// Create inventory table
await conn.query(`
  CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64),
    unit VARCHAR(32) DEFAULT 'pcs',
    stock DECIMAL(10,2) DEFAULT 0,
    low_stock_threshold DECIMAL(10,2) DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('Table created');

// Seed items (ignore duplicates)
const seeds = [
  ['cup-s',    'Small Cup (8oz)',    'Cups',     'pcs', 500, 50],
  ['cup-m',    'Medium Cup (12oz)',  'Cups',     'pcs', 500, 50],
  ['cup-l',    'Large Cup (16oz)',   'Cups',     'pcs', 300, 30],
  ['lid-s',    'Small Lid',          'Lids',     'pcs', 500, 50],
  ['lid-ml',   'Medium/Large Lid',   'Lids',     'pcs', 400, 40],
  ['straw',    'Paper Straw',        'Supplies', 'pcs', 1000, 100],
  ['nap-s',    'Napkins (small)',    'Supplies', 'pcs', 800, 80],
  ['milk-oat', 'Oat Milk 1L',        'Milk',     'L',   24, 5],
  ['milk-fresh','Fresh Milk 1L',     'Milk',     'L',   20, 5],
  ['coffee-beans','Coffee Beans 1kg','Coffee',   'kg',  10, 2],
  ['syrup-van','Vanilla Syrup 700ml','Syrups',   'ml',  12, 3],
  ['syrup-haz','Hazelnut Syrup 700ml','Syrups',  'ml',  8,  2],
  ['coco-pow', 'Cocoa Powder 500g',  'Powders',  'pcs', 6,  2],
  ['matcha',   'Ceremonial Matcha 200g','Powders','pcs', 5, 1],
  ['hib-tea',  'Hibiscus Tea 500g',  'Tea',      'pcs', 5, 1],
  ['lav-syrup','Lavender Syrup 500ml','Syrups',  'ml',  6,  2],
];

for (const s of seeds) {
  await conn.query(
    'INSERT INTO inventory (id, name, category, unit, stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
    s
  );
}

const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM inventory');
console.log('Inventory rows:', rows[0].cnt);
console.log('Done!');

await conn.end();