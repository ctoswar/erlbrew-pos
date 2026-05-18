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
  splitMode?: boolean;
  splitSelections?: Set<string>;
  onToggleSplitItem?: (key: string) => void;
  onStartSplit?: () => void;
  onCancelSplit?: () => void;
  onSplitConfirm?: (selectedKeys: string[]) => void;
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
  splitMode = false,
  splitSelections,
  onToggleSplitItem,
  onStartSplit,
  onCancelSplit,
  onSplitConfirm,
}) => {
  const subtotal = calcSubtotal(cart);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = cart.length === 0;
  const canCheckout = !isEmpty && (orderType !== "takeout" || customerName.trim().length > 0);

  return (
    <aside className="glass-panel w-full flex flex-col h-full border-l border-erl-accent/[0.06] rounded-none">
      {/* Header */}
      <div className="px-4 md:px-5 lg:px-6 pt-3 pb-2 border-b border-erl-accent/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-erl-accent/10 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <span className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
              Order
            </span>
          </div>
          {!isEmpty && (
            <button onClick={onClearCart} className="text-[11px] md:text-[9px] text-erl-danger font-semibold tracking-wide uppercase hover:opacity-80 transition-opacity px-3 py-2 md:px-2 md:py-1 rounded-lg hover:bg-erl-danger/5 min-h-[44px] md:min-h-0 flex items-center">
              Clear All
            </button>
          )}
        </div>

        {/* Split Mode */}
        {!isEmpty && onStartSplit && (
          <div className="mb-2">
            {splitMode ? (
              <button
                onClick={onCancelSplit}
                className="w-full py-2.5 md:py-1.5 rounded-lg border border-erl-danger/30 bg-erl-danger/5 text-erl-danger text-[11px] md:text-[9px] font-bold cursor-pointer tracking-[0.1em] uppercase transition-colors hover:bg-erl-danger/10 min-h-[44px] md:min-h-0 flex items-center justify-center"
              >
                Cancel Split
              </button>
            ) : (
              <button
                onClick={onStartSplit}
                className="w-full py-2.5 md:py-1.5 rounded-lg border border-dashed border-erl-border-medium bg-transparent text-erl-text-muted text-[11px] md:text-[9px] font-bold cursor-pointer tracking-[0.1em] uppercase transition-all hover:border-erl-border-strong hover:text-erl-text-secondary hover:bg-erl-accent/[0.02] min-h-[44px] md:min-h-0 flex items-center justify-center"
              >
                + Split Order
              </button>
            )}
          </div>
        )}

        {/* Order Type Tabs */}
        <div className="flex gap-2 md:gap-1.5 mb-2">
          {(["dine-in", "takeout"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => onOrderTypeChange(t)}
              className={`
                flex-1 md:flex-none px-3 py-2.5 md:py-1 rounded-md text-[11px] md:text-[9px] font-bold tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center
                ${
                  orderType === t
                    ? "bg-erl-accent/15 text-erl-accent"
                    : "text-erl-text-muted hover:text-erl-text-secondary"
                }
              `}
            >
              {t === "dine-in" ? "Dine In" : "Takeout"}
            </button>
          ))}
        </div>

        {/* Customer Name */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] md:text-[9px] text-erl-text-muted tracking-[0.12em] uppercase font-bold whitespace-nowrap">
            {orderType === "takeout" ? "Name *" : "Name"}
          </span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder={orderType === "takeout" ? "Required" : "Name…"}
            className={`
              flex-1 rounded outline-none transition-all duration-200
              bg-erl-input text-erl-text-primary border px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs
              ${orderType === "takeout" && !customerName.trim()
                ? "border-erl-danger"
                : "border-transparent focus:border-erl-accent/30"
              }
            `}
          />
        </div>
        {orderType === "takeout" && !customerName.trim() && (
          <div className="text-[11px] md:text-[9px] text-erl-danger mt-1 tracking-wide font-semibold">
            Name required for takeout orders
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="scroll-area flex-1 py-2 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 md:px-5 lg:px-6 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-erl-accent/[0.04] border border-erl-accent/[0.08] flex items-center justify-center">
              <span className="text-3xl opacity-30">🛒</span>
            </div>
            <span className="text-sm text-erl-text-disabled tracking-wide font-medium">
              No items yet
            </span>
            <span className="text-xs text-erl-text-faint tracking-wide text-center max-w-[180px] md:max-w-[200px] lg:max-w-[220px] leading-relaxed">
              Tap menu items to add them to this order
            </span>
          </div>
        ) : (
          <>
            {splitMode && (
              <div className="px-4 md:px-5 lg:px-6 pb-2 pt-1 text-[10px] text-erl-text-muted tracking-wide font-semibold">
                Select items to move to a separate order
              </div>
            )}
            {cart.map((ci) => {
              const key = cartItemKey(ci);
              const isSelected = splitSelections?.has(key) ?? false;
              return splitMode ? (
                <div
                  key={key}
                  onClick={() => onToggleSplitItem?.(key)}
                  className={`
                    flex items-center gap-3 px-4 md:px-5 lg:px-6 py-3 md:py-3.5 border-b border-erl-accent/[0.03] cursor-pointer transition-all duration-200
                    ${isSelected ? "bg-erl-accent/[0.04]" : "bg-transparent hover:bg-erl-accent/[0.02]"}
                  `}
                >
                  <div className={`
                    w-6 h-6 md:w-5 md:h-5 rounded-lg flex-shrink-0 flex items-center justify-center text-xs md:text-[11px] font-bold transition-all duration-200
                    ${isSelected ? "bg-erl-accent text-erl-base" : "bg-transparent border-2 border-erl-border-medium"}
                  `}>
                    {isSelected ? "✓" : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-erl-text-primary truncate">
                      {ci.qty}× {ci.item.name}
                    </div>
                    <div className="text-xs md:text-[10px] text-erl-text-muted mt-0.5">
                      {formatCurrency(ci.item.price)} each
                    </div>
                  </div>
                  <div className="text-sm font-bold text-erl-accent tabular-nums">
                    {formatCurrency((ci.item.price + (ci.modifiers || []).reduce((s, m) => s + m.price, 0)) * ci.qty)}
                  </div>
                </div>
              ) : (
                <CartItemRow
                  key={key}
                  item={ci.item}
                  qty={ci.qty}
                  notes={ci.notes}
                  modifiers={ci.modifiers}
                  onUpdateQty={(delta) => onUpdateQty(ci.item.id, delta, ci.modifiers)}
                  onAddNote={(notes) => onAddNote(ci.item.id, notes, ci.modifiers)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Footer — Totals + Checkout */}
      <div className="px-4 md:px-5 lg:px-6 pt-4 md:pt-5 pb-4 md:pb-6 border-t border-erl-accent/[0.06] flex-shrink-0">
        <div className="mb-4">
          <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
          {discount && (
            <TotalRow
              label={discount.label}
              value={`−${formatCurrency(discount.amount)}`}
              valueColor="text-erl-success"
              onRemove={onRemoveDiscount}
            />
          )}
          <div className="h-px bg-gradient-to-r from-transparent via-erl-border-default to-transparent my-3" />
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-erl-text-secondary tracking-[0.15em] uppercase font-bold">
              Total
            </span>
            <span className="font-display text-[24px] md:text-[28px] font-bold text-erl-accent tracking-tight">
              {formatCurrency(grand)}
            </span>
          </div>
        </div>

        {/* Split confirm */}
        {splitMode && onSplitConfirm && (
          <button
            onClick={() => {
              const selected = cart.filter((ci) => splitSelections?.has(cartItemKey(ci)));
              if (!selected.length) return;
              onSplitConfirm(Array.from(splitSelections || []));
            }}
            disabled={!splitSelections?.size}
            className={`
              w-full py-3 rounded-xl mb-3 text-[11px] md:text-[10px] font-bold tracking-[0.12em] uppercase transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center
              ${splitSelections?.size
                ? "bg-erl-accent/8 border-2 border-erl-accent/30 text-erl-accent cursor-pointer hover:bg-erl-accent/12"
                : "bg-transparent border-2 border-erl-border-subtle text-erl-text-disabled cursor-default"
              }
            `}
          >
            Move {splitSelections?.size || 0} Item{splitSelections?.size !== 1 ? 's' : ''} to New Order
          </button>
        )}

        {/* Discount button */}
        <button
          onClick={onOpenDiscount}
          className={`
            w-full mb-3 py-3 rounded-xl text-[11px] md:text-[10px] font-bold tracking-[0.12em] uppercase transition-all duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center
            ${discount
              ? "bg-erl-success/5 border-2 border-erl-success/20 text-erl-success hover:bg-erl-success/10"
              : "bg-erl-accent/[0.03] border-2 border-erl-border-default text-erl-text-muted hover:border-erl-border-medium hover:text-erl-text-secondary"
            }
          `}
        >
          {discount ? `✓ ${discount.label}` : "+ Add Discount"}
        </button>

        <button
          className={`
            btn w-full text-xs md:text-[11px] py-4 rounded-2xl tracking-[0.15em] font-bold
            transition-all duration-300 ease-out
            ${canCheckout
              ? "bg-erl-accent text-erl-base shadow-[0_4px_20px_rgba(196,149,106,0.3),0_0_0_1px_rgba(196,149,106,0.15)] hover:bg-erl-accent-light hover:shadow-[0_6px_28px_rgba(196,149,106,0.4),0_0_0_1px_rgba(196,149,106,0.25)] hover:-translate-y-0.5 active:translate-y-0"
              : "bg-erl-border-default text-erl-text-disabled cursor-not-allowed"
            }
          `}
          onClick={onCheckout}
          disabled={!canCheckout}
        >
          {canCheckout ? "Proceed to Checkout →" : "Add Items to Checkout"}
        </button>
      </div>
    </aside>
  );
};

/* Cart Item Row */

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
    <div className="flex gap-3 px-4 md:px-5 lg:px-6 py-3 md:py-3.5 border-b border-erl-accent/[0.03] transition-all duration-200 ease-out hover:bg-erl-accent/[0.015] group">
      {/* Left: item info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Name row */}
        <div className="flex items-baseline gap-2.5">
          <span className="text-base md:text-lg flex-shrink-0">{item.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm md:text-[13px] font-semibold text-erl-text-primary truncate">
              {item.name}
            </div>
            <div className="text-xs md:text-[10px] text-erl-text-muted mt-0.5">
              {formatCurrency(item.price)} each
            </div>
          </div>
          <div className="text-sm md:text-[14px] font-bold text-erl-accent whitespace-nowrap tabular-nums">
            {formatCurrency(linePrice)}
          </div>
        </div>

        {/* Modifiers */}
        {modifiers && modifiers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-7 mt-0.5">
            {modifiers.map((m, i) => (
              <span
                key={i}
                className="text-[10px] md:text-[9px] font-medium text-erl-accent-dim bg-erl-accent/[0.05] border border-erl-accent/10 rounded-lg px-1.5 py-1 md:px-2 md:py-0.5"
              >
                {m.name}{m.price > 0 ? ` +${formatCurrency(m.price)}` : ""}
              </span>
            ))}
          </div>
        )}

        {/* Note */}
        {showNote ? (
          <div className="flex gap-2 items-center pl-7 mt-1">
            <input
              ref={noteRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
                if (e.key === "Escape") { setShowNote(false); setNoteText(notes || ""); }
              }}
              placeholder="Add a note…"
              className="flex-1 text-xs md:text-[11px] py-2 md:py-1.5 px-3 rounded-lg bg-erl-base border border-erl-border-medium text-erl-text-primary outline-none focus:border-erl-accent transition-colors"
            />
            <button onClick={saveNote} className="bg-erl-accent text-erl-base border-none rounded-lg px-3 py-2 md:py-1.5 text-xs md:text-[10px] font-semibold cursor-pointer hover:opacity-90 transition-opacity min-h-[44px] md:min-h-0 flex items-center">
              Save
            </button>
            <button onClick={() => { setShowNote(false); setNoteText(notes || ""); }} className="bg-none border-none text-erl-text-muted text-base md:text-sm cursor-pointer px-2 md:px-1 rounded-lg hover:text-erl-text-primary hover:bg-erl-accent/[0.06] transition-colors min-h-[44px] md:min-h-0 flex items-center">
              ✕
            </button>
          </div>
        ) : notes ? (
          <div className="flex items-center gap-1.5 pl-7 mt-0.5 cursor-pointer" onClick={() => setShowNote(true)}>
            <span className="text-xs md:text-[10px] text-erl-accent-dim italic truncate">📝 {notes}</span>
            <span className="text-xs md:text-[9px] text-erl-text-faint underline underline-offset-2 whitespace-nowrap">edit</span>
          </div>
        ) : (
          <button onClick={() => setShowNote(true)} className="text-xs md:text-[9px] text-erl-text-faint pl-7 mt-0.5 text-left hover:text-erl-accent-dim transition-colors min-h-[44px] md:min-h-0 flex items-center">
            + note
          </button>
        )}
      </div>

      {/* Right: qty stepper */}
      <div className="flex flex-col items-center gap-1.5 justify-center">
        <button
          onClick={() => onUpdateQty(1)}
          className="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-erl-elevated border border-erl-border-default text-erl-accent text-base md:text-sm flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-erl-accent hover:text-erl-base hover:border-erl-accent hover:shadow-md active:scale-95"
        >
          +
        </button>
        <span className="text-base md:text-sm font-bold text-erl-text-primary min-w-6 md:min-w-5 text-center tabular-nums">
          {qty}
        </span>
        <button
          onClick={() => onUpdateQty(-1)}
          className={`
            w-9 h-9 md:w-8 md:h-8 rounded-xl text-base md:text-sm flex items-center justify-center transition-all duration-150 active:scale-95
            ${qty <= 1
              ? "bg-erl-base border border-erl-border-subtle text-erl-text-faint opacity-40"
              : "bg-erl-elevated border border-erl-border-default text-erl-text-secondary cursor-pointer hover:bg-erl-danger hover:text-white hover:border-erl-danger"
            }
          `}
        >
          −
        </button>
      </div>
    </div>
  );
};

/* Total Row */

const TotalRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  onRemove?: () => void;
}> = ({ label, value, valueColor, onRemove }) => (
  <div className="flex justify-between text-xs text-erl-accent-dim mb-1.5 tracking-wide items-center">
    <span className="font-semibold">{label}</span>
    <div className="flex items-center gap-2">
      <span className={valueColor || ""}>{value}</span>
      {onRemove && (
        <button onClick={onRemove} className="text-erl-danger text-xs px-2 py-1 md:px-0.5 md:py-0 hover:opacity-70 transition-opacity min-h-[44px] md:min-h-0 flex items-center">✕</button>
      )}
    </div>
  </div>
);
