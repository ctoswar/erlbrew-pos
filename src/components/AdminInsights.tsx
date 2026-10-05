import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "../utils";
import {
  BriefingAction,
  ComboRecommendation,
  getInsightsBriefing,
  getInsightsOptimization,
  getMenuInsights,
  InsightsBriefing,
  InventoryAction,
  MenuInsights,
  MenuItemInsight,
  OptimizationResponse,
  PriceSuggestion,
  SalesForecast,
  StaffingSuggestion,
} from "../utils/api";
import { useLocation } from "../contexts/LocationContext";
import { getIconByEmoji } from "./FoodIcons";

const RANGES: Array<{ label: string; days: number }> = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

const HORIZONS = [7, 14, 30];
const LABEL = "text-[9px] text-erl-muted tracking-[0.18em] uppercase";

type InsightTab = "overview" | "forecast" | "inventory" | "menu" | "briefing";

const TABS: Array<{ id: InsightTab; label: string; eyebrow: string }> = [
  { id: "overview", label: "Signal desk", eyebrow: "Overview" },
  { id: "forecast", label: "Forecast", eyebrow: "Demand" },
  { id: "inventory", label: "Inventory actions", eyebrow: "Replenish" },
  { id: "menu", label: "Menu optimization", eyebrow: "Margin + basket" },
  { id: "briefing", label: "AI briefing", eyebrow: "Optional Ollama" },
];

const STATUS_STYLES: Record<InventoryAction["status"], string> = {
  stockout: "border-erl-danger/60 bg-erl-danger/10 text-erl-danger",
  critical: "border-[#e8a020]/60 bg-[#e8a020]/10 text-[#e8a020]",
  reorder: "border-erl-accent/60 bg-erl-accent/10 text-erl-accent",
  ok: "border-erl-success/40 bg-erl-success/5 text-erl-success",
};

const PRIORITY_STYLES: Record<BriefingAction["priority"], string> = {
  high: "bg-erl-danger/15 text-erl-danger border-erl-danger/50",
  medium: "bg-[#e8a020]/15 text-[#e8a020] border-[#e8a020]/50",
  low: "bg-erl-accent/10 text-erl-accent border-erl-accent/40",
};

const money = (value: number | null): string => (value == null ? "—" : formatCurrency(value));
const integer = (value: number): string => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(value);

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function MetricCard({ label, value, detail, tone = "text-erl-accent" }: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-erl-border-subtle bg-erl-surface p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
      <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-erl-accent/5 blur-xl" />
      <div className={LABEL}>{label}</div>
      <div className={`mt-2 text-xl font-semibold tracking-tight ${tone}`}>{value}</div>
      {detail && <div className="mt-1 text-[10px] text-erl-muted">{detail}</div>}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-erl-border-default bg-erl-surface/60 px-5 py-10 text-center">
      <div className="mb-2 text-2xl opacity-70">◌</div>
      <div className="text-sm font-medium text-erl-secondary">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-erl-muted">{detail}</div>
    </div>
  );
}

function SectionTitle({ kicker, title, detail }: { kicker: string; title: string; detail: string }) {
  return (
    <div className="mb-4">
      <div className="text-[9px] font-semibold tracking-[0.22em] text-erl-accent uppercase">{kicker}</div>
      <h2 className="mt-1 font-serif text-xl text-erl-primary">{title}</h2>
      <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-erl-muted">{detail}</p>
    </div>
  );
}

