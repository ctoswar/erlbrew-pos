import React, { useState } from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";
import { loadPrintSettings, PrintSettings } from "./AdminPrintSettings";
import { openPrintWindow, printViaBluetooth } from "../utils/receiptUtils";

interface Props {
  order: Order;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const [settings] = useState<PrintSettings>(loadPrintSettings());

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";

  const handlePrint = async () => {
    const discountAmount = order.discount?.amount;
    const discountLabel = order.discount?.label;
    if (settings.printVia === "bluetooth") {
      try {
        await printViaBluetooth(order, settings, discountAmount, discountLabel);
        onClose();
      } catch (e: any) {
        const msg = e?.message || e?.reason?.message || String(e);
        alert(`Print failed:\n${msg}\n\nMake sure the print server is running.`);
      }
    } else {
      openPrintWindow(order, settings, discountAmount, discountLabel);
      onClose();
    }
  };

  const PAPER_WIDTH = settings.paperSize === "58mm" ? 240 : 280;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      {/* Preview pane */}
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", maxHeight: "95vh", minWidth: 360,
      }}>
        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div style={{
          background: "var(--bg-sidebar)", padding: "14px 20px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Playfair Display', serif" }}>
            Receipt Preview
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
            {settings.paperSize} · {settings.printCopies} {settings.printCopies === 1 ? "copy" : "copies"}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            color: "var(--text-muted)", fontSize: 20, cursor: "pointer", padding: "0 4px",
          }}>✕</button>
        </div>

        {/* ── Scrollable receipt paper ────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 20px 16px",
          display: "flex", justifyContent: "center", background: "#e8e4df",
        }}>
          {/* Receipt paper — class added so @media print can isolate it */}
          <div
            className="receipt-print-target"
            style={{
              background: "#fff",
              width: PAPER_WIDTH,
              padding: "20px 16px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
              borderRadius: 2,
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              lineHeight: 1.5,
              color: "#111",
            }}
          >
            {/* 1. Store Header */}
            {settings.showStoreHeader && (
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>ERLBREW CAFE</div>
                <div style={{ fontSize: 9, marginTop: 3, color: "#555" }}>Unit 1, Ground Floor</div>
                <div style={{ fontSize: 9, color: "#555" }}>123 Main St, BGC, Taguig</div>
                <div style={{ fontSize: 9, color: "#555" }}>Tel: (02) 8888-8888</div>
              </div>
            )}

            {/* 2. BIR Info */}
            {settings.showBIRInfo && (
              <>
                <div style={{ borderTop: "2px solid #222", borderBottom: "2px solid #222", padding: "4px 0", textAlign: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 10, letterSpacing: 2 }}>OFFICIAL RECEIPT</strong>
                </div>
                <div style={{ fontSize: 9, marginBottom: 6, lineHeight: 1.6 }}>
                  <div>ATP No  : ATP-2024-00-00000</div>
                  <div>ATP Date: Jan 01, 2024</div>
                  <div>COR No  : COR-2024-00-00000</div>
                  <div>Serial  : ERL-2024-00001</div>
                  <div>PTU No  : PTU-2024-00-00000</div>
                  <div>Machine : POS-01</div>
                  <div>Accr No : ACC-2024-0001</div>
                </div>
                <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />
              </>
            )}

            {/* 3. Transaction Info */}
            <div style={{ fontSize: 10, marginBottom: 6 }}>
              <div>Date: {dateStr}</div>
              <div>Time: {timeStr}</div>
              <div>Slip No: {order.id}</div>
              <div>Server : {order.staff.name}</div>
              <div>Type   : {order.type === "dine-in" ? `DINE-IN${order.table ? ` / Tbl ${order.table}` : ""}` : "TAKEOUT"}</div>
            </div>

            <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />

            {/* 4. Line Items */}
            <div style={{ borderTop: "1px dashed #aaa", borderBottom: "1px dashed #aaa", padding: "4px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", fontSize: 9, color: "#555" }}>
                <span style={{ flex: 1 }}>QTY&nbsp; ITEM</span>
                <span>AMOUNT</span>
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              {order.items.map((ci, idx) => (
                <div key={ci.item.id + '-' + idx} style={{ marginBottom: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <span style={{ fontWeight: 700 }}>{ci.qty}×</span> {ci.item.name}
                    </div>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatCurrency(ci.item.price * ci.qty)}
                    </div>
                  </div>
                  {ci.qty > 1 && (
                    <div style={{ fontSize: 9, color: "#888", paddingLeft: 20 }}>
                      @ {formatCurrency(ci.item.price)} ea
                    </div>
                  )}
                  {ci.modifiers && ci.modifiers.length > 0 && ci.modifiers.map((m, mi) => (
                    <div key={mi} style={{ fontSize: 9, color: "#666", paddingLeft: 20 }}>
                      + {m.name}{m.price > 0 ? ` (${formatCurrency(m.price)})` : ''}
                    </div>
                  ))}
                  {ci.notes && (
                    <div style={{ fontSize: 9, color: "#777", paddingLeft: 20, fontStyle: "italic" }}>
                      Note: {ci.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />

            {/* 5. Totals */}
            <div style={{ fontSize: 10, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
            </div>

            <div style={{ borderTop: "2px solid #222", borderBottom: "2px solid #222", padding: "5px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                <span>TOTAL DUE</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* 6. Payment */}
            <div style={{ fontSize: 10, marginBottom: 6 }}>
              <div>Payment : {payLabel}</div>
              {order.payMethod === "ewallet" && order.referenceNumber && (
                <div>Ref No  : {order.referenceNumber}</div>
              )}
              {order.payMethod === "cash" && order.cashTendered && (
                <>
                  <div>Tendered: {formatCurrency(order.cashTendered)}</div>
                  <div>Change  : {formatCurrency(order.cashTendered - order.total)}</div>
                </>
              )}
            </div>

            {/* 7. QR Code (optional) */}
            {settings.showQRCode && (
              <>
                <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />
                <div style={{ textAlign: "center", padding: "8px 0", color: "#555" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1 }}>[ QR CODE ]</div>
                  <div style={{ fontSize: 9, color: "#888" }}>Scan to Pay</div>
                </div>
              </>
            )}

            {/* 8. Footer */}
            {settings.showCustomerCopy && (
              <div style={{ borderTop: "1px dashed #aaa", paddingTop: 8, textAlign: "center", fontSize: 10 }}>
                <div style={{ marginBottom: 2 }}>Thank you for dining with us!</div>
                <div style={{ marginBottom: 8 }}>Please come again!</div>
                <div style={{ fontSize: 8, color: "#aaa", marginBottom: 2 }}>** CUSTOMER COPY **</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div style={{
          background: "var(--bg-sidebar)", padding: "14px 20px",
          borderTop: "1px solid var(--border-default)",
          display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button className="btn btn-outline" onClick={onClose} style={{ fontSize: 10, padding: "8px 18px" }}>
            Cancel
          </button>
          <button
            className="btn btn-gold"
            onClick={handlePrint}
            style={{ fontSize: 10, padding: "8px 18px" }}
          >
            🖨 Print ({settings.printCopies})
          </button>
        </div>
      </div>
    </div>
  );
};