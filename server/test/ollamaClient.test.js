import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackBriefing,
  createOllamaClient,
  parseBriefing,
} from '../src/services/ollamaClient.js';

const facts = {
  locationId: 2,
  windowDays: 30,
  horizonDays: 14,
  forecast: [{ menuItemId: 'coffee', forecastUnits: 20 }],
  inventoryActions: [{
    name: 'Beans',
    status: 'stockout',
    reason: 'No stock remains.',
  }],
  combos: [],
  priceSuggestions: [],
};

test('parseBriefing accepts only the strict advisory JSON shape', () => {
  assert.deepEqual(parseBriefing('{"summary":"Ready.","actions":[]}'), {
    summary: 'Ready.',
    actions: [],
  });
  assert.equal(parseBriefing('```json\n{"summary":"No","actions":[]}\n```'), null);
  assert.equal(parseBriefing('{"summary":"No","actions":[{"title":"x","reason":"y","priority":"urgent"}]}'), null);
  assert.equal(parseBriefing('{"summary":"No","actions":[],"write":"orders"}'), null);
});

test('Ollama client validates a mocked response without a live model', async () => {
  const client = createOllamaClient({
    baseUrl: 'http://ollama.test',
    model: 'test-model',
    fetchImpl: async (url, request) => {
      assert.equal(url, 'http://ollama.test/api/generate');
      const body = JSON.parse(request.body);
      assert.equal(body.format, 'json');
      assert.equal(body.options.temperature, 0);
      return {
        ok: true,
        async json() {
          return { response: '{"summary":"Reviewed.","actions":[]}' };
        },
      };
    },
  });

  const result = await client.generateBriefing(facts);
  assert.equal(result.source, 'ollama');
  assert.equal(result.summary, 'Reviewed.');
});

test('Ollama failure returns deterministic fallback', async () => {
  const client = createOllamaClient({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  const result = await client.generateBriefing(facts);
  const fallback = buildFallbackBriefing(facts);
  assert.equal(result.source, 'deterministic-fallback');
  assert.deepEqual({ summary: result.summary, actions: result.actions }, fallback);
});

test('disabled Ollama returns fallback without attempting a request', async () => {
  let called = false;
  const client = createOllamaClient({
    enabled: false,
    fetchImpl: async () => {
      called = true;
      throw new Error('should not be called');
    },
  });
  const result = await client.generateBriefing(facts);
  assert.equal(called, false);
  assert.equal(result.source, 'deterministic-fallback');
});
