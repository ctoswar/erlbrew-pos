import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "../utils";
import { getMenuInsights, MenuInsights, MenuItemInsight } from "../utils/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const RANGES: Array<{ label: string; days: number }> = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

const labelStyle = "text-[9px] text-erl-muted tracking-widest uppercase";

const ABC_STYLES: Record<string, string> = {
  A: "bg-erl-success/15 text-erl-success border-erl-success",
  B: "bg-erl-accent/15 text-erl-accent border-erl-accent",
  C: "bg-erl-danger/10 text-erl-danger border-erl-danger/50",
};

const QUADRANT_KEYS = ["star", "workhorse", "hidden_gem", "dog"] as const;
type QuadrantKey = (typeof QUADRANT_KEYS)[number];

const QUADRANT_META: Record<QuadrantKey, { label: string; hint: string; style: string }> = {
  star: {
    label: "⭐ Stars",
    hint: "High revenue, high margin — protect and promote",
    style: "border-erl-success bg-erl-success/5",
  },
  workhorse: {
    label: "🛠 Workhorses",
    hint: "High revenue, low margin — review cost or price",
    style: "border-erl-accent bg-erl-accent/5",
  },
  hidden_gem: {
    label: "💎 Hidden Gems",
    hint: "Low revenue, high margin — push harder",
    style: "border-[#7FB3D5] bg-[#7FB3D5]/5",
  },
  dog: {
    label: "🐕 Dogs",
    hint: "Low revenue, low margin — consider replacing",
    style: "border-erl-danger bg-erl-danger/5",
  },
};

const pct = (n: number | null): string => (n == null ? "—" : `${n.toFixed(1)}%`);
const money = (n: number | null): string => (n == null ? "—" : formatCurrency(n));

const ItemLine: React.FC<{ item: MenuItemInsight }> = ({ item }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-[11px] text-erl-secondary truncate">
      {item.emoji} {item.name}
    </span>
    <span className="text-[10px] text-erl-muted flex-shrink-0">{formatCurrency(item.revenue)}</span>
  </div>
);

