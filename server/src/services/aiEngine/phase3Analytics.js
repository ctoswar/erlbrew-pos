/**
 * Deterministic Phase 3 analytics.
 *
 * These functions deliberately have no database or network dependencies. The
 * route layer supplies location-scoped aggregates, while this module remains
 * authoritative when the optional language model is unavailable.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function median(values) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0
    ? (numbers[middle - 1] + numbers[middle]) / 2
    : numbers[middle];
}

/**
 * Forecast menu-item demand using a zero-filled, weighted moving average.
 * The explicit asOfDate makes repeated requests over the same data identical.
 */
export function forecastSales({
  items = [],
  dailyRows = [],
  historyDays = 90,
  horizonDays = 14,
  asOfDate = new Date().toISOString().slice(0, 10),
}) {
  const safeHistoryDays = clamp(Math.floor(toNumber(historyDays, 90)), 7, 735);
  const safeHorizonDays = clamp(Math.floor(toNumber(horizonDays, 14)), 1, 90);
  const itemMap = new Map();

  for (const item of items) {
    const id = String(item.id ?? item.menuItemId ?? '');
    if (id) itemMap.set(id, {
      menuItemId: id,
      name: item.name || 'Unknown',
      category: item.category || 'Uncategorized',
      price: toNumber(item.price),
    });
  }

  const historyMap = new Map();
  for (const row of dailyRows) {
    const id = String(row.menu_item_id ?? row.menuItemId ?? '');
    const day = dateKey(row.sale_date ?? row.date);
    if (!id || !day) continue;
    if (!itemMap.has(id)) {
      itemMap.set(id, {
        menuItemId: id,
        name: row.name || 'Unknown',
        category: row.category || 'Uncategorized',
        price: toNumber(row.price),
      });
    }
    if (!historyMap.has(id)) historyMap.set(id, new Map());
    const dayMap = historyMap.get(id);
    const current = dayMap.get(day) || { qty: 0, revenue: 0 };
    current.qty += toNumber(row.qty);
    current.revenue += toNumber(row.revenue);
    dayMap.set(day, current);
  }

  const results = [];
  for (const item of itemMap.values()) {
    const dayMap = historyMap.get(item.menuItemId) || new Map();
    const values = [];
    for (let offset = safeHistoryDays - 1; offset >= 0; offset -= 1) {
      const day = addDays(asOfDate, -offset);
      values.push(dayMap.get(day) || { qty: 0, revenue: 0 });
    }
    const totalQty = values.reduce((sum, value) => sum + value.qty, 0);
    const totalRevenue = values.reduce((sum, value) => sum + value.revenue, 0);
    const recentValues = values.slice(-Math.min(7, values.length));
    const recentQty = recentValues.reduce((sum, value) => sum + value.qty, 0);
    const overallDaily = totalQty / safeHistoryDays;
    const recentDaily = recentQty / recentValues.length;
    const weightedDaily = (overallDaily * 0.4) + (recentDaily * 0.6);
    const trendRatio = overallDaily > 0 ? recentDaily / overallDaily : 1;
    const trend = round2(clamp(trendRatio, 0.5, 1.5));
    const dailyUnits = round2(weightedDaily);
    const averagePrice = totalQty > 0 ? totalRevenue / totalQty : item.price;
    const forecastUnits = round2(dailyUnits * safeHorizonDays);

    let confidence = 'insufficient';
    if (safeHistoryDays >= 28 && totalQty >= 10) confidence = 'high';
    else if (safeHistoryDays >= 14 && totalQty >= 3) confidence = 'medium';
    else if (totalQty > 0) confidence = 'low';

    results.push({
      menuItemId: item.menuItemId,
      name: item.name,
      category: item.category,
      asOfDate,
      historyStartDate: addDays(asOfDate, -(safeHistoryDays - 1)),
      historyEndDate: asOfDate,
      forecastStartDate: addDays(asOfDate, 1),
      forecastEndDate: addDays(asOfDate, safeHorizonDays),
      historyDays: safeHistoryDays,
      horizonDays: safeHorizonDays,
      dailyUnits,
      forecastUnits,
      averagePrice: round2(averagePrice),
      forecastRevenue: round2(forecastUnits * averagePrice),
      trend,
      confidence,
      historyQuality: confidence === 'high'
        ? 'strong'
        : confidence === 'medium'
          ? 'usable'
          : confidence === 'low'
            ? 'thin'
            : 'insufficient',
      observedUnits: totalQty,
    });
  }

  results.sort((left, right) => right.forecastUnits - left.forecastUnits
    || left.name.localeCompare(right.name)
    || left.menuItemId.localeCompare(right.menuItemId));
  return results;
}

/**
 * Turn forecasted menu demand and recipes into advisory stock actions.
 */
