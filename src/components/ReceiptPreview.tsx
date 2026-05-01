import React from "react";
import { Order } from "../types";
import { formatCurrency } from "../utils";

interface Props {
  order: Order;
  onClose: () => void;
}

// ── BIR-required store details (same as Receipt.tsx) ────────────────────────
const STORE = {
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

const mono = "'Courier New', 'Lucida Console', monospace";

export const ReceiptPreview: React.FC<Props> = ({ order, onClose }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const payLabel = order.payMethod === "cash" ? "CASH" : order.payMethod === "card" ? "CARD" : "E-WALLET";

  const handlePrint = () => { window.print(); onClose(); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      {/* Preview pane */}
      <div style={{
        background: "#fff", borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", maxHeight: "95vh",
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
          <div
            className="receipt-print-target"
            style={{
              background: "#fff", width: 280, padding: "20px 16px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.15)", borderRadius: 2,
              fontFamily: mono, fontSize: 11, lineHeight: 1.5, color: "#111",
            }}
          >

            {/* ── 1. Store Header ───────────────────────────────────── */}
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{STORE.name}</div>
              <div style={{ fontSize: 9, marginTop: 3, color: "#555" }}>{STORE.addr1}</div>
              <div style={{ fontSize: 9, color: "#555" }}>{STORE.addr2}</div>
              <div style={{ fontSize: 9, color: "#555" }}>Tel: {STORE.tel}</div>
              <div style={{ fontSize: 9, color: "#555" }}>TIN: {STORE.tin}</div>
            </div>

            {/* ── 2. BIR Accreditations ─────────────────────────────── */}
            <div style={{ borderTop: "2px solid #222", borderBottom: "2px solid #222", padding: "4px 0", textAlign: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 10, letterSpacing: 2 }}>OFFICIAL RECEIPT</strong>
            </div>

            <div style={{ fontSize: 9, marginBottom: 6, lineHeight: 1.6 }}>
              <div>ATP No  : {STORE.atpNo}</div>
              <div>ATP Date: {STORE.atpDate}</div>
              <div>COR No  : {STORE.birCorNo}</div>
              <div>Serial  : {STORE.serial}</div>
              <div>PTU No  : {STORE.ptuNo}</div>
              <div>Machine : {STORE.machineNo}</div>
              <div>Accr No : {STORE.posAccNo}</div>
            </div>

            <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />

            {/* ── 3. Transaction Info ───────────────────────────────── */}
            <div style={{ fontSize: 10, marginBottom: 6 }}>
              <div>Date: {dateStr}</div>
              <div>Time: {timeStr}</div>
              <div>Slip No: {order.id}</div>
              <div>Server : {order.staff.name}</div>
              <div>Type   : {order.type === "dine-in" ? `DINE-IN${order.table ? ` / Tbl ${order.table}` : ""}` : "TAKEOUT"}</div>
            </div>

            <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />

            {/* ── 4. Line Items ─────────────────────────────────────── */}
            <div style={{ borderTop: "1px dashed #aaa", borderBottom: "1px dashed #aaa", padding: "4px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", fontSize: 9, color: "#555" }}>
                <span style={{ flex: 1 }}>QTY&nbsp; ITEM</span>
                <span>AMOUNT</span>
              </div>
            </div>

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
                  {ci.qty > 1 && (
                    <div style={{ fontSize: 9, color: "#888", paddingLeft: 20 }}>
                      @ {formatCurrency(ci.item.price)} ea
                    </div>
                  )}
                  {ci.notes && (
                    <div style={{ fontSize: 9, color: "#777", paddingLeft: 20, fontStyle: "italic" }}>
                      &gt; {ci.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px dashed #aaa", marginBottom: 6 }} />

            {/* ── 5. Totals (0% VAT) ────────────────────────────────── */}
            <div style={{ fontSize: 10, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>VAT-Exempt Sale:</span><span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>VAT (0%):</span><span>₱0.00</span>
              </div>
            </div>

            <div style={{ borderTop: "2px solid #222", borderBottom: "2px solid #222", padding: "5px 0", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                <span>TOTAL DUE</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* ── 6. Payment ────────────────────────────────────────── */}
            <div style={{ fontSize: 10, marginBottom: 6 }}>
              <div>Payment : {payLabel}</div>
            </div>

            {/* ── 7. BIR Footer ─────────────────────────────────────── */}
            <div style={{ borderTop: "1px dashed #aaa", paddingTop: 8, textAlign: "center", fontSize: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>NON-VAT REGISTERED</div>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 1 }}>VAT-Exempt under</div>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>Sec. 109(A), NIRC as amended</div>

              <div style={{ borderTop: "1px dashed #aaa", paddingTop: 6, marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>THIS SERVES AS AN</div>
                <div style={{ fontWeight: 700 }}>OFFICIAL RECEIPT</div>
              </div>

              <div style={{ borderTop: "1px dashed #aaa", paddingTop: 6, marginBottom: 6 }}>
                <div style={{ marginBottom: 2 }}>Thank you for dining with us!</div>
                <div style={{ marginBottom: 8 }}>Please come again!</div>
              </div>

              <div style={{ fontSize: 8, color: "#aaa", marginBottom: 2 }}>** CUSTOMER COPY **</div>
              <div style={{ fontSize: 8, color: "#aaa" }}>Min. Wage Dist.: {formatCurrency(0)}</div>
            </div>

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
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
};
