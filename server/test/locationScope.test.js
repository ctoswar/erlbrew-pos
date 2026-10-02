import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locationScope, requireLocationId, scopedLocationCondition } from '../src/middleware/location.js';

function runMiddleware(req) {
  let statusCode = 200;
  let body = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(value) {
          body = value;
          return value;
        },
      };
    },
  };
  locationScope(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
}

test('regular staff is scoped to the assigned location', () => {
  const req = { user: { role: 'Barista', location_id: 2 }, query: {}, body: {} };
  const result = runMiddleware(req);

  assert.equal(result.nextCalled, true);
  assert.equal(req.locationId, 2);
  assert.deepEqual(scopedLocationCondition(req, 'o.location_id'), {
    sql: ' AND o.location_id = ?',
    params: [2],
  });
});

test('regular staff cannot override the assigned location', () => {
  const req = { user: { role: 'Barista', location_id: 2 }, query: { location_id: '3' }, body: {} };
  const result = runMiddleware(req);

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, 'LOCATION_FORBIDDEN');
});

test('managers may select a location or work across all locations', () => {
  const selected = { user: { role: 'Manager' }, query: { location_id: '3' }, body: {} };
  const all = { user: { role: 'Manager' }, query: {}, body: {} };

  assert.equal(runMiddleware(selected).nextCalled, true);
  assert.equal(selected.locationId, 3);
  assert.equal(runMiddleware(all).nextCalled, true);
  assert.equal(all.locationId, null);
});

test('unassigned regular staff are denied and writes require a concrete location', () => {
  const req = { user: { role: 'Barista', location_id: null }, query: {}, body: {} };
  const result = runMiddleware(req);

  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, 'LOCATION_ASSIGNMENT_REQUIRED');

  const writeReq = { locationId: null };
  let statusCode = 200;
  requireLocationId(writeReq, {
    status(code) {
      statusCode = code;
      return { json() {} };
    },
  }, () => {});
  assert.equal(statusCode, 400);
});
