-- Init script for erlbrew_pos database
CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rfid VARCHAR(64) UNIQUE,
  pin VARCHAR(64),
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32),
  initials VARCHAR(8),
  color VARCHAR(16),
  password_hash VARCHAR(256) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64),
  price DECIMAL(10,2) NOT NULL,
  badge VARCHAR(64),
  description TEXT,
  emoji VARCHAR(8),
  popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  staff_id INT,
  status VARCHAR(32) DEFAULT 'pending',
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  table_name VARCHAR(32),
  type VARCHAR(16),
  pay_method VARCHAR(16),
  reference_number VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64),
  menu_item_id VARCHAR(64),
  qty INT,
  notes TEXT,
  price DECIMAL(10,2),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS time_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  rfid VARCHAR(64),
  clock_in DATETIME NOT NULL,
  clock_out DATETIME DEFAULT NULL,
  total_hours DECIMAL(5,2) DEFAULT NULL,
  date DATE GENERATED ALWAYS AS (DATE(clock_in)) STORED,
  FOREIGN KEY (staff_id) REFERENCES staff(id),
  INDEX idx_date (date),
  INDEX idx_staff_date (staff_id, date)
);

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id VARCHAR(64) NOT NULL,
  inventory_item_id VARCHAR(32) NOT NULL,
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_recipe (menu_item_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(64),
  unit VARCHAR(32) DEFAULT 'pcs',
  stock DECIMAL(10,2) DEFAULT 0,
  low_stock_threshold DECIMAL(10,2) DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Costing fields added for COGS calculations (non-destructive migration)
ALTER TABLE inventory
  ADD COLUMN purchase_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN unit_cost DECIMAL(10,2) DEFAULT 0;

-- Reference number field for E-Wallet payments (non-destructive migration)
ALTER TABLE orders
  ADD COLUMN reference_number VARCHAR(128) DEFAULT NULL;

-- Secondary RFID for tablet reader (different keyboard layout / byte order)
ALTER TABLE staff
  ADD COLUMN rfid_alt VARCHAR(64) DEFAULT NULL AFTER rfid;

-- Auto-populate rfid_alt with reversed rfid for existing staff
UPDATE staff SET rfid_alt = REVERSE(rfid) WHERE rfid IS NOT NULL AND rfid_alt IS NULL;

-- Seed inventory items
INSERT INTO inventory (id, name, category, unit, stock, low_stock_threshold) VALUES
('cup-s',    'Small Cup (8oz)',   'Cups',     'pcs', 500, 50),
('cup-m',    'Medium Cup (12oz)', 'Cups',     'pcs', 500, 50),
('cup-l',    'Large Cup (16oz)',  'Cups',     'pcs', 300, 30),
('lid-s',    'Small Lid',         'Lids',     'pcs', 500, 50),
('lid-ml',   'Medium/Large Lid',  'Lids',     'pcs', 400, 40),
('straw',    'Paper Straw',       'Supplies', 'pcs', 1000, 100),
('nap-s',    'Napkins (small)',   'Supplies', 'pcs', 800, 80),
('milk-oat', 'Oat Milk 1L',       'Milk',     'L',   24, 5),
('milk-fresh','Fresh Milk 1L',    'Milk',     'L',   20, 5),
('coffee-beans','Coffee Beans 1kg','Coffee',  'kg',  10, 2),
('syrup-van','Vanilla Syrup 700ml','Syrups',  'ml',  12, 3),
('syrup-haz','Hazelnut Syrup 700ml','Syrups', 'ml',  8,  2),
('coco-pow', 'Cocoa Powder 500g', 'Powders',  'pcs', 6,  2),
('matcha',   'Ceremonial Matcha 200g','Powders','pcs', 5, 1),
('hib-tea',  'Hibiscus Tea 500g', 'Tea',      'pcs', 5, 1),
('lav-syrup','Lavender Syrup 500ml','Syrups', 'ml',  6,  2)
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);

-- Seed admin (password_hash = NULL means first-time login, API will set it)
INSERT INTO staff (rfid, pin, name, role, initials, color, password_hash) VALUES
('ADMIN001', 'admin123', 'admin', 'Manager', 'AD', '#000000', NULL)
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);

-- Seed 4 staff (example)
INSERT INTO staff (rfid, pin, name, role, initials, color, password_hash) VALUES
  ('RF001','1234','Jane Dela Cruz','Senior Barista','JD','#C9873A', NULL),
  ('RF002','5678','Marco Santos','Barista','MS','#6e9e6a', NULL),
  ('RF003','9012','Ana Reyes','Shift Supervisor','AR','#7a6eb0', NULL),
  ('RF004','3456','Luis Garcia','Manager','LG','#b06e6e', NULL);

