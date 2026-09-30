import React, { useState, useEffect, useCallback, useRef } from "react";
import { CartItem, OrderType } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";
import { useCart } from "../hooks/useCart";
import {
  apiGet,
  getCompanySettings,
  lookupCustomerByPhone,
  parsePromoMessages,
  CustomerLoyalty,
} from "../utils/api";
import { getIconByEmoji } from "./FoodIcons";

const CART_KEY = "erlbrew_cart";
const POLL_INTERVAL = 3000;
const PROMO_REFRESH_MS = 60000;
const PROMO_ROTATE_MS = 8000;
const LOOKUP_DEBOUNCE_MS = 400;

/** Points earned per ₱100 spent — mirrors the award rule in server/src/routes/orders.js */
const POINTS_PER_PESO = 100;

const TIER_EMOJI: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

interface DisplayCart {
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
}

function readCart(): DisplayCart {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], orderType: "dine-in" as OrderType, customerName: "", customerPhone: "" };
    const cart: CartItem[] = JSON.parse(raw);
    const metaRaw = localStorage.getItem("erlbrew_cart_meta");
    const meta = metaRaw ? JSON.parse(metaRaw) : { orderType: "dine-in", customerName: "", customerPhone: "" };
    return {
      items: cart,
      orderType: meta.orderType || "dine-in",
      customerName: meta.customerName || "",
      customerPhone: meta.customerPhone || "",
    };
  } catch {
    return { items: [], orderType: "dine-in", customerName: "", customerPhone: "" };
  }
}

const cartSignature = (cart: DisplayCart): string =>
  `${cart.items.length}|${cart.items.reduce((s, c) => s + c.qty, 0)}|` +
  cart.items.map((i) => `${i.item.id}:${i.qty}:${i.selectedSize?.label || ""}:${i.notes || ""}`).join(",") +
  `|${cart.orderType}|${cart.customerName}|${cart.customerPhone}`;

