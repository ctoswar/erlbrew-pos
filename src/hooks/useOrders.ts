import { useState, useCallback } from "react";
import { Order, CartItem, Staff, OrderStatus, OrderType, PayMethod } from "../types";
import { calcSubtotal, calcTax, calcGrand, generateOrderId } from "../utils";

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);

  const placeOrder = useCallback(
    (
      cart: CartItem[],
      staff: Staff,
      type: OrderType,
      table: string | undefined,
      payMethod: PayMethod
    ): Order => {
      const subtotal = calcSubtotal(cart);
      const tax = calcTax(subtotal);
      const total = calcGrand(subtotal);
      const order: Order = {
        id: generateOrderId(),
        items: [...cart],
        staff,
        status: "preparing",
        subtotal,
        tax,
        total,
        createdAt: new Date(),
        table: type === "dine-in" ? `Table ${table}` : undefined,
        type,
        payMethod,
      };
      setOrders((prev) => [order, ...prev]);
      return order;
    },
    []
  );

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status, completedAt: status === "completed" ? new Date() : o.completedAt }
          : o
      )
    );
  }, []);

  const activeOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");

  return { orders, placeOrder, updateStatus, activeOrders, completedOrders };
}
