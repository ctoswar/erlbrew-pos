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
    <div className="flex-1 flex items-center justify-center bg-erl-base p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-erl-accent/[0.02] blur-[120px] pointer-events-none" />

      <div className="animate-scale-in card-glass py-10 px-8 w-full max-w-[500px] rounded-2xl relative">
        {/* Header */}
        <div className="flex items-center gap-4 mb-7">
          <button onClick={onBack} className="btn-ghost text-xs py-2 px-3 text-erl-text-muted rounded-xl hover:bg-white/[0.03] transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div className="font-display text-xl font-bold text-erl-text-primary tracking-wide">
              Order Summary
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="mb-6 max-h-[240px] overflow-y-auto hide-scrollbar">
          {cart.map((ci, idx) => {
            const lineTotal = (ci.item.price + (ci.modifiers || []).reduce((s, m) => s + m.price, 0)) * ci.qty;
            return (
              <div
                key={ci.item.id + "-" + idx}
                className="flex justify-between items-start py-3.5 border-b border-erl-accent/[0.03] last:border-b-0"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{ci.item.emoji}</span>
                    <div className="text-sm text-erl-text-primary font-semibold">
                      {ci.qty}× {ci.item.name}
                    </div>
                  </div>
                  {ci.modifiers && ci.modifiers.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
                      {ci.modifiers.map((m, mi) => (
                        <span key={mi} className="text-[9px] font-medium text-erl-accent-dim bg-erl-accent/[0.05] rounded-lg px-2 py-0.5 border border-erl-accent/10">
                          +{m.name}{m.price > 0 ? ` (${formatCurrency(m.price)})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {ci.notes && (
                    <div className="text-[10px] text-erl-text-faint italic mt-1.5 pl-7">
                      📝 {ci.notes}
                    </div>
                  )}
                </div>
                <div className="text-sm text-erl-accent font-bold whitespace-nowrap tabular-nums">
                  {formatCurrency(lineTotal)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="bg-erl-accent/[0.03] rounded-2xl py-5 px-5 mb-6 border border-erl-accent/[0.06]">
          <div className="flex justify-between text-xs text-erl-text-muted mb-2">
            <span className="font-semibold">Subtotal</span>
            <span className="tabular-nums font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {discount && (
            <div className="flex justify-between text-xs text-erl-success mb-2">
              <span className="font-semibold">{discount.label}</span>
              <span className="tabular-nums font-semibold">−{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="h-px bg-gradient-to-r from-transparent via-erl-border-default to-transparent my-3" />
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-erl-text-secondary tracking-[0.15em] uppercase font-bold">Grand Total</span>
            <span className="font-display text-[30px] font-bold text-erl-accent tracking-tight">{formatCurrency(grand)}</span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex gap-2 mb-6">
          <MetaBox label="Type" value={orderType === "dine-in" ? "Dine In" : "Takeout"} />
          {orderType === "dine-in" && <MetaBox label="Customer" value={customerName || "Dine-in"} />}
          <MetaBox label="Staff" value={staffName.split(" ")[0]} />
          <MetaBox label="Items" value={String(cart.reduce((s, ci) => s + ci.qty, 0))} />
        </div>

        <button
          className="btn btn-accent w-full text-[11px] py-4 rounded-2xl tracking-[0.15em] font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
          onClick={onContinue}
        >
          Select Payment Method →
        </button>
        <div className="text-center mt-3">
          <span className="text-[10px] text-erl-text-faint tracking-wide font-medium">
            {cart.length} item{cart.length !== 1 ? "s" : ""} in this order
          </span>
        </div>
      </div>
    </div>
  );
};

const MetaBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="card-glass flex-1 py-3 px-3 rounded-xl text-center">
    <div className="text-[8px] text-erl-text-muted tracking-[2px] uppercase mb-1.5 font-bold">
      {label}
    </div>
    <div className="text-sm text-erl-accent font-bold tracking-wide">
      {value}
    </div>
  </div>
);