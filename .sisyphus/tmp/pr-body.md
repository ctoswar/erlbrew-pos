## Summary

Adds full multi-location (multi-branch) support to Erlbrew POS.

### New Features

**1. Store-level Configuration**
- New `locations` table with name, address, phone, timezone
- Location selector dropdown in admin header (persists to localStorage)
- All data scoped to location: orders, inventory, cash drawer, Z-reports, time records
- Admin Locations tab for full CRUD management (create, edit, set default, deactivate)

**2. Cross-location Inventory Transfer**
- New `inventory_transfers` table with 5-state workflow:
  - `pending` -> `approved` -> `in_transit` -> `received`
  - Cancel at any stage before `received`
- Stock deducted from source on ship, added to destination on receive
- Full audit trail with requested_by, approved_by, received_by
- Admin Transfers tab with create, filter, and action buttons

**3. Consolidated Reporting Infrastructure**
- All query endpoints accept `location_id` filter parameter
- Location selector visible across admin dashboard for context switching
- Foundation for "All Locations" aggregated views

### Database Migration (Non-destructive)
- `location_id` columns added with `DEFAULT 1` to: orders, inventory, inventory_movements, cash_drawer, z_reports, time_records, staff
- Existing data automatically assigned to "Main Store" (Location 1)
- No data loss, fully backward compatible

### Files Changed (13 files, +1088/-19 lines)

**Backend:**
- `server/src/db/init.sql` — Migration SQL for locations, location_id columns, transfers
- `server/src/index.js` — Route wiring + auto-migration in initDb
- `server/src/routes/locations.js` — NEW: Locations CRUD API
- `server/src/routes/transfers.js` — NEW: Inventory transfers lifecycle API
- `server/src/routes/orders.js` — Added location_id to GET /, GET /today, GET /history, POST /
- `server/src/routes/inventory.js` — Added location_id to GET /, POST /

**Frontend:**
- `src/types/index.ts` — Location and InventoryTransfer types
- `src/contexts/LocationContext.tsx` — NEW: Location state management with localStorage
- `src/components/LocationSelector.tsx` — NEW: Dropdown selector in admin header
- `src/components/AdminLocations.tsx` — NEW: Location management tab
- `src/components/AdminTransfers.tsx` — NEW: Transfer workflow tab
- `src/components/AdminDashboard.tsx` — Added Locations and Transfers tabs
- `src/App.tsx` — Wrapped AdminDashboard with LocationProvider

Closes #55