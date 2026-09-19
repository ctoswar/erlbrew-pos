## Bug: Menu items show ₱0 prices in Flutter app

### Root Cause
MySQL DECIMAL columns return prices as strings in JSON (e.g. `"price":"10.00"` instead of `"price":10.00`). The `MenuItem.fromMap()` parser used `as num?` which fails silently on strings, defaulting all prices to 0.

### Impact
- All menu items from the POS backend displayed with ₱0 in the Flutter order sheet
- Menu sync from POS to app appeared broken (data was transferring, but prices were lost in parsing)

### Fix
- `MenuItem.fromMap()` now explicitly handles both `String` and `num` price types
- Removed dead `MockData.menu` code from `admin_menu_screen.dart`
- Cleaned unused imports

### How to Verify
1. Restart POS server
2. Open Flutter app → tap "New Order"
3. Menu items should show correct prices from POS database (not ₱0)
