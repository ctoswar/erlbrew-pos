import { useState, useCallback, useEffect, useRef } from "react";
import { Order, CartItem, Staff, OrderStatus, OrderType, PayMethod, MenuItem, Role } from "../types";
import { calcSubtotal, calcTax, calcGrand, generateOrderId } from "../utils";
import { apiGet, apiPost, apiAdminPost, apiAdminPut, apiAdminDelete, getAuthToken } from "../utils/api";

const POLL_INTERVAL = 15000; // 15s — sync with server for multi-device

// Convert a server order object (snake_case) to a frontend Order
function serverOrderToOrder(o: any): Order {
  // Build CartItem[] from server order_items
  const items: CartItem[] = (o.items || []).map((it: any) => ({
    item: {
      id: it.menu_item_id || it.menu_item_id,
      name: it.menu_item_name || it.name || 'Unknown',
      category: it.category || 'Signature Brews',
      price: Number(it.price) || 0,
      badge: it.badge || '',
      description: '',
      emoji: it.emoji || '☕',
    } as MenuItem,
    qty: it.qty || 1,
    notes: it.notes || '',
  }));

  return {
    id: o.id,
    items,
    staff: {
      rfid: o.staff_rfid || '',
      pin: '',
      name: o.staff_name || 'Unknown',
      role: (o.staff_role || 'Barista') as Role,
      initials: o.staff_initials || '??',
      color: o.staff_color || '#666',
    },
    status: o.status as OrderStatus,
    subtotal: Number(o.subtotal) || 0,
    tax: Number(o.tax) || 0,
    total: Number(o.total) || 0,
    createdAt: new Date(o.created_at),
    completedAt: o.completed_at ? new Date(o.completed_at) : undefined,
    table: o.table_name ? (o.type === 'dine-in' ? `Table ${o.table_name}` : undefined) : undefined,
    type: (o.type || 'dine-in') as OrderType,
    payMethod: (o.pay_method || 'cash') as PayMethod,
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const syncedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync today's orders from backend on mount (once)
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const syncFromServer = () => {
      apiGet('/orders/today').then((data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          const serverOrders = data.map(serverOrderToOrder);
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o.id));
            const newOrders = serverOrders.filter(o => !existingIds.has(o.id));
            // Also update status for existing orders from server
            const updated = prev.map(local => {
              const server = serverOrders.find(s => s.id === local.id);
              if (server && server.status !== local.status) {
                return { ...local, status: server.status, completedAt: server.completedAt };
              }
              return local;
            });
            return newOrders.length > 0 || updated !== prev
              ? [...updated, ...newOrders]
              : prev;
          });
        }
      }).catch(() => {});
    };

    syncFromServer();

    // Start periodic polling for multi-device sync
    pollRef.current = setInterval(syncFromServer, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const placeOrder = useCallback(
    (cart: CartItem[], staff: Staff, type: OrderType, table: string | undefined, payMethod: PayMethod, cashTendered?: number): Order => {
      const subtotal = calcSubtotal(cart);
      const tax = calcTax(subtotal);
      const total = calcGrand(subtotal);

      const items = cart.map((ci) => ({
        id: ci.item.id,
        qty: ci.qty,
        price: ci.item.price,
        notes: ci.notes,
      }));
      const payload = {
        staff_id: staff ? staff.rfid : undefined,
        staff_name: staff?.name,
        type,
        table_name: table ? table : undefined,
        pay_method: payMethod,
        items,
      };

      // Optimistic local order
      const localOrder: Order = {
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
        cashTendered,
      };

      setOrders((prev) => [localOrder, ...prev]);

      // Post to API with auth token — on success, replace the temp local order with server version
      const token = getAuthToken();
      if (token) {
        apiAdminPost('/orders', payload).then((data: any) => {
          setOrders((prev) =>
            prev.map((o) => {
              if (o.id !== localOrder.id) return o;
              // Replace with server-confirmed order (keeps server ID)
              return {
                ...o,
                id: data.id || o.id,
                subtotal: data.subtotal ?? o.subtotal,
                tax: data.tax ?? o.tax,
                total: data.total ?? o.total,
              };
            })
          );
        }).catch(() => {
          // Order already added locally, just keep it
        });
      } else {
        // Fallback: try without auth (will fail if server requires auth)
        apiPost('/orders', payload).then((data: any) => {
          setOrders((prev) =>
            prev.map((o) => {
              if (o.id !== localOrder.id) return o;
              return {
                ...o,
                id: data.id || o.id,
                subtotal: data.subtotal ?? o.subtotal,
                tax: data.tax ?? o.tax,
                total: data.total ?? o.total,
              };
            })
          );
        }).catch(() => {});
      }

      return localOrder;
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
    // Sync to server using PUT with auth
    const token = getAuthToken();
    if (token) {
      apiAdminPut(`/orders/${id}/status`, { status }).catch(() => {});
    }
  }, []);

  const activeOrders = orders.filter((o) => o.status !== "completed");
  const completedOrders = orders.filter((o) => o.status === "completed");

  const voidOrder = useCallback((id: string) => {
    // Remove locally immediately
    setOrders((prev) => prev.filter((o) => o.id !== id));
    // Delete from server
    const token = getAuthToken();
    if (token) {
      apiAdminDelete(`/orders/${id}`).catch(() => {});
    }
  }, []);

  return { orders, placeOrder, updateStatus, voidOrder, activeOrders, completedOrders };
}
