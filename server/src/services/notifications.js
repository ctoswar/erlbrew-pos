// Firestore-backed in-app notifications for the customer app.
//
// The Flutter app can only READ Firestore at users/{auth.uid}/** (firestore
// rules), so every notification is written to the signed-in Firebase user's
// subcollection. The bridge between POS customers rows and Firebase users is
// customers.firebase_uid — written at firebase-login / link-firebase time.
//
// All writes are fire-and-forget best-effort: a notification failure must
// never fail the order that triggered it.

import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let firestore = null;
let firestoreFailed = false;

function getNotificationFirestore() {
  if (firestoreFailed) return null;
  if (firestore) return firestore;
  try {
    if (!getApps().length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : process.env.GOOGLE_SERVICE_ACCOUNT_KEY
          ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
          : null;
      initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : {});
    }
    firestore = getFirestore();
  } catch (e) {
    console.error('[Notifications] Firestore init failed — notifications disabled:', e.message);
    firestoreFailed = true;
  }
  return firestore;
}

function itemSummaryFromOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items
    .map((it) => `${it.qty || 1}× ${it.name || it.menu_item_name || it.item_name || it.menu_item_id || 'item'}`)
    .join(', ') || 'your items';
}

// Resolves the Firebase uid to address for a POS customer id. Returns null
// when the account was never linked to Firebase (no notifications possible).
async function resolveFirebaseUid(pool, customerId) {
  if (!customerId) return null;
  try {
    const [rows] = await pool.query(
      'SELECT firebase_uid FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    return (rows[0]?.firebase_uid) || null;
  } catch (e) {
    console.error('[Notifications] uid lookup failed:', e.message);
    return null;
  }
}

async function writeNotification(pool, customerId, { type, title, message, data = {} }) {
  try {
    const uid = await resolveFirebaseUid(pool, customerId);
    if (!uid) return false;
    const fs = getNotificationFirestore();
    if (!fs) return false;
    await fs
      .collection('users')
      .doc(String(uid))
      .collection('notifications')
      .add({
        type,
        title,
        message,
        read: false,
        createdAt: new Date(),
        ...data,
      });
    return true;
  } catch (e) {
    console.error('[Notifications] write failed:', e.message);
    return false;
  }
}

// Order created at the POS (or the app) and linked to the customer.
export function notifyOrderPlaced(pool, customerId, order) {
  return writeNotification(pool, customerId, {
    type: 'order_placed',
    title: 'Order placed 🎉',
    message: "We're working on it! We'll ping you when it's ready for pickup.",
    data: {
      orderId: order.id,
      items: itemSummaryFromOrder(order),
      total: Number(order.total) || 0,
    },
  });
}

// Order status flipped to 'ready' — come get it.
export function notifyOrderReady(pool, customerId, order) {
  return writeNotification(pool, customerId, {
    type: 'order_ready',
    title: 'Ready for pickup! ☕',
    message: 'Your order is waiting for you at the counter.',
    data: {
      orderId: order.id,
      items: itemSummaryFromOrder(order),
      total: Number(order.total) || 0,
    },
  });
}
