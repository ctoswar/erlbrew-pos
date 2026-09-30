/**
 * Menu optimization analytics — pure, DB-free functions (Phase 3, issue #181).
 *
 * Kept deliberately pure so it can be unit-tested with node:test, mirroring
 * the accounting mappers. The route layer (routes/insights.js) does the SQL
 * and passes plain rows in:
 *
 *   { id, name, category, price, emoji, qty, revenue, unit_cogs }
 *
 * `unit_cogs` is the ingredient cost per serving computed from recipes ×
 * inventory.purchase_cost. It is `null` when the recipe is missing or cost
 * data has not been entered — margin is then reported as `null`, never 0,
 * so the UI can distinguish "no profit" from "unknown cost".
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const QUADRANTS = ['star', 'workhorse', 'hidden_gem', 'dog'];

/** Median of a numeric array (empty → null). */
export function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * ABC (Pareto) classes by cumulative revenue share, descending:
 *   A = items covering the first 70% of revenue
 *   B = next 20%
 *   C = tail
 * Ties are stable (caller passes revenue-sorted rows).
 */
export function classifyABC(items) {
  const totalRevenue = items.reduce((s, it) => s + (Number(it.revenue) || 0), 0);
  let cumulative = 0;
  return items.map((it) => {
    const before = totalRevenue > 0 ? cumulative / totalRevenue : 1;
    cumulative += Number(it.revenue) || 0;
    if (before < 0.7) return 'A';
    if (before < 0.9) return 'B';
    return 'C';
  });
}

/**
 * Sales-vs-margin quadrant using median thresholds.
 * Items with unknown margin (no cost data) are never classified — the caller
 * gets `null` back and should surface them as "needs cost data".
 */
export function classifyQuadrant(item, revenueThreshold, marginThreshold) {
  if (item.qty <= 0) return 'unsold';
  if (item.marginPct == null || revenueThreshold == null || marginThreshold == null) return null;
  const highRevenue = item.revenue >= revenueThreshold;
  const highMargin = item.marginPct >= marginThreshold;
  if (highRevenue && highMargin) return 'star';
  if (highRevenue && !highMargin) return 'workhorse';
  if (!highRevenue && highMargin) return 'hidden_gem';
  return 'dog';
}

/**
 * Build the full menu insight payload from aggregated rows.
 *
 * @param {object} input
 * @param {Array}  input.rows            aggregated order-item rows (see header)
 * @param {number} input.days            analysis window in days
 * @param {number} input.orderCount      distinct orders in the window
 * @param {number} input.weeksOfHistory  weeks of order history available
 */
export function analyzeMenu({ rows = [], days = 90, orderCount = 0, weeksOfHistory = 0 }) {
  // Enrich rows with margin math. Unknown cost → null, not 0.
  // `unit_cogs <= 0` means recipes exist but inventory costs were never
  // entered (purchase_cost defaults to 0) — reporting that as a real cost
  // would fabricate a 100% margin, so it counts as unknown too.
  const enriched = rows.map((r) => {
    const qty = Number(r.qty) || 0;
    const revenue = round2(Number(r.revenue) || 0);
    const cogsRaw = r.unit_cogs == null ? null : Number(r.unit_cogs);
    const hasCost = cogsRaw != null && Number.isFinite(cogsRaw) && cogsRaw > 0;
    const unitCogs = hasCost ? round2(cogsRaw) : null;
    const cogs = hasCost ? round2(unitCogs * qty) : null;
    const grossProfit = hasCost ? round2(revenue - cogs) : null;
    const marginPct = hasCost && revenue > 0 ? round2((grossProfit / revenue) * 100) : null;
    return {
      id: String(r.id),
      name: r.name || 'Unknown',
      category: r.category || 'Uncategorized',
      price: round2(Number(r.price) || 0),
      emoji: r.emoji || '☕',
      qty,
      revenue,
      unitCogs,
      cogs,
      grossProfit,
      marginPct,
      abc: 'C',
      quadrant: null,
    };
  });

  // Descending revenue, then qty — stable-ish tiebreak by name.
  enriched.sort((a, b) => b.revenue - a.revenue || b.qty - a.qty || a.name.localeCompare(b.name));

  // ABC classes on the sorted list.
  const abc = classifyABC(enriched);
  enriched.forEach((it, i) => { it.abc = abc[i]; });

  // Median thresholds computed only from items that actually sold and have
  // margin data, so a handful of uncosted items can't skew the matrix.
  const sold = enriched.filter((it) => it.qty > 0);
  const costed = sold.filter((it) => it.marginPct != null);
  const revenueThreshold = sold.length > 0 ? median(sold.map((it) => it.revenue)) : null;
  const marginThreshold = costed.length > 0 ? median(costed.map((it) => it.marginPct)) : null;

  enriched.forEach((it) => {
    it.quadrant = classifyQuadrant(it, revenueThreshold, marginThreshold);
  });

  const totalRevenue = round2(enriched.reduce((s, it) => s + it.revenue, 0));
  const totalUnits = enriched.reduce((s, it) => s + it.qty, 0);
  const costedRevenue = costed.reduce((s, it) => s + it.revenue, 0);
  const costedProfit = round2(costed.reduce((s, it) => s + (it.grossProfit || 0), 0));
  // Profit is only trustworthy when it covers (nearly) all revenue.
  const coveragePct = totalRevenue > 0 ? Math.round((costedRevenue / totalRevenue) * 100) : 0;
  const marginPct = costedRevenue > 0 ? round2((costedProfit / costedRevenue) * 100) : null;

  const itemsMissingCost = costed.length === sold.length ? 0 : sold.length - costed.length;

  const byQuadrant = Object.fromEntries(QUADRANTS.map((q) => [q, enriched.filter((it) => it.quadrant === q)]));

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    quality: {
      orderCount,
      weeksOfHistory,
      // < 2 weeks of history → rankings are noise
      enoughHistory: weeksOfHistory >= 2,
      itemsAnalyzed: enriched.length,
      itemsSold: sold.length,
      itemsMissingCost,
      marginCoveragePct: coveragePct,
    },
    totals: {
      revenue: totalRevenue,
      units: totalUnits,
      orderCount,
      avgOrderValue: orderCount > 0 ? round2(totalRevenue / orderCount) : null,
      // Sum of profit over costed items; null when no cost data at all.
      grossProfit: costed.length > 0 ? costedProfit : null,
      // Share of revenue the grossProfit figure covers (0–100).
      profitCoveragePct: coveragePct,
      marginPct,
    },
    thresholds: {
      revenue: revenueThreshold != null ? round2(revenueThreshold) : null,
      marginPct: marginThreshold != null ? round2(marginThreshold) : null,
    },
    items: enriched,
    best: enriched.filter((it) => it.qty > 0).slice(0, 5),
    worst: enriched.filter((it) => it.qty > 0).slice(-5).reverse(),
    matrix: {
      star: byQuadrant.star,
      workhorse: byQuadrant.workhorse,
      hidden_gem: byQuadrant.hidden_gem,
      dog: byQuadrant.dog,
    },
    // Sold items with no recipe/cost data — surfaced so the admin can fix them.
    uncosted: enriched.filter((it) => it.qty > 0 && it.marginPct == null),
  };
}
