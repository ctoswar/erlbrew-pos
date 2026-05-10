import { useState, useCallback, useEffect, useRef } from "react";
import { Order, CartItem, Staff, OrderStatus, OrderType, PayMethod, MenuItem, Role, Discount } from "../types";
import { calcSubtotal, calcTax, calcGrand, generateOrderId } from "../utils";
import { apiGet, apiPost, apiAdminPost, apiAdminPut, getAuthToken } from "../utils/api";

const POLL_INTERVAL = 15000; // 15s — sync with server for multi-device
const QUEUE_KEY = 'erlbrew_pending_queue';

interface PendingPayload {
  id: string;        // local order id
  payload: Record<string, unknown>;
  createdAt: string;
}

function readQueue(): PendingPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeQueue(queue: PendingPayload[]) {
  try {
    if (queue.length > 0) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* storage full — silently drop */ }
}

function addToQueue(payload: Record<string, unknown>, localId: string) {
  const queue = readQueue();
  // Don't duplicate
  if (queue.some(q => q.id === localId)) return;
  queue.push({ id: localId, payload, createdAt: new Date().toISOString() });
  writeQueue(queue);
}

function removeFromQueue(localId: string) {
  const queue = readQueue().filter(q => q.id !== localId);
  writeQueue(queue);
}

// Convert a server order object (snake_case) to a frontend Order
export function serverOrderToOrder(o: any): Order {
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
    modifiers: (it.modifiers || []).map((m: any) => ({ name: m.name || '', price: Number(m.price) || 0 })),
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
    referenceNumber: o.referenceNumber || o.reference_number || undefined,
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(() => {
    // Rehydrate local (pending-sync) orders from localStorage on mount
    // JSON.parse turns Date objects into strings — convert them back
    try {
      const raw = localStorage.getItem('erlbrew_local_orders');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : []).map((o: any) => ({
        ...o,
        createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        completedAt: o.completedAt ? new Date(o.completedAt) : undefined,
      }));
    } catch { return []; }
  });
  const [pendingCount, setPendingCount] = useState(() => readQueue().length);
  const syncedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Retry pending offline orders
  const retryPending = useCallback(() => {
    const queue = readQueue();
    const token = getAuthToken();
    if (queue.length === 0 || !token) return;

    let changed = false;
    queue.forEach((pending) => {
      apiAdminPost('/orders', pending.payload).then((data: any) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === pending.id ? { ...o, id: data.id || o.id } : o))
        );
        removeFromQueue(pending.id);
        setPendingCount(readQueue().length);
      }).catch(() => {
        // Still offline — leave in queue
      });
    });
    if (changed) setPendingCount(readQueue().length);
  }, []);

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
      }).catch((err) => console.error("Failed to sync today's orders:", err));
    };

    syncFromServer();

    // Start periodic polling for multi-device sync
    pollRef.current = setInterval(() => {
      syncFromServer();
      retryPending();
    }, POLL_INTERVAL);

    // Listen for SSE-triggered refresh events (from useKitchenEvents)
    const handleSSERefresh = () => { syncFromServer(); };
    window.addEventListener('kitchen:refresh', handleSSERefresh);

    // Handle voided orders from other devices
    const handleVoided = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        setOrders((prev) => prev.map((o) => o.id === detail.id ? { ...o, status: "voided" as OrderStatus } : o));
      }
    };
    window.addEventListener('order:voided', handleVoided);

    // Retry queue when browser detects connectivity
    const handleOnline = () => { retryPending(); };
    window.addEventListener('online', handleOnline);

    // Retry pending queue on mount (from prior session)
    retryPending();
    setPendingCount(readQueue().length);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('kitchen:refresh', handleSSERefresh);
      window.removeEventListener('order:voided', handleVoided);
      window.removeEventListener('online', handleOnline);
    };
  }, [retryPending]);

  // Persist local (pending-sync) orders so they survive page refresh
  useEffect(() => {
    try {
      localStorage.setItem('erlbrew_local_orders', JSON.stringify(orders));
    } catch { /* quota exceeded — silently drop */ }
  }, [orders]);

  const placeOrder = useCallback(
    (cart: CartItem[], staff: Staff, type: OrderType, table: string | undefined, payMethod: PayMethod, cashTendered?: number, discount?: Discount | null, referenceNumber?: string): Order => {
      const subtotal = calcSubtotal(cart);
      const tax = calcTax(subtotal);
      const total = calcGrand(subtotal, discount);

      const items = cart.map((ci) => ({
        id: ci.item.id,
        qty: ci.qty,
        price: ci.item.price,
        notes: ci.notes,
        modifiers: ci.modifiers || [],
      }));
      const payload: Record<string, unknown> = {
        staff_id: staff ? staff.rfid : undefined,
        staff_name: staff?.name,
        type,
        table_name: table ? table : undefined,
        pay_method: payMethod,
        items,
      };
      if (discount) {
        payload.discount_type = discount.type;
        payload.discount_label = discount.label;
        payload.discount_value = discount.value;
        payload.discount_amount = discount.amount;
        payload.subtotal = subtotal;
        payload.total = total;
      }
      // Add reference number for e-wallet payments
      if (payMethod === 'ewallet' && referenceNumber) {
        payload.reference_number = referenceNumber;
      }
      console.log('[DEBUG useOrders] payload to send:', JSON.stringify(payload));

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
        discount: discount ?? undefined,
        referenceNumber,
      };

      setOrders((prev) => [localOrder, ...prev]);

      // Post to API with auth token — on success, replace the temp local order with server version
      const token = getAuthToken();
      if (token) {
        apiAdminPost('/orders', payload).then((data: any) => {
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
        }).catch((err) => {
          console.error("Failed to persist order to server (admin):", err);
          // Offline — save to pending queue for later retry
          addToQueue(payload, localOrder.id);
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
        }).catch((err) => {
          console.error("Failed to persist order to server (fallback):", err);
          addToQueue(payload, localOrder.id);
        });
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
      apiAdminPut(`/orders/${id}/status`, { status }).catch((err) => console.error("Failed to sync status to server:", err));
    }
  }, []);

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "ready");
  const completedOrders = orders.filter((o) => o.status === "completed");

  const voidOrder = useCallback((id: string) => {
    // Mark as voided locally (the POST /:id/void was already called by VoidCredentialModal)
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "voided" as OrderStatus } : o));
  }, []);

  return { orders, placeOrder, updateStatus, voidOrder, activeOrders, completedOrders, pendingCount };
}
