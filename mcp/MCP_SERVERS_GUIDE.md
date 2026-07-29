# MCP Servers - Complete Guide

Your erlbrew-pos now has **6 integrated MCP servers** for complete development workflow!

---

## 📊 1. **Graphify** — Architecture Visualization
**Status:** ✅ Running  
**URL:** http://localhost:5173

**What It Does:**
- Visual graph of all 136+ components and connections
- Auto-detects new files in real-time
- Color-coded by community (frontend/backend/database)
- Search and filter capabilities

**Usage:**
```
Open: http://localhost:5173
- Search nodes by name
- Filter by community (Frontend/Backend/Database)
- Drag nodes to explore relationships
```

---

## 📚 2. **Obsidian** — Documentation Vault
**Status:** ✅ Auto-updating  
**Location:** `C:\Users\ctos\Desktop\erlbrew-pos\docs\`

**What It Does:**
- Project documentation and team notes
- Auto-detects new `.md` files
- Linked notes for knowledge base

**Usage:**
```bash
# Add documentation
Create files in: docs/*.md
Example: docs/API-GUIDE.md, docs/DEPLOYMENT.md
```

---

## 🗄️ 3. **Database (MySQL)** — Query Your Data
**Status:** ✅ Connected to Raspberry Pi  
**Host:** 192.168.75.101:3306

**What It Does:**
- Query MySQL database directly
- Inspect schema and relationships
- Audit trails and analytics
- No CLI needed

**Usage:**
```bash
# See all tables
node db-mcp-server.js tables

# View schema
node db-mcp-server.js schema

# Check foreign keys
node db-mcp-server.js fk

# Custom query
node db-mcp-server.js "SELECT * FROM orders WHERE DATE(created_at) = CURDATE()"
```

**Common Queries:**
```sql
-- Today's orders
SELECT id, customer_name, total FROM orders WHERE DATE(created_at) = CURDATE()

-- Staff clock records
SELECT staff_id, clock_in, clock_out FROM time_records ORDER BY clock_in DESC

-- Inventory low stock
SELECT name, stock FROM inventory WHERE stock < low_stock_threshold

-- Time adjustments audit
SELECT * FROM time_adjustments ORDER BY created_at DESC
```

---

## 📁 4. **Filesystem** — Direct File Access
**Status:** ✅ Ready  
**Scope:** `src/`, `server/`, `docs/`, `public/`

**What It Does:**
- Read/write files directly
- List directories
- Search files by pattern
- No permission issues

**Usage:**
```bash
# List files in src/components
node filesystem-mcp.js list src/components

# Read a file
node filesystem-mcp.js read src/components/POSScreen.tsx

# Search for files
node filesystem-mcp.js search "\.tsx$" src/components
```

---

## 🐳 5. **Docker** — Container Management
**Status:** ✅ Available  
**Requires:** Docker installed and running

**What It Does:**
- List running containers
- View container logs
- Check resource usage (CPU, memory)
- Health checks
- Docker Compose status

**Usage:**
```bash
# List all containers
node docker-mcp.js containers

# List images
node docker-mcp.js images

# Get container logs
node docker-mcp.js logs erlbrew-pos 50

# Check resource stats
node docker-mcp.js stats mysql-container

# Inspect container details
node docker-mcp.js inspect erlbrew-pos

# Health check
node docker-mcp.js health mysql-container

# Docker Compose status
node docker-mcp.js compose
```

---

## 🐙 6. **GitHub** — Repo Management
**Status:** ✅ Built-in  
**Requires:** `gh` CLI installed

**What It Does:**
- Read/write issues
- Create/manage pull requests
- View commit history
- Repository data access

**Usage:**
```bash
# GitHub CLI is integrated - available for Copilot
# Example: "Can you create an issue for this bug?"
# Example: "Show me recent PRs"
```

---

## 🎯 **Typical Workflow:**

### **1. Morning Check-In:**
```bash
node docker-mcp.js health mysql-container
node db-mcp-server.js "SELECT COUNT(*) as today_orders FROM orders WHERE DATE(created_at) = CURDATE()"
```

### **2. New Feature Development:**
```
1. Create component in src/components/MyComponent.tsx
2. Graphify auto-detects (within 2 seconds)
3. Graph updates on http://localhost:5173
4. Add documentation to docs/FEATURE-NAME.md
```

### **3. Debugging Issue:**
```bash
node docker-mcp.js logs app-container 100
node db-mcp-server.js "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"
node filesystem-mcp.js read server/src/routes/orders.js
```

### **4. Deployment Check:**
```bash
node docker-mcp.js compose
node docker-mcp.js stats mysql-container
node db-mcp-server.js "SELECT COUNT(*) FROM z_reports"
```

---

## 📋 **Configuration:**

All servers configured in `.mcp-config.json`:

```json
{
  "mcpServers": {
    "github": {...},
    "graphify": {...},
    "obsidian": {...},
    "database": {...},
    "filesystem": {...},
    "docker": {...}
  }
}
```

---

## ✅ **Quick Test:**

```bash
# Verify all servers
echo "Testing Database..."
node db-mcp-server.js tables

echo "Testing Filesystem..."
node filesystem-mcp.js list src

echo "Testing Docker..."
node docker-mcp.js containers

echo "✅ All MCP servers operational!"
```

---

## 🚀 **Pro Tips:**

1. **Automate workflows** — Combine database + filesystem queries
2. **Monitor deployments** — Use docker + database together
3. **Track changes** — GitHub MCP + Audit logs
4. **Documentation** — Keep Obsidian updated as you code
5. **Visualization** — Graphify shows impact of new code

---

**You now have enterprise-grade development tools integrated!** 🎉
