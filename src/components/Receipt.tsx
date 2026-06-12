import React, { useRef, useEffect } from "react";
import { Order, CartItem } from "../types";
import { formatCurrency } from "../utils";
import { getStoreInfo } from "../utils/receiptUtils";
import { loadPrintSettings } from "./AdminPrintSettings";

interface Props {
  order: Order;
  onPrint?: () => void;
}

const PAPER_MM = 80;
const FONT = "'Courier New', 'Lucida Console', monospace";
const FONT_SIZE = 11;
const W = 32;

function padCenter(text: string, width = W): string {
  const s = text.length <= width ? text : text.substring(0, width - 2) + "..";
  const spaces = Math.max(0, Math.floor((width - s.length) / 2));
  return " ".repeat(spaces) + s;
}
function padRight(text: string, width = W): string {
  const s = text.length <= width ? text : text.substring(0, width - 1) + "…";
  return s.padEnd(width);
}
function padLeft(text: string, width = W): string {
  return text.padStart(width);
}
function ln(char = "-") { return char.repeat(W); }

export const Receipt: React.FC<Props> = ({ order, onPrint }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const settings = loadPrintSettings();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const items = order.items;
  const subtotal = order.subtotal;
  const total = order.total;
  const slipNo = order.id || "0000";

  const lines: string[] = [];
  const STORE = getStoreInfo();

  // Resolve address lines
  const addressLines = STORE.addr1
    ? STORE.addr1.length > 30
      ? [STORE.addr1.substring(0, STORE.addr1.lastIndexOf(',', 30)).trim(), STORE.addr1.substring(STORE.addr1.lastIndexOf(',', 30) + 1).trim()]
      : [STORE.addr1]
    : [];

  // 1. Store Header
  if (settings.showStoreHeader) {
    lines.push(padCenter(STORE.name));
    addressLines.forEach(line => lines.push(padCenter(line)));
    if (STORE.tel) lines.push(padCenter(`Tel: ${STORE.tel}`));
    lines.push(ln("="));
  }

  // 2. BIR Accreditations
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
  lines.push(`Slip No: ${slipNo}`);
  lines.push(`Server : ${order.staff.name}`);
  lines.push(`Type   : ${order.type === "dine-in" ? `DINE-IN${order.customerName ? ` / ${order.customerName}` : ""}` : "TAKEOUT"}`);
  lines.push(ln("-"));

  // 4. Line Items
  lines.push("QTY  ITEM              AMOUNT");
  lines.push(ln("-"));
  items.forEach((ci) => {
    const ciMods = (ci as CartItem).modifiers || [];
    const modifierPrice = ciMods.reduce((s, m) => s + m.price, 0);
    const lineTotal = (ci.item.price + modifierPrice) * ci.qty;
    const qtyStr = String(ci.qty).padStart(3);
    const amtStr = formatCurrency(lineTotal).replace("₱", "").trim();
    const name = ci.item.name.length > 17 ? ci.item.name.substring(0, 16) + "…" : ci.item.name;
    lines.push(`${qtyStr}  ${padRight(name, 17)} ${padLeft(amtStr, 8)}`);
    if (ci.qty > 1) {
      const unitPrice = ci.item.price + modifierPrice;
      lines.push(`     @ ${formatCurrency(unitPrice).replace("₱","").trim()} ea`);
    }
    if (ci.notes) {
      lines.push(`     > ${ci.notes}`);
    }
    // Print modifier lines under each item
    if (ciMods.length > 0) {
      ciMods.forEach((m) => {
        const modLabel = m.price > 0
          ? `     + ${m.name} (${formatCurrency(m.price).replace("₱","").trim()})`
          : `     + ${m.name}`;
        lines.push(padRight(modLabel, W));
      });
    }
  });
  lines.push(ln("-"));

  // 5. Totals
  lines.push(`${padRight("Subtotal:", 22)}${padLeft(formatCurrency(subtotal).replace("₱","").trim(), 9)}`);
  if (order.discount && order.discount.amount > 0) {
    lines.push(`${padRight(order.discount.label + ":", 22)}${padLeft("-" + formatCurrency(order.discount.amount).replace("₱","").trim(), 9)}`);
  }
  lines.push(ln("="));
  lines.push(`${padRight("TOTAL DUE:", 22)}${padLeft(formatCurrency(total).replace("₱","").trim(), 9)}`);
  lines.push(ln("="));

  // 6. Payment
  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";
  lines.push(`Payment : ${payLabel}`);
  if (order.payMethod === "ewallet" && order.referenceNumber) {
    lines.push(`Ref No  : ${order.referenceNumber}`);
  }
  if (order.payMethod === "cash" && order.cashTendered) {
    const tendered = order.cashTendered;
    lines.push(`${padRight("Tendered:", 22)}${padLeft(formatCurrency(tendered).replace("₱","").trim(), 9)}`);
    lines.push(`${padRight("Change:", 22)}${padLeft(formatCurrency(tendered - total).replace("₱","").trim(), 9)}`);
  }

  // 7. QR Code (optional)
  if (settings.showQRCode) {
    lines.push(ln("-"));
    if (settings.qrCodeUrl) {
      lines.push(padCenter("[ QR CODE ]"));
      lines.push(padCenter("Scan for more info"));
    } else {
      lines.push(padCenter("[ QR CODE ]"));
      lines.push(padCenter("Scan to Pay"));
    }
  }

  // 8. Footer
  if (settings.showCustomerCopy) {
    lines.push(ln("-"));
    lines.push(padCenter("Thank you for dining with us!"));
    lines.push(padCenter("Please come again!"));
    lines.push(" ");
    lines.push(padCenter("** CUSTOMER COPY **"));
  }

  lines.push(" ");
  lines.push(" ");

  useEffect(() => {
    if (!printRef.current || !onPrint) return;
    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) return;
    const doc = win.document;
    doc.write("<!DOCTYPE html><html><head>");
    doc.write("<title>Receipt</title>");
    doc.write(`<style>
      @page { margin: 0; size: ${PAPER_MM}mm auto; }
      body {
        font-family: ${FONT}; font-size: ${FONT_SIZE}px; line-height: 1.4;
        width: ${PAPER_MM}mm; margin: 0; padding: 8px 6px;
        box-sizing: border-box; color: #000; background: #fff;
      }
      pre {
        font-family: ${FONT}; font-size: ${FONT_SIZE}px; line-height: 1.45;
        margin: 0; white-space: pre-wrap; word-break: keep-all;
      }
    </style>`);
    doc.write("</head><body>");
    doc.write(`<pre>${lines.join("\n")}</pre>`);
    doc.write(`<script>window.print(); window.close();<\/script>`);
    doc.write("</body></html>");
    doc.close();
    if (onPrint) onPrint();
  }, []); // eslint-disable-line

  return <div ref={printRef} className="hidden" />;
};