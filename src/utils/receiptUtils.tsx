import { Order } from "../types";
import { formatCurrency } from "./index";
import { PrintSettings } from "../components/AdminPrintSettings";

// Load company settings from localStorage (set by AdminPrintSettings)
function loadCompanySettings() {
  try {
    const s = localStorage.getItem('erlbrew_company_settings');
    if (s) {
      const data = JSON.parse(s);
      const addr = data.company_address || '';
      // Split long addresses into two lines
      const addr1 = addr.length > 30 ? addr.substring(0, addr.lastIndexOf(',', 30)).trim() : addr;
      const addr2 = addr.length > 30 ? addr.substring(addr.lastIndexOf(',', 30) + 1).trim() : '';

      return {
        name: data.company_name || 'ERLBREW CAFE',
        addr1: addr1 || 'Unit 1, Ground Floor',
        addr2: addr2 || (addr.length <= 30 ? '' : '123 Main St, BGC, Taguig'),
        tel: data.company_phone || '(02) 8888-8888',
        logo: data.company_logo || '',
        tin: '000-000-000-000',
        birCorNo: 'COR-2024-00-00000',
        atpNo: 'ATP-2024-00-00000',
        atpDate: 'Jan 01, 2024',
        serial: 'ERL-2024-00001',
        ptuNo: 'PTU-2024-00-00000',
        machineNo: 'POS-01',
        posAccNo: 'ACC-2024-0001',
      };
    }
  } catch {}
  return {
    name: 'ERLBREW CAFE',
    addr1: 'Unit 1, Ground Floor',
    addr2: '',
    tel: '(02) 8888-8888',
    logo: '',
    tin: '000-000-000-000',
    birCorNo: 'COR-2024-00-00000',
    atpNo: 'ATP-2024-00-00000',
    atpDate: 'Jan 01, 2024',
    serial: 'ERL-2024-00001',
    ptuNo: 'PTU-2024-00-00000',
    machineNo: 'POS-01',
    posAccNo: 'ACC-2024-0001',
  };
}

export interface StoreInfo {
  name: string;
  addr1: string;
  addr2: string;
  tel: string;
  logo: string;
  tin: string;
  birCorNo: string;
  atpNo: string;
  atpDate: string;
  serial: string;
  ptuNo: string;
  machineNo: string;
  posAccNo: string;
}

export function getStoreInfo(): StoreInfo {
  return loadCompanySettings();
}

const MONO = "'Courier New', 'Lucida Console', monospace";

