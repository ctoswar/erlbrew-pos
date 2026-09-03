# Erlbrew Café — Rewards & Pickup App

A Flutter customer app for café loyalty and pickup orders. Rewards and the
demo menu remain mocked locally, while PayMongo checkout and payment-confirmed
order status use the Firebase Functions project under `functions/`.

## Screens

### Customer
- **Login** (`lib/screens/login_screen.dart`) — email + password, with a Customer/Admin toggle at the top
- **Sign Up** (`lib/screens/signup_screen.dart`) — name, email, phone, password
- **Rewards** (`lib/screens/rewards_screen.dart`) — points balance, redeem catalog
- **Pickup** (`lib/screens/pickup_screen.dart`) — list of pickup orders with status (Preparing → Ready → Completed)
- **Profile** (inside `lib/screens/home_shell.dart`) — account info, log out

### Admin (staff/owner)
Flip the toggle on the login screen to "Admin" and log in with any email/password
(front-end only, no real auth yet) to reach:
- **Overview** (`lib/screens/admin/admin_home_shell.dart`) — dashboard stats: orders in progress, customer count, points outstanding, recent orders
- **Scan** (`lib/screens/admin/admin_scan_screen.dart`) — scans a customer's QR code and lets you award points in one tap
- **Orders** (`lib/screens/admin/admin_orders_screen.dart`) — every customer's pickup order, filterable by status, with a one-tap "Mark Ready" / "Mark Completed" action
- **Menu** (`lib/screens/admin/admin_menu_screen.dart`) — add, edit, or remove items on the actual café menu customers order from
- **Rewards** (`lib/screens/admin/admin_rewards_screen.dart`) — add, edit, or remove items in the redeemable rewards catalog
- **Customers** (`lib/screens/admin/admin_customers_screen.dart`) — searchable customer directory, tap a customer to manually adjust their points

## Earning points via QR (new)
- Customers tap **"Show My QR Code"** on the Rewards screen (`lib/screens/my_qr_screen.dart`). It encodes `{"type":"erlbrew_customer","id":..., "name":...}` — swap this for a signed token from your real backend later.
- Admins open the **Scan** tab, point the camera at it, choose how many points to award, and tap Award. The change applies instantly to the shared mock customer record, so it shows up next time the customer opens Rewards.

## Reward system (simplified)
There used to be two parallel reward tracks — points and a stamp card — but
they overlapped in purpose, so the stamp card was removed. **Points are now
the single currency**: earned via QR scan at checkout, spent on whatever's
in the Redeem Points catalog. `AppUser` no longer has `stamps`/`stampsGoal`
fields.

## Placing a real order (new)
- Tapping **"New Order"** on the customer Pickup screen now opens a pull-up
  menu (`lib/screens/order_sheet.dart`) instead of generating a random mock
  order. It lists the actual café menu grouped by category, lets the
  customer add/remove items with a quantity stepper, shows a running total,
  and "Place Order" creates a real `PickupOrder` from whatever's in the cart.
- Admins manage that menu — add, edit, delete items — from the new **Menu**
  tab (`lib/screens/admin/admin_menu_screen.dart`), same CRUD pattern as the
  Rewards catalog. `MockData.menu` is the shared source of truth both
  screens read from.

## PayMongo checkout (GCash and QRPh)

The New Order sheet calls the Firebase callable
`createPayMongoCheckout`. The Flutter app sends menu IDs and quantities, never
prices or PayMongo credentials, then opens only the HTTPS hosted checkout URL
returned by PayMongo. The callable prices items from the trusted catalog in
`functions/index.js`, creates a pending Firestore order, and returns the
hosted URL. `payMongoWebhook` verifies the `Paymongo-Signature` HMAC before
changing an order to paid/preparing (or failed/cancelled).

The functions project is intentionally inside this app at `functions/`; do
not use or deploy a sibling POS server for payments. Real payment
confirmation is not available until the functions are deployed and PayMongo
credentials plus the webhook URL are configured:

1. Install/use the Firebase CLI, then from `erlbrew_app/` run
   `firebase login` and `firebase use erlbrew`.
2. Install dependencies with `npm --prefix functions install`.
3. Store the PayMongo secrets in Firebase Secret Manager (never in Flutter,
   source control, or a committed `.env`):
   ```bash
   firebase functions:secrets:set PAYMONGO_SECRET_KEY
   firebase functions:secrets:set PAYMONGO_WEBHOOK_SECRET
   ```
4. Configure the non-secret `PAYMONGO_SUCCESS_URL` and
   `PAYMONGO_CANCEL_URL` deployment parameters when prompted. Use HTTPS URLs
   that return the customer to an appropriate app/web page.
5. Deploy with:
   ```bash
   firebase deploy --only functions
   ```
6. Register this webhook URL in the PayMongo dashboard:
   `https://asia-southeast1-erlbrew.cloudfunctions.net/payMongoWebhook`
   Subscribe to `checkout_session.payment.paid` and failed payment events,
   then use that endpoint's signing secret for
   `PAYMONGO_WEBHOOK_SECRET`.

The deployed function region is `asia-southeast1`, matching the Flutter
callable client. Keep the server catalog synchronized with the production
menu; client-submitted prices are deliberately ignored. A successful browser
redirect is never treated as proof of payment — only a verified webhook can
start preparation. `getPayMongoOrderStatus` is used by the pickup screen to
refresh pending orders.

Admin accounts must be created outside the client app through Firebase
Authentication and assigned an admin profile by a trusted administrator or
Admin SDK process. The Flutter client intentionally has no admin-account
creation method.

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

Run `flutter pub get` again after unzipping since the Firebase and scanner
packages (`cloud_functions`, `qr_flutter`, `mobile_scanner`) are required.

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
follow Erlbrew's own logo lockup — espresso/onyx darks, warm ivory backgrounds,
metallic gold accents, hairline borders instead of heavy boxes, and underline
inputs for a boutique feel. The real logo lives at
`assets/images/erlbrew_logo.jpg` and is registered in `pubspec.yaml` — swap
that file (keep the same name/path, or update the path in both places) if you
get a higher-res version later.
