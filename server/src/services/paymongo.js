import { resolveField, isProviderEnabled } from './integrationConfig.js';
import { deductInventoryForOrder } from './deliveryChannels.js';

const PAYMONGO_API = 'https://api.paymongo.com';

/** Amounts are integers in centavos. */
function toCentavos(amount) {
  return Math.round(Number(amount) * 100);
}

/**
 * Create a hosted Checkout Session for an order (redirect/QR flow — no card form in POS).
 * Returns { checkout_url, session_id } or throws.
 */
export async function createCheckoutSession(pool, { orderId, total, description, successUrl, cancelUrl }) {
  const key = await resolveField(pool, 'paymongo', 'secret_key');
  if (!key) throw new Error('PayMongo secret key not configured');

  const r = await fetch(`${PAYMONGO_API}/v2/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: description || `Order ${orderId}`,
              amount: toCentavos(total),
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: ['card', 'gcash', 'qrph', 'paymaya'],
          success_url: successUrl || 'https://localhost:3000/',
          cancel_url: cancelUrl || 'https://localhost:3000/',
          reference_number: orderId,
        },
      },
    }),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.errors?.[0]?.detail || json?.message || `HTTP ${r.status}`;
    throw new Error(`PayMongo checkout error: ${msg}`);
  }
  const attrs = json?.data?.attributes || {};
  return { checkout_url: attrs.checkout_url, session_id: json?.data?.id };
}

/** True when the provider is enabled and a secret key exists. */
export async function isPaymongoReady(pool) {
  if (!(await isProviderEnabled(pool, 'paymongo'))) return false;
  return !!(await resolveField(pool, 'paymongo', 'secret_key'));
}

/**
 * Handle a verified PayMongo webhook event.
 * checkout_session.payment.paid → mark order paid → status preparing → SSE.
 * checkout_session.expired / payment failed → mark failed/expired.
 *
 * Returns { order_id, pay_status } for the payment_events audit row.
 */
export async function handlePaymongoEvent(pool, body, broadcastEvent) {
  const type = body?.data?.type || body?.type || '';
  const attrs = body?.data?.data?.attributes || body?.data?.attributes || {};
  const sessionRef = attrs.reference_number || body?.data?.data?.id;
  if (!sessionRef) return { skipped: true, reason: 'no reference_number in event' };

  // Orders are created with id = reference_number at session creation time.
  const [orders] = await pool.query(
    `SELECT id, status, pay_status FROM orders WHERE id = ? OR reference_number = ? LIMIT 1`,
    [sessionRef, sessionRef]
  );
  const order = orders[0];
  if (!order) return { skipped: true, reason: `order ${sessionRef} not found` };
  if (order.status === 'voided') return { skipped: true, reason: 'order already voided' };

  if (type === 'checkout_session.payment.paid' || type === 'payment.paid') {
    if (order.pay_status === 'paid') return { order_id: order.id, pay_status: 'paid', duplicate: true };

    const paymentId = attrs.payments?.[0]?.id || attrs.id || null;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE orders SET pay_status = 'paid',
           reference_number = COALESCE(?, reference_number),
           status = IF(status = 'pending_payment', 'preparing', status)
         WHERE id = ?`,
        [paymentId, order.id]
      );
      // Stock was deferred until payment — deduct now (order_items already exist)
      await deductInventoryForOrder(conn, order.id);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (broadcastEvent) {
      broadcastEvent('order:updated', { id: order.id, status: 'preparing', pay_status: 'paid' });
      broadcastEvent('payment:paid', { id: order.id });
    }
    return { order_id: order.id, pay_status: 'paid' };
  }

  if (type === 'checkout_session.expired') {
    await pool.query(
      `UPDATE orders SET pay_status = 'expired' WHERE id = ? AND pay_status = 'pending'`,
      [order.id]
    );
    if (broadcastEvent) broadcastEvent('payment:expired', { id: order.id });
    return { order_id: order.id, pay_status: 'expired' };
  }

  if (type === 'payment.failed' || type === 'checkout_session.payment.failed') {
    await pool.query(
      `UPDATE orders SET pay_status = 'failed' WHERE id = ? AND pay_status = 'pending'`,
      [order.id]
    );
    if (broadcastEvent) broadcastEvent('payment:failed', { id: order.id });
    return { order_id: order.id, pay_status: 'failed' };
  }

  return { order_id: order.id, skipped: true, reason: `unhandled event type ${type}` };
}
