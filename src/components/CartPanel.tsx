import React, { useState, useRef, useEffect } from "react";
import { CartItem, OrderType, Discount, CartItemModifier } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";

function cartItemKey(ci: CartItem): string {
  const modKey = (ci.modifiers || []).map((m) => m.name).sort().join("|");
  return modKey ? `${ci.item.id}::${modKey}` : ci.item.id;
}

interface Props {
  cart: CartItem[];
  discount: Discount | null;
  orderType: OrderType;
  customerName: string;
  onUpdateQty: (id: string, delta: number, modifiers?: CartItemModifier[]) => void;
  onClearCart: () => void;
  onOrderTypeChange: (t: OrderType) => void;
  onCustomerNameChange: (name: string) => void;
  onCheckout: () => void;
  onOpenDiscount: () => void;
  onRemoveDiscount: () => void;
  onAddNote: (id: string, notes: string, modifiers?: CartItemModifier[]) => void;
}

export const CartPanel: React.FC<Props> = ({
  cart,
  discount,
  orderType,
  customerName,
  onUpdateQty,
  onClearCart,
  onOrderTypeChange,
  onCustomerNameChange,
  onCheckout,
  onOpenDiscount,
  onRemoveDiscount,
  onAddNote,
}) => {
  const subtotal = calcSubtotal(cart);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = cart.length === 0;

  return (
    <aside
      className="glass-panel"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderLeft: "1px solid rgba(201,135,58,0.08)",
        borderRight: "none",
        borderTop: "none",
        borderBottom: "none",
        borderRadius: 0,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "1rem 1.2rem 0.9rem",
          borderBottom: "1px solid rgba(201,135,58,0.08)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            className="font-display"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}
          >
            Current Order
          </span>
          {!isEmpty && (
            <button onClick={onClearCart} className="btn-ghost" style={{ color: "var(--danger)", fontSize: 9 }}>
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
                padding: "7px 0",
                borderRadius: 8,
                border: `1.5px solid ${orderType === t ? "var(--gold)" : "var(--border-default)"}`,
                background:
                  orderType === t ? "rgba(201,135,58,0.12)" : "transparent",
                color: orderType === t ? "var(--gold)" : "var(--text-secondary)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s var(--ease-out)",
              }}
            >
              {t === "dine-in" ? "Dine In" : "Takeout"}
            </button>
          ))}
        </div>

        {/* Customer Name */}
        {orderType === "dine-in" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 9,
                color: "var(--text-muted)",
                letterSpacing: 1.5,
                fontWeight: 700,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Name
            </span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Customer name…"
              style={{
                flex: 1,
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1.5px solid var(--border-default)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Items List ── */}
      <div
        className="scroll-area"
        style={{
          flex: 1,
          padding: "0.5rem 0",
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        {isEmpty ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "3rem 1rem",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 36, opacity: 0.5 }}>&#x1F6D2;</span>
            <span
              style={{ fontSize: 11, color: "var(--text-disabled)", letterSpacing: 1 }}
            >
              No items yet
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-faint)",
                letterSpacing: 0.5,
                textAlign: "center",
              }}
            >
              Tap menu items to add them here
            </span>
          </div>
        ) : (
          cart.map((ci) => (
            <CartItemRow
              key={cartItemKey(ci)}
              item={ci.item}
              qty={ci.qty}
              notes={ci.notes}
              modifiers={ci.modifiers}
              onUpdateQty={(delta) => onUpdateQty(ci.item.id, delta, ci.modifiers)}
              onAddNote={(notes) => onAddNote(ci.item.id, notes, ci.modifiers)}
            />
          ))
        )}
      </div>

      {/* ── Footer — Totals + Checkout ── */}
      <div
        style={{
          padding: "0.9rem 1.2rem 1rem",
          borderTop: "1px solid rgba(201,135,58,0.08)",
          flexShrink: 0,
        }}
      >
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
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, var(--border-default), transparent)",
              margin: "8px 0",
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
                fontSize: 10,
                color: "var(--text-secondary)",
                letterSpacing: 1.5,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span
              className="font-display"
              style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}
            >
              {formatCurrency(grand)}
            </span>
          </div>
        </div>

        {/* Discount button */}
        <button
          onClick={onOpenDiscount}
          className="btn-ghost"
          style={{
            width: "100%",
            marginBottom: 8,
            padding: "8px 0",
            borderRadius: 9,
            background: discount
              ? "rgba(122,201,122,0.08)"
              : "rgba(201,135,58,0.06)",
            border: `1.5px solid ${
              discount ? "var(--success)" : "var(--border-default)"
            }`,
            color: discount ? "var(--success)" : "var(--text-muted)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
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

/* ── Cart Item Row ────────────────────────────────────────────────────────── */

interface CartItemRowProps {
  item: CartItem["item"];
  qty: number;
  notes?: string;
  modifiers?: CartItemModifier[];
  onUpdateQty: (delta: number) => void;
  onAddNote: (notes: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  qty,
  notes,
  modifiers,
  onUpdateQty,
  onAddNote,
}) => {
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(notes || "");
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNote) noteRef.current?.focus();
  }, [showNote]);

  const saveNote = () => {
    onAddNote(noteText);
    setShowNote(false);
  };

  const modPrice = (modifiers || []).reduce((s, m) => s + m.price, 0);
  const linePrice = (item.price + modPrice) * qty;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 1rem",
        borderBottom: "1px solid rgba(201,135,58,0.06)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,135,58,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Left: item info */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Name row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{item.emoji}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
              {formatCurrency(item.price)} each
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--gold)",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(linePrice)}
          </div>
        </div>

        {/* Modifiers */}
        {modifiers && modifiers.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, paddingLeft: 24 }}>
            {modifiers.map((m, i) => (
              <span
                key={i}
                style={{
                  fontSize: 8.5,
                  fontWeight: 500,
                  color: "var(--gold-dim)",
                  background: "rgba(201,135,58,0.07)",
                  border: "1px solid rgba(201,135,58,0.15)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {m.name}
                {m.price > 0 ? ` +${formatCurrency(m.price)}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Note section */}
        {showNote ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center", paddingLeft: 24 }}>
            <input
              ref={noteRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
                if (e.key === "Escape") {
                  setShowNote(false);
                  setNoteText(notes || "");
                }
              }}
              placeholder="Add a note…"
              style={{
                flex: 1,
                fontSize: 10,
                padding: "5px 9px",
                borderRadius: 7,
                border: "1px solid var(--border-medium)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-medium)")}
            />
            <button
              onClick={saveNote}
              style={{
                background: "var(--gold)",
                color: "var(--bg-sidebar)",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 9,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: 0.5,
                transition: "opacity 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowNote(false);
                setNoteText(notes || "");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 5px",
                lineHeight: 1,
                borderRadius: 4,
                transition: "color 0.12s, background 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "rgba(201,135,58,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              &#x2715;
            </button>
          </div>
        ) : notes ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingLeft: 24,
              cursor: "pointer",
            }}
            onClick={() => setShowNote(true)}
          >
            <span
              style={{
                fontSize: 9.5,
                color: "var(--gold-dim)",
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              📝 {notes}
            </span>
            <span
              style={{
                fontSize: 8,
                color: "var(--text-faint)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                whiteSpace: "nowrap",
              }}
            >
              edit
            </span>
          </div>
        ) : (
          <button
            onClick={() => setShowNote(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-faint)",
              fontSize: 8.5,
              cursor: "pointer",
              padding: "0 0 0 24px",
              textAlign: "left",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold-dim)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
          >
            + note
          </button>
        )}
      </div>

      {/* Right: vertical qty stepper */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => onUpdateQty(1)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--gold)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.12s var(--ease-out)",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--gold)";
            e.currentTarget.style.color = "var(--bg-sidebar)";
            e.currentTarget.style.borderColor = "var(--gold)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--gold)";
            e.currentTarget.style.borderColor = "var(--border-default)";
          }}
        >
          +
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            minWidth: 18,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {qty}
        </span>
        <button
          onClick={() => onUpdateQty(-1)}
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: qty <= 1 ? "var(--bg-base)" : "var(--bg-elevated)",
            border: `1px solid ${qty <= 1 ? "var(--border-subtle)" : "var(--border-default)"}`,
            color: qty <= 1 ? "var(--text-faint)" : "var(--text-secondary)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: qty <= 1 ? "default" : "pointer",
            transition: "all 0.12s var(--ease-out)",
            lineHeight: 1,
            opacity: qty <= 1 ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (qty > 1) {
              e.currentTarget.style.background = "var(--danger)";
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.borderColor = "var(--danger)";
            }
          }}
          onMouseLeave={(e) => {
            if (qty > 1) {
              e.currentTarget.style.background = "var(--bg-elevated)";
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }
          }}
        >
          −
        </button>
      </div>
    </div>
  );
};

/* ── Total Row ────────────────────────────────────────────────────────────── */

const TotalRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  onRemove?: () => void;
}> = ({ label, value, valueColor, onRemove }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: 11,
      color: "var(--gold-dim)",
      marginBottom: 5,
      letterSpacing: 0.5,
      alignItems: "center",
    }}
  >
    <span>{label}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: valueColor || "inherit" }}>{value}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            color: "var(--danger)",
            fontSize: 10,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
          }}
        >
          &#x2715;
        </button>
      )}
    </div>
  </div>
);