function StaffingTable({ suggestions }: { suggestions: StaffingSuggestion[] }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (suggestions.length === 0) {
    return <EmptyState title="Not enough hourly demand yet" detail="Completed orders will populate staffing suggestions by day and hour." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-erl-border-subtle bg-erl-surface">
      <table className="w-full min-w-[620px] text-left text-[10px]">
        <thead className="bg-erl-elevated text-erl-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Window</th>
            <th className="px-3 py-2 text-right font-semibold">Avg orders</th>
            <th className="px-3 py-2 text-right font-semibold">Current</th>
            <th className="px-3 py-2 text-right font-semibold">Suggested</th>
            <th className="px-3 py-2 text-right font-semibold">Gap</th>
            <th className="px-3 py-2 font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.slice(0, 12).map((suggestion) => (
            <tr key={`${suggestion.dayOfWeek}-${suggestion.hour}`} className="border-t border-erl-border-subtle text-erl-secondary">
              <td className="px-3 py-2">{dayNames[suggestion.dayOfWeek - 1] || "Day"} {String(suggestion.hour).padStart(2, "0")}:00</td>
              <td className="px-3 py-2 text-right">{suggestion.averageOrders.toFixed(1)}</td>
              <td className="px-3 py-2 text-right">{suggestion.currentStaff}</td>
              <td className="px-3 py-2 text-right font-semibold text-erl-accent">{suggestion.suggestedStaff}</td>
              <td className={`px-3 py-2 text-right font-semibold ${suggestion.gap > 0 ? "text-erl-danger" : "text-erl-success"}`}>
                {suggestion.gap > 0 ? `+${suggestion.gap}` : suggestion.gap}
              </td>
              <td className="px-3 py-2 capitalize text-erl-muted">{suggestion.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastList({ forecasts }: { forecasts: SalesForecast[] }) {
  const peak = Math.max(...forecasts.map((forecast) => forecast.forecastUnits), 1);
  if (forecasts.length === 0) {
    return <EmptyState title="No menu demand yet" detail="Completed orders will populate this baseline once the selected location has sales history." />;
  }
  return (
    <div className="space-y-2">
      {forecasts.map((forecast, index) => (
        <div key={forecast.menuItemId} className="rounded-xl border border-erl-border-subtle bg-erl-surface/80 p-3 transition-colors hover:border-erl-border-default">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-erl-accent/10 text-[10px] font-semibold text-erl-accent">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="truncate text-[12px] font-semibold text-erl-secondary">{forecast.name}</div>
                  <div className="text-[10px] text-erl-muted">{forecast.category} · {integer(forecast.dailyUnits)} units/day baseline</div>
                </div>
                <span className="rounded-full border border-erl-border-default px-2 py-0.5 text-[9px] uppercase tracking-wide text-erl-muted">
                  {forecast.confidence}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-erl-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-erl-accent/50 to-erl-accent transition-all"
                  style={{ width: `${Math.max(3, (forecast.forecastUnits / peak) * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-erl-muted">
                <span><strong className="text-erl-secondary">{integer(forecast.forecastUnits)}</strong> next {forecast.horizonDays}d</span>
                <span><strong className="text-erl-secondary">{money(forecast.forecastRevenue)}</strong> projected</span>
                <span className={forecast.trend >= 1 ? "text-erl-success" : "text-erl-danger"}>
                  {forecast.trend >= 1 ? "↗" : "↘"} {Math.round(Math.abs(forecast.trend - 1) * 100)}% vs baseline
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryTable({ actions }: { actions: InventoryAction[] }) {
  if (actions.length === 0) {
    return <EmptyState title="No inventory signals" detail="Inventory items will appear here when the selected location has stock records." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-erl-border-subtle">
      <table className="w-full min-w-[700px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-erl-elevated text-left text-erl-muted">
            <th className="px-3 py-2.5 font-semibold">Ingredient</th>
            <th className="px-3 py-2.5 text-right font-semibold">On hand</th>
            <th className="px-3 py-2.5 text-right font-semibold">Daily demand</th>
            <th className="px-3 py-2.5 text-right font-semibold">Days left</th>
            <th className="px-3 py-2.5 text-right font-semibold">Order qty</th>
            <th className="px-3 py-2.5 text-center font-semibold">Signal</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => (
            <tr key={action.inventoryItemId} className="border-t border-erl-border-subtle text-erl-secondary">
              <td className="px-3 py-3">
                <div className="font-medium">{action.name}</div>
                <div className="mt-0.5 text-[9px] text-erl-muted">{action.reason}</div>
                {action.dataQualityFlags.length > 0 && (
                  <div className="mt-1 text-[9px] text-[#e8a020]">
                    Data check: {action.dataQualityFlags.join(" · ").replace(/_/g, " ")}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-right">{integer(action.stock)} {action.unit}</td>
              <td className="px-3 py-3 text-right">{integer(action.dailyDemand)} / day</td>
              <td className="px-3 py-3 text-right">{action.daysOfStock == null ? "—" : `${integer(action.daysOfStock)}d`}</td>
              <td className="px-3 py-3 text-right font-semibold text-erl-accent">
                {action.recommendedOrderQty > 0 ? `${integer(action.recommendedOrderQty)} ${action.unit}` : "—"}
              </td>
              <td className="px-3 py-3 text-center">
                <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${STATUS_STYLES[action.status]}`}>
                  {action.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MenuItemLine({ item }: { item: MenuItemInsight }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-erl-border-subtle py-2 last:border-b-0">
      <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-erl-secondary">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{getIconByEmoji(item.emoji)}</span>
        <span className="truncate">{item.name}</span>
      </span>
      <span className="shrink-0 text-[10px] text-erl-muted">{formatCurrency(item.revenue)}</span>
    </div>
  );
}

function PriceTable({ suggestions }: { suggestions: PriceSuggestion[] }) {
  if (suggestions.length === 0) {
    return <EmptyState title="No price signals" detail="Price suggestions need at least 14 days of history, enough volume, and positive recipe costs." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-erl-border-subtle">
      <table className="w-full min-w-[620px] border-collapse text-[10px]">
        <thead>
          <tr className="bg-erl-elevated text-left text-erl-muted">
            <th className="px-3 py-2.5 font-semibold">Item</th>
            <th className="px-3 py-2.5 text-right font-semibold">Current</th>
            <th className="px-3 py-2.5 text-right font-semibold">Guarded suggestion</th>
            <th className="px-3 py-2.5 text-center font-semibold">Signal</th>
            <th className="px-3 py-2.5 font-semibold">Why</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((suggestion) => (
            <tr key={suggestion.menuItemId} className="border-t border-erl-border-subtle text-erl-secondary">
              <td className="px-3 py-3 font-medium">{suggestion.name}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(suggestion.currentPrice)}</td>
              <td className="px-3 py-3 text-right font-semibold text-erl-accent">{formatCurrency(suggestion.suggestedPrice)}</td>
              <td className="px-3 py-3 text-center">
                <span className={suggestion.action === "hold" ? "text-erl-muted" : suggestion.action === "increase" ? "text-erl-success" : "text-erl-danger"}>
                  {suggestion.action === "hold" ? "Hold" : `${suggestion.action === "increase" ? "↗" : "↘"} ${Math.abs(suggestion.changePct).toFixed(1)}%`}
                </span>
              </td>
              <td className="max-w-[280px] px-3 py-3 text-erl-muted">{suggestion.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComboCards({ combos }: { combos: ComboRecommendation[] }) {
  if (combos.length === 0) {
    return <EmptyState title="No reliable pairings yet" detail="Combo recommendations require repeated co-purchases in completed orders; one-off baskets are intentionally filtered out." />;
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {combos.slice(0, 8).map((combo) => (
        <div key={`${combo.firstMenuItemId}-${combo.secondMenuItemId}`} className="rounded-xl border border-erl-border-subtle bg-erl-surface p-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-erl-secondary">
            <span className="truncate">{combo.firstName}</span>
            <span className="text-erl-accent">+</span>
            <span className="truncate">{combo.secondName}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-erl-muted">
            <span><strong className="text-erl-accent">{combo.pairOrders}</strong> baskets</span>
            <span>{combo.support.toFixed(1)}% support</span>
            <span>{combo.confidence.toFixed(1)}% confidence</span>
            <span>{combo.lift.toFixed(2)}× lift</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BriefingPanel({ briefing }: { briefing: InsightsBriefing }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-erl-accent/30 bg-gradient-to-br from-erl-accent/10 via-erl-surface to-erl-surface p-5 shadow-[0_12px_40px_rgba(196,149,106,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={LABEL}>Manager briefing · {briefing.source === "ollama" ? "Ollama assisted" : "deterministic fallback"}</div>
          <span className="rounded-full border border-erl-accent/30 px-2 py-1 text-[9px] uppercase tracking-wide text-erl-accent">
            advisory only
          </span>
        </div>
        <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-erl-primary">{briefing.summary}</p>
        <p className="mt-3 text-[10px] text-erl-muted">
          The optional model only summarizes the deterministic forecast, inventory, basket, and price signals. It cannot change menu or stock.
        </p>
      </div>
      {briefing.actions.length === 0 ? (
        <EmptyState title="No immediate actions" detail="The deterministic signals did not identify a priority item for this window." />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {briefing.actions.map((action) => (
            <div key={`${action.priority}-${action.title}`} className="rounded-xl border border-erl-border-subtle bg-erl-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[12px] font-semibold text-erl-secondary">{action.title}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${PRIORITY_STYLES[action.priority]}`}>
                  {action.priority}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-erl-muted">{action.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const AdminInsights: React.FC = () => {
  const { currentLocationId, currentLocation } = useLocation();
  const [activeTab, setActiveTab] = useState<InsightTab>("overview");
  const [days, setDays] = useState(90);
  const [horizonDays, setHorizonDays] = useState(14);
  const [menu, setMenu] = useState<MenuInsights | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResponse | null>(null);
  const [briefing, setBriefing] = useState<InsightsBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [menuResult, optimizationResult, briefingResult] = await Promise.allSettled([
        getMenuInsights(days, currentLocationId),
        getInsightsOptimization(days, currentLocationId, horizonDays),
        getInsightsBriefing(days, currentLocationId, horizonDays),
      ]);
      if (requestId !== requestIdRef.current) return;
      if (menuResult.status === "rejected" || optimizationResult.status === "rejected") {
        const failure = menuResult.status === "rejected"
          ? menuResult.reason
          : optimizationResult.status === "rejected"
            ? optimizationResult.reason
            : new Error("Failed to load analytics");
        throw failure;
      }
      setMenu(menuResult.value);
      setOptimization(optimizationResult.value);
      if (briefingResult.status === "fulfilled") {
        setBriefing(briefingResult.value);
      } else {
        setBriefing({
          locationId: optimizationResult.value.locationId,
          windowDays: days,
          horizonDays,
          summary: "The deterministic analytics are available, but the AI briefing could not be reached.",
          actions: [],
          source: "deterministic-fallback",
          advisoryOnly: true,
        });
      }
    } catch (loadError: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(loadError, "Failed to load analytics"));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [currentLocationId, days, horizonDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const locationLabel = currentLocation?.name || "All locations";
  const forecasts = optimization?.forecasts || [];
  const inventoryActions = optimization?.inventoryActions || [];
  const combos = optimization?.combos || [];
  const priceSuggestions = optimization?.priceSuggestions || [];
  const staffing = optimization?.staffing || [];
  const urgentInventory = inventoryActions.filter((action) => action.status === "stockout" || action.status === "critical");
  const priceChanges = priceSuggestions.filter((suggestion) => suggestion.action !== "hold");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(196,149,106,0.08),transparent_32%)]">
      <header className="shrink-0 border-b border-erl-border-default px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[9px] font-semibold tracking-[0.24em] text-erl-accent uppercase">Phase 03 / Intelligence desk</div>
            <h1 className="mt-1 font-serif text-2xl text-erl-primary sm:text-3xl">Operations intelligence</h1>
            <p className="mt-1 text-[11px] text-erl-muted">
              Transparent demand signals for <span className="text-erl-secondary">{locationLabel}</span> · no automatic mutations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-erl-border-default bg-erl-surface p-1" aria-label="Forecast history window">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  aria-pressed={days === range.days}
                  className={`rounded-lg px-2.5 py-1.5 text-[9px] font-semibold tracking-wide transition-colors ${days === range.days ? "bg-erl-accent text-erl-base shadow-sm" : "text-erl-muted hover:text-erl-secondary"}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-erl-border-default bg-erl-surface px-3 py-1.5 text-[9px] uppercase tracking-wide text-erl-muted">
              Horizon
              <select
                value={horizonDays}
                onChange={(event) => setHorizonDays(Number(event.target.value))}
                className="!w-auto !border-0 !bg-transparent !p-0 text-[10px] font-semibold text-erl-secondary focus:!ring-0"
                aria-label="Forecast horizon"
              >
                {HORIZONS.map((horizon) => <option key={horizon} value={horizon}>{horizon} days</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void load()} className="rounded-xl border border-erl-border-default bg-erl-surface px-3 py-2 text-[10px] font-semibold text-erl-secondary transition-colors hover:border-erl-accent hover:text-erl-accent" aria-label="Refresh analytics">
              ↻ Refresh
            </button>
          </div>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Insight sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group shrink-0 border-b-2 px-3 pb-2 text-left transition-colors ${activeTab === tab.id ? "border-erl-accent text-erl-secondary" : "border-transparent text-erl-muted hover:border-erl-border-medium hover:text-erl-secondary"}`}
            >
              <span className="block text-[9px] uppercase tracking-[0.16em]">{tab.eyebrow}</span>
              <span className="mt-0.5 block text-[11px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="scroll-area min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {loading && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full border-2 border-erl-accent/30 border-t-erl-accent" />
              <div className="text-[11px] text-erl-muted">Building location-scoped signals…</div>
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-erl-danger/60 bg-erl-danger/10 p-4 text-[11px] text-erl-danger" role="alert">
            <div className="font-semibold">Analytics unavailable</div>
            <div className="mt-1">{error}</div>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-erl-danger/50 px-3 py-1.5 text-[10px] font-semibold hover:bg-erl-danger/10">Try again</button>
          </div>
        )}
        {!loading && !error && menu && optimization && briefing && (
          <>
            {activeTab === "overview" && (
              <div className="space-y-5">
                {!menu.quality.enoughHistory && (
                  <div className="rounded-xl border border-[#e8a020]/50 bg-[#e8a020]/10 p-3 text-[10px] text-[#e8a020]">
                    Limited history: {menu.quality.weeksOfHistory} week{menu.quality.weeksOfHistory === 1 ? "" : "s"} observed. Forecast confidence will improve as more completed orders arrive.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  <MetricCard label="Revenue" value={formatCurrency(menu.totals.revenue)} detail={`${days}-day window`} />
                  <MetricCard label="Units sold" value={integer(menu.totals.units)} detail={`${menu.quality.orderCount} completed orders`} tone="text-erl-secondary" />
                  <MetricCard label="Urgent inventory" value={String(urgentInventory.length)} detail="stockout or critical" tone={urgentInventory.length > 0 ? "text-erl-danger" : "text-erl-success"} />
                  <MetricCard label="Price signals" value={String(priceChanges.length)} detail="advisory changes" tone={priceChanges.length > 0 ? "text-[#e8a020]" : "text-erl-success"} />
                </div>
                <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
                  <section>
                    <SectionTitle kicker="Demand baseline" title={`Top forecasts · next ${horizonDays} days`} detail="Weighted recent demand with zero-filled days. This is intentionally transparent rather than a black-box prediction." />
                    <ForecastList forecasts={forecasts.slice(0, 6)} />
                  </section>
                  <section>
                    <SectionTitle kicker="Manager pulse" title="Where to look first" detail="Signals are ranked by operational urgency, not generated by the language model." />
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-erl-border-subtle bg-erl-surface p-4">
                        <div className="flex items-center justify-between"><span className={LABEL}>Replenishment queue</span><span className="text-lg font-semibold text-erl-danger">{urgentInventory.length}</span></div>
                        <p className="mt-2 text-[10px] leading-relaxed text-erl-muted">{urgentInventory.length > 0 ? urgentInventory.slice(0, 2).map((action) => action.name).join(" · ") : "No urgent stockout risk in this window."}</p>
                      </div>
                      <div className="rounded-xl border border-erl-border-subtle bg-erl-surface p-4">
                        <div className="flex items-center justify-between"><span className={LABEL}>Basket opportunities</span><span className="text-lg font-semibold text-erl-accent">{combos.length}</span></div>
                        <p className="mt-2 text-[10px] leading-relaxed text-erl-muted">{combos[0] ? `${combos[0].firstName} + ${combos[0].secondName} is the strongest observed pairing.` : "More completed baskets are needed."}</p>
                      </div>
                      <section>
                        <SectionTitle kicker="Advisory staffing" title="Match coverage to demand" detail="Historical order volume estimates the number of staff needed per day/hour. Review these suggestions against availability and labor rules before editing schedules." />
                        <StaffingTable suggestions={staffing} />
                      </section>
                    </div>
                  </section>
                </div>
              </div>
            )}
            {activeTab === "forecast" && (
              <section>
                <SectionTitle kicker="Deterministic demand model" title="Sales forecast" detail={`A weighted moving average over ${days} days, projected across the next ${horizonDays} days. Confidence reflects history length and observed volume.`} />
                <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  <MetricCard label="Forecast items" value={String(forecasts.length)} detail="menu items with a baseline" />
                  <MetricCard label="Projected units" value={integer(forecasts.reduce((sum, item) => sum + item.forecastUnits, 0))} detail={`next ${horizonDays} days`} tone="text-erl-secondary" />
                  <MetricCard label="Projected revenue" value={formatCurrency(forecasts.reduce((sum, item) => sum + item.forecastRevenue, 0))} detail="at observed average prices" />
                  <MetricCard label="History quality" value={`${menu.quality.weeksOfHistory}w`} detail={menu.quality.enoughHistory ? "usable baseline" : "build more history"} tone={menu.quality.enoughHistory ? "text-erl-success" : "text-[#e8a020]"} />
                </div>
                <ForecastList forecasts={forecasts} />
              </section>
            )}
            {activeTab === "inventory" && (
              <section>
                <SectionTitle kicker="Forecast → stock" title="Inventory actions" detail="Recommended order quantities cover lead-time demand plus one safety day, capped by the configured low-stock threshold. Suggestions never mutate inventory." />
                <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  <MetricCard label="Stockout" value={String(inventoryActions.filter((action) => action.status === "stockout").length)} detail="no stock + demand" tone="text-erl-danger" />
                  <MetricCard label="Critical" value={String(inventoryActions.filter((action) => action.status === "critical").length)} detail="runs out before lead time" tone="text-[#e8a020]" />
                  <MetricCard label="Reorder" value={String(inventoryActions.filter((action) => action.status === "reorder").length)} detail="below threshold" />
                  <MetricCard label="Healthy" value={String(inventoryActions.filter((action) => action.status === "ok").length)} detail="no action needed" tone="text-erl-success" />
                </div>
                <InventoryTable actions={inventoryActions} />
              </section>
            )}
            {activeTab === "menu" && (
              <section className="space-y-6">
                <SectionTitle kicker="Menu optimization" title="Margin, price, and basket signals" detail="Use the suggestions as a review queue. Price changes are bounded to ±10%, require cost data, and are never applied automatically." />
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-erl-border-subtle bg-erl-surface p-4">
                    <div className={LABEL}>Best sellers</div>
                    <div className="mt-2">{menu.best.map((item) => <MenuItemLine key={item.id} item={item} />)}</div>
                  </div>
                  <div className="rounded-xl border border-erl-border-subtle bg-erl-surface p-4">
                    <div className={LABEL}>Needs a closer look</div>
                    <div className="mt-2">{menu.worst.map((item) => <MenuItemLine key={item.id} item={item} />)}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-3">
                    <div className={LABEL}>Guarded price suggestions</div>
                    <p className="mt-1 text-[10px] text-erl-muted">Target margin and historical volume are used to produce advisory holds, increases, or decreases.</p>
                  </div>
                  <PriceTable suggestions={priceSuggestions} />
                </div>
                <div>
                  <div className="mb-3">
                    <div className={LABEL}>Co-purchased pairs</div>
                    <p className="mt-1 text-[10px] text-erl-muted">Support, confidence, and lift are calculated from completed order baskets with minimum support and confidence thresholds.</p>
                  </div>
                  <ComboCards combos={combos} />
                </div>
              </section>
            )}
            {activeTab === "briefing" && (
              <section>
                <SectionTitle kicker="Optional language layer" title="AI briefing" detail="Ollama is an optional private service. If it is disabled, unavailable, slow, or returns invalid JSON, this page uses a deterministic briefing instead." />
                <BriefingPanel briefing={briefing} />
              </section>
            )}
            <div className="mt-6 border-t border-erl-border-subtle pt-3 text-right text-[9px] text-erl-muted">
              Generated {new Date(menu.generatedAt).toLocaleString()} · {locationLabel} · {menu.quality.itemsAnalyzed} menu items analyzed
            </div>
          </>
        )}
      </main>
    </div>
  );
};
