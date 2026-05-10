import React from "react";
import { CartItem, OrderType, Discount } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";

interface Props {
  cart: CartItem[];
  discount: Discount | null;
  orderType: OrderType;
  table: string;
  staffName: string;
  onBack: () => void;
  onContinue: () => void;
}

export const CheckoutScreen: React.FC<Props> = ({
  cart,
  discount,
  orderType,
  table,
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
          padding: "2rem 1.5rem",
          width: "100%",
          maxWidth: 480,
          borderRadius: 20,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <button
            onClick={onBack}
            className="btn-ghost"
            style={{ fontSize: 11, padding: "6px 10px", color: "var(--text-muted)" }}
          >
            ← Back
          </button>
          <div
            className="font-display"
            style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}
          >
            Order Summary
          </div>
        </div>

        {/* Items List */}
        <div
          style={{
            marginBottom: 16,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {cart.map((ci, idx) => (
            <div
              key={ci.item.id + "-" + idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "8px 0",
                borderBottom: "1px solid rgba(201,135,58,0.04)",
              }}
            >
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontWeight: 700,
                  }}
                >
                  {ci.qty}× {ci.item.name}
                </div>
                {ci.modifiers && ci.modifiers.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    {ci.modifiers.map((m, mi) => (
                      <span
                        key={mi}
                        style={{
                          fontSize: 9.5,
                          color: "var(--gold-dim)",
                          marginRight: 6,
                        }}
                      >
                        + {m.name}
                        {m.price > 0 ? ` (${formatCurrency(m.price)})` : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--gold-dim)", marginTop: 2 }}>
                  {formatCurrency(ci.item.price)} each
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--gold)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {formatCurrency(
                  (ci.item.price +
                    (ci.modifiers || []).reduce((s, m) => s + m.price, 0)) *
                    ci.qty
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div
          style={{
            background: "rgba(201,135,58,0.04)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--gold-dim)",
              marginBottom: 6,
            }}
          >
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--success)",
                marginBottom: 6,
              }}
            >
              <span>{discount.label}</span>
              <span>−{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--border-default), transparent)",
              marginBottom: 10,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Grand Total
            </span>
            <span
              className="font-display"
              style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)" }}
            >
              {formatCurrency(grand)}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <MetaBox
            label="Type"
            value={orderType === "dine-in" ? "Dine In" : "Takeout"}
          />
          {orderType === "dine-in" && <MetaBox label="Table" value={`Table ${table}`} />}
          <MetaBox label="Staff" value={staffName.split(" ")[0]} />
          <MetaBox
            label="Items"
            value={String(cart.reduce((s, ci) => s + ci.qty, 0))}
          />
        </div>

        <button
          className="btn btn-gold"
          onClick={onContinue}
          style={{ width: "100%", fontSize: 11, padding: 13, borderRadius: 12 }}
        >
          Select Payment Method →
        </button>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: "var(--text-faint)",
              letterSpacing: 1,
            }}
          >
            {cart.length} item{cart.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

const MetaBox: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div
    className="card-glass"
    style={{
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontSize: 8,
        color: "var(--gold-dim)",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 3,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 12,
        color: "var(--gold)",
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      {value}
    </div>
  </div>
);