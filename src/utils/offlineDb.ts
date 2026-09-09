// IndexedDB wrapper for offline data storage
import { InventoryItem } from '../types';

const DB_NAME = 'erlbrew-pos-offline';
const DB_VERSION = 1;

export interface OfflineOrder {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
}

export interface OfflineMenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  badge?: string;
  description: string;
  emoji: string;
  available: boolean;
}

export type OfflineInventoryItem = InventoryItem;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Orders store for offline queue
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('synced', 'synced', { unique: false });
        orderStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Menu items cache
      if (!db.objectStoreNames.contains('menu')) {
        db.createObjectStore('menu', { keyPath: 'id' });
      }

      // Inventory cache
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'id' });
      }
    };
  });
}

// Orders - Offline Queue
export async function addOfflineOrder(order: OfflineOrder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const request = store.put(order);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly');
    const store = tx.objectStore('orders');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly');
    const store = tx.objectStore('orders');
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(0)); // 0 = not synced
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markOrderSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const order = getReq.result;
      if (order) {
        order.synced = 1;
        store.put(order);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeOfflineOrder(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Menu Items Cache
export async function cacheMenuItems(items: OfflineMenuItem[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('menu', 'readwrite');
  const store = tx.objectStore('menu');
  for (const item of items) {
    store.put(item);
  }
}

export async function getCachedMenuItems(): Promise<OfflineMenuItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('menu', 'readonly');
    const store = tx.objectStore('menu');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Inventory Cache
export async function cacheInventoryItems(items: InventoryItem[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');
  for (const item of items) {
    store.put(item);
  }
}

export async function getCachedInventoryItems(): Promise<InventoryItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('inventory', 'readonly');
    const store = tx.objectStore('inventory');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear all offline data
export async function clearOfflineData(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['orders', 'menu', 'inventory'], 'readwrite');
  tx.objectStore('orders').clear();
  tx.objectStore('menu').clear();
  tx.objectStore('inventory').clear();
}
