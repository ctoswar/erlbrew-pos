import React, { useState } from "react";
import { PayMethod } from "../types";
import { formatCurrency, getQuickCashAmounts } from "../utils";

interface Props {
  total: number;
  discountLabel?: string;
  discountAmount?: number;
  onBack: () => void;
  /** Passes back (method, cashTendered) so parent can store in Order.cashTendered */
  onConfirm: (method: PayMethod, cashTendered?: number) => void;
}

export const PaymentScreen: React.FC<Props> = ({ total, discountLabel, discountAmount, onBack, onConfirm }) => {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [cashGiven, setCashGiven] = useState("");

  const cash = parseFloat(cashGiven) || 0;
  const change = cash - total;
  const quickAmounts = getQuickCashAmounts(total);
  const canConfirm = method !== "cash" || (cashGiven !== "" && cash >= total);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div className="animate-fadeInUp card-elevated" style={{ padding: "2rem 1.5rem", width: "100%", maxWidth: 440 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button className="btn btn-outline" onClick={onBack} style={{ fontSize: 11, padding: "7px 12px" }}>← Back</button>
          <div className="font-display" style={{ fontSize: 19, color: "var(--text-primary)" }}>Payment</div>
        </div>

        {/* Amount Due */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Amount Due</div>
          <div className="font-display" style={{ fontSize: 40, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(total)}</div>
          {discountLabel && discountAmount && (
            <div style={{ fontSize: 10, color: "var(--success)", marginTop: 4 }}>
              {discountLabel} (−{formatCurrency(discountAmount)})
            </div>
          )}
        </div>

        {/* Method Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["cash", "card", "ewallet"] as PayMethod[]).map((m) => (
            <button key={m} className={`btn tab ${method === m ? "active-subtle" : ""}`}
              onClick={() => { setMethod(m); setCashGiven(""); }}
              style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 9, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-disabled)" }}>
              {m === "cash" ? "Cash" : m === "card" ? "Card" : "E-Wallet"}
            </button>
          ))}
        </div>

        {/* Cash Panel */}
        {method === "cash" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Cash Tendered
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {quickAmounts.map((amt) => (
                <button key={amt} className="btn" onClick={() => setCashGiven(String(amt))}
                  style={{ background: cashGiven === String(amt) ? "var(--gold)" : "var(--bg-base)", border: `1px solid ${cashGiven === String(amt) ? "var(--gold)" : "var(--border-subtle)"}`, color: cashGiven === String(amt) ? "var(--bg-sidebar)" : "var(--text-muted)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, fontFamily: "'Lato', sans-serif" }}>
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
            <input type="number" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
              placeholder="Or enter amount" style={{ marginBottom: 12 }} />
            {cashGiven && cash >= total && (
              <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: 10, padding: 14, textAlign: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: "var(--success)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Change</div>
                <div className="font-display" style={{ fontSize: 30, fontWeight: 700, color: "var(--success)" }}>{formatCurrency(change)}</div>
              </div>
            )}
            {cashGiven && cash < total && (
              <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--danger)" }}>Short by {formatCurrency(total - cash)}</div>
              </div>
            )}
          </div>
        )}

        {/* Card Panel */}
        {method === "card" && (
          <div style={{ textAlign: "center", padding: "1.5rem 0", marginBottom: 16 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💳</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Present card to the payment terminal.<br />Tap, insert, or swipe.
            </div>
          </div>
        )}

        {/* E-Wallet Panel */}
        {method === "ewallet" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: "var(--bg-base)", borderRadius: 12, padding: "1.5rem", marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>GCash Reference</div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "rgba(201,135,58,0.1)", border: "1px dashed var(--gold)",
                borderRadius: 10, padding: "12px 20px", marginBottom: 12,
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", letterSpacing: 3, fontFamily: "'Lato', sans-serif" }}>
                  0917-123-4567
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText("09171234567")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold-muted)", fontSize: 11, padding: "4px 8px", borderRadius: 4 }}
                  title="Copy number"
                >
                  📋
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Open your GCash app →<br />
                <strong style={{ color: "var(--text-primary)" }}>Pay Bills → Search "Erlbrew"</strong><br />
                Reference: <strong style={{ color: "var(--gold)" }}>#{String(Math.floor(Math.random() * 900000 + 100000))}</strong><br />
                <span style={{ fontSize: 10 }}>Enter amount: {formatCurrency(total)}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Tap <strong style={{ color: "var(--gold)" }}>Confirm & Place Order</strong> once payment is sent
            </div>
          </div>
        )}

        <button className="btn btn-gold" onClick={() => canConfirm && onConfirm(method, method === 'cash' ? cash : undefined)}
          disabled={!canConfirm}
          style={{ width: "100%", fontSize: 11, padding: 13, borderRadius: 10, marginBottom: 6 }}>
          Confirm & Place Order ✓
        </button>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1 }}>
            {method === "cash"
              ? `Change: ${formatCurrency(change)} — keep the receipt`
              : `${method === "card" ? "Present card" : "Reference shown above — pay via GCash"} to pay`}
          </span>
        </div>
      </div>
    </div>
  );
};
