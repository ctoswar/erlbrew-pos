import { useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { playNewOrderChime } from '../utils/sound';
import { serverOrderToOrder } from './useOrders';

export function useKitchenEvents() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const syncOrders = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kitchen:refresh'));
  }, []);

  useEffect(() => {
    // Only connect if document is visible (don't waste resources on hidden tabs)
    if (document.hidden) return;

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.addEventListener('order:created', (_e: MessageEvent) => {
      playNewOrderChime();
      syncOrders();
    });

    es.addEventListener('order:updated', () => {
      syncOrders();
    });

    es.addEventListener('order:voided', () => {
      syncOrders();
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [syncOrders]);

  return { syncOrders };
}

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