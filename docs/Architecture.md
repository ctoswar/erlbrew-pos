# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  POS Tablet  │  │  Kitchen     │  │  Admin       │      │
│  │  (React)     │  │  Display     │  │  Dashboard   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Express.js (Port 3001)                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │ Auth    │  │ Orders  │  │ Menu    │              │   │
│  │  │ (JWT)   │  │         │  │         │              │   │
│  │  └─────────┘  └─────────┘  └─────────┘              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │Invntry  │  │ Staff   │  │ Reports │              │   │
│  │  │         │  │         │  │         │              │   │
│  │  └─────────┘  └─────────┘  └─────────┘              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MySQL 8    │  │   Google     │  │   Redis      │      │
│  │   (Primary)  │  │   Sheets     │  │   (Cache)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Tech Stack
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling

### Component Structure

```
src/
├── components/
│   ├── Auth/           # Login, RFID scanner
│   ├── POS/            # Order taking, cart, checkout
│   ├── Kitchen/        # Kitchen display board
│   ├── Admin/          # Dashboard, reports, settings
│   └── Shared/         # Common UI components
├── hooks/              # Custom React hooks
├── types/              # TypeScript interfaces
└── utils/              # Helper functions
```

### State Management
- **React Context** - Global state (auth, cart)
- **Local State** - Component-specific state
- **Server State** - API responses cached in state

### Real-time Updates
- **Server-Sent Events (SSE)** - Order status updates
- **WebSocket** - Kitchen board live updates

---

## Backend Architecture

### Tech Stack
- **Express.js** - HTTP server
- **MySQL2** - Database driver
- **JWT** - Authentication
- **Multer** - File uploads

### Directory Structure

```
server/src/
├── index.js           # Server entry point
├── routes/            # API route handlers
│   ├── orders.js      # Order CRUD
│   ├── menu.js        # Menu management
│   ├── staff.js       # Staff management
│   ├── inventory.js   # Inventory tracking
│   └── ...
├── middleware/         # Express middleware
│   └── auth.js        # JWT authentication
├── services/          # External integrations
│   ├── googleSheets.js
│   └── audit.js
└── db/                # Database schema
    └── init.sql
```

### Authentication Flow

```
Client                    Server                    Database
  │                         │                         │
  │── POST /login ────────▶│                         │
  │   (RFID + PIN)         │── Query staff ─────────▶│
  │                         │◀── Staff record ────────│
  │                         │── Verify PIN (bcrypt)   │
  │                         │── Generate JWT          │
  │◀── { token, staff } ───│                         │
  │                         │                         │
  │── GET /orders ────────▶│                         │
  │   (Bearer token)       │── Verify JWT            │
  │                         │── Query orders ────────▶│
  │◀── Orders array ───────│◀── Results ──────────────│
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `staff` | Employee accounts, RFID, roles |
| `menu_items` | Products, prices, categories |
| `orders` | Transaction records |
| `order_items` | Line items per order |
| `inventory` | Stock tracking |
| `recipes` | Menu-to-inventory mapping |
| `cash_drawer` | Cash register sessions |
| `time_records` | Clock in/out tracking |
| `audit_logs` | Action history |

### Key Relationships

```
staff ──────┐
            │
menu_items ─┼──▶ orders ──▶ order_items
            │       │
            │       ▼
            │   customers
            │
inventory ──┴──▶ recipes
```

---

## Deployment Architecture

### Docker Compose

```yaml
services:
  erlbw-api:        # Backend (Express)
    build: ./server
    ports: 3001
    
  erlbrew-pos:      # Frontend (nginx)
    build: .
    ports: 3004
    depends_on: erlbw-api
```

### Network Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tablet    │────▶│   nginx     │────▶│  Express    │
│  (Browser)  │     │  (Port 3004)│     │  (Port 3001)│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │    MySQL    │
                                        │  (Port 3306)│
                                        └─────────────┘
```

---

## Security Measures

1. **Authentication** - JWT with 24h expiration
2. **Authorization** - Role-based (Staff, Manager, Admin)
3. **Input Validation** - Server-side validation on all inputs
4. **SQL Injection Prevention** - Parameterized queries
5. **Rate Limiting** - Login: 10/min, API: 100/min
6. **CORS** - Configurable allowed origins
7. **HTTPS** - Self-signed for local, Let's Encrypt for production

---

## Performance Considerations

- **Connection Pooling** - MySQL2 pool for database connections
- **Layer Caching** - Docker layers for faster rebuilds
- **Static Assets** - nginx for frontend serving
- **Gzip Compression** - Enabled in nginx
- **Lazy Loading** - Route-based code splitting