export function buildReceiptLines(order: Order, settings: PrintSettings, discountAmount?: number, discountLabel?: string): string[] {
  const W = settings.paperSize === "58mm" ? 26 : 32;

  function padCenter(text: string, width = W): string {
    const s = text.length <= width ? text : text.substring(0, width - 2) + "..";
    return " ".repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
  }
  function padRight(text: string, width = W): string {
    const s = text.length <= width ? text : text.substring(0, width - 1) + "…";
    return s.padEnd(width);
  }
  function padLeft(text: string, width = W): string {
    return text.padStart(width);
  }
  function ln(char = "-"): string { return char.repeat(W); }

  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Load company settings from localStorage
  const STORE = getStoreInfo();

  // 1. Store Header
  if (settings.showStoreHeader) {
    lines.push(padCenter(STORE.name));
    if (STORE.addr1) lines.push(padCenter(STORE.addr1));
    if (STORE.addr2) lines.push(padCenter(STORE.addr2));
    if (STORE.tel) lines.push(padCenter(`Tel: ${STORE.tel}`));
    lines.push(ln("="));
  }

  // 2. BIR Info
  if (settings.showBIRInfo) {
    lines.push(padCenter("ACKNOWLEDGMENT RECEIPT"));
    lines.push(ln("="));
    lines.push(`ATP No  : ${STORE.atpNo}`);
    lines.push(`ATP Date: ${STORE.atpDate}`);
    lines.push(`COR No  : ${STORE.birCorNo}`);
    lines.push(`Serial  : ${STORE.serial}`);
    lines.push(`PTU No  : ${STORE.ptuNo}`);
    lines.push(`Machine : ${STORE.machineNo}`);
    lines.push(`Accr No : ${STORE.posAccNo}`);
    lines.push(ln("-"));
  }

  // 3. Transaction Info
  lines.push(`Date: ${dateStr}`);
  lines.push(`Time: ${timeStr}`);
  lines.push(`Slip No: ${order.id}`);
  lines.push(`Server : ${order.staff.name}`);
  lines.push(`Type   : ${order.type === "dine-in" ? `DINE-IN${order.customerName ? ` / ${order.customerName}` : ""}` : "TAKEOUT"}`);
  lines.push(ln("-"));

  // 4. Line Items
  lines.push("QTY  ITEM              AMOUNT");
  lines.push(ln("-"));
  order.items.forEach((ci) => {
    const modifierTotal = (ci.modifiers || []).reduce((s, m) => s + m.price, 0);
    const lineTotal = (ci.item.price + modifierTotal) * ci.qty;
    const qtyStr = String(ci.qty).padStart(3);
    const amtStr = formatCurrency(lineTotal).replace("₱", "").trim();
    const name = ci.item.name.length > 17 ? ci.item.name.substring(0, 16) + "…" : ci.item.name;
    lines.push(`${qtyStr}  ${padRight(name, 17)} ${padLeft(amtStr, 8)}`);
    if (ci.qty > 1) lines.push(`     @ ${formatCurrency(ci.item.price + modifierTotal).replace("₱", "").trim()} ea`);
    if (ci.modifiers && ci.modifiers.length > 0) {
      ci.modifiers.forEach(m => {
        const modLine = `     + ${m.name}${m.price > 0 ? ' (' + formatCurrency(m.price).replace("₱", "").trim() + ')' : ''}`;
        lines.push(modLine);
      });
    }
    if (ci.notes) lines.push(`     > ${ci.notes}`);
  });
  lines.push(ln("-"));

  // 5. Totals
  lines.push(`${padRight("Subtotal:", W - 9)}${padLeft(formatCurrency(order.subtotal).replace("₱", "").trim(), 9)}`);
  if (discountAmount && discountAmount > 0) {
    lines.push(`${padRight(`${discountLabel || "Discount"}:`, W - 9)}${padLeft("-" + formatCurrency(discountAmount).replace("₱", "").trim(), 9)}`);
  }
  lines.push(ln("="));
  lines.push(`${padRight("TOTAL DUE:", W - 9)}${padLeft(formatCurrency(order.total).replace("₱", "").trim(), 9)}`);
  lines.push(ln("="));

  // 6. Payment
  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";
  lines.push(`Payment : ${payLabel}`);
  if (order.payMethod === "ewallet" && order.referenceNumber) {
    lines.push(`Ref No  : ${order.referenceNumber}`);
  }
  if (order.payMethod === "cash" && order.cashTendered) {
    lines.push(`${padRight("Tendered:", W - 9)}${padLeft(formatCurrency(order.cashTendered).replace("₱", "").trim(), 9)}`);
    lines.push(`${padRight("Change:", W - 9)}${padLeft(formatCurrency(order.cashTendered - order.total).replace("₱", "").trim(), 9)}`);
  }

  // 7. WiFi Info (optional)
  if (settings.showWifiInfo) {
    lines.push(ln("-"));
    if (settings.wifiAsQR) {
      // QR mode: placeholder — actual QR rendered by print-server.py or ReceiptPreview
      lines.push(padCenter("Connect to Wi-Fi"));
      lines.push(padCenter("[ SCAN QR TO JOIN ]"));
    } else {
      lines.push(`WiFi: ${settings.wifiSsid}`);
      lines.push(`Pass: ${settings.wifiPassword}`);
    }
  }

  // 8. QR Code (optional)
  if (settings.showQRCode) {
    lines.push(ln("-"));
    if (settings.qrCodeUrl) {
      // Note: For Bluetooth printing, the actual QR code is rendered by print-server.py
      // using ESC/POS native QR commands. These lines are only for browser/plain-text preview.
      lines.push(padCenter("[ QR CODE ]"));
      lines.push(padCenter("Scan for more info"));
    } else {
      lines.push(padCenter("[ QR CODE ]"));
      lines.push(padCenter("Scan to Pay"));
    }
  }

  // 9. Footer
  if (settings.showCustomerCopy) {
    lines.push(ln("-"));
    lines.push(padCenter("Thank you for dining with us!"));
    lines.push(padCenter("Please come again!"));
    lines.push(" ");
    lines.push(padCenter("** CUSTOMER COPY **"));
  }

  lines.push(" ");
  lines.push(" ");
  return lines;
}

