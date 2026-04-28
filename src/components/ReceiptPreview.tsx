import React from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  order: Order;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      {/* Preview pane */}
      <div style={{
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "95vh",
      }}>
        {/* ── Preview toolbar ─────────────────────────────────────────── */}
        <div style={{
          background: "var(--bg-sidebar)",
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>
            Receipt Preview
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: "var(--text-muted)", fontSize: 20, cursor: "pointer", padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable receipt paper ────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "20px 20px 16px",
          display: "flex", justifyContent: "center",
          background: "#e8e4df",
        }}>
          {/* The paper */}
          <div style={{
            background: "#fff",
            width: 280,
            padding: "20px 16px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
            borderRadius: 2,
            fontFamily: "'Courier New', 'Lucida Console', monospace",
            fontSize: 11,
            lineHeight: 1.5,
            color: "#111",
          }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>ERLBREW CAFE</div>
              <div style={{ fontSize: 9, marginTop: 3, color: "#555" }}>Unit 1, Ground Floor</div>
              <div style={{ fontSize: 9, color: "#555" }}>123 Main Street, BGC, Taguig</div>
              <div style={{ fontSize: 9, color: "#555" }}>Tel: (02) 8888-8888</div>
              <div style={{ fontSize: 9, color: "#555" }}>VAT Reg: TIN-000-000-000</div>
            </div>

            <div style={{ borderTop: "1px solid #222", borderBottom: "1px solid #222", padding: "4px 0", textAlign: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 10, letterSpacing: 2 }}>OFFICIAL RECEIPT</strong>
            </div>

            {/* Order info */}
            <div style={{ fontSize: 10, marginBottom: 6 }}>
              <div>Date: {dateStr} &nbsp; {timeStr}</div>
              <div>Slip No: {order.id}</div>
              <div>Server: {order.staff.name}</div>
              <div>Type: {order.type === "dine-in" ? `DINE-IN  ${order.table ? `Table ${order.table}` : ""}`.trim() : "TAKEOUT"}</div>
            </div>

            <div style={{ borderTop: "1px dashed #aaa", borderBottom: "1px dashed #aaa", padding: "4px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", fontSize: 9, color: "#555", marginBottom: 2 }}>
                <span style={{ flex: 1 }}>QTY&nbsp; ITEM</span>
                <span>AMOUNT</span>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 6 }}>
              {order.items.map((ci) => (
                <div key={ci.item.id} style={{ marginBottom: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <span style={{ fontWeight: 700 }}>{ci.qty}×</span> {ci.item.name}
                    </div>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatCurrency(ci.item.price * ci.qty)}
                    </div>
                  </div>
                  {ci.notes && (
                    <div style={{ fontSize: 9, color: "#777", paddingLeft: 20, fontStyle: "italic" }}>
                      &gt; {ci.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px dashed #aaa", paddingTop: 5, marginBottom: 5 }}>
<div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
          </div>
        </div>

            <div style={{ borderTop: "2px solid #222", borderBottom: "2px solid #222", padding: "5px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                <span>TOTAL</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            <div style={{ fontSize: 10, marginBottom: 10 }}>
              Payment: {order.payMethod === "cash" ? "CASH" : order.payMethod.toUpperCase()}
            </div>

            <div style={{ borderTop: "1px dashed #aaa", paddingTop: 8, textAlign: "center", fontSize: 10 }}>
              <div style={{ marginBottom: 2 }}>Thank you for dining with us!</div>
              <div style={{ marginBottom: 8 }}>Please come again!</div>
              <div style={{ fontSize: 8, color: "#aaa" }}>BIR-Approved</div>
              <div style={{ fontSize: 8, color: "#aaa" }}>Serial: ERL-2024-0001</div>
            </div>
          </div>
        </div>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <div style={{
          background: "var(--bg-sidebar)",
          padding: "14px 20px",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <button className="btn btn-outline" onClick={onClose} style={{ fontSize: 10, padding: "8px 18px" }}>
            Cancel
          </button>
          <button
            className="btn btn-gold"
            onClick={() => { window.print(); onClose(); }}
            style={{ fontSize: 10, padding: "8px 18px" }}
          >
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
};