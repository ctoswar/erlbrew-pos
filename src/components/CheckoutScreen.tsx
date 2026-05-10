import React from "react";
import { CartItem, OrderType, Discount } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";

interface Props {
  cart: CartItem[];
  discount: Discount | null;
  orderType: OrderType;
  customerName: string;
  staffName: string;
  onBack: () => void;
  onContinue: () => void;
}

export const CheckoutScreen: React.FC<Props> = ({
  cart,
  discount,
  orderType,
  customerName,
  staffName,
  onBack,
  onContinue,
}) => {
  const subtotal = calcSubtotal(cart);
  const grand = calcGrand(subtotal, discount);
  const discountAmount = discount?.amount ?? 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: "1rem",
      }}
    >
      <div
        className="animate-scaleIn card-glass"
        style={{
          padding: "1.8rem 1.5rem",
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
          <button onClick={onBack} className="btn-ghost" style={{ fontSize: 10, padding: "5px 8px", color: "var(--text-muted)" }}>
            ← Back
          </button>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Order Summary
          </div>
        </div>

        {/* Items List */}
        <div style={{ marginBottom: 14, maxHeight: 200, overflowY: "auto" }} className="hide-scrollbar">
          {cart.map((ci, idx) => {
            const lineTotal = (ci.item.price + (ci.modifiers || []).reduce((s, m) => s + m.price, 0)) * ci.qty;
            return (
              <div
                key={ci.item.id + "-" + idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "7px 0",
                  borderBottom: "1px solid rgba(201,135,58,0.05)",
                }}
              >
                <div style={{ flex: 1, paddingRight: 10 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-primary)", fontWeight: 600 }}>
                    {ci.qty}× {ci.item.name}
                  </div>
                  {ci.modifiers && ci.modifiers.length > 0 && (
                    <div style={{ marginTop: 2, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {ci.modifiers.map((m, mi) => (
                        <span key={mi} style={{ fontSize: 8.5, color: "var(--gold-dim)" }}>
                          +{m.name}{m.price > 0 ? ` (${formatCurrency(m.price)})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {ci.notes && (
                    <div style={{ fontSize: 8.5, color: "var(--text-disabled)", fontStyle: "italic", marginTop: 1 }}>
                      Note: {ci.notes}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(lineTotal)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div style={{ background: "rgba(201,135,58,0.04)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--gold-dim)", marginBottom: 5 }}>
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(subtotal)}</span>
          </div>
          {discount && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--success)", marginBottom: 5 }}>
              <span>{discount.label}</span>
              <span>−{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border-default), transparent)", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>Grand Total</span>
            <span className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(grand)}</span>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <MetaBox label="Type" value={orderType === "dine-in" ? "Dine In" : "Takeout"} />
          {orderType === "dine-in" && <MetaBox label="Customer" value={customerName || "Walk-in"} />}
          <MetaBox label="Staff" value={staffName.split(" ")[0]} />
          <MetaBox label="Items" value={String(cart.reduce((s, ci) => s + ci.qty, 0))} />
        </div>

        <button className="btn btn-gold" onClick={onContinue} style={{ width: "100%", fontSize: 10.5, padding: 12, borderRadius: 12 }}>
          Select Payment Method →
        </button>
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <span style={{ fontSize: 8.5, color: "var(--text-faint)", letterSpacing: 1 }}>
            {cart.length} item{cart.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

const MetaBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    className="card-glass"
    style={{
      flex: 1,
      padding: "8px 10px",
      borderRadius: 10,
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 7.5, color: "var(--gold-dim)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, letterSpacing: 0.5 }}>
      {value}
    </div>
  </div>
);