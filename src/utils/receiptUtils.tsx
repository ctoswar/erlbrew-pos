import { Order } from "../types";
import { formatCurrency } from "./index";
import { PrintSettings } from "../components/AdminPrintSettings";

export const STORE = {
  name: "ERLBREW CAFE",
  addr1: "Unit 1, Ground Floor",
  addr2: "123 Main St, BGC, Taguig",
  tel: "(02) 8888-8888",
  tin: "000-000-000-000",
  birCorNo: "COR-2024-00-00000",
  atpNo: "ATP-2024-00-00000",
  atpDate: "Jan 01, 2024",
  serial: "ERL-2024-00001",
  ptuNo: "PTU-2024-00-00000",
  machineNo: "POS-01",
  posAccNo: "ACC-2024-0001",
};

const MONO = "'Courier New', 'Lucida Console', monospace";

// ── Build receipt lines array (shared by preview and print window) ──────────────
export function buildReceiptLines(order: Order, settings: PrintSettings): string[] {
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

  // 1. Store Header
  if (settings.showStoreHeader) {
    lines.push(padCenter(STORE.name));
    lines.push(padCenter(STORE.addr1));
    lines.push(padCenter(STORE.addr2));
    lines.push(padCenter(`Tel: ${STORE.tel}`));
    lines.push(padCenter(`TIN: ${STORE.tin}`));
    lines.push(ln("="));
  }

  // 2. BIR Info
  if (settings.showBIRInfo) {
    lines.push(padCenter("OFFICIAL RECEIPT"));
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
  lines.push(`Type   : ${order.type === "dine-in" ? `DINE-IN${order.table ? ` / Tbl ${order.table}` : ""}` : "TAKEOUT"}`);
  lines.push(ln("-"));

  // 4. Line Items
  lines.push("QTY  ITEM              AMOUNT");
  lines.push(ln("-"));
  order.items.forEach((ci) => {
    const qtyStr = String(ci.qty).padStart(3);
    const amtStr = formatCurrency(ci.item.price * ci.qty).replace("₱", "").trim();
    const name = ci.item.name.length > 17 ? ci.item.name.substring(0, 16) + "…" : ci.item.name;
    lines.push(`${qtyStr}  ${padRight(name, 17)} ${padLeft(amtStr, 8)}`);
    if (ci.qty > 1) lines.push(`     @ ${formatCurrency(ci.item.price).replace("₱", "").trim()} ea`);
    if (ci.notes) lines.push(`     > ${ci.notes}`);
  });
  lines.push(ln("-"));

  // 5. Totals
  lines.push(`${padRight("Subtotal:", W - 9)}${padLeft(formatCurrency(order.subtotal).replace("₱", "").trim(), 9)}`);
  lines.push(`${padRight("VAT-Exempt Sale:", W - 9)}${padLeft(formatCurrency(order.subtotal).replace("₱", "").trim(), 9)}`);
  lines.push(`${padRight("VAT (0%):", W - 9)}${padLeft("0.00", 9)}`);
  lines.push(ln("="));
  lines.push(`${padRight("TOTAL DUE:", W - 9)}${padLeft(formatCurrency(order.total).replace("₱", "").trim(), 9)}`);
  lines.push(ln("="));

  // 6. Payment
  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";
  lines.push(`Payment : ${payLabel}`);
  if (order.payMethod === "cash" && order.cashTendered) {
    lines.push(`${padRight("Tendered:", W - 9)}${padLeft(formatCurrency(order.cashTendered).replace("₱", "").trim(), 9)}`);
    lines.push(`${padRight("Change:", W - 9)}${padLeft(formatCurrency(order.cashTendered - order.total).replace("₱", "").trim(), 9)}`);
  }
  if (settings.showQRCode) {
    lines.push(ln("-"));
    lines.push(padCenter("[ QR CODE ]"));
    lines.push(padCenter("Scan to Pay"));
  }

  // 7. BIR Footer
  lines.push(ln("-"));
  lines.push(padCenter("NON-VAT REGISTERED"));
  lines.push(padCenter("VAT-Exempt under"));
  lines.push(padCenter("Sec. 109(A), NIRC as amended"));
  lines.push(ln("-"));
  lines.push(padCenter("THIS SERVES AS AN"));
  lines.push(padCenter("OFFICIAL RECEIPT"));

  if (settings.showCustomerCopy) {
    lines.push(ln("-"));
    lines.push(padCenter("Thank you for dining with us!"));
    lines.push(padCenter("Please come again!"));
    lines.push(" ");
    lines.push(padCenter("** CUSTOMER COPY **"));
    lines.push(" ");
    lines.push(padCenter(`Min. Wage Dist.: ${formatCurrency(0)}`));
  }

  lines.push(" ");
  lines.push(" ");
  return lines;
}

// ── Open a clean print window with the receipt ──────────────────────────────────
export function openPrintWindow(order: Order, settings: PrintSettings): void {
  const lines = buildReceiptLines(order, settings);
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

// ── Render receipt lines as React elements (used by AdminPrintSettings preview) ─
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
        textAlign: isCentered ? "center" : "left",
        letterSpacing: isDouble ? 1 : 0,
      }}>
        {line}
      </div>
    );
  });
}