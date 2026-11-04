import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import staffRouter, { maskStaffName } from '../src/routes/staff.js';

// The RFID card-lookup endpoint is exposed publicly (Cloudflare tunnel) — these
// tests pin down its minified response shape, name masking and rate limiting.

const STAFF_ROW = {
  id: 4242,
  name: 'Jane Dela Cruz',
  role: 'Barista',
  initials: 'JD',
  color: '#C9873A',
  location_id: null,
};

function createPool(rows) {
  return {
    async query(sql) {
      if (sql.includes('SELECT id, name, role, initials, color, location_id FROM staff')) {
        return [rows, []];
      }
      return [[], []];
    },
  };
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const req = http.request(
        { hostname: address.address, port: address.port, path, method: 'GET' },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            server.close(() => resolve({ status: res.statusCode, body }));
          });
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
    server.on('error', reject);
  });
}

test('maskStaffName initials-masks every word', () => {
  assert.equal(maskStaffName('Jane Dela Cruz'), 'J*** D*** C***');
  assert.equal(maskStaffName('Jane'), 'J***');
  assert.equal(maskStaffName('  Jane\tDela   Cruz  '), 'J*** D*** C***');
  assert.equal(maskStaffName(''), '');
  assert.equal(maskStaffName(null), '');
});

test('rfid lookup answers with minified, masked payload (no card UID leakage)', async () => {
  const calls = [];
  const app = express();
  const limiterStub = undefined; // limiter sits inside the router factory
  void limiterStub;
  app.use('/api/staff', staffRouter(createPool([STAFF_ROW])));

  const { status, body } = await request(app, '/api/staff/rfid/RFID_EXAMPLE_1');
  const parsed = JSON.parse(body);

  assert.equal(status, 200);
  assert.equal(parsed.id, 4242);
  assert.equal(parsed.name, 'J*** D*** C***'); // masked
  assert.equal(parsed.role, 'Barista');
  assert.equal(parsed.initials, 'JD');
  assert.equal(parsed.color, '#C9873A');
  assert.equal(parsed.location_id, null);
  // Leaked before: raw card UID(s) + timestamps
  assert.equal(parsed.rfid, undefined);
  assert.equal(parsed.rfid_alt, undefined);
  assert.equal(parsed.created_at, undefined);
  void calls;
});

test('unknown card returns JSON null (existing client contract)', async () => {
  const app = express();
  app.use('/api/staff', staffRouter(createPool([])));
  const { status, body } = await request(app, '/api/staff/rfid/UNKOWN_CARD');
  assert.equal(status, 200);
  assert.equal(body, 'null');
});

test('11th lookup inside the window is rate-limited (429)', async () => {
  const app = express();
  app.use('/api/staff', staffRouter(createPool([STAFF_ROW])));
  // Same app/instance shares limiter state — fire the whole burst sequentially.
  const statuses = [];
  for (let i = 0; i < 11; i += 1) {
    const { status } = await request(app, `/api/staff/rfid/RFID_EXAMPLE_${i}`);
    statuses.push(status);
  }
  assert.deepStrictEqual(statuses.slice(0, 10), Array(10).fill(200));
  assert.equal(statuses[10], 429);
});
