import React, { useState } from "react";
import { PayMethod } from "../types";
import { formatCurrency, getQuickCashAmounts } from "../utils";
import { loadPrintSettings } from "./AdminPrintSettings";

interface Props {
  total: number;
  discountLabel?: string;
  discountAmount?: number;
  onBack: () => void;
  onConfirm: (method: PayMethod, cashTendered?: number, referenceNumber?: string) => void;
}

export const PaymentScreen: React.FC<Props> = ({
  total,
  discountLabel,
  discountAmount,
  onBack,
  onConfirm,
}) => {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitEwallet, setSplitEwallet] = useState("");
  const [splitRef, setSplitRef] = useState("");
  const printSettings = loadPrintSettings();

  const cash = parseFloat(cashGiven) || 0;
  const change = cash - total;
  const quickAmounts = getQuickCashAmounts(total);
  const splitEwalletNum = parseFloat(splitEwallet) || 0;
  const splitCashNeeded = total - splitEwalletNum;
  const canConfirm = splitMode
    ? splitEwalletNum > 0 &&
      splitEwalletNum < total &&
      splitRef.trim() !== "" &&
      cashGiven !== "" &&
      parseFloat(cashGiven) >= splitCashNeeded
    : method !== "cash" || (cashGiven !== "" && cash >= total);
  const canConfirmEwallet = method === "ewallet" && referenceNumber.trim() !== "";

  const handleConfirm = () => {
    if (splitMode) {
      onConfirm(
        "cash",
        parseFloat(cashGiven) || 0,
        `SPLIT:₱${splitEwalletNum.toFixed(0)}-${splitRef}`
      );
    } else {
      onConfirm(
        method,
        method === "cash" ? cash : undefined,
        method === "ewallet" ? referenceNumber : undefined
      );
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "1rem" }}>
      <div className="animate-scaleIn card-glass" style={{ padding: "1.6rem 1.4rem", width: "100%", maxWidth: 420, borderRadius: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <button onClick={onBack} className="btn-ghost" style={{ fontSize: 10, padding: "5px 8px", color: "var(--text-muted)" }}>← Back</button>
          <div className="font-display" style={{ fontSize: 17, color: "var(--text-primary)", fontWeight: 700 }}>Payment</div>
        </div>

        {/* Amount Due */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 8, color: "var(--gold-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Amount Due</div>
          <div className="font-display" style={{ fontSize: 38, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(total)}</div>
          {discountLabel && discountAmount && (
            <div style={{ fontSize: 9, color: "var(--success)", marginTop: 2 }}>{discountLabel} (−{formatCurrency(discountAmount)})</div>
          )}
        </div>

        {/* Method Tabs */}
        {!splitMode && (
          <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
            {(["cash", "card", "ewallet"] as PayMethod[]).map((m) => (
              <button key={m} onClick={() => { setMethod(m); setCashGiven(""); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  background: method === m ? "rgba(201,135,58,0.12)" : "transparent",
                  border: `1.5px solid ${method === m ? "var(--gold)" : "var(--border-default)"}`,
                  color: method === m ? "var(--gold)" : "var(--text-faint)",
                  fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  cursor: "pointer", transition: "all 0.12s var(--ease-out)",
                }}
              >{m === "cash" ? "Cash" : m === "card" ? "Card" : "E-Wallet"}</button>
            ))}
          </div>
        )}

        {/* Cash Panel */}
        {method === "cash" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: "var(--gold-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Cash Tendered</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
              {quickAmounts.map((amt) => (
                <button key={amt} onClick={() => setCashGiven(String(amt))}
                  style={{
                    background: cashGiven === String(amt) ? "var(--gold)" : "var(--bg-surface)",
                    border: `1px solid ${cashGiven === String(amt) ? "var(--gold)" : "var(--border-subtle)"}`,
                    color: cashGiven === String(amt) ? "var(--bg-sidebar)" : "var(--text-muted)",
                    borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.12s var(--ease-out)",
                  }}
                >{formatCurrency(amt)}</button>
              ))}
            </div>
            <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="Or enter amount" style={{ marginBottom: 10 }} />
            {cashGiven && cash >= total && (
              <div style={{ background: "rgba(122,201,122,0.08)", border: "1px solid rgba(122,201,122,0.2)", borderRadius: 10, padding: "10px", textAlign: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 8, color: "var(--success)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Change</div>
                <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: "var(--success)" }}>{formatCurrency(change)}</div>
              </div>
            )}
            {cashGiven && cash < total && (
              <div style={{ background: "rgba(201,122,122,0.08)", border: "1px solid rgba(201,122,122,0.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--danger)" }}>Short by {formatCurrency(total - cash)}</div>
              </div>
            )}
          </div>
        )}

        {/* Card Panel */}
        {method === "card" && (
          <div style={{ textAlign: "center", padding: "1.2rem 0", marginBottom: 14 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>&#x1F4B3;</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>Present card to the payment terminal.<br />Tap, insert, or swipe.</div>
          </div>
        )}

        {/* E-Wallet Panel */}
        {method === "ewallet" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ background: "rgba(201,135,58,0.04)", borderRadius: 10, padding: "1.2rem", marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "var(--gold-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>GCash Reference</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,135,58,0.08)", border: "1px dashed var(--gold)", borderRadius: 8, padding: "10px 16px", marginBottom: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", letterSpacing: 2 }}>{printSettings.gcashNumber || "0917-123-4567"}</span>
                <button onClick={() => navigator.clipboard.writeText("09171234567")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold-muted)", fontSize: 10, padding: "3px 6px", borderRadius: 4 }}>📋</button>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Open GCash → <strong style={{ color: "var(--text-primary)" }}>Pay Bills → Search "Erlbrew"</strong><br />
                <span style={{ fontSize: 9 }}>Amount: {formatCurrency(total)}</span>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 8, color: "var(--gold-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Customer's Reference No.</div>
              <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="e.g. REF-123456789" />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Tap <strong style={{ color: "var(--gold)" }}>Confirm & Place Order</strong> once paid</div>
          </div>
        )}

        {/* Split Bill Toggle */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 9, color: "var(--text-muted)", justifyContent: "center" }}>
            <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} style={{ accentColor: "var(--gold)", width: 13, height: 13 }} />
            Split bill (Cash + E-Wallet)
          </label>
        </div>

        {/* Split Bill Panel */}
        {splitMode && (
          <div style={{ marginBottom: 10, padding: 12, background: "rgba(201,135,58,0.04)", borderRadius: 10, border: "1px solid rgba(201,135,58,0.1)" }}>
            <div style={{ fontSize: 8, color: "var(--gold)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Split Payment</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={{ fontSize: 7.5, color: "var(--text-faint)", marginBottom: 2 }}>E-Wallet Amount</div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 10, pointerEvents: "none" }}>₱</span>
                  <input type="number" value={splitEwallet} onChange={(e) => setSplitEwallet(e.target.value)} placeholder="0.00" min="0" max={total}
                    style={{ width: "100%", padding: "7px 10px 7px 22px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 11 }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, color: "var(--text-faint)", marginBottom: 2 }}>E-Wallet Reference</div>
                <input type="text" value={splitRef} onChange={(e) => setSplitRef(e.target.value)} placeholder="GCash ref number…"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 11 }} />
              </div>
              {splitEwalletNum > 0 && (
                <div style={{ padding: "7px 10px", background: "rgba(201,135,58,0.06)", borderRadius: 7, fontSize: 9, color: "var(--text-muted)" }}>
                  <div>E-Wallet: <strong style={{ color: "var(--gold)" }}>₱{splitEwalletNum.toFixed(2)}</strong></div>
                  <div>Cash due: <strong style={{ color: "var(--text-primary)" }}>₱{Math.max(0, splitCashNeeded).toFixed(2)}</strong></div>
                </div>
              )}
            </div>
          </div>
        )}

        <button className="btn btn-gold" onClick={handleConfirm} disabled={!canConfirm || (method === "ewallet" && !canConfirmEwallet)}
          style={{ width: "100%", fontSize: 10, padding: 12, borderRadius: 12, marginBottom: 4 }}>
          {splitMode ? `Split (₱${splitEwalletNum.toFixed(0)} GCash + ₱${Math.max(0, splitCashNeeded).toFixed(0)} Cash)` : "Confirm & Place Order ✓"}
        </button>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 8.5, color: "var(--text-faint)", letterSpacing: 1 }}>
            {method === "cash" ? `Change: ${formatCurrency(change)}` : method === "card" ? "Present card" : "Pay via GCash"}
          </span>
        </div>
      </div>
    </div>
  );
};