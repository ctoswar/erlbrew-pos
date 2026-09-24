import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyPaymongo, verifyFoodpanda, verifyGrab, extractEventId } from '../src/services/webhookVerify.js';

const SECRET = 'whsec_test_123';

// ─── PayMongo ────────────────────────────────────────────────────────────────
test('paymongo: valid te signature accepted', () => {
  const body = JSON.stringify({ data: { id: 'evt_1' } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const r = verifyPaymongo(body, { 'paymongo-signature': `t=${t},te=${sig}` }, SECRET);
  assert.equal(r.ok, true);
});

test('paymongo: valid li signature accepted (live endpoint)', () => {
  const body = JSON.stringify({ data: { id: 'evt_2' } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const r = verifyPaymongo(body, { 'paymongo-signature': `t=${t},li=${sig}` }, SECRET);
  assert.equal(r.ok, true);
});

test('paymongo: tampered body rejected', () => {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${JSON.stringify({ data: { id: 'evt_1' } })}`).digest('hex');
  const r = verifyPaymongo('{"data":{"id":"evt_EVIL"}}', { 'paymongo-signature': `t=${t},te=${sig}` }, SECRET);
  assert.equal(r.ok, false);
});

test('paymongo: wrong secret rejected', () => {
  const body = '{"a":1}';
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'wrong').update(`${t}.${body}`).digest('hex');
  const r = verifyPaymongo(body, { 'paymongo-signature': `t=${t},te=${sig}` }, SECRET);
  assert.equal(r.ok, false);
});

test('paymongo: missing header rejected', () => {
  assert.equal(verifyPaymongo('{}', {}, SECRET).ok, false);
});

test('paymongo: missing secret rejected', () => {
  const r = verifyPaymongo('{}', { 'paymongo-signature': 't=1,te=abc' }, null);
  assert.equal(r.ok, false);
});

test('paymongo: malformed header rejected', () => {
  assert.equal(verifyPaymongo('{}', { 'paymongo-signature': 'garbage' }, SECRET).ok, false);
});

// ─── Grab ────────────────────────────────────────────────────────────────────
test('grab: valid HMAC body signature accepted', () => {
  const body = JSON.stringify({ order_id: 'G1' });
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  assert.equal(verifyGrab(body, { 'x-grab-signature': sig }, SECRET).ok, true);
});

test('grab: wrong signature rejected', () => {
  assert.equal(verifyGrab('{"a":1}', { 'x-grab-signature': 'deadbeef' }, SECRET).ok, false);
});

test('grab: missing header rejected', () => {
  assert.equal(verifyGrab('{}', {}, SECRET).ok, false);
});

// ─── FoodPanda ───────────────────────────────────────────────────────────────
test('foodpanda: exact Authorization value accepted', () => {
  assert.equal(verifyFoodpanda('{}', { authorization: SECRET }, SECRET).ok, true);
});

test('foodpanda: Basic base64(user:pass) decoded and accepted', () => {
  const auth = `Basic ${Buffer.from(`${SECRET}:`).toString('base64')}`;
  assert.equal(verifyFoodpanda('{}', { authorization: auth }, SECRET).ok, true);
});

test('foodpanda: Bearer token accepted', () => {
  assert.equal(verifyFoodpanda('{}', { authorization: `Bearer ${SECRET}` }, SECRET).ok, true);
});

test('foodpanda: wrong token rejected', () => {
  assert.equal(verifyFoodpanda('{}', { authorization: 'Basic d3Jvbmc6' }, SECRET).ok, false);
});

test('foodpanda: missing header rejected', () => {
  assert.equal(verifyFoodpanda('{}', {}, SECRET).ok, false);
});

// ─── Idempotency key ─────────────────────────────────────────────────────────
test('extractEventId: prefers PayMongo resource id', () => {
  const body = { data: { id: 'evt_abc' } };
  assert.equal(extractEventId('paymongo', body, '{}'), 'evt_abc');
});

test('extractEventId: falls back to body hash when no id', () => {
  const raw = '{"foo":1}';
  const id = extractEventId('foodpanda', JSON.parse(raw), raw);
  assert.match(id, /^sha256:[0-9a-f]{40}/);
});

test('extractEventId: same payload → same key (retry dedupe)', () => {
  const raw = '{"foo":1}';
  assert.equal(
    extractEventId('foodpanda', JSON.parse(raw), raw),
    extractEventId('foodpanda', JSON.parse(raw), raw)
  );
});
