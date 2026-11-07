import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/middleware/auth.js';
import { customerAuthMiddleware } from '../src/middleware/customerAuth.js';
import {
  deriveCustomerNames,
  isVerifiedFirebaseCustomer,
  sentinelPhoneForUid,
} from '../src/routes/customers.js';

process.env.JWT_SECRET = 'customer-security-test-secret';

function request(app, path, token) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const req = http.request({
        hostname: address.address,
        port: address.port,
        path,
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }, (res) => {
        res.resume();
        res.on('end', () => server.close(() => resolve(res.statusCode)));
      });
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
    server.on('error', reject);
  });
}

test('customer tokens cannot access staff middleware routes', async () => {
  const app = express();
  app.get('/staff-only', authMiddleware, (_req, res) => res.sendStatus(204));
  const token = jwt.sign({ sub: 42, customer: true }, process.env.JWT_SECRET);
  assert.equal(await request(app, '/staff-only', token), 403);
});

test('staff tokens remain accepted by staff middleware', async () => {
  const app = express();
  app.get('/staff-only', authMiddleware, (_req, res) => res.sendStatus(204));
  const token = jwt.sign({ sub: 7, role: 'Barista' }, process.env.JWT_SECRET);
  assert.equal(await request(app, '/staff-only', token), 204);
});

test('customer middleware accepts customer tokens only', async () => {
  const app = express();
  app.get('/customer-only', customerAuthMiddleware, (_req, res) => res.sendStatus(204));
  const customerToken = jwt.sign({ sub: 42, customer: true }, process.env.JWT_SECRET);
  const staffToken = jwt.sign({ sub: 7, role: 'Manager' }, process.env.JWT_SECRET);
  assert.equal(await request(app, '/customer-only', customerToken), 204);
  assert.equal(await request(app, '/customer-only', staffToken), 401);
});

test('Firebase customer exchange requires verified email claims', () => {
  assert.equal(isVerifiedFirebaseCustomer({ email: 'customer@example.com', email_verified: true }), true);
  assert.equal(isVerifiedFirebaseCustomer({ email: 'customer@example.com', email_verified: false }), false);
  assert.equal(isVerifiedFirebaseCustomer({ email_verified: true }), false);
});

test('deriveCustomerNames splits the Google display name', () => {
  assert.deepEqual(deriveCustomerNames({ name: 'Juan Dela Cruz', email: 'juan@gmail.com' }), {
    displayName: 'Juan Dela Cruz',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
  });
  assert.deepEqual(deriveCustomerNames({ name: 'Maria', email: 'maria@gmail.com' }), {
    displayName: 'Maria',
    firstName: 'Maria',
    lastName: null,
  });
});

test('deriveCustomerNames falls back to the email local-part', () => {
  const derived = deriveCustomerNames({ email: 'jane.doe@gmail.com' });
  assert.equal(derived.firstName, 'Jane.doe');
  assert.equal(derived.lastName, null);
  assert.equal(derived.displayName, 'Jane.doe');

  const bare = deriveCustomerNames({});
  assert.equal(bare.firstName, 'Erlbrew');
  assert.equal(bare.displayName, 'Erlbrew');
});

test('sentinelPhoneForUid is stable, unique and fits the phone column', () => {
  const a = sentinelPhoneForUid('uid-alpha');
  const b = sentinelPhoneForUid('uid-beta');
  assert.equal(a, sentinelPhoneForUid('uid-alpha')); // deterministic — retries stay idempotent
  assert.notEqual(a, b);
  assert.match(a, /^g-[0-9a-f]{12}$/);
  assert.ok(a.length <= 32); // VARCHAR(32) UNIQUE NOT NULL
});