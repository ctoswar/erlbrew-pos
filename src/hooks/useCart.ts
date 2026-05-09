import { useState, useCallback, useEffect } from "react";
import { CartItem, MenuItem, Discount, DiscountType, CartItemModifier } from "../types";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erlbrew_cart");
      if (raw) setCart(JSON.parse(raw));
      const disc = localStorage.getItem("erlbrew_discount");
      if (disc) setDiscount(JSON.parse(disc));
    } catch (err) {
      console.error("Failed to hydrate cart from localStorage:", err);
    }
  }, []);

  // Persist cart and discount to localStorage
  useEffect(() => {
    try { localStorage.setItem("erlbrew_cart", JSON.stringify(cart)); } catch (err) { console.error("Failed to persist cart:", err); }
  }, [cart]);

  useEffect(() => {
    try {
      if (discount) localStorage.setItem("erlbrew_discount", JSON.stringify(discount));
      else localStorage.removeItem("erlbrew_discount");
    } catch (err) { console.error("Failed to persist discount:", err); }
  }, [discount]);

  const addItem = useCallback((item: MenuItem, modifiers?: CartItemModifier[]) => {
    setCart((prev) => {
      const key = JSON.stringify({ id: item.id, modifiers: modifiers || [] });
      const existing = prev.find((ci) => {
        const ciKey = JSON.stringify({ id: ci.item.id, modifiers: ci.modifiers || [] });
        return ciKey === key;
      });
      if (existing) {
        return prev.map((ci) => {
          const ciKey = JSON.stringify({ id: ci.item.id, modifiers: ci.modifiers || [] });
          return ciKey === key ? { ...ci, qty: ci.qty + 1 } : ci;
        });
      }
      return [...prev, { item, qty: 1, modifiers: modifiers || [] }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number, modifiers?: CartItemModifier[]) => {
    setCart((prev) => {
      const key = JSON.stringify({ id, modifiers: modifiers || [] });
      return prev
        .map((ci) => {
          const ciKey = JSON.stringify({ id: ci.item.id, modifiers: ci.modifiers || [] });
          return ciKey === key ? { ...ci, qty: ci.qty + delta } : ci;
        })
        .filter((ci) => ci.qty > 0);
    });
  }, []);

  const removeItem = useCallback((id: string, modifiers?: CartItemModifier[]) => {
    const key = JSON.stringify({ id, modifiers: modifiers || [] });
    setCart((prev) => prev.filter((ci) => {
      const ciKey = JSON.stringify({ id: ci.item.id, modifiers: ci.modifiers || [] });
      return ciKey !== key;
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(null);
  }, []);

  const addNote = useCallback((id: string, notes: string, modifiers?: CartItemModifier[]) => {
    const key = JSON.stringify({ id, modifiers: modifiers || [] });
    setCart((prev) =>
      prev.map((ci) => {
        const ciKey = JSON.stringify({ id: ci.item.id, modifiers: ci.modifiers || [] });
        return ciKey === key ? { ...ci, notes } : ci;
      })
    );
  }, []);

  /** Apply a named discount. Pass null to remove. */
  const applyDiscount = useCallback((type: DiscountType, label: string, value: number, subtotal: number) => {
    if (!type || !value) { setDiscount(null); return; }
    const amount = type === "custom_fixed"
      ? Math.min(value, subtotal)                        // fixed amount, don't exceed subtotal
      : subtotal * (value / 100);                         // percentage
    setDiscount({ type, label, value, amount: Math.round(amount * 100) / 100 });
  }, []);

  const removeDiscount = useCallback(() => setDiscount(null), []);

  return { cart, discount, addItem, updateQty, removeItem, clearCart, addNote, applyDiscount, removeDiscount };
}
