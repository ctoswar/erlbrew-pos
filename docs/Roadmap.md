# Roadmap

## Current Status: v2.0.0 (Production Ready)

The core POS system is fully functional with order management, inventory tracking, staff scheduling, and reporting.

---

## Phase 1: Core Enhancements (Q4 2026)

### Priority: High

- [x] **Offline Mode**
  - [x] Service worker for POS
  - [x] Local order queue
  - [x] IndexedDB for menu/inventory cache
  - [x] Background sync when reconnected
  - [x] Visual indicator for online/offline status
  - [x] Queue orders locally, push to server on reconnect

- [ ] **Multi-location Support**
  - Store-level configuration
  - Cross-location inventory transfer
  - Consolidated reporting

- [x] **Advanced Reporting**
  - [x] Date range custom reports
  - [x] Export to PDF/Excel
  - [x] Staff performance metrics
  - [x] Inventory turnover analysis

- [ ] **Customer Loyalty Program**
  - Points accumulation
  - Reward redemption
  - Customer profiles with order history

- [ ] **Receipt Customization**
  - Custom receipt templates
  - Logo upload
  - Receipt preview before printing

---

## Phase 2: Integrations (Q1 2027)

### Payment Gateways

- [ ] **PayMongo Integration**
  - Card payments (Visa/Mastercard)
  - GCash direct
  - Maya direct

- [ ] **Square Integration**
  - Terminal API
  - Inventory sync

### Delivery Platforms

- [ ] **GrabFood Integration**
  - Menu sync
  - Order push
  - Status updates

- [ ] **FoodPanda Integration**
  - Menu sync
  - Order push
  - Status updates

### Accounting

- [ ] **QuickBooks Integration**
  - Invoice sync
  - Expense tracking

- [ ] **Xero Integration**
  - Invoice sync
  - Bank reconciliation

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

- [ ] **Kitchen Display System (KDS)**
  - Touch screen interface
  - Order routing
  - Timer alerts

- [ ] **Customer Display**
  - Order confirmation screen
  - Loyalty points display
  - Promotional messages

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
