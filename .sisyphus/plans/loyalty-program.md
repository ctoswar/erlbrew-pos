# Customer Loyalty Program — Implementation Plan

## Architecture Decisions

- **POS backend is the single source of truth** for menu, customers, points, rewards
- **POS owns customer auth** — customers register/login via POS API, no Firebase Auth for business logic
- **Auto points** — ₱100 spent = 1 point, awarded when POS order completes with linked customer
- **Incremental phases** — ship working features early, build on each phase

## Scope

Connect the POS Express+MySQL backend to the Flutter erlbrew-app, implementing the roadmap items:
1. Menu sync (POS → Flutter)
2. Points accumulation (auto on orders)
3. Reward redemption
4. Customer profiles with order history

---

## Phase 1: Foundation — Backend API + Menu Sync

**Goal**: Flutter app reads menu from POS API instead of MockData. Foundation for all future phases.

### 1A. Database: Add loyalty columns + tables
**File**: `server/src/index.js` (initDb function)

Add to `customers` table via ALTER TABLE:
- `loyalty_points INT DEFAULT 0`
- `loyalty_tier ENUM('bronze','silver','gold','platinum') DEFAULT 'bronze'`
- `last_points_update TIMESTAMP NULL`
- `password_hash VARCHAR(256) DEFAULT NULL` (for customer auth)

Create new tables:
- `loyalty_rewards` (id, title, description, points_cost, emoji, is_active, created_at)
- `loyalty_points_log` (id, customer_id, points, type ENUM('earned','redeemed','adjusted','expired'), reference_type, reference_id, notes, created_at)
- `loyalty_redemptions` (id, customer_id, reward_id, points_spent, created_at)

### 1B. Backend: Customer Auth API
**File**: `server/src/routes/customers.js` (extend existing)

New endpoints:
- `POST /api/customers/register` — Create customer account (phone, name, email, password)
- `POST /api/customers/login` — Phone + password login → JWT token
- `GET /api/customers/me` — Get current customer profile (Bearer auth)
- `PUT /api/customers/me` — Update profile

Auth middleware: `customerAuthMiddleware` — verifies customer JWT (separate from staff JWT)

### 1C. Backend: Menu Sync API
**File**: `server/src/routes/menu.js` (extend existing)

The menu GET endpoint already exists and is public. No changes needed.
Flutter app just needs to call `GET /api/menu` and transform response.

New endpoint:
- `GET /api/menu/sync` — Returns full menu with modifiers, categories, prices (optimized for Flutter consumption)

### 1D. Flutter: POS API Service
**File**: `erlbrew_app/lib/services/pos_api_service.dart` (NEW)

HTTP client wrapping `http` package:
- Base URL configurable (default: `http://localhost:3001`)
- JWT token management (stored in SharedPreferences)
- Methods: login, register, getMenu, getProfile, updateProfile
- Error handling, timeout, retry logic

### 1E. Flutter: Replace MockData in screens
**Files**: Multiple screens

Replace `MockData.menu` → `PosApiService.getMenu()`:
- `order_sheet.dart` (lines 57, 120, 178)
- `admin_menu_screen.dart` (lines 162, 171, 192) — disable or remove menu CRUD (POS is source of truth)

Replace `MockData.currentUser` → `PosApiService.getProfile()`:
- `login_screen.dart` (line 201) — call POS login API
- `signup_screen.dart` (line 49) — call POS register API
- `home_shell.dart` (line 218) — fetch profile from POS
- `rewards_screen.dart` (line 24) — fetch points from POS
- `my_qr_screen.dart` (line 17) — use POS customer ID

### Phase 1 Deliverables
- [ ] Database migration adds loyalty columns + tables
- [ ] Customer register/login API works with JWT
- [ ] Menu sync endpoint returns clean data
- [ ] Flutter PosApiService created with all methods
- [ ] Flutter login/signup uses POS API
- [ ] Flutter order screen loads menu from POS
- [ ] Flutter profile displays POS customer data
- [ ] MockData class can be deprecated

---

## Phase 2: Points Accumulation

**Goal**: Customers earn points automatically when completing POS orders.

### 2A. Backend: Points on Order Completion
**File**: `server/src/routes/orders.js`

When `PUT /api/orders/:id/status` sets status to `completed`:
1. Look up `orders.customer_id`
2. Calculate points: `Math.floor(order.total / 100)` (₱100 = 1 point)
3. Update `customers.loyalty_points += points`
4. Insert into `loyalty_points_log` (type: 'earned', reference: order_id)
5. Update `customers.last_points_update`

### 2B. Backend: Points API
**File**: `server/src/routes/customers.js` (extend)

New endpoints:
- `GET /api/customers/me/points` — Current balance + tier + recent log
- `GET /api/customers/me/points/history` — Paginated points history
- `POST /api/customers/me/points/adjust` — Admin manual adjustment (reason required)

### 2C. Backend: Tier Calculation
**File**: `server/src/routes/customers.js` (extend)

Tier thresholds:
- Bronze: 0–499 points
- Silver: 500–1,999 points
- Gold: 2,000–4,999 points
- Platinum: 5,000+ points

Auto-update tier when points change. Return tier info in profile.

### 2D. Flutter: Points Display
**Files**: `rewards_screen.dart`, `home_shell.dart`

- Show real points balance from POS API
- Show tier badge (Bronze/Silver/Gold/Platinum)
- Show points history (last 10 transactions)

### Phase 2 Deliverables
- [ ] Points auto-award on order completion
- [ ] Points history log works
- [ ] Tier calculation works
- [ ] Flutter shows real points balance
- [ ] Flutter shows tier badge
- [ ] Flutter shows points history

---

## Phase 3: Reward Redemption

