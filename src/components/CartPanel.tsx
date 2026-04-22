import React from "react";
import { CartItem, OrderType } from "../types";
import { formatCurrency, calcSubtotal, calcTax, calcGrand } from "../utils";

interface Props {
  cart: CartItem[];
  orderType: OrderType;
  table: string;
  onUpdateQty: (id: string, delta: number) => void;
  onClearCart: () => void;
  onOrderTypeChange: (t: OrderType) => void;
  onTableChange: (t: string) => void;
  onCheckout: () => void;
}

const TABLES = ["1", "2", "3", "4", "5", "6"];

export const CartPanel: React.FC<Props> = ({
  cart, orderType, table,
  onUpdateQty, onClearCart, onOrderTypeChange, onTableChange, onCheckout,
}) => {
  const subtotal = calcSubtotal(cart);
  const tax = calcTax(subtotal);
  const grand = calcGrand(subtotal);
  const isEmpty = cart.length === 0;

  return (
    <aside style={{ width: 320, background: "var(--bg-sidebar)", borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
          <div className="font-display" style={{ fontSize: 15, color: "var(--text-primary)" }}>Current Order</div>
          {!isEmpty && (
            <button className="btn btn-danger" onClick={onClearCart} style={{ fontSize: 8, padding: "5px 10px" }}>
              Clear All
            </button>
          )}
        </div>

        {/* Order Type */}
        <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
          {(["dine-in", "takeout"] as OrderType[]).map((t) => (
            <button key={t} className={`btn tab ${orderType === t ? "active-subtle" : ""}`}
              onClick={() => onOrderTypeChange(t)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 8, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-disabled)" }}>
              {t === "dine-in" ? "Dine In" : "Takeout"}
            </button>
          ))}
        </div>

        {/* Table Picker */}
        {orderType === "dine-in" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 1 }}>Table:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {TABLES.map((t) => (
                <button key={t} className="btn" onClick={() => onTableChange(t)}
                  style={{ width: 28, height: 28, borderRadius: 6, fontSize: 10, background: table === t ? "var(--gold)" : "transparent", border: `1px solid ${table === t ? "var(--gold)" : "var(--border-subtle)"}`, color: table === t ? "var(--bg-sidebar)" : "var(--text-faint)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.7rem 1.1rem" }}>
        {isEmpty ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-disabled)", fontSize: 11, letterSpacing: 1 }}>
            No items yet
          </div>
        ) : (
          cart.map((ci) => (
            <div key={ci.item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ci.item.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatCurrency(ci.item.price)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <QtyButton onClick={() => onUpdateQty(ci.item.id, -1)} label="−" color="var(--text-secondary)" />
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700, minWidth: 16, textAlign: "center" }}>{ci.qty}</span>
                <QtyButton onClick={() => onUpdateQty(ci.item.id, 1)} label="+" color="var(--gold)" />
              </div>
              <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
                {formatCurrency(ci.item.price * ci.qty)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "1rem 1.1rem", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <TotalRow label="Subtotal"  value={formatCurrency(subtotal)} />
          <TotalRow label="VAT (12%)" value={formatCurrency(tax)} />
          <div className="divider" style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>Total</span>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>{formatCurrency(grand)}</span>
          </div>
        </div>
        <button className="btn btn-gold" onClick={onCheckout} disabled={isEmpty} style={{ width: "100%", fontSize: 10, padding: 13, borderRadius: 10 }}>
          Proceed to Payment →
        </button>
      </div>
    </aside>
  );
};

const QtyButton: React.FC<{ onClick: () => void; label: string; color: string }> = ({ onClick, label, color }) => (
  <button className="btn" onClick={onClick}
    style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg-base)", border: "1px solid var(--border-default)", color, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {label}
  </button>
);

const TotalRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gold-muted)", marginBottom: 5 }}>
    <span>{label}</span><span>{value}</span>
  </div>
);
