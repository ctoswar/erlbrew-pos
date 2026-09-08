import { getUnsyncedOrders, markOrderSynced } from './offlineDb';
import { apiAdminPost, getAuthToken } from './api';

let syncInProgress = false;

export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  if (syncInProgress) return { synced: 0, failed: 0 };
  
  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    const unsyncedOrders = await getUnsyncedOrders();
    const token = getAuthToken();

    if (!token || unsyncedOrders.length === 0) {
      syncInProgress = false;
      return { synced: 0, failed: 0 };
    }

    for (const order of unsyncedOrders) {
      try {
        await apiAdminPost('/orders', order.payload);
        await markOrderSynced(order.id);
        synced++;
      } catch (err) {
        console.error('Failed to sync order:', order.id, err);
        failed++;
      }
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

export function registerBackgroundSync() {
  // Listen for service worker messages
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_OFFLINE_ORDERS') {
      syncOfflineOrders();
    }
  });

  // Listen for online event to trigger sync
  window.addEventListener('online', () => {
    setTimeout(() => syncOfflineOrders(), 1000);
  });
}
