import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatCurrency } from "../utils";
import { apiAdminGet, getSalesReport, getStaffReport, DailySalesReport, SalesReportSummary, StaffReport } from "../utils/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type DateRange = "today" | "this_week" | "this_month" | "last_month" | "last_2_weeks" | "custom" | "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec" | "year_to_date";

export const AdminReports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<"sales" | "inventory" | "staff">("sales");
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<"summary" | "items" | "staff" | "stock">("summary");

  // Sales report data
  const [salesData, setSalesData] = useState<DailySalesReport[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary>({ totalRevenue: 0, totalOrders: 0, avgOrder: 0, totalCOGS: 0, grossProfit: 0 });

  // Inventory report data
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<any[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);

  // Staff report data
  const [staffStats, setStaffStats] = useState<StaffReport[]>([]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const customStartRef = useRef(startDate);
  const customEndRef = useRef(endDate);

  useEffect(() => {
    customStartRef.current = startDate;
    customEndRef.current = endDate;
  }, [startDate, endDate]);

  const getDateRange = useCallback((): { start: string; end: string } => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const d = (offset: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + offset);
      return x;
    };

    const getMonthDates = (month: number) => {
      const start = new Date(currentYear, month, 1);
      const end = new Date(currentYear, month + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    };

    switch (dateRange) {
      case "today":
        return { start: fmt(today), end: fmt(today) };
      case "this_week": {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return { start: fmt(startOfWeek), end: fmt(today) };
      }
      case "this_month": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: fmt(startOfMonth), end: fmt(today) };
      }
      case "last_month": {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: fmt(startOfLastMonth), end: fmt(endOfLastMonth) };
      }
      case "last_2_weeks": {
        const twoWeeksAgo = d(-14);
        return { start: fmt(twoWeeksAgo), end: fmt(today) };
      }
      case "year_to_date": {
        const startOfYear = new Date(currentYear, 0, 1);
        return { start: fmt(startOfYear), end: fmt(today) };
      }
      case "jan": return getMonthDates(0);
      case "feb": return getMonthDates(1);
      case "mar": return getMonthDates(2);
      case "apr": return getMonthDates(3);
      case "may": return getMonthDates(4);
      case "jun": return getMonthDates(5);
      case "jul": return getMonthDates(6);
      case "aug": return getMonthDates(7);
      case "sep": return getMonthDates(8);
      case "oct": return getMonthDates(9);
      case "nov": return getMonthDates(10);
      case "dec": return getMonthDates(11);
      case "custom":
        return { start: customStartRef.current, end: customEndRef.current };
      default:
        return { start: fmt(today), end: fmt(today) };
    }
  }, [dateRange]);

  useEffect(() => {
    if (dateRange !== "custom") {
      const { start, end } = getDateRange();
      setStartDate(start);
      setEndDate(end);
    }
  }, [dateRange, getDateRange]);

  const fetchSalesData = useCallback(async () => {
    const { start, end } = getDateRange();
    setLoading(true);
    try {
      const result = await getSalesReport(start, end);
      setSalesData(result.data);
      setSalesSummary(result.summary);
    } catch (e) {
      console.error("Failed to fetch sales data", e);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await apiAdminGet<any[]>("/inventory");
      setInventoryItems(items);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventoryHistory = useCallback(async (itemId?: string) => {
    try {
      const { start, end } = getDateRange();
      const qs = new URLSearchParams();
      qs.append("start", start);
      qs.append("end", end);
      if (itemId) qs.append("itemId", itemId);
      qs.append("limit", "500");
      const rows = await apiAdminGet<any[]>(`/inventory/movements?${qs.toString()}`);
      setInventoryHistory(rows || []);
    } catch (e) {
      console.error("Failed to fetch inventory history", e);
    }
  }, [getDateRange]);

  const fetchStaffData = useCallback(async () => {
    const { start, end } = getDateRange();
    setLoading(true);
    try {
      const result = await getStaffReport(start, end);
      setStaffStats(result);
    } catch (e) {
      console.error("Failed to fetch staff data", e);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    if (activeReport === "sales") fetchSalesData();
    else if (activeReport === "inventory") { fetchInventoryData(); fetchInventoryHistory(selectedInventoryItem || undefined); }
    else if (activeReport === "staff") fetchStaffData();
  }, [activeReport, fetchSalesData, fetchInventoryData, fetchStaffData, selectedInventoryItem]);

  // Export CSV
  const exportCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSalesCSV = () => {
    const rows = [
      ["Date", "Orders", "Revenue", "COGS", "Profit"],
      ...salesData.map(d => [d.date, String(d.orders), String(d.revenue), String(d.cogs), String(d.profit)]),
      ["", "", "", "", ""],
      ["Summary", "", "", "", ""],
      ["Total Revenue", String(salesSummary.totalRevenue), "", "", ""],
      ["Total Orders", String(salesSummary.totalOrders), "", "", ""],
      ["Avg Order", String(salesSummary.avgOrder), "", "", ""],
      ["Total COGS", String(salesSummary.totalCOGS), "", "", ""],
      ["Gross Profit", String(salesSummary.grossProfit), "", "", ""],
    ];
    exportCSV(`sales-report-${startDate}-to-${endDate}.csv`, rows);
  };

  const exportStaffCSV = () => {
    const rows = [
      ["Staff", "Orders", "Revenue", "Avg/Order", "Hours Worked"],
      ...staffStats.map(s => [s.name, String(s.orders), String(s.revenue), s.orders > 0 ? String(s.revenue / s.orders) : "0", String(s.hoursWorked.toFixed(1))]),
    ];
    exportCSV(`staff-report-${startDate}-to-${endDate}.csv`, rows);
  };

  const exportInventoryCSV = () => {
    const rows = [
      ["Item", "Category", "Stock", "Unit", "Purchase Cost", "Unit Cost", "Low Stock Threshold"],
      ...inventoryItems.map(i => [i.name, i.category, String(i.stock), i.unit, String(i.purchase_cost ?? ""), String(i.unit_cost ?? ""), String(i.low_stock_threshold ?? 10)]),
    ];
    exportCSV(`inventory-report-${new Date().toISOString().split("T")[0]}.csv`, rows);
  };

  const lowStockItems = inventoryItems.filter((i: any) => i.stock <= (i.low_stock_threshold || 10));
  const outOfStockItems = inventoryItems.filter((i: any) => i.stock <= 0);

  const labelStyle = "text-[9px] text-erl-accent-muted tracking-widest uppercase font-bold";

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Report Type Tabs */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-1.5 px-4 py-3 border-b border-erl-border-default flex-shrink-0 justify-between items-start sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto pb-1 sm:pb-0">
          {([["sales", "Sales Report"], ["inventory", "Inventory Report"], ["staff", "Staff Report"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveReport(key)} className={`
              flex-shrink-0 px-5 py-[7px] rounded-lg text-[9px] font-bold tracking-wide cursor-pointer uppercase
              ${activeReport === key ? "border-[1.5px] border-erl-accent bg-erl-accent/15 text-erl-accent" : "border-[1.5px] border-erl-border-default bg-transparent text-erl-secondary"}
            `}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => {
            if (activeReport === "sales") exportSalesCSV();
            else if (activeReport === "staff") exportStaffCSV();
            else exportInventoryCSV();
          }} className="flex-1 sm:flex-none px-4 py-[7px] rounded-lg text-[9px] font-bold tracking-wide cursor-pointer uppercase border-[1.5px] border-erl-success bg-erl-success/10 text-erl-success">
            📥 Export CSV
          </button>
          <button onClick={() => setShowPrintModal(true)} className="flex-1 sm:flex-none px-4 py-[7px] rounded-lg text-[9px] font-bold tracking-wide cursor-pointer uppercase border-[1.5px] border-erl-accent bg-erl-accent/10 text-erl-accent">
            🖨 Print
          </button>
        </div>
      </div>

      {/* Date Range Selector (only for Sales and Staff reports) */}
      {activeReport !== "inventory" && (
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-erl-border-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
            <div className="text-[9px] text-erl-muted tracking-wide flex-shrink-0">PERIOD:</div>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                ["Today", "today"],
                ["This Week", "this_week"],
                ["Last 2 Weeks", "last_2_weeks"],
                ["This Month", "this_month"],
                ["Last Month", "last_month"],
              ] as const).map(([label, value]) => (
                <button key={value} onClick={() => setDateRange(value)} className={`
                  px-2.5 py-1 text-[8px] rounded-md cursor-pointer
                  ${dateRange === value ? "border border-erl-accent bg-erl-accent/15 text-erl-accent font-bold" : "border border-erl-border-subtle bg-transparent text-erl-muted font-normal"}
                `}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
            <div className="text-[9px] text-erl-muted tracking-wide flex-shrink-0">MONTH:</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const).map((month) => (
                <button key={month} onClick={() => setDateRange(month)} className={`
                  px-2 py-1 text-[8px] rounded-md cursor-pointer
                  ${dateRange === month ? "border border-erl-accent bg-erl-accent/15 text-erl-accent font-bold" : "border border-erl-border-subtle bg-transparent text-erl-muted font-normal"}
                `}>
                  {month.toUpperCase()}
                </button>
              ))}
              <button onClick={() => setDateRange("year_to_date")} className={`
                px-2.5 py-1 text-[8px] rounded-md cursor-pointer
                ${dateRange === "year_to_date" ? "border border-erl-accent bg-erl-accent/15 text-erl-accent font-bold" : "border border-erl-border-subtle bg-transparent text-erl-muted font-normal"}
              `}>
                Year to Date
              </button>
            </div>
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 text-[10px] rounded-md border border-erl-border-subtle bg-erl-base text-erl-text-primary" />
              <span className="text-erl-muted text-[10px]">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 text-[10px] rounded-md border border-erl-border-subtle bg-erl-base text-erl-text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="scroll-area flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="text-center text-erl-muted py-12">Loading...</div>
        ) : (
          <>
            {/* SALES REPORT */}
            {activeReport === "sales" && (
              <div>
                {/* Charts */}
                <div className="bg-erl-surface rounded-xl p-4 mb-4">
                  <div className="text-[10px] text-erl-muted tracking-widest uppercase mb-3">
                    Revenue vs Profit
                  </div>
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={salesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "var(--text-muted)" }} />
                        <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          formatter={(value: any, name: any) => [formatCurrency(value), name]}
                          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: 8, fontSize: 10 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={{ fill: "var(--gold)", r: 2 }} name="Revenue" />
                        <Line type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} dot={{ fill: "var(--success)", r: 2 }} name="Profit" />
                        <Line type="monotone" dataKey="cogs" stroke="var(--danger)" strokeWidth={1.5} dot={{ fill: "var(--danger)", r: 2 }} name="COGS" strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center text-erl-muted py-8">No sales data for this period</div>
                  )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                  {[
                    { label: "Total Revenue", value: formatCurrency(salesSummary.totalRevenue), color: "text-erl-accent" },
                    { label: "Total Orders", value: String(salesSummary.totalOrders), color: "text-erl-text-primary" },
                    { label: "Avg Order", value: formatCurrency(salesSummary.avgOrder), color: "text-erl-success" },
                    { label: "COGS", value: formatCurrency(salesSummary.totalCOGS), color: "text-erl-danger" },
                    { label: "Gross Profit", value: formatCurrency(salesSummary.grossProfit), color: salesSummary.grossProfit >= 0 ? "text-erl-success" : "text-erl-danger" },
                    { label: "Margin", value: salesSummary.totalRevenue > 0 ? `${((salesSummary.grossProfit / salesSummary.totalRevenue) * 100).toFixed(1)}%` : "0%", color: "text-erl-muted" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-erl-surface rounded-[10px] p-3">
                      <div className={labelStyle}>{label}</div>
                      <div className={`text-base font-bold mt-1 ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Daily Breakdown Table */}
                {salesData.length > 0 && (
                  <div className="bg-erl-surface rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-erl-border-subtle text-[9px] font-semibold text-erl-muted tracking-widest uppercase">
                      Daily Breakdown
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-erl-elevated">
                          <th className="px-3 py-2 text-left text-erl-muted font-semibold">Date</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">Orders</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">Revenue</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">COGS</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.map((d) => (
                          <tr key={d.date} className="border-t border-erl-border-subtle">
                            <td className="px-3 py-2 text-erl-secondary">{d.date}</td>
                            <td className="px-3 py-2 text-right text-erl-muted">{d.orders}</td>
                            <td className="px-3 py-2 text-right text-erl-accent font-semibold">{formatCurrency(d.revenue)}</td>
                            <td className="px-3 py-2 text-right text-erl-danger">{formatCurrency(d.cogs)}</td>
                            <td className="px-3 py-2 text-right text-erl-success font-semibold">{formatCurrency(d.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INVENTORY REPORT */}
            {activeReport === "inventory" && (
              <div>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
                  <div className="bg-erl-surface rounded-[10px] p-3 text-center">
                    <div className="text-xl font-bold text-erl-accent">{inventoryItems.length}</div>
                    <div className={labelStyle}>Total Items</div>
                  </div>
                  <div className="bg-erl-surface rounded-[10px] p-3 text-center">
                    <div className="text-xl font-bold text-[#e8a020]">{lowStockItems.length}</div>
                    <div className={labelStyle}>Low Stock</div>
                  </div>
                  <div className="bg-erl-surface rounded-[10px] p-3 text-center">
                    <div className="text-xl font-bold text-erl-danger">{outOfStockItems.length}</div>
                    <div className={labelStyle}>Out of Stock</div>
                  </div>
                </div>

                {/* Inventory History Chart */}
                {inventoryHistory.length > 0 && (
                  <div className="bg-erl-surface rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10px] text-erl-muted tracking-widest uppercase">Stock Movements</div>
                      <select
                        value={selectedInventoryItem || ""}
                        onChange={(e) => setSelectedInventoryItem(e.target.value || null)}
                        className="text-[9px] bg-erl-base border border-erl-border-default rounded-md px-2 py-1 text-erl-text-primary outline-none cursor-pointer"
                      >
                        <option value="">All items</option>
                        {inventoryItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={inventoryHistory.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="created_at" tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickFormatter={(v) => v ? v.slice(0, 10) : ""} />
                        <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} />
                        <Tooltip
                          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: 8, fontSize: 10 }}
                          formatter={(_value: any, _name: any, props: any) => {
                            const row = props?.payload;
                            return [`${row?.quantity || 0} ${row?.unit || ''}`, row?.movement_type || ''];
                          }}
                          labelFormatter={(label: any) => `Date: ${label?.slice(0, 10) || ""}`}
                        />
                        <Bar dataKey="quantity" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Low Stock Alert Table */}
                {lowStockItems.length > 0 && (
                  <div className="bg-erl-surface rounded-xl mb-4 overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-erl-border-subtle text-[9px] font-semibold text-[#e8a020] tracking-widest uppercase">
                      Low Stock Alerts
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-erl-elevated">
                          <th className="px-3 py-2 text-left text-erl-muted font-semibold">Item</th>
                          <th className="px-3 py-2 text-center text-erl-muted font-semibold">Category</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">Stock</th>
                          <th className="px-3 py-2 text-right text-erl-muted font-semibold">Alert At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockItems.map((item: any) => (
                          <tr key={item.id} className="border-t border-erl-border-subtle">
                            <td className="px-3 py-2 text-erl-text-primary font-medium">{item.name}</td>
                            <td className="px-3 py-2 text-center text-erl-muted">{item.category}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${item.stock <= 0 ? "text-erl-danger" : "text-[#e8a020]"}`}>
                              {item.stock} {item.unit}
                            </td>
                            <td className="px-3 py-2 text-right text-erl-muted">
                              {item.low_stock_threshold} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Inventory Table */}
                <div className="bg-erl-surface rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-erl-border-subtle text-[9px] font-semibold text-erl-muted tracking-widest uppercase">
                    All Inventory Items
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-erl-elevated">
                        <th className="px-3 py-2 text-left text-erl-muted font-semibold">Item</th>
                        <th className="px-3 py-2 text-center text-erl-muted font-semibold">Category</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Stock</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Unit</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Purchase Cost</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item: any) => (
                        <tr key={item.id} className="border-t border-erl-border-subtle">
                          <td className="px-3 py-2 text-erl-text-primary font-medium">{item.name}</td>
                          <td className="px-3 py-2 text-center text-erl-muted">{item.category}</td>
                          <td className={`px-3 py-2 text-right ${item.stock <= (item.low_stock_threshold || 10) ? "text-erl-danger" : "text-erl-secondary"}`}>
                            {item.stock}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted">{item.unit}</td>
                          <td className="px-3 py-2 text-right text-erl-secondary">
                            {item.purchase_cost != null ? formatCurrency(item.purchase_cost) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-secondary">
                            {item.unit_cost != null ? formatCurrency(item.unit_cost) : "-"}
                          </td>
                        </tr>
                      ))}
                      {inventoryItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-erl-muted">
                            No inventory items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {/* STAFF REPORT */}
            {activeReport === "staff" && (
              <div>
                <div className="bg-erl-surface rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-erl-border-subtle text-[9px] font-semibold text-erl-muted tracking-widest uppercase">
                    Staff Performance ({startDate} to {endDate})
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-erl-elevated">
                        <th className="px-3 py-2 text-left text-erl-muted font-semibold">Staff</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Orders</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Revenue</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Avg/Order</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Hours</th>
                        <th className="px-3 py-2 text-right text-erl-muted font-semibold">Revenue/Hr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffStats.map((s) => (
                        <tr key={s.staff_id} className="border-t border-erl-border-subtle">
                          <td className="px-3 py-2 text-erl-text-primary font-medium">
                            <span className="inline-block w-5 h-5 rounded-full text-[8px] font-bold text-white text-center leading-5 mr-2" style={{ background: s.color || '#888' }}>
                              {s.initials || '?'}
                            </span>
                            {s.name}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted">{s.orders}</td>
                          <td className="px-3 py-2 text-right text-erl-accent font-semibold">{formatCurrency(s.revenue)}</td>
                          <td className="px-3 py-2 text-right text-erl-secondary">
                            {s.orders > 0 ? formatCurrency(s.revenue / s.orders) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-muted">
                            {s.hoursWorked > 0 ? `${s.hoursWorked.toFixed(1)}h` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-erl-success font-semibold">
                            {s.hoursWorked > 0 ? formatCurrency(s.revenue / s.hoursWorked) : "-"}
                          </td>
                        </tr>
                      ))}
                      {staffStats.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-erl-muted">
                            No staff data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Print Modal */}
      <PrintModal
        show={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        printType={printType}
        setPrintType={setPrintType}
        salesData={salesData}
        salesSummary={salesSummary}
        inventoryItems={inventoryItems}
        staffStats={staffStats}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

const PrintModal: React.FC<{
  show: boolean;
  onClose: () => void;
  printType: "summary" | "items" | "staff" | "stock";
  setPrintType: (t: "summary" | "items" | "staff" | "stock") => void;
  salesData: DailySalesReport[];
  salesSummary: SalesReportSummary;
  inventoryItems: any[];
  staffStats: StaffReport[];
  startDate: string;
  endDate: string;
}> = ({ show, onClose, printType, setPrintType, salesData, salesSummary, inventoryItems, staffStats, startDate, endDate }) => {
  if (!show) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${(() => { try { const s = localStorage.getItem('erlbrew_company_settings'); return s ? JSON.parse(s).company_name || 'Erlbrew Café POS' : 'Erlbrew Café POS'; } catch { return 'Erlbrew Café POS'; } })()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #C9873A; padding-bottom: 15px; }
            .header h1 { font-size: 24px; color: #1a0e06; margin-bottom: 5px; }
            .header h2 { font-size: 18px; color: #C9873A; font-weight: normal; }
            .header .date-range { font-size: 12px; color: #666; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f0eb; font-weight: 600; font-size: 12px; text-transform: uppercase; }
            td { font-size: 13px; }
            .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
            .summary-card { background: #f9f5f2; border: 1px solid #e0d5c8; border-radius: 8px; padding: 15px; text-align: center; }
            .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1; color: #888; margin-bottom: 5px; }
            .summary-card .value { font-size: 20px; font-weight: 700; color: #C9873A; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const lowStockItems = inventoryItems.filter((i: any) => i.stock <= (i.low_stock_threshold || 10));
  const outOfStockItems = inventoryItems.filter((i: any) => i.stock <= 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/65 z-[998]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[999] p-4">
        <div className="bg-erl-elevated border-[1.5px] border-erl-border-medium rounded-2xl p-6 w-full max-w-[380px] max-h-[90dvh] max-h-[90vh] overflow-y-auto">
          <div className="text-sm font-bold text-erl-text-primary mb-4 font-display">
            Print Report
          </div>

          <div className="flex flex-col gap-2.5 mb-4">
            {([
              ["summary", "Sales Summary", "Revenue, orders, profit overview"],
              ["items", "Item Sales", "Best selling items breakdown"],
              ["staff", "Staff Report", "Staff performance summary"],
              ["stock", "Current Stock", "All inventory items with stock levels"],
            ] as const).map(([value, label, desc]) => (
              <button key={value} onClick={() => setPrintType(value)} className={`
                px-4 py-3 rounded-[10px] cursor-pointer text-left
                ${printType === value ? "border-2 border-erl-accent bg-erl-accent/15" : "border-2 border-erl-border-default bg-transparent"}
              `}>
                <div className="text-xs font-bold text-erl-text-primary mb-0.5">{label}</div>
                <div className="text-[10px] text-erl-muted">{desc}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-erl-border-default bg-transparent text-erl-secondary text-[10px] font-bold cursor-pointer">
              Cancel
            </button>
            <button onClick={handlePrint} className="flex-1 py-2.5 rounded-lg border-none bg-erl-accent text-erl-sidebar text-[10px] font-bold cursor-pointer">
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print Content */}
      <div id="print-area" className="hidden">
        <div className="header">
          <h1>{(() => { try { const s = localStorage.getItem('erlbrew_company_settings'); return s ? JSON.parse(s).company_name || 'Erlbrew Café POS' : 'Erlbrew Café POS'; } catch { return 'Erlbrew Café POS'; } })()}</h1>
          <h2>{printType === "summary" ? "Sales Summary Report" : printType === "items" ? "Item Sales Report" : printType === "staff" ? "Staff Performance Report" : "Current Stock Report"}</h2>
          <div className="date-range">Period: {startDate} to {endDate} | Generated: {new Date().toLocaleString()}</div>
        </div>

        {printType === "summary" && (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <div className="label">Total Revenue</div>
                <div className="value">{formatCurrency(salesSummary.totalRevenue)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Total Orders</div>
                <div className="value">{salesSummary.totalOrders}</div>
              </div>
              <div className="summary-card">
                <div className="label">Avg Order Value</div>
                <div className="value">{formatCurrency(salesSummary.avgOrder)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Gross Profit</div>
                <div className="value">{formatCurrency(salesSummary.grossProfit)}</div>
              </div>
              <div className="summary-card">
                <div className="label">COGS</div>
                <div className="value">{formatCurrency(salesSummary.totalCOGS)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Margin</div>
                <div className="value">{salesSummary.totalRevenue > 0 ? ((salesSummary.grossProfit / salesSummary.totalRevenue) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                  <th style={{ textAlign: "right" }}>COGS</th>
                  <th style={{ textAlign: "right" }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map(d => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td style={{ textAlign: "right" }}>{d.orders}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(d.revenue)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(d.cogs)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(d.profit)}</td>
                  </tr>
                ))}
                {salesData.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No sales data</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {printType === "items" && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Orders</th>
                <th style={{ textAlign: "right" }}>Revenue</th>
                <th style={{ textAlign: "right" }}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {[...salesData].sort((a, b) => b.revenue - a.revenue).map((d, idx) => (
                <tr key={d.date}>
                  <td>{idx + 1}</td>
                  <td>{d.date}</td>
                  <td style={{ textAlign: "right" }}>{d.orders}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(d.revenue)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(d.profit)}</td>
                </tr>
              ))}
              {salesData.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No item sales data</td></tr>
              )}
            </tbody>
          </table>
        )}

        {printType === "staff" && (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <div className="label">Total Staff</div>
                <div className="value">{staffStats.length}</div>
              </div>
              <div className="summary-card">
                <div className="label">Total Orders</div>
                <div className="value">{staffStats.reduce((s, x) => s + x.orders, 0)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Total Revenue</div>
                <div className="value">{formatCurrency(staffStats.reduce((s, x) => s + x.revenue, 0))}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th style={{ textAlign: "right" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                  <th style={{ textAlign: "right" }}>Avg/Order</th>
                  <th style={{ textAlign: "right" }}>Hours</th>
                  <th style={{ textAlign: "right" }}>Revenue/Hr</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map(s => (
                  <tr key={s.staff_id}>
                    <td>{s.name}</td>
                    <td style={{ textAlign: "right" }}>{s.orders}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(s.revenue)}</td>
                    <td style={{ textAlign: "right" }}>{s.orders > 0 ? formatCurrency(s.revenue / s.orders) : "-"}</td>
                    <td style={{ textAlign: "right" }}>{s.hoursWorked > 0 ? `${s.hoursWorked.toFixed(1)}h` : "-"}</td>
                    <td style={{ textAlign: "right" }}>{s.hoursWorked > 0 ? formatCurrency(s.revenue / s.hoursWorked) : "-"}</td>
                  </tr>
                ))}
                {staffStats.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#999" }}>No staff data</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {printType === "stock" && (
          <>
            <div style={{ marginBottom: 15, padding: 10, background: "#f9f5f2", borderRadius: 8 }}>
              <strong>Stock Summary:</strong> Total: {inventoryItems.length} | Low Stock: {lowStockItems.length} | Out of Stock: {outOfStockItems.length}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Stock</th>
                  <th style={{ textAlign: "right" }}>Alert At</th>
                  <th style={{ textAlign: "right" }}>Purchase Cost</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td style={{ textAlign: "right", color: item.stock <= 0 ? "#c00" : item.stock <= (item.low_stock_threshold || 10) ? "#e67e22" : "#27ae60" }}>
                      {item.stock} {item.unit}
                    </td>
                    <td style={{ textAlign: "right" }}>{item.low_stock_threshold || 10} {item.unit}</td>
                    <td style={{ textAlign: "right" }}>{item.purchase_cost != null ? formatCurrency(item.purchase_cost) : "-"}</td>
                  </tr>
                ))}
                {inventoryItems.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No inventory items</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        <div className="footer">
          {(() => { try { const s = localStorage.getItem('erlbrew_company_settings'); return s ? JSON.parse(s).company_name || 'Erlbrew Café POS' : 'Erlbrew Café POS'; } catch { return 'Erlbrew Café POS'; } })()} | Generated by Admin
        </div>
      </div>
    </>
  );
};
