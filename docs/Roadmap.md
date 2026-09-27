# Roadmap

## Current Status: v2.4.0 (Production Ready)

The core POS system is fully functional with order management, inventory tracking, staff scheduling, reporting, and customer loyalty program.

---

## Phase 1: Core Enhancements (Q4 2026)

### Priority: High

- [x] **Offline Mode** ✅ v2.1.0
  - Service worker for POS
  - Local order queue
  - IndexedDB for menu/inventory cache
  - Background sync when reconnected
  - Visual indicator for offline/online status
  - Queue orders locally, push to server on reconnect

- [x] **Multi-location Support** ✅ v2.3.0
  - Store-level configuration (locations table, location_id on 7 tables)
  - Cross-location inventory transfer (5-state workflow: pending → approved → in_transit → received/cancelled)
  - Consolidated reporting (per-location filtering via LocationContext)
  - Location selector in admin header
  - Admin Locations tab (CRUD)
  - Admin Transfers tab (request/approve/ship/receive/cancel)

- [x] **Advanced Reporting** ✅ v2.2.0
  - Date range custom reports
  - Export to PDF/Excel
  - Staff performance metrics
  - Inventory turnover analysis

- [x] **Customer Loyalty Program** ✅ v2.4.0
  - Points accumulation (₱1 = 1 point, auto-award on order completion)
  - Reward redemption (catalog CRUD, points deduction, redemption history)
  - Customer profiles with order history (stats, recent orders, pull-to-refresh)
  - Customer auth (register/login via POS API, JWT tokens)
  - Menu sync (POS → Flutter app)
  - Tier system (Bronze → Silver → Gold → Platinum)

### Priority: Medium

- [x] **Receipt Customization** ✅ v2.0.0
  - Custom receipt templates (paper size 57/58/80mm, store header, BIR info, customer copy)
  - Logo upload (company logo stored as base64, shown on login screen + receipts)
  - Receipt preview before printing (ReceiptPreview.tsx)
  - Additional: QR code, WiFi info, print via browser/bluetooth, print copies

---

## Phase 2: Integrations (Q1 2027) ✅ complete

### Payment Gateways

