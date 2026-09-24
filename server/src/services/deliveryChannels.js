import { resolveField, isProviderEnabled } from './integrationConfig.js';

// Asia/Taipei time (UTC+8) — server timezone-independent (same helper as orders.js)
function taipeiNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

// ─── Shared delivery-channel abstraction ─────────────────────────────────────
// GrabFood and FoodPanda share this flow:
//   inbound order push (auto-accept) → kitchen order with order_source
//   outbound status push (staff advances status) → platform state
//   menu export from menu_items → platform catalog
//
// MOCK-FIRST: merchant/partner accounts are not yet approved. When a platform's
// credentials are missing, outbound calls are logged and skipped (mock mode) —
// inbound webhooks still work via fixtures (signature must be configured).

const PROVIDER_LABELS = { grab: 'GrabFood', foodpanda: 'FoodPanda' };

/** Map our order status → platform state string. */
const STATUS_MAP = {
  grab: {
    pending: 'NEW',
    preparing: 'PREPARING',
    ready: 'READY_FOR_PICKUP',
    completed: 'COMPLETED',
    voided: 'CANCELLED',
  },
  foodpanda: {
    pending: 'RECEIVED',
    preparing: 'RECEIVED',
    ready: 'READY_FOR_PICKUP',
    completed: 'DISPATCHED',
    voided: 'CANCELLED',
  },
};

async function isMockMode(pool, provider) {
  if (provider === 'grab') {
    const id = await resolveField(pool, 'grab', 'client_id');
    const secret = await resolveField(pool, 'grab', 'client_secret');
    return !(id && secret);
  }
  const key = await resolveField(pool, 'foodpanda', 'api_key');
  return !key;
}

/**
 * Push an order-state change to the delivery platform.
 * Fire-and-forget: failures are logged, never block the POS status update.
 */
export async function pushOrderState(pool, provider, externalOrderId, ourStatus) {
  if (!PROVIDER_LABELS[provider] || !externalOrderId) return;
  try {
    if (!(await isProviderEnabled(pool, provider))) return;
    const platformState = STATUS_MAP[provider]?.[ourStatus];
    if (!platformState) return;

    if (await isMockMode(pool, provider)) {
      console.log(`[delivery:${provider}] MOCK push state ${externalOrderId} → ${platformState}`);
      return;
    }

    // Real push (activated once partner credentials arrive):
    // grab: PUT https://partner-api.grab.com/food/v1/merchant/{merchantId}/orders/{orderId} OrderStateRequest
    // foodpanda: PUT https://api.foodpanda.ph/v2/chains/{chainId}/orders/{orderId} status
    console.log(`[delivery:${provider}] TODO push state ${externalOrderId} → ${platformState} (endpoint pending account)`);
  } catch (e) {
    console.error(`[delivery:${provider}] state push failed:`, e.message);
  }
}

/** Called from orders status update — routes to the right provider by order_source. */
export async function pushStatusForOrder(pool, order) {
  if (!order?.order_source || order.order_source === 'pos') return;
  await pushOrderState(pool, order.order_source, order.external_order_id, order.newStatus || order.status);
}

// ─── Inbound: normalize platform payload → our order shape ───────────────────

function normalizeGrabOrder(payload) {
  const items = (payload.items || []).map(it => ({
    name: String(it.name || it.item_name || '').slice(0, 128),
    qty: Math.max(1, parseInt(it.quantity || it.qty, 10) || 1),
    price: Number(it.price || it.unit_price || 0),
  }));
  return {
    external_order_id: String(payload.order_id || payload.short_order_number || '').slice(0, 64),
    customer_name: String(payload.receiver?.name || payload.customer?.name || 'Grab Customer').slice(0, 128),
    customer_phone: String(payload.receiver?.phone_number || payload.receiver?.phone || '').slice(0, 32) || null,
    total: Number(payload.total?.amount || payload.price?.total || 0),
    items,
    raw: payload,
  };
}

function normalizeFoodpandaOrder(payload) {
  const items = (payload.items || payload.order?.items || []).map(it => ({
    name: String(it.name || it.item_name || it.variant_name || '').slice(0, 128),
    qty: Math.max(1, parseInt(it.quantity || it.qty, 10) || 1),
    price: Number(it.price || it.unit_price || 0),
  }));
  return {
    external_order_id: String(payload.order_id || payload.id || '').slice(0, 64),
    customer_name: String(payload.customer?.name || payload.delivery_address?.first_name || 'FoodPanda Customer').slice(0, 128),
    customer_phone: String(payload.customer?.phone || payload.delivery_address?.phone || '').slice(0, 32) || null,
    total: Number(payload.total_price || payload.grand_total || 0),
    items,
    raw: payload,
  };
}

const NORMALIZERS = { grab: normalizeGrabOrder, foodpanda: normalizeFoodpandaOrder };

/**
 * Handle a verified inbound delivery webhook.
 * Auto-accept (per decision): order created directly as 'preparing'.
 * Items are matched to menu_items by name (case-insensitive); unmatched items
 * are noted in the order but skipped (order_items.menu_item_id has an FK).
 *
 * Returns { order_id, external_order_id } for the payment_events audit row.
 */
