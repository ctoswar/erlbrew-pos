import { useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { serverOrderToOrder } from './useOrders';

export function useKitchenEvents() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const syncOrders = useCallback(() => {
    // This is a lightweight sync - just triggers the existing polling to get latest
    // The actual state update happens in useOrders via its polling
    window.dispatchEvent(new CustomEvent('kitchen:refresh'));
  }, []);

  useEffect(() => {
    // Only connect if document is visible (don't waste resources on hidden tabs)
    if (document.hidden) return;

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.addEventListener('order:created', (e: MessageEvent) => {
      console.log('[SSE] order:created', e.data);
      // Trigger immediate re-sync
      syncOrders();
    });

    es.addEventListener('order:updated', (e: MessageEvent) => {
      console.log('[SSE] order:updated', e.data);
      syncOrders();
    });

    es.addEventListener('order:voided', (e: MessageEvent) => {
      console.log('[SSE] order:voided', e.data);
      syncOrders();
    });

    es.onerror = (e) => {
      console.warn('[SSE] connection error, will retry...', e);
      // EventSource auto-reconnects, but if it's a permanent error, we might want to fall back to polling
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [syncOrders]);

  return { syncOrders };
}

// Lightweight sync function that can be called to fetch latest orders
// Used when SSE event triggers need immediate update
export async function syncKitchenOrders(): Promise<void> {
  try {
    const data = await apiGet<any[]>('/api/orders/today');
    if (Array.isArray(data)) {
      window.dispatchEvent(new CustomEvent('kitchen:ordersUpdated', {
        detail: data.map(serverOrderToOrder)
      }));
    }
  } catch (e) {
    console.warn('[SSE] sync failed, waiting for next poll', e);
  }
}