const itemLineTotal = (ci: CartItem): number => {
  const modifierTotal = (ci.modifiers || []).reduce((s, m) => s + (m.price || 0) * (m.qty || 1), 0);
  return (ci.item.price + modifierTotal) * ci.qty;
};

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

  const lastCartSigRef = useRef<string>(cartSignature(readCart()));

  const reload = useCallback(() => {
    const next = readCart();
    setCart(next);
    const sig = cartSignature(next);
    if (lastCartSigRef.current !== sig) {
      lastCartSigRef.current = sig;
      setFadeKey((k) => k + 1);
    }
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

  const { items, orderType, customerName, customerPhone } = cart;
  const subtotal = calcSubtotal(items);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = items.length === 0;

  // Loyalty lookup for the phone captured at checkout (#173) — re-runs when cart meta changes
  const [loyalty, setLoyalty] = useState<CustomerLoyalty | null>(null);
  useEffect(() => {
    const phone = customerPhone.trim();
    if (!phone) {
      setLoyalty(null);
      return;
    }
    let cancelled = false;
    // Debounced: the POS writes meta on every keystroke in the phone field
    const timer = window.setTimeout(() => {
      lookupCustomerByPhone(phone)
        .then((result) => { if (!cancelled) setLoyalty(result); })
        .catch(() => { if (!cancelled) setLoyalty(null); });
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerPhone]);

  // Promotional messages ticker (#174) — refreshed every 60s (display runs in a long-lived window)
  const [promoMessages, setPromoMessages] = useState<string[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      getCompanySettings()
        .then((settings) => { if (alive) setPromoMessages(parsePromoMessages(settings.promo_messages)); })
        // Hidden entirely when the fetch fails
        .catch(() => { if (alive) setPromoMessages([]); });
    };
    load();
    const refresh = window.setInterval(load, PROMO_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (promoMessages.length <= 1) return; // single message stays static
    const rotate = window.setInterval(
      () => setPromoIndex((i) => (i + 1) % promoMessages.length),
      PROMO_ROTATE_MS
    );
    return () => window.clearInterval(rotate);
  }, [promoMessages.length]);

  const currentPromo = promoMessages.length > 0 ? promoMessages[promoIndex % promoMessages.length] : "";
  const pointsToEarn = Math.floor(grand / POINTS_PER_PESO);

  const orderLabel = orderType === "dine-in" ? (customerName || "Dine-in") : "Takeout";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0600] via-[#1e0e06] to-[#0d0600] text-[#f5e6d0] font-sans flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-12 pt-5 md:pt-7 pb-4 md:pb-5 border-b border-erl-accent/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-3xl md:text-4xl">☕</span>
          <div>
            <div className="font-display text-xl md:text-[26px] font-bold text-erl-accent tracking-wide">
              ERLBREW CAFÉ
            </div>
            <div className="text-[10px] md:text-[11px] text-[#f5e6d0]/50 tracking-widest uppercase mt-0.5">
              Customer Display
            </div>
          </div>
        </div>
        {!isEmpty && (
          <div className="bg-erl-accent/15 border-[1.5px] border-erl-accent/40 rounded-xl px-4 md:px-5 py-2 md:py-2.5 text-center">
            <div className="text-[9px] tracking-widest text-[#f5e6d0]/50 uppercase mb-1">Order Type</div>
            <div className="text-[13px] md:text-[15px] font-bold text-erl-accent">
              {orderLabel}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-12">
        {isEmpty ? (
          /* Empty state */
          <div key={"empty-" + fadeKey} className="text-center animate-fade-in">
            <div className="text-6xl md:text-8xl mb-4 md:mb-6">🛒</div>
            <div className="font-display text-3xl md:text-4xl text-erl-accent mb-3">
              Welcome!
            </div>
            <div className="text-base md:text-lg text-[#f5e6d0]/55 leading-relaxed max-w-[440px]">
              Your order will appear here as items are added by the cashier.
            </div>
            <div className="mt-6 md:mt-8 flex gap-2 md:gap-3 justify-center flex-wrap">
              {categories.length > 0 && categories.map((cat) => (
                <span key={cat} className="bg-erl-accent/10 border border-erl-accent/25 rounded-full px-3 md:px-4 py-1.5 text-[10px] md:text-[11px] text-[#f5e6d0]/40 tracking-wide">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* Cart items */
          <div key={"cart-" + fadeKey} className="w-full max-w-[1100px] flex flex-col lg:flex-row gap-8 lg:gap-12 items-start animate-fade-in">
            {/* Left: item list */}
            <div className="flex-1 w-full">
              <div className="text-[10px] tracking-widest text-[#f5e6d0]/35 uppercase mb-4 md:mb-5">
                Your Order · {items.reduce((s, c) => s + c.qty, 0)} item{items.reduce((s, c) => s + c.qty, 0) !== 1 ? "s" : ""}
              </div>
              <div className="flex flex-col gap-2 md:gap-3">
                {items.map((ci) => (
                  <div key={ci.item.id} className="flex items-center gap-3 md:gap-4 bg-white/[0.04] border border-erl-accent/12 rounded-[14px] px-4 md:px-5 py-3 md:py-4">
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-[10px] bg-erl-accent/15 flex items-center justify-center flex-shrink-0">
                      {getIconByEmoji(ci.item.emoji)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm md:text-base font-semibold text-[#f5e6d0] mb-0.5 truncate">
                        {ci.item.name}{ci.selectedSize ? <span className="text-[#f5e6d0]/50 font-normal ml-1 text-xs">({ci.selectedSize.label})</span> : ""}
                      </div>
                      {ci.notes && (
                        <div className="text-[10px] md:text-[11px] text-[#f5e6d0]/40 italic">
                          Note: {ci.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] md:text-[11px] text-[#f5e6d0]/40 mb-0.5">
                        {ci.qty} × {formatCurrency(itemLineTotal(ci) / ci.qty)}
                      </div>
                      <div className="text-[15px] md:text-[17px] font-bold text-erl-accent">
                        {formatCurrency(itemLineTotal(ci))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: totals */}
            <div className="w-full lg:w-[320px] flex-shrink-0 bg-erl-accent/8 border-[1.5px] border-erl-accent/20 rounded-[20px] px-5 md:px-7 py-5 md:py-7">
              <div className="text-[10px] tracking-widest text-[#f5e6d0]/35 uppercase mb-4 md:mb-5">
                Total
              </div>

              <div className="flex flex-col gap-3 md:gap-3.5">
                <div className="flex justify-between text-sm text-[#f5e6d0]/60">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="h-px bg-erl-accent/20 my-1" />
                <div className="flex justify-between font-display text-2xl md:text-[28px] font-bold text-erl-accent">
                  <span>Total</span>
                  <span>{formatCurrency(grand)}</span>
                </div>
              </div>

              <div className="mt-5 md:mt-6 px-4 py-3 md:py-3.5 bg-black/20 rounded-[10px] text-center">
                <div className="text-[10px] text-[#f5e6d0]/35 tracking-wide mb-1">Order Type</div>
                <div className="text-sm md:text-base font-bold text-[#f5e6d0]">{orderType === "dine-in" ? `🍽️ ${customerName || "Dine-in"}` : "🥤 Takeout"}</div>
              </div>

              {/* Loyalty — only when a phone was captured at checkout (#173) */}
              {loyalty && (
                <div className="mt-3 md:mt-4 px-4 py-3 md:py-3.5 bg-erl-accent/10 border border-erl-accent/25 rounded-[10px] text-center animate-fade-in">
                  {loyalty.found ? (
                    <>
                      <div className="text-[10px] text-[#f5e6d0]/45 tracking-widest uppercase mb-1">
                        {loyalty.loyaltyTier && (
                          <>{TIER_EMOJI[loyalty.loyaltyTier.toLowerCase()] || "⭐"} {loyalty.loyaltyTier} · </>
                        )}
                        Loyalty
                      </div>
                      <div className="font-display text-lg md:text-xl font-bold text-erl-accent">
                        {loyalty.loyaltyPoints ?? 0} pts
                      </div>
                      <div className="text-[11px] text-[#f5e6d0]/55 mt-1">
                        {loyalty.name ? `${loyalty.name} · ` : ""}
                        You'll earn {pointsToEarn} point{pointsToEarn === 1 ? "" : "s"} on this order
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] text-[#f5e6d0]/45 tracking-widest uppercase mb-1">Loyalty</div>
                      <div className="text-[11px] text-[#f5e6d0]/60 leading-snug">
                        ⭐ Earn 1 point for every ₱100 spent — place this order to start earning with this number.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Promotional ticker (#174) — hidden entirely when no messages are configured */}
      {currentPromo && (
        <div className="px-4 md:px-12 py-2.5 md:py-3 border-t border-erl-accent/10 bg-erl-accent/[0.07] flex items-center gap-3 flex-shrink-0">
          <span className="pill pill-accent flex-shrink-0">✦ Promo</span>
          <span
            key={promoIndex}
            className="text-[12px] md:text-[13px] font-semibold text-erl-accent truncate animate-fade-in"
          >
            {currentPromo}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 md:px-12 py-4 border-t border-erl-accent/10 flex justify-between items-center flex-shrink-0">
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
