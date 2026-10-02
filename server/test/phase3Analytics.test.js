import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryActions,
  forecastSales,
  recommendCombos,
  suggestStaffing,
  suggestPrices,
} from '../src/services/aiEngine/phase3Analytics.js';

test('forecastSales is deterministic and zero-fills missing days', () => {
  const input = {
    items: [{ id: 'coffee', name: 'Coffee', category: 'Drinks', price: 100 }],
    dailyRows: [
      { sale_date: '2026-01-01', menu_item_id: 'coffee', qty: 4, revenue: 400 },
      { sale_date: '2026-01-03', menu_item_id: 'coffee', qty: 2, revenue: 200 },
    ],
    historyDays: 7,
    horizonDays: 7,
    asOfDate: '2026-01-07',
  };
  const first = forecastSales(input);
  const second = forecastSales(input);

  assert.deepEqual(first, second);
  assert.equal(first[0].observedUnits, 6);
  assert.equal(first[0].horizonDays, 7);
  assert.equal(first[0].forecastStartDate, '2026-01-08');
  assert.equal(first[0].forecastEndDate, '2026-01-14');
  assert.equal(first[0].historyQuality, 'thin');
  assert.ok(first[0].forecastUnits > 0);
});

test('calculateInventoryActions scopes advice to recipe demand and flags stockout', () => {
  const actions = calculateInventoryActions({
    inventory: [
      { id: 'beans', name: 'Beans', unit: 'kg', stock: 0, low_stock_threshold: 2, location_id: 4 },
      { id: 'cups', name: 'Cups', unit: 'pcs', stock: 100, low_stock_threshold: 10, location_id: 4 },
    ],
    recipes: [{ menu_item_id: 'coffee', inventory_item_id: 'beans', quantity: 0.02 }],
    forecasts: [{ menuItemId: 'coffee', dailyUnits: 20 }],
  });

  assert.equal(actions[0].inventoryItemId, 'beans');
  assert.equal(actions[0].status, 'stockout');
  assert.equal(actions[0].locationId, 4);
  assert.ok(actions[0].recommendedOrderQty > 0);
  assert.ok(actions[0].dataQualityFlags.includes('low_forecast_confidence'));
  assert.ok(actions[1].dataQualityFlags.includes('no_forecasted_recipe_demand'));
  assert.equal(actions[1].status, 'ok');
});

test('recommendCombos uses support and lift with stable ordering', () => {
  const combos = recommendCombos({
    pairs: [
      { first_menu_item_id: 'a', first_name: 'A', second_menu_item_id: 'b', second_name: 'B', pair_orders: 4 },
      { first_menu_item_id: 'a', first_name: 'A', second_menu_item_id: 'c', second_name: 'C', pair_orders: 1 },
      { first_menu_item_id: 'd', first_name: 'D', second_menu_item_id: 'e', second_name: 'E', pair_orders: 2 },
    ],
    itemOrders: [
      { menu_item_id: 'a', order_count: 5 },
      { menu_item_id: 'b', order_count: 8 },
      { menu_item_id: 'c', order_count: 2 },
      { menu_item_id: 'd', order_count: 50 },
    ],
    totalOrders: 10,
  });

  assert.equal(combos.length, 1);
  assert.equal(combos[0].firstMenuItemId, 'a');
  assert.equal(combos[0].pairOrders, 4);
  assert.equal(combos[0].lift, 1);
});

test('suggestPrices never suggests a change without cost or sufficient history', () => {
  const [missingCost] = suggestPrices({
    historyDays: 90,
    items: [{ id: 'a', name: 'A', price: 100, qty: 20, unitCogs: 0, marginPct: null }],
  });

  const [shortHistory] = suggestPrices({
    historyDays: 7,
    items: [{ id: 'b', name: 'B', price: 100, qty: 20, unitCogs: 80, marginPct: 20 }],
  });

  assert.equal(missingCost.action, 'hold');
  assert.equal(shortHistory.action, 'hold');
  assert.equal(missingCost.guarded, true);
  assert.equal(shortHistory.guarded, true);
});

test('suggestStaffing returns advisory gaps from historical hourly demand', () => {
  const [suggestion] = suggestStaffing({
    historyDays: 30,
    staffCount: 1,
    hourlyRows: [{ day_of_week: 2, hour: 10, order_count: 300 }],
  });
  assert.equal(suggestion.dayOfWeek, 2);
  assert.equal(suggestion.hour, 10);
  assert.equal(suggestion.suggestedStaff, 2);
  assert.equal(suggestion.gap, 1);
  assert.equal(suggestion.advisoryOnly, true);
});
