## Summary

Fixes menu sync from POS backend to Flutter app. Two issues resolved.

**Closes #77**

## Bug 1: Menu items showing ₱0 prices

MySQL DECIMAL columns return prices as strings (e.g. "price":"10.00"). `MenuItem.fromMap()` used `as num?` which fails silently, defaulting all prices to 0.

**Fix:** `MenuItem.fromMap()` now handles both String and num price types.

## Bug 2: Admin menu screen showed static placeholder

The admin menu screen displayed "Menu managed in POS" instead of actual menu items.

**Fix:** Rewrote admin menu screen to:
- Fetch all 70+ menu items from `GET /api/menu`
- Display items in a grid with emoji, name, category, price
- Search bar and category filter chips
- Create/edit/delete via POS API (admin auth required)
- FAB for adding new items, popup menu for edit/delete

## Files Changed

- `erlbrew_app/lib/models/app_models.dart` — Fix MenuItem.fromMap price parsing
- `erlbrew_app/lib/screens/admin/admin_menu_screen.dart` — Rewrite to use POS API
- `erlbrew_app/lib/services/pos_api_service.dart` — Add admin menu CRUD methods

## How to Test

1. Restart POS server
2. Open Flutter app → Admin → Menu tab
3. Should see all menu items from POS with correct prices
4. Try adding/editing/deleting items — changes persist to POS database
