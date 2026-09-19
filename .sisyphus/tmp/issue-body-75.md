## Bug Fixes

### 1. /me endpoint returning 404
**Issue:** `GET /api/customers/me` was returning 404 because Express route `/:id` was defined before `/me`. Express matches routes in order, so `/me` was caught by `/:id` with `id = "me"`, which doesn't exist.

**Fix:** Moved all `/me` routes before `/:id` routes in `customers.js`.

### 2. Login only accepted phone number
**Issue:** Customer login only accepted phone number, but users often enter email addresses.

**Fix:** Updated login endpoint to auto-detect email (checks for `@` symbol) and query by either phone or email.

**Changes:**
- Backend: `server/src/routes/customers.js` — Route reordering + email login
- Flutter: `erlbrew_app/lib/screens/login_screen.dart` — Label changed to 'Phone or Email'
