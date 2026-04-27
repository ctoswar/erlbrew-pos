import React, { useRef, useEffect } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  order: Order;
  onPrint?: () => void;
}

const PAPER_MM = 80; // 80mm thermal printer
const FONT = "'Courier New', 'Lucida Console', monospace";
const FONT_SIZE = 11;

function padCenter(text: string, width = 32): string {
  const s = text.length <= width ? text : text.substring(0, width - 2) + "..";
  const spaces = Math.max(0, Math.floor((width - s.length) / 2));
  return " ".repeat(spaces) + s;
}

function padRight(text: string, width = 32): string {
  const s = text.length <= width ? text : text.substring(0, width - 1) + "…";
  return s.padEnd(width);
}

function padLeft(text: string, width = 32): string {
  return text.padStart(width);
}



export const Receipt: React.FC<Props> = ({ order, onPrint }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  const items = order.items;
  const subtotal = order.subtotal;
  const tax = order.tax;
  const total = order.total;
  

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(padCenter("ERLBREW CAFE", 32));
  lines.push(padCenter("Unit 1, Ground Floor", 32));
  lines.push(padCenter("123 Main Street, BGC, Taguig", 32));
  lines.push(padCenter("Tel: (02) 8888-8888", 32));
  lines.push(padCenter("VAT Reg: TIN-000-000-000", 32));
  lines.push("=".repeat(32));
  lines.push(padCenter("OFFICIAL RECEIPT", 32));
  lines.push("=".repeat(32));

  // ── Order info ────────────────────────────────────────────────────────────
  lines.push(`Date: ${dateStr}   ${timeStr}`);
  lines.push(`Slip No: ${order.id}`);
  lines.push(`Server: ${order.staff.name}`);
  lines.push(`Type:   ${order.type === "dine-in" ? `DINE-IN  ${order.table ? `Table ${order.table}` : ""}`.trim() : "TAKEOUT"}`);
  lines.push("-".repeat(32));

  // ── Items ─────────────────────────────────────────────────────────────────
  lines.push("QTY   ITEM                 AMOUNT");
  lines.push("-".repeat(32));

  items.forEach((ci) => {
    const qtyStr = String(ci.qty).padStart(3);
    const priceStr = formatCurrency(ci.item.price * ci.qty).replace("₱", "").trim();
    const name = ci.item.name.length > 18 ? ci.item.name.substring(0, 17) + "…" : ci.item.name;
    const line1 = `${qtyStr}   ${padRight(name, 18)} ${padLeft(priceStr, 7)}`;
    lines.push(line1);
    if (ci.notes) {
      lines.push(`     > ${ci.notes}`);
    }
  });

  lines.push("-".repeat(32));

  // ── Totals ────────────────────────────────────────────────────────────────
  lines.push(`${padRight("Subtotal:", 22)}${padLeft(formatCurrency(subtotal).replace("₱","").trim(), 9)}`);
  lines.push(`${padRight("VAT (12%):", 22)}${padLeft(formatCurrency(tax).replace("₱","").trim(), 9)}`);
  lines.push("=".repeat(32));
  lines.push(`${padRight("TOTAL:", 22)}${padLeft(formatCurrency(total).replace("₱","").trim(), 9)}`);
  lines.push("=".repeat(32));

  // ── Payment ───────────────────────────────────────────────────────────────
  lines.push(`Payment: ${order.payMethod === "cash" ? "CASH" : order.payMethod.toUpperCase()}`);

  // ── Footer ────────────────────────────────────────────────────────────────
  lines.push("-".repeat(32));
  lines.push(padCenter("Thank you for dining with us!", 32));
  lines.push(padCenter("Please come again!", 32));
  lines.push(" ".repeat(32));
  lines.push(padCenter(" BIR-Approved", 32));
  lines.push(padCenter("Serial: ERL-2024-0001", 32));
  lines.push(" ".repeat(32));
  lines.push(" ".repeat(32));

  // Print on mount
  useEffect(() => {
    if (!printRef.current || !onPrint) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    const doc = win.document;
    doc.write("<!DOCTYPE html><html><head>");
    doc.write("<title>Receipt</title>");
    doc.write(`<style>
      @page { margin: 0; size: ${PAPER_MM}mm auto; }
      body {
        font-family: ${FONT};
        font-size: ${FONT_SIZE}px;
        line-height: 1.4;
        width: ${PAPER_MM}mm;
        margin: 0;
        padding: 8px 6px;
        box-sizing: border-box;
        color: #000;
        background: #fff;
      }
      pre {
        font-family: ${FONT};
        font-size: ${FONT_SIZE}px;
        line-height: 1.45;
        margin: 0;
        white-space: pre-wrap;
        word-break: keep-all;
      }
    </style>`);
    doc.write("</head><body>");
    doc.write(`<pre>${lines.join("\n")}</pre>`);
    doc.write(`<script>window.print(); window.close();<\/script>`);
    doc.write("</body></html>");
    doc.close();
    if (onPrint) onPrint();
  }, []); // eslint-disable-line

  return (
    <div ref={printRef} style={{ display: "none" }} />
  );
};