import { useState, useCallback, useEffect } from "react";
import { CartItem, MenuItem, Discount, DiscountType } from "../types";

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

  const addItem = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => (ci.item.id === id ? { ...ci, qty: ci.qty + delta } : ci))
        .filter((ci) => ci.qty > 0)
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(null);
  }, []);

  const addNote = useCallback((id: string, notes: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.item.id === id ? { ...ci, notes } : ci))
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