export function calculateInventoryActions({
  inventory = [],
  recipes = [],
  forecasts = [],
  leadTimeDays = 3,
  safetyDays = 1,
}) {
  const safeLeadTime = clamp(Math.floor(toNumber(leadTimeDays, 3)), 0, 30);
  const safeSafetyDays = clamp(Math.floor(toNumber(safetyDays, 1)), 0, 30);
  const demandByIngredient = new Map();
  const qualityByIngredient = new Map();

  for (const recipe of recipes) {
    const inventoryItemId = String(recipe.inventory_item_id ?? recipe.inventoryItemId ?? '');
    const forecast = forecasts.find((entry) =>
      String(entry.menuItemId) === String(recipe.menu_item_id ?? recipe.menuItemId));
    if (!inventoryItemId || !forecast) continue;
    const quantity = toNumber(recipe.quantity);
    const dailyDemand = toNumber(forecast.dailyUnits) * quantity;
    demandByIngredient.set(
      inventoryItemId,
      (demandByIngredient.get(inventoryItemId) || 0) + dailyDemand,
    );
    const qualityFlags = qualityByIngredient.get(inventoryItemId) || [];
    if (!forecast.confidence || ['insufficient', 'low'].includes(forecast.confidence)) {
      qualityFlags.push('low_forecast_confidence');
    }
    if (quantity <= 0) qualityFlags.push('invalid_recipe_quantity');
    qualityByIngredient.set(inventoryItemId, qualityFlags);
  }

  return inventory.map((row) => {
    const id = String(row.id);
    const rawStock = toNumber(row.stock, Number.NaN);
    const stock = Math.max(0, Number.isFinite(rawStock) ? rawStock : 0);
    const threshold = Math.max(0, toNumber(row.low_stock_threshold));
    const dailyDemand = round2(demandByIngredient.get(id) || 0);
    const targetStock = round2(dailyDemand * (safeLeadTime + safeSafetyDays));
    const daysOfStock = dailyDemand > 0 ? round2(stock / dailyDemand) : null;
    const recommendedOrderQty = Math.max(0, Math.ceil(Math.max(targetStock, threshold) - stock));
    const dataQualityFlags = [...new Set([
      ...(qualityByIngredient.get(id) || []),
      ...(dailyDemand <= 0 ? ['no_forecasted_recipe_demand'] : []),
      ...(threshold <= 0 ? ['missing_reorder_threshold'] : []),
      ...(!Number.isFinite(rawStock) ? ['missing_stock_value'] : []),
    ])];

    let status = 'ok';
    let reason = 'Projected stock covers the lead-time demand.';
    if (stock <= 0 && dailyDemand > 0) {
      status = 'stockout';
      reason = 'No stock remains for an ingredient used by forecasted sales.';
    } else if (dailyDemand > 0 && daysOfStock !== null && daysOfStock <= safeLeadTime) {
      status = 'critical';
      reason = 'Stock is expected to run out before the replenishment lead time.';
    } else if (stock <= threshold || recommendedOrderQty > 0) {
      status = 'reorder';
      reason = 'Stock is at or below the configured reorder threshold.';
    }

    return {
      inventoryItemId: id,
      name: row.name || id,
      unit: row.unit || 'pcs',
      locationId: row.location_id ?? row.locationId ?? null,
      stock: round2(stock),
      lowStockThreshold: round2(threshold),
      dailyDemand,
      targetStock,
      daysOfStock,
      recommendedOrderQty,
      dataQualityFlags,
      status,
      reason,
    };
  }).sort((left, right) => {
    const rank = { stockout: 0, critical: 1, reorder: 2, ok: 3 };
    return rank[left.status] - rank[right.status] || left.name.localeCompare(right.name);
  });
}

/**
 * Recommend pairs from completed-order baskets using support, confidence and
 * lift. No recommendation mutates menu or pricing data.
 */
export function recommendCombos({
  pairs = [],
  itemOrders = [],
  totalOrders = 0,
  minSupport = 2,
  minConfidence = 0.1,
}) {
  const ordersByItem = new Map(itemOrders.map((row) => [
    String(row.menu_item_id ?? row.menuItemId),
    toNumber(row.order_count ?? row.orderCount),
  ]));
  const safeOrderCount = Math.max(0, toNumber(totalOrders));
  const safeMinSupport = Math.max(1, Math.floor(toNumber(minSupport, 2)));
  const safeMinConfidence = clamp(toNumber(minConfidence, 0.1), 0, 1);
  return pairs
    .map((pair) => {
      const firstId = String(pair.first_menu_item_id ?? pair.firstMenuItemId ?? '');
      const secondId = String(pair.second_menu_item_id ?? pair.secondMenuItemId ?? '');
      const pairOrders = Math.floor(toNumber(pair.pair_orders ?? pair.pairOrders));
      const firstOrders = ordersByItem.get(firstId) || 0;
      const secondOrders = ordersByItem.get(secondId) || 0;
      if (!firstId || !secondId || pairOrders < safeMinSupport || safeOrderCount <= 0) return null;
      const support = pairOrders / safeOrderCount;
      const confidence = firstOrders > 0 ? pairOrders / firstOrders : 0;
      const secondProbability = secondOrders / safeOrderCount;
      const lift = secondProbability > 0 ? confidence / secondProbability : 0;
      if (confidence < safeMinConfidence) return null;
      return {
        firstMenuItemId: firstId,
        firstName: pair.first_name || firstId,
        secondMenuItemId: secondId,
        secondName: pair.second_name || secondId,
        pairOrders,
        support: round2(support * 100),
        confidence: round2(confidence * 100),
        lift: round2(lift),
      };
    })
    .filter((pair) => pair !== null)
    .sort((left, right) => right.pairOrders - left.pairOrders
      || right.lift - left.lift
      || left.firstMenuItemId.localeCompare(right.firstMenuItemId)
      || left.secondMenuItemId.localeCompare(right.secondMenuItemId));
}