export const AdminInsights: React.FC = () => {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<MenuInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMenuInsights(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const chartData = (data?.items ?? [])
    .filter((i) => i.qty > 0)
    .slice(0, 10)
    .map((i) => ({ name: i.name.length > 14 ? `${i.name.slice(0, 13)}…` : i.name, revenue: i.revenue }));

  const unsold = (data?.items ?? []).filter((i) => i.qty === 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-b border-erl-border-default flex-shrink-0 justify-between items-start sm:items-center">
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase text-erl-accent">Menu Insights</div>
          <div className="text-[9px] text-erl-muted mt-0.5">Best/worst sellers, margin matrix & ABC classes</div>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-[7px] rounded-lg text-[9px] font-bold tracking-wide uppercase border-[1.5px] cursor-pointer transition-colors ${
                days === r.days
                  ? "border-erl-accent bg-erl-accent text-erl-base"
                  : "border-erl-border-default text-erl-muted hover:text-erl-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-area flex-1 p-4 overflow-y-auto">
        {loading && <div className="text-center text-erl-muted py-12">Loading insights…</div>}

        {error && (
          <div className="bg-erl-danger/10 border border-erl-danger text-erl-danger rounded-xl p-4 text-[11px]">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Data-quality banners */}
            {!data.quality.enoughHistory && (
              <div className="bg-[#e8a020]/10 border border-[#e8a020] text-[#e8a020] rounded-xl p-3 mb-3 text-[10px]">
                ⚠ Only {data.quality.weeksOfHistory} week{data.quality.weeksOfHistory === 1 ? "" : "s"} of order
                history — rankings may be noisy. Check back after 2 weeks of sales.
              </div>
            )}
            {data.quality.itemsMissingCost > 0 && (
              <div className="bg-erl-accent/10 border border-erl-accent text-erl-accent rounded-xl p-3 mb-3 text-[10px]">
                ℹ {data.quality.itemsMissingCost} sold item{data.quality.itemsMissingCost === 1 ? "" : "s"} missing
                recipe cost data — margin covers {data.quality.marginCoveragePct}% of revenue. Add recipes in
                Inventory → Recipes to complete the picture.
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <div className="bg-erl-surface rounded-[10px] p-3">
                <div className={labelStyle}>Revenue</div>
                <div className="text-base font-bold mt-1 text-erl-accent">{formatCurrency(data.totals.revenue)}</div>
              </div>
              <div className="bg-erl-surface rounded-[10px] p-3">
                <div className={labelStyle}>Units Sold</div>
                <div className="text-base font-bold mt-1 text-erl-secondary">{data.totals.units}</div>
              </div>
              <div className="bg-erl-surface rounded-[10px] p-3">
                <div className={labelStyle}>Gross Profit</div>
                <div className="text-base font-bold mt-1 text-erl-success">
                  {money(data.totals.grossProfit)}
                  {data.totals.grossProfit != null && data.totals.profitCoveragePct < 100 && (
                    <span className="text-[9px] font-normal text-erl-muted"> ({data.totals.profitCoveragePct}%)</span>
                  )}
                </div>
              </div>
              <div className="bg-erl-surface rounded-[10px] p-3">
                <div className={labelStyle}>Items Sold</div>
                <div className="text-base font-bold mt-1 text-erl-secondary">
                  {data.quality.itemsSold}
                  <span className="text-[9px] font-normal text-erl-muted"> / {data.quality.itemsAnalyzed}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
              {/* Top 10 chart */}
              <div className="bg-erl-surface rounded-xl p-4">
                <div className="text-[10px] text-erl-muted tracking-widest uppercase mb-3">
                  Top 10 by Revenue ({data.windowDays}d)
                </div>
                {chartData.length === 0 ? (
                  <div className="text-center text-erl-muted py-8 text-[11px]">No sales in this period</div>
                ) : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9a8f85" }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 9, fill: "#9a8f85" }} />
                        <Tooltip
                          contentStyle={{ background: "#1e0e06", border: "1px solid #3a2a1c", borderRadius: 8, fontSize: 11 }}
                          formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
                        />
                        <Bar dataKey="revenue" fill="#C9873A" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Best / Worst */}
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-erl-surface rounded-xl p-4">
                  <div className="text-[10px] text-erl-muted tracking-widest uppercase mb-2">🏆 Best Sellers</div>
                  {data.best.length === 0 ? (
                    <div className="text-[11px] text-erl-muted py-2">No sales in this period</div>
                  ) : (
                    data.best.map((i) => <ItemLine key={i.id} item={i} />)
                  )}
                </div>
                <div className="bg-erl-surface rounded-xl p-4">
                  <div className="text-[10px] text-erl-muted tracking-widest uppercase mb-2">🐌 Worst Sellers</div>
                  {data.worst.length === 0 ? (
                    <div className="text-[11px] text-erl-muted py-2">No sales in this period</div>
                  ) : (
                    data.worst.map((i) => <ItemLine key={i.id} item={i} />)
                  )}
                  {unsold.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-erl-border-subtle">
                      <div className="text-[9px] text-erl-danger tracking-widest uppercase mb-1">
                        No sales ({unsold.length})
                      </div>
                      <div className="text-[10px] text-erl-muted truncate">
                        {unsold.map((i) => i.name).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Margin matrix */}
            <div className="bg-erl-surface rounded-xl p-4 mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-[10px] text-erl-muted tracking-widest uppercase">Margin Matrix</div>
                <div className="text-[9px] text-erl-muted">
                  median revenue {money(data.thresholds.revenue)} · median margin {pct(data.thresholds.marginPct)}
                </div>
              </div>
              <div className="text-[9px] text-erl-muted mb-3">
                Quadrants split at the median — items are relative to your own menu, not an industry benchmark.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUADRANT_KEYS.map((q) => {
                  const meta = QUADRANT_META[q];
                  const items = data.matrix[q];
                  return (
                    <div key={q} className={`border rounded-[10px] p-3 ${meta.style}`}>
                      <div className="text-[11px] font-bold text-erl-secondary">
                        {meta.label}{" "}
                        <span className="text-[9px] font-normal text-erl-muted">({items.length})</span>
                      </div>
                      <div className="text-[9px] text-erl-muted mb-1.5">{meta.hint}</div>
                      {items.length === 0 ? (
                        <div className="text-[10px] text-erl-muted">—</div>
                      ) : (
                        items.slice(0, 6).map((i) => <ItemLine key={i.id} item={i} />)
                      )}
                      {items.length > 6 && (
                        <div className="text-[9px] text-erl-muted">+{items.length - 6} more…</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full ranked table */}
            <div className="bg-erl-surface rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-erl-border-subtle text-[9px] font-semibold text-erl-muted tracking-widest uppercase">
                All Items — ranked by revenue
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-erl-elevated">
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">#</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Item</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Category</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Revenue</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Profit</th>
                      <th className="px-3 py-2 text-right text-erl-muted font-semibold">Margin</th>
                      <th className="px-3 py-2 text-center text-erl-muted font-semibold">ABC</th>
                      <th className="px-3 py-2 text-left text-erl-muted font-semibold">Quadrant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((i, idx) => (
                      <tr key={i.id} className="border-t border-erl-border-subtle">
                        <td className="px-3 py-2 text-erl-muted">{idx + 1}</td>
                        <td className="px-3 py-2 text-erl-secondary">
                          {i.emoji} {i.name}
                        </td>
                        <td className="px-3 py-2 text-erl-muted">{i.category}</td>
                        <td className="px-3 py-2 text-right text-erl-secondary">{i.qty}</td>
                        <td className="px-3 py-2 text-right text-erl-accent font-semibold">
                          {formatCurrency(i.revenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-erl-success">{money(i.grossProfit)}</td>
                        <td className="px-3 py-2 text-right text-erl-secondary">{pct(i.marginPct)}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded border text-[8px] font-bold ${ABC_STYLES[i.abc]}`}
                          >
                            {i.abc}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-erl-muted">
                          {i.quadrant === "unsold"
                            ? "unsold"
                            : i.quadrant
                              ? QUADRANT_META[i.quadrant].label
                              : "—"}
                        </td>
                      </tr>
                    ))}
                    {data.items.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-erl-muted">
                          No menu items yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[9px] text-erl-muted mt-3 text-right">
              Generated {new Date(data.generatedAt).toLocaleString()} · {data.quality.orderCount} orders in window ·{" "}
              {data.quality.weeksOfHistory} weeks of history
            </div>
          </>
        )}
      </div>
    </div>
  );
};
