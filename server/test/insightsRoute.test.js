import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import insightsRouter from '../src/routes/insights.js';

process.env.JWT_SECRET = 'phase3-route-test-secret';

function createPool(calls) {
  return {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('SELECT role, location_id FROM staff')) {
        return [[{ role: 'Manager', location_id: null }], []];
      }
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ COLUMN_NAME: 'purchase_cost' }, { COLUMN_NAME: 'unit_cost' }], []];
      }
      if (sql.includes('SELECT m.id, m.name')) {
        return [[{
          id: 'coffee',
          name: 'Coffee',
          category: 'Drinks',
          price: 100,
          emoji: '☕',
          qty: 2,
          revenue: 200,
          unit_cogs: null,
        }], []];
      }
      if (sql.includes('TIMESTAMPDIFF(WEEK')) return [[{ weeks: 4 }], []];
      if (sql.includes('COUNT(*) AS cnt')) return [[{ cnt: 1 }], []];
      return [[], []];
    },
  };
}

function request(app, path, token) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const requestOptions = {
        hostname: address.address,
        port: address.port,
        path,
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      };
      const req = http.request(requestOptions, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close(() => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
        });
      });
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
    server.on('error', reject);
  });
}

test('menu insights enforce Manager role and scope selected location', async () => {
  const calls = [];
  const pool = createPool(calls);
  const app = express();
  app.locals.pool = pool;
  app.use('/api/insights', insightsRouter(pool, {
    ollamaClient: { generateBriefing: async () => ({ summary: 'ok', actions: [], source: 'test' }) },
  }));

  const managerToken = jwt.sign({ sub: 10, role: 'Manager' }, process.env.JWT_SECRET);
  const managerResponse = await request(app, '/api/insights/menu?location_id=2', managerToken);
  assert.equal(managerResponse.statusCode, 200);
  assert.equal(managerResponse.body.locationId, 2);
  const menuQuery = calls.find((call) => call.sql.includes('SELECT m.id, m.name'));
  assert.deepEqual(menuQuery.params, [90, 2, 2]);
  assert.match(menuQuery.sql, /o\.location_id = \?/);
  assert.match(menuQuery.sql, /i\.location_id = \?/);
  const historyQuery = calls.find((call) => call.sql.includes('TIMESTAMPDIFF(WEEK'));
  assert.deepEqual(historyQuery.params, [2]);

  const forecastResponse = await request(app, '/api/insights/forecast?location_id=2&horizonDays=7', managerToken);
  assert.equal(forecastResponse.statusCode, 200);
  assert.equal(forecastResponse.body.locationId, 2);
  assert.equal(forecastResponse.body.horizonDays, 7);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.equal(forecastResponse.body.forecasts[0].forecastStartDate, tomorrow.toISOString().slice(0, 10));
  const dailyQuery = calls.find((call) => call.sql.includes('DATE(o.created_at) AS sale_date'));
  assert.deepEqual(dailyQuery.params, [90, 2]);

  const staffToken = jwt.sign({ sub: 11, role: 'Barista', location_id: 2 }, process.env.JWT_SECRET);
  const staffResponse = await request(app, '/api/insights/menu?location_id=2', staffToken);
  assert.equal(staffResponse.statusCode, 403);
  assert.equal(staffResponse.body.code, 'FORBIDDEN');
});