/**
 * Produce bounded, advisory price signals. Cost, volume and history gates
 * intentionally yield a hold signal instead of an aggressive recommendation.
 */
export function suggestPrices({ items = [], historyDays = 90, targetMarginPct = 65 }) {
  const safeHistoryDays = Math.max(0, Math.floor(toNumber(historyDays)));
  const targetMargin = clamp(toNumber(targetMarginPct, 65), 20, 90);
  const soldVolumes = items.map((item) => toNumber(item.qty)).filter((qty) => qty > 0);
  const typicalVolume = median(soldVolumes) || 0;

  return items.map((item) => {
    const price = toNumber(item.price);
    const unitCogs = toNumber(item.unitCogs ?? item.unit_cogs, 0);
    const marginPct = item.marginPct == null ? null : toNumber(item.marginPct);
    const volume = toNumber(item.qty);
    const base = {
      menuItemId: String(item.id ?? item.menuItemId),
      name: item.name || 'Unknown',
      currentPrice: round2(price),
      suggestedPrice: round2(price),
      changePct: 0,
      action: 'hold',
      confidence: 'low',
      reason: 'No change is recommended.',
      guarded: true,
    };

    if (safeHistoryDays < 14) {
      base.reason = 'At least 14 days of history are required.';
      return base;
    }

    if (price <= 0 || unitCogs <= 0 || marginPct == null) {
      base.reason = 'A positive menu price and ingredient cost are required.';
      return base;
    }

    if (volume < 5) {
      base.reason = 'Sales volume is too low for a price signal.';
      return base;
    }

    const lowMargin = marginPct < targetMargin;
    const highMarginLowDemand = marginPct > 85 && typicalVolume > 0 && volume < typicalVolume * 0.75;
    let change = lowMargin ? (marginPct < targetMargin - 15 ? 0.05 : 0.03) : 0;
    if (highMarginLowDemand) change = -0.03;
    change = clamp(change, -0.1, 0.1);

    const roundedPrice = Math.round((price * (1 + change)) / 0.05) * 0.05;
    const floor = unitCogs * 1.2;
    const boundedPrice = Math.max(floor, Math.min(price * 1.1, Math.max(price * 0.9, roundedPrice)));
    const changePct = price > 0 ? round2(((boundedPrice - price) / price) * 100) : 0;
    base.suggestedPrice = round2(boundedPrice);
    base.changePct = changePct;
    base.confidence = safeHistoryDays >= 28 ? 'high' : 'medium';
    if (changePct > 0) {
      base.action = 'increase';
      base.reason = 'Margin is below the guarded target; increase is capped at 10%.';
    } else if (changePct < 0) {
      base.action = 'decrease';
      base.reason = 'High margin and below-typical volume support a small test decrease.';
    } else {
      base.reason = 'The guarded price band does not justify a change.';
    }
    return base;
  }).sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct)
    || left.name.localeCompare(right.name));
}

/**
 * Turn historical hourly order volume into advisory staffing levels. The
 * calculation is intentionally conservative and never edits schedules.
 */
export function suggestStaffing({ hourlyRows = [], staffCount = 0, historyDays = 90, ordersPerStaffHour = 8 }) {
  const safeHistoryDays = Math.max(1, Math.floor(toNumber(historyDays, 90)));
  const safeStaffCount = Math.max(0, Math.floor(toNumber(staffCount)));
  const safeCapacity = Math.max(1, toNumber(ordersPerStaffHour, 8));
  return hourlyRows
    .map((row) => {
      const orderCount = Math.max(0, toNumber(row.order_count ?? row.orderCount));
      const averageOrders = orderCount / safeHistoryDays;
      const suggestedStaff = Math.max(1, Math.ceil(averageOrders / safeCapacity));
      const gap = suggestedStaff - safeStaffCount;
      return {
        dayOfWeek: Number(row.day_of_week ?? row.dayOfWeek),
        hour: Number(row.hour),
        averageOrders: round2(averageOrders),
        currentStaff: safeStaffCount,
        suggestedStaff,
        gap,
        confidence: safeHistoryDays >= 28 && orderCount >= 20 ? 'high' : safeHistoryDays >= 14 ? 'medium' : 'low',
        advisoryOnly: true,
      };
    })
    .filter((row) => Number.isInteger(row.dayOfWeek) && row.dayOfWeek >= 1 && row.dayOfWeek <= 7
      && Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23)
    .sort((left, right) => right.gap - left.gap || right.averageOrders - left.averageOrders
      || left.dayOfWeek - right.dayOfWeek || left.hour - right.hour);
}
