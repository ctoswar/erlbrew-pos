import { useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { serverOrderToOrder } from './useOrders';

// Play a notification sound — uses Web Audio API to avoid loading audio files
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);        // A5
    osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2); // E6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio not available — silent fallback */ }
}

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

    es.addEventListener('order:created', (e: MessageEvent) => {
      playNotificationSound();
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