export async function handleDeliveryWebhook(pool, provider, payload, broadcastEvent) {
  const normalize = NORMALIZERS[provider];
  if (!normalize) return { skipped: true, reason: 'unsupported provider' };

  // Status-only webhooks (cancellations, rider updates) without order data.
  const normalized = normalize(payload);
  const status = String(payload.status || '').toUpperCase();

  if (status && status !== 'RECEIVED' && !normalized.external_order_id) {
    return { skipped: true, reason: 'status event without order' };
  }

  if (status === 'CANCELLED') {
    const [orders] = await pool.query(
      `SELECT id FROM orders WHERE order_source = ? AND external_order_id = ?`,
      [provider, normalized.external_order_id]
    );
    if (orders[0]) {
      await pool.query(
        `UPDATE orders SET status = 'voided', void_reason = ? WHERE id = ?`,
        [`Cancelled by ${PROVIDER_LABELS[provider]}`, orders[0].id]
      );
      if (broadcastEvent) broadcastEvent('order:voided', { id: orders[0].id });
      return { order_id: orders[0].id, cancelled: true };
    }
    return { skipped: true, reason: 'cancel for unknown order' };
  }

  if (!normalized.external_order_id) return { skipped: true, reason: 'missing order id' };
  if (!normalized.items.length) return { skipped: true, reason: 'no items in payload' };

  // Idempotency beyond payment_events: unique (order_source, external_order_id).
  const [existing] = await pool.query(
    `SELECT id FROM orders WHERE order_source = ? AND external_order_id = ?`,
    [provider, normalized.external_order_id]
  );
  if (existing[0]) return { order_id: existing[0].id, duplicate: true };

  // Match items to menu by name (shallow mapping — no platform SKU table yet).
  const [menuRows] = await pool.query(`SELECT id, name, price FROM menu_items`);
  const byName = new Map(menuRows.map(m => [m.name.trim().toLowerCase(), m]));
  const matched = [];
  const unmatched = [];
  for (const it of normalized.items) {
    const m = byName.get(it.name.trim().toLowerCase());
    if (m) matched.push({ menuItem: m, qty: it.qty, price: Number(m.price) });
    else unmatched.push(it);
  }
  if (!matched.length) return { skipped: true, reason: 'no menu items matched payload' };
  if (unmatched.length) {
    console.warn(`[delivery:${provider}] ${unmatched.length} items not on menu:`,
      unmatched.map(u => u.name).join(', '));
  }

  const orderId = `EXT-${provider.toUpperCase().slice(0, 3)}-${normalized.external_order_id}`.slice(0, 64);
  const subtotal = matched.reduce((s, m) => s + m.price * m.qty, 0);
  const tax = 0; // delivery platform totals are tax-inclusive; keep tax at 0
  const total = normalized.total > 0 ? normalized.total : subtotal;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO orders (id, staff_id, status, subtotal, tax, total, customer_name, customer_phone,
         type, pay_method, reference_number, order_source, external_order_id, pay_status, created_at)
       VALUES (?, NULL, 'preparing', ?, ?, ?, ?, ?, 'takeout', 'ewallet', ?, ?, ?, 'paid', ?)`,
      [orderId, subtotal, tax, total, normalized.customer_name, normalized.customer_phone,
        normalized.external_order_id, provider, normalized.external_order_id, toMysqlDatetime(taipeiNow())]
    );
    for (const m of matched) {
      await conn.query(
        `INSERT INTO order_items (order_id, menu_item_id, qty, notes, price) VALUES (?, ?, ?, ?, ?)`,
        [orderId, m.menuItem.id, m.qty,
          provider === 'grab' ? 'GrabFood' : 'FoodPanda', m.price]
      );
    }
    // Deduct inventory via recipes (same behavior as POS orders).
    await deductInventoryForOrder(conn, orderId);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  if (broadcastEvent) {
    broadcastEvent('order:created', { id: orderId, order_source: provider });
  }
  console.log(`[delivery:${provider}] inbound order ${orderId} auto-accepted (source=${provider})`);
  return { order_id: orderId, external_order_id: normalized.external_order_id };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMysqlDatetime(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Recipe-based inventory deduction for an order (mirrors POST /api/orders logic). */
export async function deductInventoryForOrder(conn, orderId) {
  try {
    const [orderItems] = await conn.query(
      `SELECT menu_item_id, qty FROM order_items WHERE order_id = ?`, [orderId]
    );
    if (!orderItems.length) return;
    const itemQtyMap = {};
    for (const oi of orderItems) itemQtyMap[oi.menu_item_id] = (itemQtyMap[oi.menu_item_id] || 0) + Number(oi.qty);
    const menuItemIds = Object.keys(itemQtyMap);

    const [recipes] = await conn.query(
      `SELECT r.menu_item_id, r.inventory_item_id, r.quantity
       FROM recipes r WHERE r.menu_item_id IN (?)`, [menuItemIds]
    );
    for (const r of recipes) {
      const used = Number(r.quantity) * (itemQtyMap[r.menu_item_id] || 0);
      if (used > 0) {
        await conn.query(
          `UPDATE inventory SET stock = GREATEST(0, stock - ?) WHERE id = ?`, [used, r.inventory_item_id]
        );
      }
    }
  } catch (e) {
    console.warn(`[delivery] inventory deduction failed for ${orderId}: ${e.message}`);
  }
}

/** Export menu in a normalized payload for platform catalog sync (mock-first). */
export async function buildMenuExport(pool, provider) {
  const [items] = await pool.query(
    `SELECT id, name, category, price, description FROM menu_items ORDER BY category, name`
  );
  return {
    provider,
    generated_at: new Date().toISOString(),
    mock: await isMockMode(pool, provider),
    items: items.map(i => ({
      external_id: i.id,
      name: i.name,
      category: i.category,
      // platforms want centavos
      price: Math.round(Number(i.price) * 100),
      currency: 'PHP',
      description: i.description || '',
      available: true,
    })),
  };
}
