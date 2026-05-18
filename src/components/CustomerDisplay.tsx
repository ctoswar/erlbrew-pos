import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CartItem, OrderType } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";
import { useCart } from "../hooks/useCart";
import { apiGet } from "../utils/api";

const CART_KEY = "erlbrew_cart";
const POLL_INTERVAL = 3000;

interface DisplayCart {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
}

function readCart(): DisplayCart {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], orderType: "dine-in" as OrderType, customerName: "" };
    const cart: CartItem[] = JSON.parse(raw);
    const metaRaw = localStorage.getItem("erlbrew_cart_meta");
    const meta = metaRaw ? JSON.parse(metaRaw) : { orderType: "dine-in", customerName: "" };
    return { items: cart, orderType: meta.orderType || "dine-in", customerName: meta.customerName || "" };
  } catch {
    return { items: [], orderType: "dine-in", customerName: "" };
  }
}

export const CustomerDisplay: React.FC = () => {
  const [cart, setCart] = useState<DisplayCart>(() => readCart());
  const [categories, setCategories] = useState<string[]>([]);
  
  const [fadeKey, setFadeKey] = useState(0);

  // Fetch categories from menu API
  useEffect(() => {
    apiGet<any[]>("/menu")
      .then((data) => {
        const cats = [...new Set(data.map((d: any) => d.category).filter(Boolean))] as string[];
        cats.sort((a, b) => a.localeCompare(b));
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const reload = useCallback(() => {
    setCart(readCart());
    setFadeKey((k) => k + 1);
  }, []);

  // Pull discount from centralized cart store (do not rely on local readCart for discount)
  const { discount } = useCart();

  // Listen for cross-tab storage events (POS updating cart)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CART_KEY || e.key === "erlbrew_cart_meta" || e.key === "erlbrew_cart_version") reload();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [reload]);

  // Fallback polling every 3s (handles same-tab updates and edge cases)
  // Only restart polling if cart length (number of items) changes to avoid unnecessary reloads
  const pollTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(reload, POLL_INTERVAL);
    // remember last length to help debug/logging if needed
  }, [cart.items.length]);

  const { items, orderType, customerName } = cart;
  const subtotal = calcSubtotal(items);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = items.length === 0;

  const orderLabel = orderType === "dine-in" ? (customerName || "Dine-in") : "Takeout";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0600] via-[#1e0e06] to-[#0d0600] text-[#f5e6d0] font-sans flex flex-col">
      {/* Header */}
      <div className="px-12 pt-7 pb-5 border-b border-erl-accent/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-4xl">☕</span>
          <div>
            <div className="font-display text-[26px] font-bold text-erl-accent tracking-wide">
              ERLBREW CAFÉ
            </div>
            <div className="text-[11px] text-[#f5e6d0]/50 tracking-widest uppercase mt-0.5">
              Customer Display
            </div>
          </div>
        </div>
        {!isEmpty && (
          <div className="bg-erl-accent/15 border-[1.5px] border-erl-accent/40 rounded-xl px-5 py-2.5 text-center">
            <div className="text-[9px] tracking-widest text-[#f5e6d0]/50 uppercase mb-1">Order Type</div>
            <div className="text-[15px] font-bold text-erl-accent">
              {orderLabel}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-12">
        {isEmpty ? (
          /* Empty state */
          <div key={"empty-" + fadeKey} className="text-center animate-fade-in">
            <div className="text-8xl mb-6">🛒</div>
            <div className="font-display text-4xl text-erl-accent mb-3">
              Welcome!
            </div>
            <div className="text-lg text-[#f5e6d0]/55 leading-relaxed max-w-[440px]">
              Your order will appear here as items are added by the cashier.
            </div>
            <div className="mt-8 flex gap-3 justify-center">
              {categories.length > 0 && categories.map((cat) => (
                <span key={cat} className="bg-erl-accent/10 border border-erl-accent/25 rounded-full px-4 py-1.5 text-[11px] text-[#f5e6d0]/40 tracking-wide">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* Cart items */
          <div key={"cart-" + fadeKey} className="w-full max-w-[1100px] flex gap-12 items-start animate-fade-in">
            {/* Left: item list */}
            <div className="flex-1">
              <div className="text-[10px] tracking-widest text-[#f5e6d0]/35 uppercase mb-5">
                Your Order · {items.reduce((s, c) => s + c.qty, 0)} item{items.reduce((s, c) => s + c.qty, 0) !== 1 ? "s" : ""}
              </div>
              <div className="flex flex-col gap-3">
                {items.map((ci) => (
                  <div key={ci.item.id} className="flex items-center gap-4 bg-white/[0.04] border border-erl-accent/12 rounded-[14px] px-5 py-4">
                    <div className="w-11 h-11 rounded-[10px] bg-erl-accent/15 flex items-center justify-center text-[22px] flex-shrink-0">
                      {ci.item.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-[#f5e6d0] mb-0.5">
                        {ci.item.name}
                      </div>
                      {ci.notes && (
                        <div className="text-[11px] text-[#f5e6d0]/40 italic">
                          Note: {ci.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[#f5e6d0]/40 mb-0.5">
                        {ci.qty} × {formatCurrency(ci.item.price)}
                      </div>
                      <div className="text-[17px] font-bold text-erl-accent">
                        {formatCurrency(ci.item.price * ci.qty)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: totals */}
            <div className="w-[320px] flex-shrink-0 bg-erl-accent/8 border-[1.5px] border-erl-accent/20 rounded-[20px] px-7 py-7">
              <div className="text-[10px] tracking-widest text-[#f5e6d0]/35 uppercase mb-5">
                Total
              </div>

              <div className="flex flex-col gap-3.5">
                <div className="flex justify-between text-sm text-[#f5e6d0]/60">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="h-px bg-erl-accent/20 my-1" />
                <div className="flex justify-between font-display text-[28px] font-bold text-erl-accent">
                  <span>Total</span>
                  <span>{formatCurrency(grand)}</span>
                </div>
              </div>

              <div className="mt-6 px-4 py-3.5 bg-black/20 rounded-[10px] text-center">
                <div className="text-[10px] text-[#f5e6d0]/35 tracking-wide mb-1">Order Type</div>
                <div className="text-base font-bold text-[#f5e6d0]">{orderType === "dine-in" ? `🍽️ ${customerName || "Dine-in"}` : "🥤 Takeout"}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-12 py-4 border-t border-erl-accent/10 flex justify-between items-center flex-shrink-0">
        <div className="text-[11px] text-[#f5e6d0]/25">
          Powered by Erlbrew POS
        </div>
        <div className="flex gap-1.5 items-center">
          {isEmpty ? null : (
            <div className="w-2.5 h-2.5 rounded-full bg-erl-accent shadow-[0_0_8px_#C9873A] animate-pulse" />
          )}
          <span className="text-[11px] text-[#f5e6d0]/30">
            {isEmpty ? "Waiting for order…" : "Live"}
          </span>
        </div>
      </div>
    </div>
  );
};
