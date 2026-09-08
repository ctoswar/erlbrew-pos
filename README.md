# Erlbrew POS

A tablet-optimized Point of Sale system for Erlbrew Cafe, built with React + TypeScript frontend and Express + MySQL backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
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
cd infra

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Services:
- Frontend: http://localhost:3004
- Backend API: http://localhost:3001

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

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