- [x] **PayMongo Integration** ✅ (issue #127)
  - Card payments (Visa/Mastercard) — hosted Checkout: customer scans QR / opens link, webhook confirms payment
  - GCash and Maya as payment methods inside PayMongo Checkout (QRPh too)
  - Credentials + enable toggle in Admin → Settings → Integrations (env var or encrypted DB setting)

- [x] **Square Integration** ✅ _(closed — out of scope for the Philippines market)_
  - Terminal API — decided not to build; no Square terminal availability in PH, PayMongo covers card payments
  - Inventory sync — n/a, covered by the built-in inventory system

### Delivery Platforms

- [x] **GrabFood Integration** ✅ (issue #127)
  - Menu sync — menu export payload from Settings → Integrations (`GET /api/integrations/grab/menu`)
  - Order push — inbound webhook auto-accepts into kitchen (idempotent, inventory deducted)
  - Status updates — pushed to platform whenever staff advances the order
  - Mock-first: outbound calls stay in mock mode until partner credentials are configured

- [x] **FoodPanda Integration** ✅ (issue #127)
  - Menu sync — menu export payload from Settings → Integrations (`GET /api/integrations/foodpanda/menu`)
  - Order push — inbound webhook auto-accepts into kitchen (idempotent, inventory deducted)
  - Status updates — pushed to platform whenever staff advances the order
  - Mock-first: outbound calls stay in mock mode until partner credentials are configured

### Accounting

- [x] **QuickBooks Integration** ✅
  - Invoice sync — one summary invoice per day from orders (`DocNumber = ERL-YYYYMMDD`), auto-pushed after each Z-Report
  - Expense tracking — supplier invoices → QuickBooks Bills
  - Ready for Intuit credentials — dry-run payloads can be reviewed before connecting

- [x] **Xero Integration** ✅ (issue #156, PR #157)
  - Invoice sync — one summary invoice per day from orders, auto-pushed after each Z-Report
  - Bank reconciliation — matches recorded cash/card drawer transactions against a bank statement feed (`POST /api/accounting/xero/reconcile`)
  - Mock-first: no network call leaves the app until credentials are configured

---

## Phase 3: Advanced Features (Q2 2027)

### AI & Analytics

- [ ] **Sales Forecasting**
  - Machine learning predictions
  - Inventory optimization
  - Staff scheduling suggestions

- [ ] **Menu Optimization**
  - Best/worst sellers analysis
  - Price optimization suggestions
  - Combo recommendations

### Hardware Integration

- [x] **Kitchen Display System (KDS)** ✅ _(live since v2.0.0 — credited under Completed Milestones)_
  - [x] Touch screen interface — tap-to-advance tickets (Start → Mark Ready → Serve), 44px touch targets, mobile status filter tabs
  - [x] Timer alerts — live elapsed-time counter, pulsing red "Late" badge at ≥10 min preparing, Web Audio chime on new orders
  - [ ] Order routing — delivery vs walk-in lanes & priority, delivery tickets surfaced first (issue #163); station/printer routing deferred — single-station café
  - Still to build: overdue alert sound + notifications (issue #162), dedicated kiosk/fullscreen mode

- [ ] **Customer Display** _(partially built — fullscreen `?customer` second-monitor view ships)_
  - [x] Order confirmation screen — live cart, totals and order type mirrored from the POS
  - [ ] Loyalty points display
  - [ ] Promotional messages

### Mobile

- [ ] **Staff Mobile App**
  - Shift management
  - Clock in/out
  - Schedule viewing

- [ ] **Customer Mobile App**
  - Pre-ordering
  - Loyalty tracking
  - Payment

---

## Phase 4: Enterprise (Q3 2027)

- [ ] **Multi-tenant Architecture**
  - White-label support
  - Tenant isolation
  - Custom branding

- [ ] **API Platform**
  - Public API for integrations
  - Webhook support
  - Developer documentation

- [ ] **Advanced Security**
  - Role-based access control (RBAC)
  - Audit logging
  - Compliance reports

---

## Completed Milestones

### Phase 2 Integrations (September 2026)
- [x] PayMongo payment gateway — hosted Checkout (QR/link), GCash/Maya, webhook confirmation (issue #127)
- [x] GrabFood delivery integration — menu export, inbound order webhook, status push (issue #127)
- [x] FoodPanda delivery integration — menu export, inbound order webhook, status push (issue #127)
- [x] QuickBooks accounting — daily summary invoice sync + supplier-invoice Bills
- [x] Xero accounting — daily summary invoice sync + bank reconciliation (issue #156, PR #157)
- [x] Square — closed as out of scope (Philippines market)

### v2.4.0 (September 2026)
- [x] Customer Loyalty Program (Phase 1-4)
  - Backend: customer auth, menu sync, points accumulation, rewards CRUD, order history
  - Flutter: PosApiService, login/signup, rewards screen, profile with stats
  - Database: customers loyalty columns, loyalty_rewards, loyalty_points_log, loyalty_redemptions tables

### v2.3.0 (September 2026)
- [x] Multi-location support (locations, transfers, per-location filtering)

### v2.2.0 (September 2026)
- [x] Advanced Reporting (PDF/Excel export, staff metrics, inventory turnover)

### v2.1.0 (September 2026)
- [x] Offline Mode (menu/inventory IndexedDB caching)
- [x] Timezone fix (all timestamps display in Asia/Manila UTC+8)
- [x] Receipt 57mm alignment fix (adaptive column widths)

### v2.0.0 (September 2026)
- [x] Core POS functionality
- [x] Kitchen board with real-time updates
- [x] Inventory management
- [x] Staff management with RFID/PIN
- [x] Time tracking
- [x] Cash drawer management
- [x] Z-Report generation
- [x] Google Sheets sync
- [x] Docker deployment
- [x] Security hardening
- [x] Community standards

### v1.0.0 (August 2026)
- [x] Initial release
- [x] Basic order taking
- [x] Menu management
- [x] Payment processing

---

## How to Contribute

See [Contributing](Contributing) for guidelines on how to contribute to any of these features.

## Questions?

Open an issue with the label `question` or `discussion` if you have questions about the roadmap.
