import { useState, useCallback, useEffect } from "react";
import { CartItem, MenuItem } from "../types";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erlbrew_cart");
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Persist cart to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem("erlbrew_cart", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

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

  const clearCart = useCallback(() => setCart([]), []);

  const addNote = useCallback((id: string, notes: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.item.id === id ? { ...ci, notes } : ci))
    );
  }, []);

  return { cart, addItem, updateQty, removeItem, clearCart, addNote };
}
