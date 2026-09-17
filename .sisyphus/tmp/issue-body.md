## Overview
Add multi-location (multi-branch) support to enable managing multiple stores from a single deployment.

## Sub-features

### 1. Store-level Configuration
- New `locations` table with name, address, phone, timezone
- Location selector in admin UI
- All data (orders, inventory, cash drawer, Z-reports, time records) scoped to location
- Staff assigned to primary location

### 2. Cross-location Inventory Transfer
- New `inventory_transfers` table
- Request -> Approve -> In Transit -> Received workflow
- Stock deducted from source, added to destination on completion
- Transfer history and audit trail

### 3. Consolidated Reporting
- Dashboard and reports can filter by single location or "All Locations"
- Z-Report per location
- Cross-location sales/inventory summaries

## Migration Strategy
- Add `location_id` columns with DEFAULT 1 (backward compatible)
- Seed one default location ("Main Store") so existing data is not orphaned
- No data loss - existing records become Location 1
