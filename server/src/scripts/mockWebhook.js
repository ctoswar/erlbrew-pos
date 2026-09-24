/**
 * Send a signed mock webhook to a running server — for testing via tunnel
 * (ngrok / Cloudflare Tunnel → localhost:3001) without real gateway accounts.
 *
 * Usage:
 *   node src/scripts/mockWebhook.js paymongo paid  [orderId]
 *   node src/scripts/mockWebhook.js paymongo expired [orderId]
 *   node src/scripts/mockWebhook.js foodpanda received [externalOrderId]
 *   node src/scripts/mockWebhook.js grab received [externalOrderId]
 *
 * Env:
 *   WEBHOOK_SECRET     — signing secret (default: test-webhook-secret)
 *   WEBHOOK_URL        — full endpoint URL (default: http://localhost:3001/api/webhooks/<provider>)
 */
import crypto from 'crypto';

const [, , provider, kind = 'paid', ref = 'TEST-ORDER-1'] = process.argv;
if (!provider || !['paymongo', 'foodpanda', 'grab'].includes(provider)) {
  console.error('Usage: node mockWebhook.js <paymongo|foodpanda|grab> [paid|expired|failed|received|cancelled] [ref]');
  process.exit(1);
}

const secret = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
const url = process.env.WEBHOOK_URL || `http://localhost:3001/api/webhooks/${provider}`;

function buildPayload() {
  if (provider === 'paymongo') {
    const typeMap = { paid: 'checkout_session.payment.paid', expired: 'checkout_session.expired', failed: 'payment.failed' };
    return {
      data: {
        id: `evt_mock_${Date.now()}`,
        type: 'event',
        attributes: { type: typeMap[kind] || typeMap.paid },
        data: {
          id: `csm_${Date.now()}`,
          type: 'checkout_session',
          attributes: { reference_number: ref, payments: [{ id: `pay_mock_${Date.now()}` }] },
        },
      },
    };
  }
  if (provider === 'foodpanda') {
    return {
      order_id: ref,
      status: kind === 'cancelled' ? 'CANCELLED' : 'RECEIVED',
      customer: { name: 'Test Customer', phone: '09171234567' },
      total_price: 250,
      items: [{ item_name: 'ES-01', quantity: 1, price: 250 }],
    };
  }
  // grab
  return {
    order_id: ref,
    status: kind === 'cancelled' ? 'CANCELLED' : 'RECEIVED',
    receiver: { name: 'Test Customer', phone_number: '09171234567' },
    total: { amount: 250 },
    items: [{ item_name: 'ES-01', quantity: 1, price: 250 }],
  };
}

const body = JSON.stringify(buildPayload());
const headers = { 'Content-Type': 'application/json' };

if (provider === 'paymongo') {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  headers['Paymongo-Signature'] = `t=${t},te=${sig}`;
} else if (provider === 'grab') {
  headers['X-Grab-Signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
} else {
  // foodpanda: static token / Basic auth
  headers['Authorization'] = `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
}

console.log(`POST ${url}`);
console.log(`Authorization/signature headers using secret: ${secret.slice(0, 4)}…`);

const res = await fetch(url, { method: 'POST', headers, body });
const text = await res.text();
console.log(`→ ${res.status} ${text}`);
