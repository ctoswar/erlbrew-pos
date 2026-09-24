import crypto from 'crypto';

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ─── PayMongo ────────────────────────────────────────────────────────────────
// Header: Paymongo-Signature: t=<timestamp>,te=<test-sig>,li=<live-sig>
// signed string = `${t}.${rawBody}` HMAC-SHA256(hex) with the webhook secret.
// Compare against BOTH te and li (endpoint secret determines which matches).
export function verifyPaymongo(rawBody, headers, secret) {
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };
  const header = headers['paymongo-signature'];
  if (!header) return { ok: false, reason: 'missing Paymongo-Signature header' };
  const parts = {};
  for (const kv of String(header).split(',')) {
    const idx = kv.indexOf('=');
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const t = parts.t;
  const candidates = [parts.te, parts.li].filter(Boolean);
  if (!t || candidates.length === 0) return { ok: false, reason: 'malformed signature header' };
  const signed = `${t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const ok = candidates.some(c => timingSafeEqual(expected, c));
  return ok ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

// ─── FoodPanda ───────────────────────────────────────────────────────────────
// Static token or Basic auth configured in Vendor Portal — sent as Authorization header.
export function verifyFoodpanda(rawBody, headers, secret) {
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };
  const auth = headers['authorization'];
  if (!auth) return { ok: false, reason: 'missing Authorization header' };
  // Accept either the exact configured string, or Basic <base64> where decoded === secret,
  // or a plain token comparison.
  if (timingSafeEqual(auth, secret)) return { ok: true };
  if (timingSafeEqual(auth, `Basic ${secret}`)) return { ok: true };
  const m = /^Basic\s+(.+)$/i.exec(auth);
  if (m) {
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      // HTTP Basic credentials are "user:pass" — accept with or without the colon suffix
      if (timingSafeEqual(decoded, secret) || timingSafeEqual(decoded, `${secret}:`)) return { ok: true };
      const userPart = decoded.split(':')[0];
      if (timingSafeEqual(userPart, secret)) return { ok: true };
    } catch { /* fall through */ }
  }
  if (timingSafeEqual(auth, `Bearer ${secret}`)) return { ok: true };
  return { ok: false, reason: 'authorization mismatch' };
}

// ─── Grab ────────────────────────────────────────────────────────────────────
// HMAC-SHA256 of raw body, sent as X-Grab-Signature (hex).
// NOTE: confirm exact header name with Grab when partner credentials arrive.
export function verifyGrab(rawBody, headers, secret) {
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };
  const sig = headers['x-grab-signature'] || headers['x-signature'];
  if (!sig) return { ok: false, reason: 'missing signature header' };
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return timingSafeEqual(expected, sig) ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

export const VERIFIERS = {
  paymongo: verifyPaymongo,
  grab: verifyGrab,
  foodpanda: verifyFoodpanda,
};

/** Stable idempotency key for an incoming event. */
export function extractEventId(provider, body, rawBody) {
  const id = body?.data?.id || body?.id || body?.event_id;
  if (id && typeof id === 'string') return id;
  return `sha256:${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 40)}`;
}