-- Seed 16 menu items (example) -- replace with real data as needed
INSERT INTO menu_items (id, name, category, price, badge, description, emoji, popular) VALUES
  ('m1','Smoked Sea Salt Mocha','Signature Brews',6.75,'SIGNATURE','Single-origin dark chocolate, espresso, steamed oat milk, topped with house-smoked Maldon sea salt.','☕',TRUE),
  ('m2','Velvet Matcha Latte','Signature Brews',6.25,'SIGNATURE','Ceremonial grade Uji matcha whisked with Madagascar vanilla bean and creamy macadamia milk.','🍵',TRUE),
  ('m3','Honey Lavender Cortado','Signature Brews',5.50,'SIGNATURE','Local wildflower honey, dried culinary lavender, and a double shot of our house Heritage roast.','🌼',FALSE),
  ('m4','Cold Brew Reserve','Signature Brews',5.75,'HAND-POURED','24-hour slow steeped concentrate. Served over a single clear ice sphere.','🧊',FALSE),
  ('m5','Heritage Double Espresso','Espresso',4.00,'CLASSIC','Two shots of our house Heritage blend. Clean, balanced, with a honey-toned finish.','☕',FALSE),
  ('m6','Flat White','Espresso',4.75,'CLASSIC','Velvety micro-foam poured over a ristretto double shot.','☕',FALSE),
  ('m7','Spiced Americano','Espresso',4.25,'SEASONAL','Cardamom and Ceylon cinnamon infused hot water, finished with a Heritage espresso shot.','🫖',FALSE),
  ('m8','Macchiato Lungo','Espresso',4.50,'CLASSIC','Long pull espresso with a delicate cloud of steamed milk.','☕',FALSE),
  ('m9','Kouign-Amann','Pastries',4.25,'BAKED DAILY','Buttery, caramelized Breton pastry. Crisp outside, tender within.','🥐',TRUE),
  ('m10','Cardamom Knot','Pastries',3.75,'BAKED DAILY','Soft brioche twisted with house-ground cardamom sugar.','🍞',FALSE),
  ('m11','Almond Financier','Pastries',3.50,'BAKED DAILY','Brown butter almond cake with flaked Marcona almonds on top.','🧁',FALSE),
  ('m12','Seasonal Tart','Pastries',5.00,'SEASONAL','Chefs daily selection using locally sourced seasonal produce.','🥧',FALSE),
  ('m13','Hibiscus Fizz','Cold Drinks',5.25,'HOUSE-MADE','Dried hibiscus flowers steeped overnight with citrus zest, topped with sparkling water.','🌺',FALSE),
  ('m14','Cascara Lemonade','Cold Drinks',5.50,'RARE','Coffee cherry husks brewed into sweet tea blended with fresh Meyer lemon.','🍋',FALSE),
  ('m15','Oat Horchata Cold Brew','Cold Drinks',6.00,'SIGNATURE','House oat horchata swirled through our cold brew concentrate.','🥤',TRUE),
  ('m16','Still Water','Cold Drinks',1.50,'', 'Filtered still water.','💧',FALSE);

-- Supplier invoices table
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(64) NOT NULL,
  supplier_name VARCHAR(128) NOT NULL,
  contact_person VARCHAR(128),
  contact_phone VARCHAR(32),
  contact_email VARCHAR(128),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending', -- pending, partial, paid, overdue, cancelled
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_invoice_number (invoice_number)
);

-- Supplier invoice line items
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  item_description VARCHAR(256) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id) ON DELETE CASCADE
);

-- Company settings table (for logo, company info)
CREATE TABLE IF NOT EXISTS company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(64) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Menu modifiers (admin-editable per menu item)
CREATE TABLE IF NOT EXISTS menu_modifiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_menu_item (menu_item_id)
);

-- Modifiers selected per order item
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  modifier_name VARCHAR(128) NOT NULL,
  modifier_price DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

-- Void/refund reason fields (non-destructive migration)
ALTER TABLE orders
  ADD COLUMN void_reason VARCHAR(256) DEFAULT NULL,
  ADD COLUMN refund_reason VARCHAR(256) DEFAULT NULL;

-- Z-Reports table
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
  printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

-- Cash drawer tracking table
CREATE TABLE IF NOT EXISTS cash_drawer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_date DATE NOT NULL,
  opening_float DECIMAL(10,2) DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  cash_payouts DECIMAL(10,2) DEFAULT 0,
  closing_amount DECIMAL(10,2) DEFAULT 0,
  expected_amount DECIMAL(10,2) DEFAULT 0,
  variance DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  INDEX idx_shift_date (shift_date)
);

-- Seed default company settings
INSERT INTO company_settings (setting_key, setting_value) VALUES
  ('company_name', 'Erlbrew Cafe'),
  ('company_address', ''),
  ('company_phone', ''),
  ('company_email', ''),
  ('company_logo', '')  -- Base64 encoded logo image
ON DUPLICATE KEY UPDATE setting_key=LAST_INSERT_ID(setting_key);
