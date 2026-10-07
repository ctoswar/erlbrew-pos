# Erlbrew POS

A tablet-optimized Point of Sale system for Erlbrew Cafe, built with React + TypeScript frontend and Express + MySQL backend.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

## Features

- **POS Terminal** - Touch-optimized interface for taking orders
- **Kitchen Board** - Real-time Kanban view for order preparation
- **Dashboard** - Sales analytics and reporting
- **Inventory Management** - Track stock levels and costs
- **Staff Management** - RFID/PIN login, time tracking, scheduling
- **Multiple Payment Methods** - Cash, Card, E-Wallet (GCash/Maya)
- **Receipt Printing** - Bluetooth printer integration via Raspberry Pi
- **Google Sheets Sync** - Optional cloud backup of orders and reports

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Express 5, Node.js |
| Database | MySQL 8 |
| Containerization | Docker, Docker Compose |

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- MySQL 8 (or Docker)

### Local Development

```bash
# Clone the repository
git clone https://github.com/ctoswar/erlbrew-pos.git
cd erlbrew-pos

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Start frontend (terminal 1)
cd ..
npm run dev

# Start backend (terminal 2)
cd server
npm run dev
```

Frontend: http://localhost:3000
Backend API: http://localhost:3001

### Docker Deployment

```bash
# Start all services from the repository root
docker compose -f infra/docker-compose.yml up -d

# View logs
docker compose -f infra/docker-compose.yml logs -f

# Stop services
docker compose -f infra/docker-compose.yml down
```

Services:
- Frontend: https://localhost (port 80 → 3004 redirects to HTTPS on 443)
- Backend API: http://localhost:3001

### Install as an Android app (PWA)

Chrome only offers **Install app** when the POS is served over HTTPS (a secure
context is required for service-worker registration and the install prompt).
TLS is terminated by nginx using the certs in `infra/certs/` — that directory
is git-ignored, so generate the certs once on the machine that runs Docker:

```powershell
# One-time per machine (Windows; on Linux/macOS: brew/curl see mkcert.dev)
winget install FiloSottile.mkcert

# Generate the LAN certificate (SANs: localhost, pos.lan, this machine's IPs)
New-Item -ItemType Directory -Force infra\certs
mkcert -cert-file infra\certs\cert.pem -key-file infra\certs\key.pem `
  localhost 127.0.0.1 pos.lan <your-server-LAN-IP> <your-tailscale-IP>

# Export the root CA — copy rootCA.pem to every tablet (email/drive/USB)
Copy-Item "$env:LOCALAPPDATA\mkcert\rootCA.pem" infra\certs\rootCA.pem
```

If tablets reach the stack at an address not listed above, add it and re-run
the `mkcert` line (`mkcert -CAROOT` shows where the CA lives).

Then start the stack and install the app:

1. `docker compose -f infra/docker-compose.yml up -d --build` — requires
   `infra/certs/cert.pem` + `key.pem` to exist, nginx will not start without them.
   (If host port `443` is already taken, replace **both** frontend port entries
   with `- "3004:443"` and open `https://<server>:3004` instead.)
2. On the tablet, install the CA once: **Settings → Security → Encryption &
   credentials → Install a certificate → CA certificate** → select `rootCA.pem`.
3. Open `https://<server>/` in Chrome → ⋮ menu → **Install app**.
4. The app appears in the launcher/app drawer with its own icon and opens
   standalone (no URL bar). HTTP on port `3004` now 301-redirects to HTTPS, so
   old bookmarks keep working.

To change the cert later, regenerate `infra/certs/*.pem` and
`docker compose -f infra/docker-compose.yml restart erlbrew-pos`. Never commit
`infra/certs/` — the key must not enter git or the Docker build context
(already excluded in `.gitignore` / `.dockerignore`).

### Tailscale Deployment for Multiple Locations

Use one central POS deployment and one shared MySQL database. Each branch connects to the
central server over the Tailscale network; do not create a separate database for each branch
if you need consolidated reports and inventory transfers.

Recommended topology:

```text
Branch A tablet ─┐
Branch B tablet ─┼── Tailscale network ── POS server ── MySQL
Branch C tablet ─┘
```

1. Install Tailscale on the server running Docker, and on every branch tablet or computer.
2. Start the stack from the repository root with `docker compose -f infra/docker-compose.yml up -d`.
3. Allow the Tailscale network to reach the frontend port (`3004`) on the POS server.
4. Open the POS from each branch using the server's Tailscale IP or MagicDNS hostname:

   ```text
   http://100.x.x.x:3004
   # or
   http://pos-server.your-tailnet.ts.net:3004
   ```

