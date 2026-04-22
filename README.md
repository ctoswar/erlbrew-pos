# ☕ Erlbrew Café POS System

A tablet-optimized Point of Sale system built with **React + TypeScript + Vite**, designed to match the Erlbrew Café brand aesthetic.

---

## 🗂 Project Structure

```
erlbrew-pos/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx                   # Entry point
    ├── App.tsx                    # Root component (login/POS router)
    ├── types/
    │   └── index.ts               # All TypeScript interfaces & types
    ├── data/
    │   └── index.ts               # Staff & menu data
    ├── utils/
    │   └── index.ts               # Formatting, calc, summary helpers
    ├── hooks/
    │   ├── useCart.ts             # Cart state management
    │   ├── useOrders.ts           # Order lifecycle management
    │   └── useClock.ts            # Live clock hook
    ├── styles/
    │   └── global.css             # CSS variables, animations, base styles
    └── components/
        ├── LoginScreen.tsx        # RFID + PIN login
        ├── Topbar.tsx             # Navigation bar
        ├── POSScreen.tsx          # Main POS orchestrator
        ├── MenuGrid.tsx           # Menu browsing & item cards
        ├── CartPanel.tsx          # Cart sidebar with totals
        ├── CheckoutScreen.tsx     # Order summary before payment
        ├── PaymentScreen.tsx      # Cash / Card / E-Wallet payment
        ├── SuccessScreen.tsx      # Order confirmation
        ├── KitchenBoard.tsx       # Kitchen order queue (3-column kanban)
        └── Dashboard.tsx          # Daily sales summary & analytics
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open in browser or tablet
# Local:   http://localhost:3000
# Tablet:  http://YOUR_PC_IP:3000  (same WiFi network)
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🔐 Demo Login Credentials

| Name            | Role             | RFID  | PIN  |
|-----------------|------------------|-------|------|
| Jane Dela Cruz  | Senior Barista   | RF001 | 1234 |
| Marco Santos    | Barista          | RF002 | 5678 |
| Ana Reyes       | Shift Supervisor | RF003 | 9012 |
| Luis Garcia     | Manager          | RF004 | 3456 |

> **RFID in production:** Replace `simulateScan()` in `LoginScreen.tsx` with a WebSocket or Web Serial API listener that reads from your physical RFID reader hardware.

---

## 📱 Tablet Deployment

### Recommended Setup
- **Device:** iPad (landscape) or Android tablet 10"+
- **Browser:** Chrome or Safari in fullscreen / kiosk mode
- **Network:** Same WiFi as the machine running the dev/production server

### Kiosk Mode (Android)
1. Build the project: `npm run build`
2. Serve the `dist/` folder via any static server (e.g., `npx serve dist`)
3. Open Chrome → address bar → ⋮ → "Add to Home Screen"
4. Enable kiosk mode via Android's "Screen Pinning" feature

### iPad
1. Open in Safari → Share → "Add to Home Screen"
2. Launches in full-screen app mode automatically

---

## 💳 Payment Methods Supported

| Method   | Notes                                        |
|----------|----------------------------------------------|
| Cash     | Quick-amount buttons + change calculator     |
| Card     | Shows "tap card to terminal" instructions    |
| E-Wallet | QR code display (GCash / Maya / PayMaya)     |

---

## 🍳 Kitchen Board

The Kitchen Board (`/kitchen` nav tab) shows a 3-column Kanban:

- **Preparing** → barista working on the order
- **Ready to Serve** → order complete, waiting for pickup
- **Completed** → delivered to customer

Orders automatically show a **Late** badge after 10 minutes in "Preparing".

---

## 📊 Dashboard

The Dashboard tab shows:
- Total revenue, order count, average ticket value
- Top 5 best-selling items with visual bars
- Revenue breakdown by category
- Payment method distribution
- Recent orders table with live status

---

## 🛠 Customization

### Adding Menu Items
Edit `src/data/index.ts` → `MENU` array.

### Adding Staff
Edit `src/data/index.ts` → `STAFF` array.

### Changing Tax Rate
Edit `src/utils/index.ts` → `calcTax()` function (currently 12% VAT for PH).

### Connecting a Real RFID Reader
In `src/components/LoginScreen.tsx`, replace `simulateScan()` with:
```ts
// Web Serial API example
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 9600 });
// Read RFID tag ID from serial stream, then match against STAFF array
```

---

## 🎨 Design System

Built to match the Erlbrew Café website:
- **Fonts:** Playfair Display (headings) + Lato (body)
- **Colors:** Deep espresso browns (`#0d0600`, `#1e0e06`) + warm gold (`#C9873A`)
- **CSS Variables:** All tokens defined in `src/styles/global.css`
