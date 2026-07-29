# 🔒 Security Setup — Before Pushing to GitHub

## ✅ What's Safe to Push
- Source code (`.tsx`, `.js`, `.ts`)
- Configuration examples (`.example.json`, `.env.example`)
- Documentation (`.md` files)
- Package dependencies (`package.json`, `package-lock.json`)

## ❌ What's NOT Safe (Already .gitignored)
- `.env` files (database credentials, JWT secrets)
- `.mcp-config.json` (MySQL password)
- `server/.env` (backend configuration)
- Private key files (`.pem`, `.key`, `.pfx`)
- Screenshots and test files (large binaries)

---

## 🚀 Setup Instructions for Your Team

### **1. Clone the repo**
```bash
git clone https://github.com/your-username/erlbrew-pos.git
cd erlbrew-pos
```

### **2. Copy configuration from examples**
```bash
# Copy backend config template
cp server/.env.example server/.env

# Copy MCP config template
cp .mcp-config.example.json .mcp-config.json
```

### **3. Add your local secrets to `.env` files**

**`server/.env`:**
```
DATABASE_URL=mysql://root:gameclub11@192.168.75.101:3306/erlbrew_pos
JWT_SECRET=your-secret-key-here
PORT=3001
CORS_ORIGINS=https://localhost:3000
GOOGLE_SHEETS_ID=your-sheet-id
PRINT_SERVER_URL=https://192.168.75.101:9100
```

**`.mcp-config.json`:**
```json
{
  "database": {
    "env": {
      "DB_HOST": "192.168.75.101",
      "DB_USER": "root",
      "DB_PASSWORD": "gameclub11",
      "DB_PORT": "3306"
    }
  }
}
```

### **4. Never commit these files**
```bash
# ✅ These are already in .gitignore
git status  # Verify .env and .mcp-config.json are NOT listed

# If they appear in git, remove them:
git rm --cached .env server/.env .mcp-config.json
git commit -m "Remove secrets from tracking"
```

---

## 🔐 Environment Variables Used

| File | Variables | Source |
|------|-----------|--------|
| `server/.env` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGINS` | Keep local only |
| `.mcp-config.json` | `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Keep local only |
| `print-server/.env` | `BT_PRINTER_MAC`, `PRINTER_TYPE` | Pi only |

---

## ✨ Your `.env` Template

Create `server/.env` with:
```
# Database
DATABASE_URL=mysql://root:gameclub11@192.168.75.101:3306/erlbrew_pos

# JWT
JWT_SECRET=your-production-secret-key-min-32-chars-long

# Server
PORT=3001
CORS_ORIGINS=https://localhost:3000,https://192.168.75.101:3000

# Google Sheets (optional)
GOOGLE_SHEETS_ID=your-sheet-id-here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Print Server
PRINT_SERVER_URL=https://192.168.75.101:9100
```

---

## ✨ Your `.mcp-config.json` Template

```json
{
  "mcpServers": {
    "database": {
      "env": {
        "DB_TYPE": "mysql",
        "DB_HOST": "192.168.75.101",
        "DB_USER": "root",
        "DB_PASSWORD": "gameclub11",
        "DB_NAME": "erlbrew_pos",
        "DB_PORT": "3306"
      }
    }
  }
}
```

---

## 🔍 Verify Before Pushing

Run this before `git push`:

```bash
# 1. Check for exposed secrets
git diff --cached | grep -i "password\|secret\|key\|token"

# 2. Verify .env files are NOT staged
git status | grep -E "\.env|\.mcp-config\.json"

# 3. Verify .gitignore is working
git check-ignore .env server/.env .mcp-config.json  # Should all return 0
```

---

## 🛡️ GitHub Security Checks

After pushing:

1. **Enable branch protection rules** → Require code review
2. **Enable secret scanning** → Settings > Security > Secret scanning
3. **Use GitHub Secrets** for any CI/CD that needs credentials
4. **Add CODEOWNERS** → Require approval for changes to sensitive files

---

## ⚠️ If You Accidentally Pushed Secrets

**IMMEDIATELY:**

```bash
# 1. Rotate the exposed password
# Change MySQL root password on the Raspberry Pi

# 2. Force-remove the commit (if not yet public)
git log --all --full-history --oneline | grep "sensitive file"
git filter-branch --tree-filter 'rm -f .env' -- --all
git push origin --force-with-lease

# 3. Create a new token/credential
# GitHub will notify you if secrets were exposed in public repos
```

---

## ✅ Ready to Push!

Once setup is complete:

```bash
# 1. Verify secrets are gitignored
git status  # Should NOT show .env or .mcp-config.json

# 2. Push to GitHub
git add .
git commit -m "Add MCP servers and documentation"
git push origin main
```

**Your code is now safe to share publicly!** 🚀