5. Create the branches in **Admin → Locations**. Use the same central URL at every branch.
6. Configure Tailscale ACLs so only approved POS devices and staff devices can access the
   server.

For HTTPS, use a Tailscale MagicDNS hostname and Tailscale certificates, then terminate TLS
at Nginx. Keep port `3001` private to Docker/Nginx; branch devices should access the frontend
URL rather than the backend directly. With the frontend and `/api` served by the same Nginx
host, leave `VITE_API_URL` empty.

For branch-local receipt printing, install Tailscale on each Raspberry Pi print server and
assign each branch its own print-server hostname, for example:

```text
Branch A → http://branch-a-printer:9100
Branch B → http://branch-b-printer:9100
```

#### Multi-location isolation

The admin dashboard, POS terminals, inventory, transfers, reports, and Insights support
location filtering. Configure each terminal with its branch during first-time setup; regular
staff are locked to their assigned branch, while Managers may switch branches or use the
consolidated view.

## Environment Variables

### Backend (server/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT tokens (generate with `openssl rand -hex 32`) |
| `PORT` | No | Server port (default: 3001) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `GOOGLE_SHEETS_ID` | No | Google Sheets ID for cloud sync |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | Google service account JSON |
| `PRINT_SERVER_URL` | No | Raspberry Pi print server URL |
| `OLLAMA_ENABLED` | No | Set `true` to enable optional Manager AI briefings; deterministic analytics do not require it |
| `OLLAMA_BASE_URL` | No | Ollama service URL (Docker default: `http://ollama:11434`) |
| `OLLAMA_MODEL` | No | Installed local model name used for briefings (example: `qwen3.5:2b`) |
| `OLLAMA_TIMEOUT_MS` | No | Briefing request timeout, bounded by the backend (default: `5000`) |

`CORS_ORIGINS` must contain the exact browser origin used by each deployment,
including the scheme and port when present. For example, a POS opened at
`http://pos.lan` must include `http://pos.lan`; changing only the hostname in
DNS does not update CORS automatically. When using `infra/docker-compose.yml`,
recreate the API container after changing the value:

```powershell
docker compose -f infra/docker-compose.yml up -d --force-recreate erlbw-api
```

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PRINT_SERVER_URL` | No | Print server URL for receipts |

## API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/staff/login` | Staff login (RFID+PIN or username+password) |
| GET | `/api/menu` | Get menu items |
| GET | `/api/orders` | Get all orders |
| GET | `/api/orders/today` | Get today's orders |

### Protected Endpoints (require Bearer token)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/orders` | Staff | Create new order |
| PUT | `/api/orders/:id/status` | Staff | Update order status |
| GET | `/api/orders/cogs` | Staff | Get cost of goods sold |
| GET | `/api/inventory` | Staff | Get inventory items |
| POST | `/api/inventory` | Admin | Create inventory item |
| PUT | `/api/inventory/:id` | Admin | Update inventory item |
| GET | `/api/staff` | Admin | Get all staff |
| POST | `/api/staff` | Admin | Create staff member |

### Admin-Only Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/api/orders/:id` | Void order |
| POST | `/api/orders/:id/void` | Void with reason |
| POST | `/api/orders/:id/refund` | Refund order |
| DELETE | `/api/orders/all` | Clear all orders (fresh start) |

Phase 3 analytics endpoints are Manager-only and accept an optional
`location_id` query parameter. Omit it for all locations:
`/api/insights/menu`, `/api/insights/forecast`,
`/api/insights/inventory`, `/api/insights/optimization`, `/api/insights/staffing`, and
`/api/insights/briefing`. The optional Ollama service is disabled by default;
see [docs/AI-Analytics.md](docs/AI-Analytics.md) before enabling the `ai`
Compose profile.

## Demo Credentials

| Name | Role | RFID | PIN |
|------|------|------|-----|
| Jane Dela Cruz | Senior Barista | RF001 | 1234 |
| Marco Santos | Barista | RF002 | 5678 |
| Ana Reyes | Shift Supervisor | RF003 | 9012 |
| Luis Garcia | Manager | RF004 | 3456 |

## Project Structure

```
erlbrew-pos/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── server/                 # Backend (Express + MySQL)
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── middleware/      # Auth middleware
│   │   ├── services/       # Google Sheets integration
│   │   └── index.js        # Server entry point
│   └── Dockerfile
├── infra/                  # Docker configuration
│   ├── docker-compose.yml
│   └── Dockerfile
└── erlbrew_app/            # Firebase functions (optional)
```

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

## Security

Report security vulnerabilities via [SECURITY.md](SECURITY.md).

## License

This project is source-available for reference only. See [LICENSE](./LICENSE) — all rights reserved.
