import 'dotenv/config';
import mysql from 'mysql2/promise';

// SECURITY FIX: Use environment variables instead of hardcoded credentials
const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

await conn.query(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id VARCHAR(64) NOT NULL,
    inventory_item_id VARCHAR(32) NOT NULL,
    quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_recipe (menu_item_id, inventory_item_id)
  )
`);

console.log('recipes table created');

const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM recipes');
console.log('recipes rows:', rows[0].cnt);

conn.end();