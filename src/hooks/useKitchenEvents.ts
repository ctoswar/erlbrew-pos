import { useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { playNewOrderChime } from '../utils/sound';
import { serverOrderToOrder } from './useOrders';

export function useKitchenEvents() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const syncOrders = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kitchen:refresh'));
  }, []);

  const connect = useCallback(() => {
    // Connect only while the tab is visible — but re-connect on
    // visibilitychange below, so hiding the tab no longer kills the
    // order chime for the rest of the session.
    if (eventSourceRef.current || document.hidden) return;

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
  }, [syncOrders]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => {
    connect();

    const onVisibilityChange = () => {
      if (document.hidden) disconnect();
      else connect();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [connect, disconnect]);

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