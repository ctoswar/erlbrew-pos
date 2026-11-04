# Google Play — Erlbrew Café release checklist

Code-side is done (see Facts). The remaining steps are console-side and yours.

## 0. Facts

| Field | Value |
| --- | --- |
| applicationId | `com.erlbrew.app` (**PERMANENT** — never changed; every future update must match) |
| Display name | Erlbrew Café |
| Version (first upload) | `1.0.0+1` — `erlbrew_app/pubspec.yaml` (bump `+N` versionCode for every new upload) |
| Upload key | `erlbrew_app/android/app/erlbrew-upload-key.jks`, alias `erlbrew-upload`, 25-year validity |
| Key SHA-1 | `6F:AA:5C:71:7B:75:D9:C0:43:BD:38:74:B4:F0:0F:2D:5A:42:29:10` |
| Key SHA-256 | `4D:D2:2A:3D:6C:F2:FF:B9:74:30:04:65:E2:6A:C4:D1:F3:7C:B5:E7:F7:F4:93:3D:FF:CC:28:20:DD:1F:7D:17` |
| Current AAB | `erlbrew_app/build/app/outputs/bundle/release/app-release.aab` (pre-`flutterfire` baseline) |

## 1. Back up the upload key — DO THIS FIRST

Copy all three to private storage today (password manager / private cloud):

- `erlbrew_app/android/app/erlbrew-upload-key.jks`
- `erlbrew_app/android/key.properties`
- `erlbrew_app/android/.upload_key_password`

Google cannot recover this key — losing it means you can never update the app.

## 2. Firebase console (unblocks login + SMS verification)

1. console.firebase.google.com → project **erlbrew** → **Add app → Android**
2. Package name: `com.erlbrew.app`
3. Paste the **SHA-1** and **SHA-256** fingerprints above (required for phone/auth flows)
4. Enable the sign-in methods the app uses: **Email/Password** (+ **Phone** for SMS verification flows)
5. Clone: `flutterfire configure` (Firebase CLI logged in) → regenerates `lib/firebase_options.dart` with real per-platform options — this is the fix for the web-only options blocker
6. Rebuild the store bundle after configure:

```powershell
cd erlbrew_app
flutter build appbundle --release --dart-define-from-file=config/.env
```

## 3. Play Console (developer account — $25 one-time)

1. play.google.com/console → create account → identity + payment
2. Create app: `Erlbrew Café`, type **App**, free

## 4. Store listing preparation

- **App name:** Erlbrew Café
- **Short description, ~80 chars:** Official Erlbrew Café rewards & pre-pickup ordering app.
- **Privacy policy URL:** `https://erlbrewcafe.page/privacy` — publish a simple policy page there (data collected: email, phone, hashed PIN via server; payments via PayMongo; Firebase Auth identifiers)
- **Data safety form:** collects email + phone + user IDs (Firebase Auth / server accounts); no sharing with third parties; data encrypted in transit (HTTPS end-to-end via Cloudflare); delete requests honored on support contact
- **Category:** Food & Drink
- **Screenshots:** 2 phone screenshots minimum — install an internal build, login → Rewards, Pickup screens
- **Graphical assets:** app icon 512×512 (a custom one is needed — default Flutter icon), feature graphic 1024×500

## 5. Internal testing track (first target)

1. Play Console → Release → **Internal testing** → create track → upload `app-release.aab`
2. Add tester emails (max 100) → share the opt-in link
3. Test matrix: install, staff Patterns? none in app — customer email login, QR scan, order flow, payment (PayMongo sandbox/test keys first), POS manifest/CORS reachability via `api.erlbrewcafe.page`

## 6. Update flow (every release after)

```powershell
# bump version in erlbrew_app/pubspec.yaml (version: 1.0.1+N versionCode MUST increment)
.\build_apk.ps1   # or flutter build appbundle --release
# upload new AAB to the testing/production track
```

## 7. Backend availability contract for the store build

The APK/AAB bakes `POS_API_URL` from `erlbrew_app/config/.env` at build time:

- LAN-only dev: `https://<POS-PC-LAN-IP>:3004` (+ mkcert rootCA on the phone)
- Public (recommended for Play): Cloudflare tunnel → `https://api.erlbrewcafe.page` (Published-application route → `http://localhost:3001`), then `POS_API_URL=https://api.erlbrewcafe.page`
