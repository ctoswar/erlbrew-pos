import React from "react";
import { CartItem, OrderType } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";

interface Props {
  cart: CartItem[];
  orderType: OrderType;
  table: string;
  staffName: string;
  onBack: () => void;
  onContinue: () => void;
}

export const CheckoutScreen: React.FC<Props> = ({
  cart, orderType, table, staffName, onBack, onContinue,
}) => {
  const subtotal = calcSubtotal(cart);
  const grand = calcGrand(subtotal);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div className="animate-fadeInUp card-elevated" style={{ padding: "2.5rem", width: 480 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button className="btn btn-outline" onClick={onBack} style={{ fontSize: 11, padding: "7px 12px" }}>← Back</button>
          <div className="font-display" style={{ fontSize: 19, color: "var(--text-primary)" }}>Order Summary</div>
        </div>

        {/* Items List */}
        <div style={{ background: "var(--bg-base)", borderRadius: 10, padding: 14, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
          {cart.map((ci) => (
            <div key={ci.item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>
                  {ci.qty}× {ci.item.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--gold-muted)" }}>{formatCurrency(ci.item.price)} each</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>
                {formatCurrency(ci.item.price * ci.qty)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ background: "var(--bg-base)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gold-muted)", marginBottom: 6 }}>
          <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="divider" style={{ marginBottom: 10 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>Grand Total</span>
            <span className="font-display" style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(grand)}</span>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <MetaBox label="Type" value={orderType === "dine-in" ? "Dine In" : "Takeout"} />
          {orderType === "dine-in" && <MetaBox label="Table" value={`Table ${table}`} />}
          <MetaBox label="Staff" value={staffName.split(" ")[0]} />
          <MetaBox label="Items" value={String(cart.reduce((s, ci) => s + ci.qty, 0))} />
        </div>

        <button className="btn btn-gold" onClick={onContinue} style={{ width: "100%", fontSize: 11, padding: 13, borderRadius: 10 }}>
          Select Payment Method →
        </button>
      </div>
    </div>
  );
};

const MetaBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: 1, background: "var(--bg-base)", borderRadius: 8, padding: 10, textAlign: "center" }}>
    <div style={{ fontSize: 8, color: "var(--gold-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700, letterSpacing: 0.5 }}>{value}</div>
  </div>
);
