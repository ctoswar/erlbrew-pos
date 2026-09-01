# Erlbrew Café — Rewards & Pickup App (Front-end only)

A Flutter front-end for a café loyalty + pickup app. No backend — all data is
mocked in `lib/models/app_models.dart` so you can see the full flow and wire
up your real API later.

## Screens

### Customer
- **Login** (`lib/screens/login_screen.dart`) — email + password, with a Customer/Admin toggle at the top
- **Sign Up** (`lib/screens/signup_screen.dart`) — name, email, phone, password
- **Rewards** (`lib/screens/rewards_screen.dart`) — points balance, stamp card, redeem catalog
- **Pickup** (`lib/screens/pickup_screen.dart`) — list of pickup orders with status (Preparing → Ready → Completed)
- **Profile** (inside `lib/screens/home_shell.dart`) — account info, log out

### Admin (staff/owner)
Flip the toggle on the login screen to "Admin" and log in with any email/password
(front-end only, no real auth yet) to reach:
- **Overview** (`lib/screens/admin/admin_home_shell.dart`) — dashboard stats: orders in progress, customer count, points outstanding, recent orders
- **Scan** (`lib/screens/admin/admin_scan_screen.dart`) — scans a customer's QR code and lets you award points and/or a stamp in one tap
- **Orders** (`lib/screens/admin/admin_orders_screen.dart`) — every customer's pickup order, filterable by status, with a one-tap "Mark Ready" / "Mark Completed" action
- **Rewards** (`lib/screens/admin/admin_rewards_screen.dart`) — add, edit, or remove items in the redeemable rewards catalog
- **Customers** (`lib/screens/admin/admin_customers_screen.dart`) — searchable customer directory, tap a customer to manually adjust their points

## Earning points via QR (new)
- Customers tap **"Show My QR Code"** on the Rewards screen (`lib/screens/my_qr_screen.dart`). It encodes `{"type":"erlbrew_customer","id":..., "name":...}` — swap this for a signed token from your real backend later.
- Admins open the **Scan** tab, point the camera at it, choose how many points (and whether to add a stamp), and tap Award. The change applies instantly to the shared mock customer record, so it shows up next time the customer opens Rewards.

### Camera permissions (required for the Scan tab)
This project ships as `lib/` + `pubspec.yaml` only — no platform folders yet.
After you unzip it and run `flutter create .` inside the project (to generate
`android/`, `ios/`, `web/`), add camera access **before** the scanner will work:

- **Android** — in `android/app/src/main/AndroidManifest.xml`, inside the
  `<manifest>` tag (above `<application>`), add:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  ```
- **iOS** — in `ios/Runner/Info.plist`, inside the top-level `<dict>`, add:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>Erlbrew needs camera access to scan customer QR codes</string>
  ```
- **Web (Chrome)** — no manifest edit needed; Chrome will prompt for camera
  permission the first time you open the Scan tab. This only works over
  `localhost` or HTTPS, which `flutter run -d chrome` already uses.

Run `flutter pub get` again after unzipping since two new packages
(`qr_flutter`, `mobile_scanner`) were added.

## Run it
```bash
flutter pub get
flutter run
```

## Where to plug in a real backend
- `lib/models/app_models.dart` → `MockData` class holds the fake user, reward
  catalog, and orders. Replace with API calls (e.g. to your POS/server) and
  swap `MockData.currentUser` for real auth state.
- `login_screen.dart` / `signup_screen.dart` → `_handleLogin` / `_handleSignup`
  currently just `Future.delayed` + set mock data. Replace with your auth
  endpoint calls.
- `pickup_screen.dart` → order status is toggled locally for demo purposes;
  wire this to real order status from your server (maybe via polling or
  websockets).

## Styling
Colors and fonts in `lib/theme/app_theme.dart` and `lib/widgets/brand_mark.dart`
follow Erlbrew's existing branding: Playfair Display + Quicksand for UI text,
Cinzel + Cormorant Garamond for the wordmark, and a warm espresso/matcha
palette.