**Goal**: Customers spend points on rewards from a catalog managed in the POS.

### 3A. Backend: Rewards Catalog API
**File**: `server/src/routes/loyalty.js` (NEW)

- `GET /api/loyalty/rewards` — List active rewards (public)
- `POST /api/loyalty/rewards` — Create reward (admin only)
- `PUT /api/loyalty/rewards/:id` — Update reward (admin only)
- `DELETE /api/loyalty/rewards/:id` — Deactivate reward (admin only)

### 3B. Backend: Redemption API
**File**: `server/src/routes/customers.js` (extend)

- `POST /api/customers/me/redeem` — Redeem a reward
  - Validate: customer has enough points, reward is active
  - Deduct points, insert redemption record, insert points log (type: 'redeemed')
  - Return redemption details + updated balance

### 3C. Flutter: Rewards Screen
**Files**: `rewards_screen.dart`, `admin_rewards_screen.dart`

- Customer: Fetch rewards from POS API, show points cost, redeem button
- Admin: Remove MockData CRUD, replace with POS API calls (or disable if POS admin manages rewards)

### 3D. Flutter: Redemption Flow
**File**: `rewards_screen.dart`

- Tap reward → confirmation dialog → POST /api/customers/me/redeem
- Show updated balance
- Show redemption history

### Phase 3 Deliverables
- [ ] Rewards catalog API works
- [ ] Redemption deducts points correctly
- [ ] Redemption history logged
- [ ] Flutter customer can browse and redeem rewards
- [ ] Flutter admin can manage rewards catalog

---

## Phase 4: Customer Profiles with Order History

**Goal**: Customers see their full order history in the Flutter app.

### 4A. Backend: Order History API
**File**: `server/src/routes/customers.js` (extend)

- `GET /api/customers/me/orders` — Paginated order history for current customer
  - Returns: order id, items, totals, status, date, points earned
  - Filter by status, date range

### 4B. Flutter: Order History Screen
**File**: `pickup_screen.dart` (extend) or new `order_history_screen.dart`

- Fetch order history from POS API
- Show order details: items, totals, status, date
- Show points earned per order
- Pull-to-refresh

### 4C. Flutter: Profile Screen
**File**: `home_shell.dart` (profile tab)

- Show: name, email, phone
- Show: loyalty tier + points balance
- Show: total orders, total spent
- Show: recent orders (last 5)

### Phase 4 Deliverables
- [ ] Order history API returns customer orders
- [ ] Flutter shows order history with details
- [ ] Flutter profile shows full customer data
- [ ] Order history shows points earned per order

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `server/src/routes/loyalty.js` | Rewards catalog + redemption API |
| `server/src/middleware/customerAuth.js` | Customer JWT auth middleware |
| `erlbrew_app/lib/services/pos_api_service.dart` | HTTP client for POS backend |

### Modified Files
| File | Changes |
|------|---------|
| `server/src/index.js` | Add loyalty tables in initDb, mount loyalty route |
| `server/src/routes/customers.js` | Add register, login, profile, points, redemption endpoints |
| `server/src/routes/orders.js` | Auto-award points on order completion |
| `erlbrew_app/lib/models/app_models.dart` | Add loyalty fields to AppUser, deprecate MockData |
| `erlbrew_app/lib/screens/login_screen.dart` | Use POS API for login |
| `erlbrew_app/lib/screens/signup_screen.dart` | Use POS API for register |
| `erlbrew_app/lib/screens/home_shell.dart` | Fetch profile from POS, show tier/points |
| `erlbrew_app/lib/screens/rewards_screen.dart` | Fetch rewards from POS, real redemption |
| `erlbrew_app/lib/screens/pickup_screen.dart` | Fetch order history from POS |
| `erlbrew_app/lib/screens/order_sheet.dart` | Fetch menu from POS API |
| `erlbrew_app/lib/screens/admin/admin_rewards_screen.dart` | POS API for rewards CRUD |
| `erlbrew_app/lib/screens/admin/admin_menu_screen.dart` | Remove or disable (POS is source of truth) |

---

## Risk Mitigation

1. **Dual auth systems**: POS JWT for customers, Firebase Auth stays for Firebase-only features (push notifications). Keep them separate — don't try to merge.
2. **Offline/edge cases**: Flutter app should cache last-known menu and profile. Show stale data with "last updated" timestamp rather than blank screens.
3. **Points calculation accuracy**: Use database transactions for points updates. Never calculate in Flutter — always server-side.
4. **Menu sync staleness**: POS menu endpoint is already public and fast. Flutter can cache for 5 minutes, force-refresh on pull-to-refresh.
5. **Existing order flow disruption**: Don't modify the PayMongo checkout flow. Points are awarded AFTER payment confirms (when order status → completed).

---

## Testing Strategy

### Backend
- Unit tests for points calculation logic
- Integration tests for auth flow (register → login → get profile → earn points → redeem)
- Test points accuracy: order with ₱500 total should award exactly 500 points
- Test edge cases: duplicate redemption, insufficient points, inactive rewards

### Flutter
- Manual testing of POS API connection
- Test login flow: register → login → see profile
- Test menu display: items load from POS, categories work
- Test points: complete order → see points update
- Test redemption: browse rewards → redeem → see balance change

---

## Success Criteria

- [ ] Flutter app loads menu from POS API (no more hardcoded MockData menu)
- [ ] Customer can register and login via POS backend
- [ ] Points auto-accrue when POS orders complete (₱100 = 1 point)
- [ ] Customer can view points balance and history in Flutter
- [ ] Customer can browse rewards catalog and redeem with points
- [ ] Customer can view full order history in Flutter
- [ ] POS admin can manage rewards catalog
- [ ] All data is consistent between POS and Flutter app
