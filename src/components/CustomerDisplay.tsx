import React, { useState, useEffect, useCallback, useRef } from "react";
import { CartItem, OrderType } from "../types";
import { formatCurrency, calcSubtotal, calcGrand } from "../utils";
import { useCart } from "../hooks/useCart";

const CART_KEY = "erlbrew_cart";
const POLL_INTERVAL = 3000;

interface DisplayCart {
  items: CartItem[];
  orderType: OrderType;
  table: string;
}

function readCart(): DisplayCart {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], orderType: "dine-in" as OrderType, table: "1" };
    const cart: CartItem[] = JSON.parse(raw);
    const metaRaw = localStorage.getItem("erlbrew_cart_meta");
    const meta = metaRaw ? JSON.parse(metaRaw) : { orderType: "dine-in", table: "1" };
    return { items: cart, orderType: meta.orderType || "dine-in", table: meta.table || "1" };
  } catch {
    return { items: [], orderType: "dine-in", table: "1" };
  }
}

export const CustomerDisplay: React.FC = () => {
  const [cart, setCart] = useState<DisplayCart>(() => readCart());
  
  const [fadeKey, setFadeKey] = useState(0);

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

  const { items, orderType, table } = cart;
  const subtotal = calcSubtotal(items);
  const grand = calcGrand(subtotal, discount);
  const isEmpty = items.length === 0;

  const orderLabel = orderType === "dine-in" ? `Table ${table}` : "Takeout";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d0600 0%, #1e0e06 50%, #0d0600 100%)",
      color: "#f5e6d0",
      fontFamily: "'Lato', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "28px 48px 22px",
        borderBottom: "1px solid rgba(201,135,58,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontSize: 36 }}>☕</span>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#C9873A", letterSpacing: 1 }}>
              ERLBREW CAFÉ
            </div>
            <div style={{ fontSize: 11, color: "rgba(245,230,208,0.5)", letterSpacing: 3, marginTop: 2, textTransform: "uppercase" }}>
              Customer Display
            </div>
          </div>
        </div>
        {!isEmpty && (
          <div style={{
            background: "rgba(201,135,58,0.15)",
            border: "1.5px solid rgba(201,135,58,0.4)",
            borderRadius: 12,
            padding: "10px 22px",
            textAlign: "center" as const,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(245,230,208,0.5)", textTransform: "uppercase", marginBottom: 4 }}>
              Order Type
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#C9873A" }}>
              {orderLabel}
            </div>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 48px" }}>
        {isEmpty ? (
          /* Empty state */
          <div key={"empty-" + fadeKey} style={{ textAlign: "center" as const, animation: "fadeIn 0.6s ease" }}>
            <div style={{ fontSize: 80, marginBottom: 24 }}>🛒</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: "#C9873A", marginBottom: 12 }}>
              Welcome!
            </div>
            <div style={{ fontSize: 18, color: "rgba(245,230,208,0.55)", lineHeight: 1.6, maxWidth: 440 }}>
              Your order will appear here as items are added by the cashier.
            </div>
            <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
              {["Signature Brews", "Espresso", "Cold Drinks", "Pastries"].map((cat) => (
                <span key={cat} style={{
                  background: "rgba(201,135,58,0.1)",
                  border: "1px solid rgba(201,135,58,0.25)",
                  borderRadius: 20,
                  padding: "6px 16px",
                  fontSize: 11,
                  color: "rgba(245,230,208,0.4)",
                  letterSpacing: 1,
                }}>{cat}</span>
              ))}
            </div>
          </div>
        ) : (
          /* Cart items */
          <div key={"cart-" + fadeKey} style={{ width: "100%", maxWidth: 1100, display: "flex", gap: 48, alignItems: "flex-start", animation: "fadeIn 0.4s ease" }}>
            {/* Left: item list */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(245,230,208,0.35)", textTransform: "uppercase", marginBottom: 20 }}>
                Your Order · {items.reduce((s, c) => s + c.qty, 0)} item{items.reduce((s, c) => s + c.qty, 0) !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map((ci) => (
                  <div key={ci.item.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(201,135,58,0.12)",
                    borderRadius: 14,
                    padding: "16px 20px",
                  }}>
                    <div style={{
                      width: 44, height: 44,
                      borderRadius: 10,
                      background: "rgba(201,135,58,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {ci.item.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#f5e6d0", marginBottom: 2 }}>
                        {ci.item.name}
                      </div>
                      {ci.notes && (
                        <div style={{ fontSize: 11, color: "rgba(245,230,208,0.4)", fontStyle: "italic" }}>
                          Note: {ci.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 11, color: "rgba(245,230,208,0.4)", marginBottom: 2 }}>
                        {ci.qty} × {formatCurrency(ci.item.price)}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#C9873A" }}>
                        {formatCurrency(ci.item.price * ci.qty)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: totals */}
            <div style={{
              width: 320, flexShrink: 0,
              background: "rgba(201,135,58,0.08)",
              border: "1.5px solid rgba(201,135,58,0.2)",
              borderRadius: 20,
              padding: "28px 28px",
            }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(245,230,208,0.35)", textTransform: "uppercase", marginBottom: 20 }}>
                Total
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "rgba(245,230,208,0.6)" }}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div style={{ height: 1, background: "rgba(201,135,58,0.2)", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#C9873A" }}>
                  <span>Total</span>
                  <span>{formatCurrency(grand)}</span>
                </div>
              </div>

              <div style={{ marginTop: 24, padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, textAlign: "center" as const }}>
                <div style={{ fontSize: 10, color: "rgba(245,230,208,0.35)", letterSpacing: 1, marginBottom: 4 }}>Order Type</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f5e6d0" }}>{orderType === "dine-in" ? `🍽️ Dine-in — Table ${table}` : "🥤 Takeout"}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 48px",
        borderTop: "1px solid rgba(201,135,58,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, color: "rgba(245,230,208,0.25)" }}>
          Powered by Erlbrew POS
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isEmpty ? null : (
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "#C9873A",
              boxShadow: "0 0 8px #C9873A",
              animation: "pulse 2s infinite",
            }} />
          )}
          <span style={{ fontSize: 11, color: "rgba(245,230,208,0.3)" }}>
            {isEmpty ? "Waiting for order…" : "Live"}
          </span>
        </div>
      </div>
    </div>
  );
};
