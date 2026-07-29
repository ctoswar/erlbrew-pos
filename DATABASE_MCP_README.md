# Database MCP Server - Quick Reference

## What It Does
Allows Copilot CLI to query your MySQL database directly without CLI tools.

## Usage Examples

### Get Database Schema
```bash
node db-mcp-server.js schema
```
Shows all tables, columns, types, and constraints.

### List All Tables
```bash
node db-mcp-server.js tables
```
Table names, row counts, data size.

### View Foreign Key Relationships
```bash
node db-mcp-server.js fk
```
Shows all FK constraints (data integrity tracking).

### Custom SQL Query
```bash
node db-mcp-server.js "SELECT COUNT(*) FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)"
```
Any SQL you want to run.

---

## Common Queries You Might Use

### Check Database Health
```sql
SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'erlbrew_pos'
```

### View Time Adjustment Audit Trail
```sql
SELECT * FROM time_adjustments ORDER BY created_at DESC LIMIT 10
```

### Find Orders by Date
```sql
SELECT id, customer_name, total, created_at FROM orders WHERE DATE(created_at) = CURDATE()
```

### Check Staff Clock Records
```sql
SELECT staff_id, DATE(clock_in) as date, COUNT(*) as clock_ins FROM time_records GROUP BY staff_id, DATE(clock_in)
```

### View Inventory Stock Levels
```sql
SELECT name, stock, low_stock_threshold FROM inventory WHERE stock < low_stock_threshold
```

### See Receipt Print Settings
```sql
SELECT * FROM admin_settings WHERE key LIKE 'receipt%'
```

---

## Configuration

Located in `.mcp-config.json`:

```json
{
  "database": {
    "command": "node",
    "args": ["db-mcp-server.js"],
    "env": {
      "DB_HOST": "192.168.75.101",
      "DB_USER": "root",
      "DB_PASSWORD": "gameclub11",
      "DB_NAME": "erlbrew_pos"
    }
  }
}
```

Change DB_HOST, DB_USER, DB_PASSWORD if needed.

---

## What You Can Do With This

✅ Audit data integrity (FK relationships)
✅ Check recent changes (orders, time records)
✅ Verify inventory levels
✅ Track employee clocking patterns
✅ Generate quick reports
✅ Debug data issues without SSH/MySQL CLI

---

## Troubleshooting

**"Connection refused"** → MySQL service not running or firewall blocking
**"Access denied"** → Check DB_USER, DB_PASSWORD in .mcp-config.json
**"Unknown database"** → Change DB_NAME to correct database name
