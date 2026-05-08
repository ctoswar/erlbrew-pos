import React, { useRef, useEffect } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  order: Order;
  onPrint?: () => void;
}

const PAPER_MM = 80;
const FONT = "'Courier New', 'Lucida Console', monospace";
const FONT_SIZE = 11;
const W = 32;

// Load company settings from localStorage (set by AdminPrintSettings)
function getStoreInfo() {
  try {
    const s = localStorage.getItem('erlbrew_company_settings');
    if (s) {
      const data = JSON.parse(s);
      return {
        name: data.company_name || 'ERLBREW CAFE',
        addr1: data.company_address || 'Unit 1, Ground Floor',
        addr2: data.company_address2 || '123 Main St, BGC, Taguig',
        tel: data.company_phone || '(02) 8888-8888',
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
    addr2: '123 Main St, BGC, Taguig',
    tel: '(02) 8888-8888',
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

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const items = order.items;
  const subtotal = order.subtotal;
  const total = order.total;
  const slipNo = order.id || "0000";

  const lines: string[] = [];
  const STORE = getStoreInfo();

  // ── 1. Store Header ────────────────────────────────────────────────────────
  lines.push(padCenter(STORE.name));
  lines.push(padCenter(STORE.addr1));
  if (STORE.addr2) lines.push(padCenter(STORE.addr2));
  if (STORE.tel) lines.push(padCenter(`Tel: ${STORE.tel}`));
  lines.push(ln("="));

  // ── 2. BIR Accreditations ──────────────────────────────────────────────────
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

  // ── 3. Transaction Info ────────────────────────────────────────────────────
  lines.push(`Date: ${dateStr}`);
  lines.push(`Time: ${timeStr}`);
  lines.push(`Slip No: ${slipNo}`);
  lines.push(`Server : ${order.staff.name}`);
  lines.push(`Type   : ${order.type === "dine-in" ? `DINE-IN${order.table ? ` / Tbl ${order.table}` : ""}` : "TAKEOUT"}`);
  lines.push(ln("-"));

  // ── 4. Line Items ──────────────────────────────────────────────────────────
  lines.push("QTY  ITEM              AMOUNT");
  lines.push(ln("-"));
  items.forEach((ci) => {
    const qtyStr = String(ci.qty).padStart(3);
    const amtStr = formatCurrency(ci.item.price * ci.qty).replace("₱", "").trim();
    const name = ci.item.name.length > 17 ? ci.item.name.substring(0, 16) + "…" : ci.item.name;
    lines.push(`${qtyStr}  ${padRight(name, 17)} ${padLeft(amtStr, 8)}`);
    if (ci.qty > 1) {
      lines.push(`     @ ${formatCurrency(ci.item.price).replace("₱","").trim()} ea`);
    }
    if (ci.notes) {
      lines.push(`     > ${ci.notes}`);
    }
  });
  lines.push(ln("-"));

  // ── 5. Totals ─────────────────────────────────────────────────────────────
  lines.push(`${padRight("Subtotal:", 22)}${padLeft(formatCurrency(subtotal).replace("₱","").trim(), 9)}`);
  if (order.discount && order.discount.amount > 0) {
    lines.push(`${padRight(order.discount.label + ":", 22)}${padLeft("-" + formatCurrency(order.discount.amount).replace("₱","").trim(), 9)}`);
  }
  lines.push(ln("="));
  lines.push(`${padRight("TOTAL DUE:", 22)}${padLeft(formatCurrency(total).replace("₱","").trim(), 9)}`);
  lines.push(ln("="));

  // ── 6. Payment ─────────────────────────────────────────────────────────────
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

  // ── 7. Footer ──────────────────────────────────────────────────────────────
  lines.push(ln("-"));
  lines.push(padCenter("Thank you for dining with us!"));
  lines.push(padCenter("Please come again!"));
  lines.push(" ");
  lines.push(padCenter("** CUSTOMER COPY **"));
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

  return <div ref={printRef} style={{ display: "none" }} />;
};
