/**
 * Migration: Create menu_item_sizes table for size variants.
 * Run: node server/migrate-sizes.js
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function migrate() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL });
  const conn = await pool.getConnection();
  try {
    console.log('Creating menu_item_sizes table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_item_sizes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        menu_item_id VARCHAR(64) NOT NULL,
        label VARCHAR(64) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        INDEX idx_sizes_menu_item (menu_item_id)
      )
    `);
    console.log('✅ menu_item_sizes table created successfully');

    // Add size column to order_items if it doesn't exist
    const [cols] = await conn.query("SHOW COLUMNS FROM order_items LIKE 'size'");
    if (cols.length === 0) {
      await conn.query("ALTER TABLE order_items ADD COLUMN size VARCHAR(64) DEFAULT NULL AFTER price");
      console.log('✅ Added size column to order_items');
    } else {
      console.log('⏭️  order_items.size column already exists');
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}
migrate();