export function openPrintWindow(order: Order, settings: PrintSettings, discountAmount?: number, discountLabel?: string): void {
  const lines = buildReceiptLines(order, settings, discountAmount, discountLabel);
  const W_PX = settings.paperSize === "58mm" ? 226 : 302;

  const win = window.open("", "_blank", "width=440,height=700");
  if (!win) return;

  // Repeat receipt for multi-copy printing
  const sep = "=".repeat(32);
  const copies = Array(settings.printCopies).fill(lines.join("\n")).join(`\n\n${sep}\n\n`);

  win.document.write("<!DOCTYPE html><html><head>");
  win.document.write("<title>Receipt</title>");
  win.document.write(`<style>
    @page { margin: 0; size: ${settings.paperSize}mm auto; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${MONO}; font-size: 11px; line-height: 1.4;
      width: ${W_PX}px; margin: 0 auto; padding: 8px 6px;
      box-sizing: border-box; color: #000; background: #fff;
    }
    pre {
      font-family: ${MONO}; font-size: 11px; line-height: 1.45;
      margin: 0; white-space: pre-wrap; word-break: keep-all;
    }
  </style>`);
  win.document.write("</head><body>");
  win.document.write(`<pre>${copies}</pre>`);
  win.document.write("<script>window.print();<\/script>");
  win.document.write("</body></html>");
  win.document.close();
}

export function renderReceiptLines(order: Order, settings: PrintSettings): React.ReactElement[] {
  const lines = buildReceiptLines(order, settings);
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isDouble = /^=+$/.test(trimmed);
    const isCentered = trimmed === trimmed.trimLeft() && trimmed.length > 0;
    return (
      <div key={i} style={{
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: 1.45,
        color: isDouble ? "#222" : "#111",
        fontWeight: isDouble ? 700 : 400,
        padding: isDouble ? "2px 0" : "0",
        textAlign: isCentered ? "center" as const : "left" as const,
        letterSpacing: isDouble ? 1 : 0,
      }}>
        {line}
      </div>
    );
  });
}

// Backend proxies to Pi at /api/print and /api/open-drawer
export async function printViaBluetooth(order: Order, settings: PrintSettings, discountAmount?: number, discountLabel?: string): Promise<void> {
  const baseUrl = (import.meta.env.VITE_API_URL as string) || '';
  const lines = buildReceiptLines(order, settings, discountAmount, discountLabel);

  // Build WiFi QR data string (standard format: WIFI:T:<enc>;S:<ssid>;P:<pwd>;;)
  let wifiQrData: string | null = null;
  if (settings.showWifiInfo && settings.wifiAsQR && settings.wifiSsid) {
    wifiQrData = `WIFI:T:WPA;S:${settings.wifiSsid};P:${settings.wifiPassword};;`;
  }

  // Repeat lines for multi-copy
  const allLines = Array(settings.printCopies).fill(lines).flat();

  const res = await fetch(`${baseUrl}/api/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: allLines,
      paperSize: settings.paperSize,
      qrCodeUrl: settings.showQRCode && settings.qrCodeUrl ? settings.qrCodeUrl : null,
      wifiQrData: wifiQrData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Print server error ${res.status}`);
  }
}

// Open cash drawer via backend proxy
export async function openCashDrawer(): Promise<void> {
  const baseUrl = (import.meta.env.VITE_API_URL as string) || '';
  const res = await fetch(`${baseUrl}/api/open-drawer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Drawer error ${res.status}`);
  }
}