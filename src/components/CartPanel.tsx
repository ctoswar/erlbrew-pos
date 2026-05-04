import React from "react";
import { CartItem, OrderType, Discount } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";

interface Props {
  cart: CartItem[];
  discount: Discount | null;
  orderType: OrderType;
  table: string;
  onUpdateQty: (id: string, delta: number) => void;
  onClearCart: () => void;
  onOrderTypeChange: (t: OrderType) => void;
  onTableChange: (t: string) => void;
  onCheckout: () => void;
  onOpenDiscount: () => void;
  onRemoveDiscount: () => void;
}

const TABLES = ["1", "2", "3", "4", "5", "6"];

export const CartPanel: React.FC<Props> = ({
  cart, discount, orderType, table,
  onUpdateQty, onClearCart, onOrderTypeChange, onTableChange, onCheckout,
  onOpenDiscount, onRemoveDiscount,
}) => {
  const subtotal = calcSubtotal(cart);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = cart.length === 0;

  return (
    <aside style={{
      width: "100%",
      background: "var(--bg-sidebar)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "1rem 1.2rem 0.9rem",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            Current Order
          </span>
          {!isEmpty && (
            <button
              onClick={onClearCart}
              style={{
                background: "transparent",
                border: "1px solid var(--danger-border)",
                borderRadius: 8,
                color: "var(--danger)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "5px 12px",
                cursor: "pointer",
                textTransform: "uppercase" as const,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Order Type Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: orderType === "dine-in" ? 10 : 0 }}>
          {(["dine-in", "takeout"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => onOrderTypeChange(t)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 9,
                border: `1.5px solid ${orderType === t ? "var(--gold)" : "var(--border-default)"}`,
                background: orderType === t ? "rgba(201,135,58,0.12)" : "transparent",
                color: orderType === t ? "var(--gold)" : "var(--text-secondary)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase" as const,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t === "dine-in" ? "Dine In" : "Takeout"}
            </button>
          ))}
        </div>

        {/* Table Picker — only for dine-in */}
        {orderType === "dine-in" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" as const }}>
              Table
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {TABLES.map((t) => (
                <button
                  key={t}
                  onClick={() => onTableChange(t)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: table === t ? "var(--gold)" : "var(--bg-elevated)",
                    border: `1.5px solid ${table === t ? "var(--gold)" : "var(--border-default)"}`,
                    color: table === t ? "var(--bg-sidebar)" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Items List ── */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.5rem 0", overflowY: "auto", minHeight: 0 }}>
        {isEmpty ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "3rem 1rem",
            gap: 10,
          }}>
            <span style={{ fontSize: 32 }}>🛒</span>
            <span style={{ fontSize: 11, color: "var(--text-disabled)", letterSpacing: 1 }}>
              No items yet
            </span>
            <span style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: 0.5, textAlign: "center" }}>
              Tap menu items to add them here
            </span>
          </div>
        ) : (
          cart.map((ci) => (
            <CartItemRow
              key={ci.item.id}
              item={ci.item}
              qty={ci.qty}
              onUpdateQty={(delta) => onUpdateQty(ci.item.id, delta)}
            />
          ))
        )}
      </div>

      {/* ── Footer — Totals + Checkout ── */}
      <div style={{
        padding: "0.9rem 1.2rem 1rem",
        borderTop: "1.5px solid var(--border-default)",
        flexShrink: 0,
        background: "var(--bg-surface)",
      }}>
        <div style={{ marginBottom: 10 }}>
          <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
          {discount && (
            <TotalRow
              label={discount.label}
              value={`−${formatCurrency(discount.amount)}`}
              valueColor="var(--success)"
              onRemove={onRemoveDiscount}
            />
          )}
          <div style={{ height: 1, background: "var(--border-default)", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" as const }}>
              Total
            </span>
            <span className="font-display" style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
              {formatCurrency(grand)}
            </span>
          </div>
        </div>

        {/* Discount button */}
        <button
          onClick={onOpenDiscount}
          style={{
            width: "100%", marginBottom: 8,
            padding: "8px 0", borderRadius: 9,
            background: discount ? "rgba(122,201,122,0.1)" : "rgba(201,135,58,0.1)",
            border: `1.5px solid ${discount ? "var(--success)" : "var(--border-default)"}`,
            color: discount ? "var(--success)" : "var(--text-muted)",
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
            cursor: "pointer", textTransform: "uppercase" as const,
          }}
        >
          {discount ? `✓ ${discount.label}` : "+ Add Discount"}
        </button>

        <button
          className="btn btn-gold"
          onClick={onCheckout}
          disabled={isEmpty}
          style={{
            width: "100%",
            fontSize: 10.5,
            padding: "14px 0",
            borderRadius: 12,
            letterSpacing: 1.5,
            fontWeight: 700,
            opacity: isEmpty ? 0.3 : 1,
          }}
        >
          Proceed to Checkout →
        </button>
      </div>
    </aside>
  );
};

// ── Cart Item Row ─────────────────────────────────────────────────────────────

interface CartItemRowProps {
  item: CartItem["item"];
  qty: number;
  onUpdateQty: (delta: number) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, qty, onUpdateQty }) => {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 1.2rem",
      borderBottom: "1px solid var(--border-subtle)",
      transition: "background 0.1s",
    }}>
      {/* Emoji */}
      <span style={{ fontSize: 20, flexShrink: 0 }}>{item.emoji}</span>

      {/* Name + price */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
          marginBottom: 2,
        }}>
          {item.name}
        </div>
        <div style={{ fontSize: 10, color: "var(--gold-muted)" }}>
          {formatCurrency(item.price)} each
        </div>
      </div>

      {/* Qty controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => onUpdateQty(-1)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          −
        </button>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          minWidth: 18,
          textAlign: "center",
        }}>
          {qty}
        </span>
        <button
          onClick={() => onUpdateQty(1)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--gold)",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          +
        </button>
      </div>

      {/* Line total */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--gold)",
        minWidth: 52,
        textAlign: "right",
      }}>
        {formatCurrency(item.price * qty)}
      </div>
    </div>
  );
};

// ── Total Row ─────────────────────────────────────────────────────────────────

const TotalRow: React.FC<{ label: string; value: string; valueColor?: string; onRemove?: () => void }> = ({ label, value, valueColor, onRemove }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "var(--gold-dim)",
    marginBottom: 5,
    letterSpacing: 0.5,
    alignItems: "center",
  }}>
    <span>{label}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: valueColor || "inherit" }}>{value}</span>
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 10, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
      )}
    </div>
  </div>
);