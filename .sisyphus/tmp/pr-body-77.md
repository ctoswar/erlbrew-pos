## Summary

Fixes menu items showing ₱0 in the Flutter app. The menu data was transferring correctly from POS, but prices were lost during JSON parsing.

**Closes #77**

## Bug

MySQL DECIMAL columns return prices as strings in JSON (e.g. `"price":"10.00"`). `MenuItem.fromMap()` used `as num?` which fails silently on strings, defaulting all prices to 0.

## Fix

**`erlbrew_app/lib/models/app_models.dart`:**
- `MenuItem.fromMap()` now handles both `String` and `num` price types from MySQL DECIMAL

**`erlbrew_app/lib/screens/admin/admin_menu_screen.dart`:**
- Removed dead `_openEditor()` and `_delete()` methods that referenced `MockData.menu` but were never called
- Removed unused imports

## How to Test

1. Restart POS server
2. Open Flutter app → tap "New Order"
3. Menu items should show correct prices (not ₱0)
