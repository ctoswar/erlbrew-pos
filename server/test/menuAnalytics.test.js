import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMenu,
  classifyABC,
  classifyQuadrant,
  median,
} from '../src/services/aiEngine/menuAnalytics.js';

const row = (over = {}) => ({
  id: 'M1',
  name: 'Americano',
  category: 'Coffee',
  price: 120,
  emoji: '☕',
  qty: 10,
  revenue: 1200,
  unit_cogs: 30,
  ...over,
});

// ─── median ──────────────────────────────────────────────────────────────────
test('median: odd/even/empty', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([NaN, Infinity, 5]), 5);
});

// ─── ABC (Pareto) ────────────────────────────────────────────────────────────
test('classifyABC: A = items starting within the first 70% of revenue', () => {
  // Cumulative starts: 0%, 70%, 85%, 95% → A, B, B, C
  const classes = classifyABC([
    { revenue: 700 },
    { revenue: 150 },
    { revenue: 100 },
    { revenue: 50 },
  ]);
  assert.deepEqual(classes, ['A', 'B', 'B', 'C']);
});

test('classifyABC: no revenue → everything C', () => {
  assert.deepEqual(classifyABC([{ revenue: 0 }, { revenue: 0 }]), ['C', 'C']);
});

test('classifyABC: all A when single item holds all revenue', () => {
  assert.deepEqual(classifyABC([{ revenue: 999 }]), ['A']);
});

// ─── quadrant ────────────────────────────────────────────────────────────────
test('classifyQuadrant: the four quadrants around median thresholds', () => {
  const base = { qty: 10 };
  // thresholds: revenue 500, margin 50%
  assert.equal(classifyQuadrant({ ...base, revenue: 900, marginPct: 70 }, 500, 50), 'star');
  assert.equal(classifyQuadrant({ ...base, revenue: 900, marginPct: 30 }, 500, 50), 'workhorse');
  assert.equal(classifyQuadrant({ ...base, revenue: 100, marginPct: 70 }, 500, 50), 'hidden_gem');
  assert.equal(classifyQuadrant({ ...base, revenue: 100, marginPct: 30 }, 500, 50), 'dog');
});

test('classifyQuadrant: unsold and uncosted items are not classified', () => {
  assert.equal(classifyQuadrant({ qty: 0, revenue: 0, marginPct: null }, 500, 50), 'unsold');
  assert.equal(classifyQuadrant({ qty: 5, revenue: 900, marginPct: null }, 500, 50), null);
});

// ─── analyzeMenu ─────────────────────────────────────────────────────────────
test('analyzeMenu: margin math uses recipe cost, not revenue alone', () => {
  const out = analyzeMenu({ rows: [row({ qty: 10, revenue: 1200, unit_cogs: 30 })] });
  const item = out.items[0];
  assert.equal(item.cogs, 300);
  assert.equal(item.grossProfit, 900);
  assert.equal(item.marginPct, 75);
});

test('analyzeMenu: unknown cost → null margin (never 0), flagged in quality', () => {
  const out = analyzeMenu({
    rows: [row({ unit_cogs: null }), row({ id: 'M2', name: 'Latte', qty: 5, revenue: 700, unit_cogs: 40 })],
  });
  const uncosted = out.items.find((i) => i.id === 'M1');
  assert.equal(uncosted.marginPct, null);
  assert.equal(uncosted.grossProfit, null);
  assert.equal(out.quality.itemsMissingCost, 1);
  assert.equal(out.uncosted.length, 1);
  // Profit covers only the costed revenue.
  assert.equal(out.totals.grossProfit, 500);
  assert.ok(out.totals.profitCoveragePct > 0 && out.totals.profitCoveragePct < 100);
});

test('analyzeMenu: no cost data at all → totals.grossProfit null', () => {
  const out = analyzeMenu({ rows: [row({ unit_cogs: null })] });
  assert.equal(out.totals.grossProfit, null);
  assert.equal(out.totals.marginPct, null);
  assert.equal(out.totals.profitCoveragePct, 0);
  assert.equal(out.thresholds.marginPct, null);
});

test('analyzeMenu: items are sorted by revenue and best/worst slices are correct', () => {
  const out = analyzeMenu({
    rows: [
      row({ id: 'A', name: 'A', qty: 1, revenue: 100 }),
      row({ id: 'B', name: 'B', qty: 2, revenue: 500 }),
      row({ id: 'C', name: 'C', qty: 3, revenue: 300 }),
      row({ id: 'D', name: 'D', qty: 4, revenue: 700 }),
      row({ id: 'E', name: 'E', qty: 5, revenue: 200 }),
      row({ id: 'F', name: 'F', qty: 6, revenue: 600 }),
    ],
  });
  assert.deepEqual(out.items.map((i) => i.id), ['D', 'F', 'B', 'C', 'E', 'A']);
  assert.equal(out.best[0].id, 'D');
  assert.equal(out.worst[0].id, 'A');
  assert.equal(out.totals.revenue, 2400);
});

test('analyzeMenu: unit_cogs 0 (costs never entered) counts as unknown, not 100% margin', () => {
  const out = analyzeMenu({ rows: [row({ unit_cogs: 0 })] });
  const item = out.items[0];
  assert.equal(item.unitCogs, null);
  assert.equal(item.marginPct, null);
  assert.equal(item.grossProfit, null);
  assert.equal(out.quality.itemsMissingCost, 1);
  assert.equal(out.totals.grossProfit, null);
});

test('analyzeMenu: zero-qty rows are unsold and excluded from best/worst', () => {
  const out = analyzeMenu({
    rows: [row({ id: 'DEAD', name: 'Dead', qty: 0, revenue: 0 }), row({ id: 'LIVE', name: 'Live', qty: 1, revenue: 100 })],
  });
  assert.equal(out.quality.itemsSold, 1);
  assert.equal(out.best.length, 1);
  assert.equal(out.worst.length, 1);
  assert.equal(out.items.find((i) => i.id === 'DEAD').quadrant, 'unsold');
});

test('analyzeMenu: quality gates — enoughHistory only with >= 2 weeks', () => {
  assert.equal(analyzeMenu({ rows: [], weeksOfHistory: 1 }).quality.enoughHistory, false);
  assert.equal(analyzeMenu({ rows: [], weeksOfHistory: 2 }).quality.enoughHistory, true);
});

test('analyzeMenu: AOV is null with no orders, computed otherwise', () => {
  assert.equal(analyzeMenu({ rows: [row()], orderCount: 0 }).totals.avgOrderValue, null);
  // 1200 / 4 = 300
  assert.equal(analyzeMenu({ rows: [row()], orderCount: 4 }).totals.avgOrderValue, 300);
});

test('analyzeMenu: empty input produces a safe payload', () => {
  const out = analyzeMenu({ rows: [], days: 30, orderCount: 0, weeksOfHistory: 0 });
  assert.equal(out.items.length, 0);
  assert.equal(out.best.length, 0);
  assert.equal(out.worst.length, 0);
  assert.equal(out.totals.revenue, 0);
  assert.equal(out.thresholds.revenue, null);
  assert.equal(out.quality.enoughHistory, false);
});
