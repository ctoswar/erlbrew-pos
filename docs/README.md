# Erlbrew Café POS — Full Technical Documentation

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Frontend (`/src`)](#3-frontend-src)
4. [Backend (`/server/src`)](#4-backend-server-src)
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [Google Sheets Integration](#7-google-sheets-integration)
8. [Authentication & Security](#8-authentication--security)
9. [Environment Variables](#9-environment-variables)
10. [Print Server & Hardware Integration](#10-print-server--hardware-integration)
11. [Bug Fixes Applied](#11-bug-fixes-applied)
12. [Recent Feature Changes](#12-recent-feature-changes)

---

## 1. System Overview

**Erlbrew Café POS** is a full-stack tablet-optimized Point of Sale system for a coffee shop. It runs on two processes:

| Process | Port | Purpose |
|---|---|---|
| Frontend (Vite + React) | 3000 | Staff-facing UI + Customer display |
| Backend (Express.js) | 3001 | REST API, DB, Sheets, Print |

**Two browsers/machines share state** via the same MySQL database and periodic polling (15s intervals).

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite 5 (ESM)
- **Backend**: Node.js + Express 4 (ESM modules)
- **Database**: MySQL 8 (accessed via `mysql2/promise`)
- **Auth**: JWT (`jsonwebtoken`) with bcrypt password hashing
- **Sheets**: Google Sheets API v4 via `googleapis`
- **Styling**: Custom CSS with CSS Variables — no CSS framework

### Deployment Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Staff Tablet   │     │ Customer Display│     │  Kitchen Board  │
│  (POS UI :3000) │     │  (:3000?customer)│     │  (:3000 Kitchen) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  Vite proxy /api →   │                       │
         └───────────────────────┴───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Express API :3001     │
                    │  JWT Auth  Rate Limit  │
                    └───────┬────────┬────────┘
                            │        │
                 ┌──────────▼──┐  ┌──▼──────────────────┐
                 │ MySQL :3306  │  │ Pi Print Server      │
                 │ 192.168.x.x  │  │ https://192.168.x.x  │
                 └─────────────┘  └───────────────────────┘
```

---

## 2. Architecture

### Frontend Directory Structure
```
src/
├── main.tsx                   # React entry point
├── App.tsx                    # Root: auth check → LoginScreen or POSScreen
├── types/index.ts             # All TypeScript interfaces
├── data/index.ts              # Static seed data (menu, staff) — now DB-driven
├── utils/
│   ├── index.ts               # formatCurrency, calcSubtotal, calcTax,
│   │                           # calcGrand, buildDailySummary, etc.
│   ├── api.ts                 # apiGet, apiPost, apiAdminGet, auth token mgmt
│   └── receiptUtils.tsx       # openCashDrawer, printReceipt helpers
├── hooks/
│   ├── useCart.ts             # Cart state: items, discount, localStorage
│   ├── useOrders.ts           # Orders: place, poll, update status, void
│   └── useClock.ts            # Live clock (1s interval)
├── components/
│   ├── LoginScreen.tsx        # RFID card scan OR PIN login
│   ├── Topbar.tsx             # Nav tabs, live clock, staff badge
│   ├── POSScreen.tsx          # Main orchestrator: screen router + layout
│   ├── MenuGrid.tsx            # Category tabs + item cards grid
│   ├── CartPanel.tsx           # Item list, totals, discount, order type
│   ├── CheckoutScreen.tsx      # Order review before payment
│   ├── PaymentScreen.tsx      # Cash/Card/E-Wallet selection + change calc
│   ├── SuccessScreen.tsx      # Confirmation + print receipt trigger
│   ├── KitchenBoard.tsx       # 4-column kanban: pending/preparing/ready/done
│   ├── Dashboard.tsx          # KPI cards, charts, cost analysis, sync Sheet3
│   ├── CustomerDisplay.tsx    # Second-monitor: live cart + order status
│   ├── AdminScreen.tsx        # Admin tab hub
│   ├── AdminMenu.tsx           # Add/edit/delete menu items
│   ├── AdminInventory.tsx     # Stock levels, low-stock alerts + movement history
│   ├── AdminStaff.tsx          # Add/edit/delete staff
│   ├── AdminPrintSettings.tsx # Print server URL config
│   ├── CashDrawerScreen.tsx   # Cash drawer management: open, cash in/out, close, reconcile
│   ├── IngredientEditor.tsx   # Link inventory items → menu item (recipes)
│   ├── DiscountModal.tsx      # PWD/Senior/Custom discount picker
│   ├── TimeKeeping.tsx        # Clock-in/out status board
│   ├── Receipt.tsx             # 80mm thermal printer output (hidden div)
│   └── ReceiptPreview.tsx     # On-screen receipt preview before printing
└── styles/global.css          # CSS variables, animations, resets, components
```

### Backend Directory Structure
```
server/src/
├── index.js                   # Express app bootstrap, routes, print proxy
├── middleware/auth.js         # JWT verification middleware
├── routes/
│   ├── staff.js               # Login, CRUD staff, RFID lookup
│   ├── menu.js                # CRUD menu items
│   ├── orders.js              # Place orders, update status, COGS, cash drawer + transactions, Z-reports
│   ├── inventory.js           # CRUD inventory stock + inventory movement log (sale/restock/adjustment/void)
│   ├── recipes.js             # Link inventory → menu item (recipes)
│   └── clock.js               # Clock in/out via RFID, time records
└── services/
    └── googleSheets.js        # appendOrder, appendTimeRecord, appendDashboard
```

---

## 3. Frontend (`/src`)

### 3.1 Types (`types/index.ts`)

Core TypeScript interfaces:

```typescript
interface Order {
  id: string;
  items: CartItem[];      // items ordered
  staff: Staff;           // who took the order
  status: OrderStatus;    // "pending" | "preparing" | "ready" | "completed"
  subtotal: number;        // sum of item prices × qty
  tax: number;             // 12% VAT (subtotal × 0.12)
  total: number;           // subtotal − discount
  createdAt: Date;
  completedAt?: Date;
  table?: string;          // "Table 1" for dine-in
  type: OrderType;         // "dine-in" | "takeout"
  payMethod: PayMethod;    // "cash" | "card" | "ewallet"
  cashTendered?: number;   // cash amount given (for change calculation)
  discount?: Discount;     // applied discount
}

interface Discount {
  type: DiscountType;      // "pwd" | "senior" | "custom_pct" | "custom_fixed"
  label: string;           // "PWD Discount", "Senior Discount", etc.
  value: number;           // percentage (20) or fixed peso amount
  amount: number;           // computed peso discount
}

interface Staff {
  id?: number;
  rfid: string;            // RFID card UID
  pin: string;             // bcrypt-hashed 4-digit PIN
  name: string;
  role: Role;              // "Barista" | "Senior Barista" | "Shift Supervisor" | "Manager"
  initials: string;        // 2-letter code shown on orders
  color: string;           // hex color for avatar
}

interface MenuItem {
  id: string;              // e.g. "m1", "m2"
  name: string;
  category: Category;      // "Signature Brews" | "Espresso" | "Pastries" | "Cold Drinks"
  price: number;           // PHP
  badge?: string;          // e.g. "SIGNATURE", "HAND-POURED", "BAKED DAILY"
  description: string;
  emoji: string;
  popular?: boolean;
}

interface CartItem {
  item: MenuItem;
  qty: number;
  notes?: string;          // per-item special instructions
}
```

### 3.2 Utility Functions (`utils/index.ts`)

| Function | Signature | Description |
|---|---|---|
| `formatCurrency` | `(n) => "₱123.45"` | Formats number as Philippine peso |
| `calcSubtotal` | `(cart) => number` | `Σ(item.price × item.qty)` |
| `calcTax` | `(subtotal) => number` | `subtotal × 0.12` (12% VAT) |
| `calcGrand` | `(subtotal, discount?) => number` | `subtotal − discount.amount` |
| `buildDailySummary` | `(orders, cogsData?) => DailySummary` | Aggregates revenue, top items, category, payment method |
| `generateOrderId` | `() => "#1234"` | Random 4-digit order number |
| `getQuickCashAmounts` | `(total) => [₱X, ₱Y, ...]` | Rounded cash buttons (nearest, +10, +50, +100) |

### 3.3 API Client (`utils/api.ts`)

```typescript
// Public (no auth) — used by KitchenBoard, Dashboard, TimeKeeping
apiGet<T>(path)        // GET /api/...  (cookie-based session)
apiPost<T>(path, body) // POST /api/... (cookie-based session)

// Admin (Bearer token required)
apiAdminGet<T>(path)
apiAdminPost<T>(path, body)
apiAdminPut<T>(path, body)
apiAdminDelete<T>(path)

// Auth token stored in localStorage key: "erlbrew_token"
// Set automatically on login; sent as Authorization: Bearer <token>
```

### 3.4 Hooks

**`useCart`** — Cart state with localStorage persistence
- `cart: CartItem[]` — current items
- `discount: Discount | null` — applied discount
- `addItem(item)`, `updateQty(id, delta)`, `removeItem(id)` — cart mutations
- `applyDiscount(type, label, value, subtotal)` — sets discount, computes peso amount
- `removeDiscount()` — clears discount
- `clearCart()` — clears both cart and discount
- `addNote(id, notes)` — attach per-item special instructions

**`useOrders`** — Order lifecycle management
- Polls `GET /orders/today` every 15s for multi-device sync
- `placeOrder(...)` — optimistic local order, then POST to server
- `updateStatus(id, status)` — local + `PUT /orders/:id/status`
- `voidOrder(id)` — local + `DELETE /orders/:id`
- Sends full `discount_*` fields and pre-computed `subtotal`/`total` in payload so server respects client-side calculations

**`useClock`** — Live wall clock (updates every second via `setInterval`)

---

## 4. Backend (`/server/src`)

### 4.1 Server Bootstrap (`index.js`)

- TLS bypass set at top of file (before imports): `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` — allows HTTPS connections to Pi print server with self-signed cert
- CORS: production requires `CORS_ORIGINS=https://yourdomain.com` env var; no wildcard
- Rate limiting: 10 login attempts/15min, 100 API requests/minute
- DB pool: MySQL with `+08:00` timezone, auto-seeds 16 menu items if `menu_items` table is empty
- JWT secret required: exits with `FATAL` if not set

### 4.2 Routes Overview

| Route Module | Mount | Auth | Notes |
|---|---|---|---|
| `staff` | `/api/staff` | Mixed | Public RFID lookup, all others protected |
| `menu` | `/api/menu` | Mixed | Public reads, admin writes |
| `orders` | `/api/orders` | Mixed | Public reads, admin writes |
| `inventory` | `/api/inventory` | All admin | All routes require JWT |
| `recipes` | `/api/recipes` | Mixed | Public reads, admin writes |
| `clock` | `/api/clock` | Mixed | Public POST for clock-in, GET admin-only |

### 4.3 Order Flow (Critical Path)

```
1. POST /api/orders  (auth required)
   ├── Validates items, type, pay_method
   ├── Calculates subtotal server-side
   ├── INSERT into orders + order_items tables
   ├── Auto-deducts inventory (per recipes: qty × inventory_item qty)
   │   ├── Logs inventory_movements (type: "sale") with before/after stock snapshots
   │   └── Skips silently if not enough stock (order still succeeds)
   ├── Logs cash drawer sale transaction if pay_method = "cash" (auto-updates cash_sales)
   └── Appends row to Google Sheets "Orders" tab (best-effort)
       └── Writes: timestamp, order_id, staff_name, item list, subtotal, tax, total, pay_method, status

2. PUT /api/orders/:id/status  (auth required)
   └── Sets completed_at timestamp when status = "completed"

3. DELETE /api/orders/:id  (auth required)
   └── Removes order_items then orders rows

4. GET /api/orders/today  (public)
   └── Returns today's orders with items, staff info
```

**Discount handling** — server accepts pre-computed `subtotal` and `total` from client when a discount is applied:
```json
{
  "discount_type": "senior",
  "discount_label": "Senior Citizen Discount",
  "discount_value": 20,
  "discount_amount": 12.50,
  "subtotal": 62.50,
  "total": 50.00,
  ...
}
```
Server uses `total` directly from payload when discount fields are present.

### 4.4 Inventory Auto-Deduction & Movement Log

When `POST /api/orders` is called:
1. Fetch all `recipes` for ordered menu items in one query
2. For each recipe: `newStock = currentStock − (recipe.quantity × orderedQty)`
3. UPDATE inventory only if `stock >= deduction`
4. Log `inventory_movements` entry with `movement_type = 'sale'`, `stock_before`, `stock_after`, `reference_id = order_id`
5. Log `[LOW STOCK]` warning if `newStock <= low_stock_threshold`
6. On failure: order still succeeds (best-effort deduction and logging)

**Inventory restoration on void:** When an order is voided (`POST /api/orders/:id/void`), all deducted inventory is restored and logged as `movement_type = 'void'`.

**Admin UI:** Admins can view movement history per item or globally via the "History" button on inventory cards or the "Movement Log" button in the inventory header. Manual restock/adjustment is done via the "+ Restock" button, which logs entries as `restock` or `adjustment` types.

---

## 5. API Reference

### Public Endpoints (No Auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/staff/rfid/:rfid` | Lookup staff by RFID card UID |
| `GET` | `/api/orders` | All orders (kitchen/dashboard) |
| `GET` | `/api/orders/today` | Today's orders |
| `GET` | `/api/menu` | All menu items |
| `GET` | `/api/inventory` | Inventory items |
| `GET` | `/api/recipes/:menuItemId` | Ingredients for a menu item |
| `GET` | `/api/clock` | Today's clock records (TimeKeeping screen) |
| `POST` | `/api/clock` | RFID tap → clock in or out |
| `POST` | `/api/staff/login` | Staff login (PIN or password) |

### Protected Endpoints (Bearer Token Required)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/orders` | Place a new order |
| `PUT` | `/api/orders/:id/status` | Update order status |
| `DELETE` | `/api/orders/:id` | Void/delete order |
| `GET` | `/api/orders/cogs` | COGS report (auth required) |
| `POST` | `/api/sheets/sync-dashboard` | Sync today's dashboard to Google Sheet3 |
| `GET` | `/api/staff` | All staff (admin list) |
| `POST` | `/api/staff` | Create staff member |
| `GET` | `/api/staff/:id` | Get staff by ID |
| `PUT` | `/api/staff/:id` | Update staff |
| `POST` | `/api/menu` | Create menu item |
| `PUT` | `/api/menu/:id` | Update menu item |
| `DELETE` | `/api/menu/:id` | Delete menu item |
| `POST` | `/api/inventory` | Create inventory item |
| `PUT` | `/api/inventory/:id` | Update inventory item |
| `DELETE` | `/api/inventory/:id` | Delete inventory item |
| `PUT` | `/api/recipes/:menuItemId` | Set recipes for menu item |
| `GET` | `/api/clock/:staffId` | Staff time records |
| `GET` | `/api/inventory/movements` | Inventory movement log (filters: itemId, type, start, end, limit) |
| `POST` | `/api/inventory/movements` | Manual restock or adjustment (admin only, with reason) |
| `GET` | `/api/orders/cash-drawer` | Today's open cash drawer or empty stub |
| `POST` | `/api/orders/cash-drawer` | Open a new cash drawer shift with opening float |
| `PUT` | `/api/orders/cash-drawer/:id` | Update/close cash drawer (save progress, close shift) |
| `GET` | `/api/orders/cash-drawer/transactions` | Cash drawer transaction log (sales, cash in/out, payouts) |
| `POST` | `/api/orders/cash-drawer/transactions` | Record a cash in/out transaction with reason |

### Response Shapes

**Order:**
```json
{
  "id": "uuid-v4",
  "status": "preparing",
  "subtotal": 62.50,
  "tax": 7.50,
  "total": 50.00,
  "type": "dine-in",
  "pay_method": "cash",
  "created_at": "2026-05-06T...",
  "items": [{ "menu_item_id": "m1", "qty": 2, "price": 6.75, "notes": "" }],
  "staff_name": "Jane Dela Cruz"
}
```

**COGS Report:**
```json
{
  "cogs": 284.50,
  "orderCount": 37,
  "start": "2026-05-06",
  "end": "2026-05-06",
  "details": [{ "order_id": "uuid", "total": 62.50, "cogs": 18.20, "profit": 44.30 }]
}
```

---

## 6. Database Schema

**All tables use InnoDB engine, utf8mb4 collation, UTC+8 timezone.**

### `staff`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PRIMARY KEY AUTO_INCREMENT | |
| `rfid` | VARCHAR(64) UNIQUE | RFID card UID |
| `pin` | VARCHAR(255) | bcrypt-hashed 4-digit PIN |
| `name` | VARCHAR(128) | |
| `role` | ENUM('Barista','Senior Barista','Shift Supervisor','Manager') | |
| `initials` | VARCHAR(2) | 2-letter code |
| `color` | VARCHAR(8) | Hex color e.g. `#C9873A` |
| `created_at` | TIMESTAMP | |

### `menu_items`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(64) PRIMARY KEY | e.g. `m1` |
| `name` | VARCHAR(128) | |
| `category` | ENUM(...) | 4 categories |
| `price` | DECIMAL(10,2) | |
| `badge` | VARCHAR(32) | Optional label |
| `description` | TEXT | |
| `emoji` | VARCHAR(8) | |
| `popular` | TINYINT(1) | 0 or 1 |

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) PRIMARY KEY | UUID v4 |
| `staff_id` | INT FK → staff.id | nullable |
| `status` | ENUM('pending','preparing','ready','completed') | |
| `subtotal` | DECIMAL(10,2) | |
| `tax` | DECIMAL(10,2) | Always 0 in DB (tax computed at tax time) |
| `total` | DECIMAL(10,2) | |
| `table_name` | VARCHAR(32) | e.g. `1` |
| `type` | ENUM('dine-in','takeout') | |
| `pay_method` | ENUM('cash','card','ewallet') | |
| `created_at` | TIMESTAMP | |
| `completed_at` | TIMESTAMP NULL | |

### `order_items`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PRIMARY KEY AUTO_INCREMENT | |
| `order_id` | VARCHAR(36) FK → orders.id | |
| `menu_item_id` | VARCHAR(64) FK → menu_items.id | |
| `qty` | INT | |
| `price` | DECIMAL(10,2) | Snapshot at time of order |
| `notes` | TEXT | Special instructions |

### `inventory`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(64) PRIMARY KEY | e.g. `inv_01` |
| `name` | VARCHAR(128) | |
| `category` | VARCHAR(64) | |
| `unit` | VARCHAR(32) | e.g. `pcs`, `ml`, `g` |
| `stock` | DECIMAL(10,2) | Current quantity |
| `low_stock_threshold` | DECIMAL(10,2) | Alert when stock ≤ threshold |
| `purchase_cost` | DECIMAL(10,2) NULL | Per-unit cost for COGS |
| `unit_cost` | DECIMAL(10,2) NULL | Alias for purchase_cost |
| `created_at` | TIMESTAMP | |

### `recipes` (menu item → inventory mapping)
| Column | Type | Notes |
|---|---|---|
| `id` | INT PRIMARY KEY AUTO_INCREMENT | |
| `menu_item_id` | VARCHAR(64) FK → menu_items.id | |
| `inventory_item_id` | VARCHAR(64) FK → inventory.id | |
| `quantity` | DECIMAL(10,2) | How much of inventory item is used per serving |

### `inventory_movements` (audit log)
| Column | Type | Notes |
|---|---|---|
| `id` | INT PRIMARY KEY AUTO_INCREMENT | |
| `inventory_item_id` | VARCHAR(32) FK → inventory.id | |
| `movement_type` | ENUM('sale','restock','adjustment','void') | |
| `quantity` | DECIMAL(10,2) | Absolute quantity changed |
| `stock_before` | DECIMAL(10,2) | Snapshot before change |
| `stock_after` | DECIMAL(10,2) | Snapshot after change |
| `reference_type` | VARCHAR(32) | e.g. "order" |
| `reference_id` | VARCHAR(64) | e.g. order UUID |
| `notes` | VARCHAR(256) | Optional reason |
| `created_at` | TIMESTAMP | |

### `cash_drawer`
| Column | Type | Notes |
|---|---|---|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | |
| `shift_date` | DATE NOT NULL | |
| `status` | ENUM('open','closed') | |
| `opening_float` | DECIMAL(10,2) | Cash put in at start of shift |
| `cash_sales` | DECIMAL(10,2) | Auto-summed from cash orders |
| `cash_payouts` | DECIMAL(10,2) | Money taken out during shift |
| `closing_amount` | DECIMAL(10,2) | Physical cash counted at end |
| `expected_amount` | DECIMAL(10,2) | float + sales - payouts |
| `variance` | DECIMAL(10,2) | closing - expected |
| `notes` | TEXT | |

### `cash_drawer_transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | |
| `drawer_id` | INT FK → cash_drawer.id | |
| `transaction_type` | ENUM('cash_in','cash_out','sale','payout') | |
| `amount` | DECIMAL(10,2) | |
| `balance_before` | DECIMAL(10,2) | Running balance before entry |
| `balance_after` | DECIMAL(10,2) | Running balance after entry |
| `reason` | VARCHAR(256) | Description or order reference |
| `staff_name` | VARCHAR(128) | Who performed the transaction |
| `created_at` | TIMESTAMP | |

### `time_records`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PRIMARY KEY AUTO_INCREMENT | |
| `staff_id` | INT FK → staff.id | |
| `rfid` | VARCHAR(64) | Snapshot at clock-in |
| `clock_in` | TIMESTAMP | |
| `clock_out` | TIMESTAMP NULL | Set on clock-out |
| `total_hours` | DECIMAL(5,2) NULL | Computed: `TIMESTAMPDIFF(MINUTE, clock_in, clock_out) / 60` |

---

## 7. Google Sheets Integration

Configured via `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON) and `GOOGLE_SHEETS_ID` env vars.

### Tabs Used

| Tab Name | Data Written |
|---|---|
| `Orders` (or first sheet) | Each placed order: timestamp, order ID, staff, items, subtotal, tax, total, pay method, status |
| `Sheet2` (or first sheet) | Clock in/out events: timestamp, staff name, role, action, clock in, clock out, total hours |
| `Sheet3` | Full daily dashboard: KPI summary, top items, revenue by category, payment methods, hourly breakdown, order detail |

### Sheet3 Dashboard Contents
Sheet3 is written on every Dashboard load (2s debounce after orders change) and contains:

**Sections (column A-J):**
1. Title + generation timestamp
2. KPI Summary: Revenue, Orders, Avg Value, COGS, Gross Profit, Margin %
3. Top Items table: Item name | Qty Sold
4. Revenue by Category: Category | Revenue (₱) | Items Sold
5. Payment Methods: Method | Total (₱) | Orders
6. Hourly Breakdown: Hour label | Orders count | Revenue (₱)
7. Order Detail: Full row per order

**Charts (embedded at column L, anchored by row):**
- **Bar Chart** — Top Selling Items (col A: item names, col B: qty)
- **Pie Chart** — Revenue by Category (col A: categories, col B: revenue)
- **Pie Chart** — Payment Methods (col A: methods, col B: totals)
- **Line Chart** — Hourly Orders & Revenue (col A: hours, col B: orders, col C: revenue)

**Formatting applied:** Bold title (gold), section headers (gold), order detail header row, currency number format, frozen top row.

### Sheets API Notes
- Tab name cached after first resolve (in-memory)
- Sheet3 auto-created via `batchUpdate addSheet` request; falls back to first tab if creation fails
- All Sheets writes are `USER_ENTERED` so values are parsed as numbers/dates

---

## 8. Authentication & Security

### JWT Auth
- Algorithm: HS256
- Payload: `{ sub: staff_id, name, role, exp }`
- Expiry: `1d` (24 hours)
- Header sent: `Authorization: Bearer <token>`
- Token stored in `localStorage` key `erlbrew_token`

### Login Methods
1. **RFID + PIN** — Staff taps card, enters 4-digit PIN. PIN verified with bcrypt against stored hash. Triggers auto clock-in/clock-out. Returns JWT.
2. **Username + Password** — For admin access (same PIN or separate `password_hash` field)

### Security Measures
- `JWT_SECRET` must be set — server refuses to start without it
- Rate limiting: 10 login attempts/15min per IP; 100 API requests/min per IP
- CORS: whitelist only; no wildcard in production
- `credentials: true` for all frontend fetch calls (cookie-based)
- Auth failures logged with specific error codes: `NO_TOKEN`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `AUTH_FAILED`

---

## 9. Environment Variables

### Server (`server/.env`)
```bash
# REQUIRED
JWT_SECRET=                    # JWT signing secret (min 32 chars recommended)
DATABASE_URL=                   # MySQL connection string
GOOGLE_SHEETS_ID=              # Google Sheets spreadsheet ID

# OPTIONAL
PORT=3001                      # Default: 3001
CORS_ORIGINS=                  # Comma-separated, e.g. https://erp.erlbrew.com
NODE_TLS_REJECT_UNAUTHORIZED=0  # Set automatically by code (print server TLS)
GOOGLE_SERVICE_ACCOUNT_KEY=     # JSON service account credentials
PRINT_SERVER_URL=              # Default: https://192.168.75.101:9100
```

### Frontend (Vite)
```bash
# Frontend reads these at build time
VITE_API_URL=                  # Default: "" (same origin, uses Vite proxy)
```

---

## 10. Print Server & Hardware Integration

### Print Proxy
The backend acts as a proxy to solve Chrome's Private Network Access CORS block. The tablet (browser) calls `POST /api/print` and `POST /api/open-drawer`; the backend forwards to the Pi Bluetooth print server.

```bash
POST /api/print
Body: { lines: string[], paperSize?: "80mm" | "58mm" }
→ Forwards to https://192.168.75.101:9100/print

POST /api/open-drawer
→ Forwards to https://192.168.75.101:9100/open-drawer
```

### Cash Drawer Management

**Quick-open button** on the Topbar (💰 icon) lets staff pop the drawer from any screen — no need to navigate to Admin.

**Full management** in Admin → Cash Drawer tab:
- **Open shift** with an opening float
- **+ Cash In / − Cash Out** — record money added to or taken from the drawer with reason
- **Cash Payouts** — running total of cash taken out
- **Expected Cash** — auto-calculated: `float + sales − payouts`
- **Actual Cash** — manual count at end of shift
- **Variance** — colored indicator (green = balanced, red = >₱50 off)
- **Save Progress** / **Close & Balance** — end-of-day reconciliation
- **Transaction Log** — full history of every movement (sale, cash in, cash out) with timestamps and running balance

Cash sales are auto-logged as `sale` transactions when cash orders are placed via the POS. The cash drawer `cash_sales` field is automatically updated.

### Receipt Printing
Receipt.tsx renders a hidden `<pre>` element with 80mm thermal print layout. On `onPrint` callback (wired to SuccessScreen), `window.open()` writes HTML and calls `window.print()`.

---

## 11. Bug Fixes Applied

The following bugs were identified and fixed during development:

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | CRITICAL | Server ignored discount — always set `total = subtotal` | Server now extracts `discount_type`, `discount_amount`, `subtotal`, `total` from req.body when discount present |
| 2 | CRITICAL | `NODE_TLS_REJECT_UNAUTHORIZED=0` set globally as env var | Set as `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` in-process at top of index.js before all imports |
| 3 | CRITICAL | `calcTax` always returned 0 (stub body) | Returns `Math.round(subtotal * 0.12 * 100) / 100` (12% VAT) |
| 4 | CRITICAL | Missing auth on `GET /api/orders`, `/orders/today`, `/clock` | Removed `authMiddleware` from read-only routes; kept on write operations |
| 5 | CRITICAL | Staff `GET /` with auth blocked RFID card lookup at login | Extracted RFID lookup to `GET /api/staff/rfid/:rfid` (no auth) |
| 6 | HIGH | KitchenBoard dropped `pending` orders (no column) | Added `pending` to `COLUMNS` array |
| 7 | HIGH | `CustomerDisplay calcGrand(subtotal)` ignored discount | Added `discount` argument to both `calcGrand` calls |
| 8 | HIGH | Clock-in crashed if `time_records` result empty | Added null check `if (!rec) return res.status(404)...` before accessing `rec.clock_in` |
| 9 | HIGH | 11 empty `.catch(() => {})` swallowed errors silently | All replaced with `console.error(e)` with context |
| 10 | HIGH | ReceiptPreview had no discount row | Added discount line between Subtotal and Total |
| 11 | HIGH | Receipt.tsx text receipt had no discount row | Added `order.discount?.amount` display with label |
| 12 | HIGH | POSScreen `renderMainScreen` switch had no `default` | Added `default: return null` |
| 13 | HIGH | `PRINT_HTTPS_AGENT` defined but never passed to fetch | Removed (TLS bypass handled by process env) |
| 14 | MEDIUM | 7+ components had broken scroll areas | Added `overflowY: "auto", minHeight: 0` to all `.scroll-area` flex containers |
| 15 | MEDIUM | Google Sheets `repeatCell` used wrong field names | `startColIndex`/`endColIndex` → `startColumnIndex`/`endColumnIndex` |
| 16 | HIGH | Sheet3 sync had no design (no charts, no formatting) | Added 4 embedded charts (bar, pie×2, line), bold headers, currency format, frozen row |

---

## Appendix A: Menu Categories

| Category | Badge | Items |
|---|---|---|
| Signature Brews | SIGNATURE | Smoked Sea Salt Mocha, Velvet Matcha Latte, Honey Lavender Cortado, Cold Brew Reserve, Oat Horchata Cold Brew |
| Espresso | CLASSIC / SEASONAL | Heritage Double Espresso, Flat White, Spiced Americano, Macchiato Lungo |
| Pastries | BAKED DAILY / SEASONAL | Kouign-Amann, Cardamom Knot, Almond Financier, Seasonal Tart |
| Cold Drinks | HOUSE-MADE / RARE | Hibiscus Fizz, Cascara Lemonade, Still Water |

## Appendix B: Staff Roles & Permissions

| Role | Access |
|---|---|
| Barista | POS (place orders, view kitchen board) |
| Senior Barista | POS + Dashboard |
| Shift Supervisor | POS + Dashboard + Kitchen Board |
| Manager | All screens + Admin panel (menu, inventory, staff, recipes) |

Admin routes (`/admin`) are shown to all roles via `staff.role` check in Topbar. API-level protection is handled by `authMiddleware` — any authenticated staff can access admin routes; client-side hides admin tab for non-managers.

## 12. Recent Feature Changes

| Feature | What Changed |
|---------|-------------|
| Inventory Movement Log | New `inventory_movements` table. Sales auto-logged on order placement, voids restore and log. Manual restock/adjustment via Admin UI. Movement history per-item and global views in Admin Inventory. |
| Cash Drawer Transactions | New `cash_drawer_transactions` table. Cash sales auto-logged. Cash in/out with reasons via Admin UI. Full transaction history with running balance. |
| Cash Drawer Quick Access | 💰 button on Topbar to open physical drawer from any screen. |
| Takeout Name Required | Name input now shows for both dine-in and takeout. Takeout requires a name to proceed to checkout. |