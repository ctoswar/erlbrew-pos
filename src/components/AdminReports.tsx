import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatCurrency } from "../utils";
import { apiGet } from "../utils/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DateRange = "today" | "this_week" | "this_month" | "last_month" | "last_2_weeks" | "custom" | "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec" | "year_to_date";

interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
  profit: number;
}

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
  const [printType, setPrintType] = useState<"summary" | "items" | "stock">("summary");

  // Sales report data
  const [salesData, setSalesData] = useState<RevenueDataPoint[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalRevenue: 0, totalOrders: 0, avgOrder: 0, totalCOGS: 0, grossProfit: 0 });

  // Inventory report data
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Staff report data
  const [staffStats, setStaffStats] = useState<any[]>([]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Use refs to avoid circular dependency with getDateRange
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
      // Monthly filters - January (0) to December (11)
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

  // Update start/end when preset changes
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
      // Use /orders/history which supports start/end filtering (returns { orders: [], total })
      const result = await apiGet<any>(`/orders/history?start=${start}&end=${end}`);
      const orders = Array.isArray(result) ? result : (result.orders || []);

      // Group by date
      const byDate: Record<string, RevenueDataPoint> = {};
      orders.forEach((o: any) => {
        const date = new Date(o.created_at || o.createdAt).toISOString().split("T")[0];
        if (!byDate[date]) byDate[date] = { date, revenue: 0, orders: 0, profit: 0 };
        byDate[date].revenue += Number(o.total) || 0;
        byDate[date].orders += 1;
        // Rough estimate
        byDate[date].profit += (Number(o.total) || 0) * 0.3;
      });

      const data = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      setSalesData(data);

      const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
      const totalOrders = data.reduce((s, d) => s + d.orders, 0);
      setSalesSummary({
        totalRevenue,
        totalOrders,
        avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        totalCOGS: totalRevenue * 0.3,
        grossProfit: totalRevenue * 0.7,
      });
    } catch (e) {
      console.error("Failed to fetch sales data", e);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await apiGet<any[]>("/inventory");
      setInventoryItems(items);
    } catch (e) {
      console.error("Failed to fetch inventory", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaffData = useCallback(async () => {
    const { start, end } = getDateRange();
    setLoading(true);
    try {
      // Get orders and group by staff — use /orders/history for date filtering
      const result = await apiGet<any>(`/orders/history?start=${start}&end=${end}`);
      const orders = Array.isArray(result) ? result : (result.orders || []);
      const staffMap: Record<string, { name: string; orders: number; revenue: number }> = {};

      orders.forEach((o: any) => {
        const staffName = o.staff?.name || "Unknown";
        if (!staffMap[staffName]) staffMap[staffName] = { name: staffName, orders: 0, revenue: 0 };
        staffMap[staffName].orders += 1;
        staffMap[staffName].revenue += Number(o.total) || 0;
      });

      // Also get time records
      const timeRecords = await apiGet<any[]>(`/clock?start=${start}&end=${end}`).catch(() => []);

      setStaffStats(
        Object.values(staffMap).map(s => {
          const staffTime = timeRecords.filter((t: any) => t.staff_name === s.name);
          const totalHours = staffTime.reduce((sum: number, t: any) => sum + (Number(t.total_hours) || 0), 0);
          return { ...s, hoursWorked: totalHours };
        }).sort((a, b) => b.revenue - a.revenue)
      );
    } catch (e) {
      console.error("Failed to fetch staff data", e);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    if (activeReport === "sales") fetchSalesData();
    else if (activeReport === "inventory") fetchInventoryData();
    else if (activeReport === "staff") fetchStaffData();
  }, [activeReport, fetchSalesData, fetchInventoryData, fetchStaffData]);

  const lowStockItems = inventoryItems.filter((i: any) => i.stock <= (i.low_stock_threshold || 10));
  const outOfStockItems = inventoryItems.filter((i: any) => i.stock <= 0);

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "var(--gold-muted)",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    fontWeight: 700,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Report Type Tabs */}
      <div style={{
        display: "flex",
        gap: 6,
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {([["sales", "Sales Report"], ["inventory", "Inventory Report"], ["staff", "Staff Report"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveReport(key)} style={{
              padding: "7px 20px",
              borderRadius: 9,
              border: `1.5px solid ${activeReport === key ? "var(--gold)" : "var(--border-default)"}`,
              background: activeReport === key ? "rgba(201,135,58,0.15)" : "transparent",
              color: activeReport === key ? "var(--gold)" : "var(--text-secondary)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              cursor: "pointer",
              textTransform: "uppercase" as const,
            }}>
              {label}
            </button>
          ))}
        </div>
        {/* Print Button */}
        <button onClick={() => setShowPrintModal(true)} style={{
          padding: "7px 16px",
          borderRadius: 9,
          border: "1.5px solid var(--gold)",
          background: "rgba(201,135,58,0.1)",
          color: "var(--gold)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          🖨 Print
        </button>
      </div>

      {/* Date Range Selector (only for Sales and Staff reports) */}
      {activeReport !== "inventory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0.7rem 1rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1 }}>PERIOD:</div>
            {([
              ["Today", "today"],
              ["This Week", "this_week"],
              ["Last 2 Weeks", "last_2_weeks"],
              ["This Month", "this_month"],
              ["Last Month", "last_month"],
            ] as const).map(([label, value]) => (
              <button key={value} onClick={() => setDateRange(value)} style={{
                padding: "4px 10px",
                fontSize: 8,
                borderRadius: 6,
                border: `1px solid ${dateRange === value ? "var(--gold)" : "var(--border-subtle)"}`,
                background: dateRange === value ? "rgba(201,135,58,0.15)" : "transparent",
                color: dateRange === value ? "var(--gold)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: dateRange === value ? 700 : 400,
              }}>
                {label}
              </button>
            ))}
          </div>
          {/* Monthly Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1 }}>MONTH:</div>
            {(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const).map((month) => (
              <button key={month} onClick={() => setDateRange(month)} style={{
                padding: "4px 8px",
                fontSize: 8,
                borderRadius: 6,
                border: `1px solid ${dateRange === month ? "var(--gold)" : "var(--border-subtle)"}`,
                background: dateRange === month ? "rgba(201,135,58,0.15)" : "transparent",
                color: dateRange === month ? "var(--gold)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: dateRange === month ? 700 : 400,
              }}>
                {month.toUpperCase()}
              </button>
            ))}
            <button onClick={() => setDateRange("year_to_date")} style={{
              padding: "4px 10px",
              fontSize: 8,
              borderRadius: 6,
              border: `1px solid ${dateRange === "year_to_date" ? "var(--gold)" : "var(--border-subtle)"}`,
              background: dateRange === "year_to_date" ? "rgba(201,135,58,0.15)" : "transparent",
              color: dateRange === "year_to_date" ? "var(--gold)" : "var(--text-muted)",
              cursor: "pointer",
              fontWeight: dateRange === "year_to_date" ? 700 : 400,
            }}>
              Year to Date
            </button>
          </div>
          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{
                padding: "4px 8px",
                fontSize: 10,
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
              }} />
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{
                padding: "4px 8px",
                fontSize: 10,
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading...</div>
        ) : (
          <>
            {/* SALES REPORT */}
            {activeReport === "sales" && (
              <div>
                {/* Line Chart */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: "1rem", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                    Revenue Over Time
                  </div>
                  {salesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={salesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: "var(--text-muted)" }} />
                        <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickFormatter={(v) => `₱${v.toLocaleString()}`} />
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(value), ""]}
                          contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-medium)", borderRadius: 8, fontSize: 10 }}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="var(--gold)" strokeWidth={2} dot={{ fill: "var(--gold)", r: 3 }} name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No sales data for this period</div>
                  )}
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Total Revenue", value: formatCurrency(salesSummary.totalRevenue), color: "var(--gold)" },
                    { label: "Total Orders", value: String(salesSummary.totalOrders), color: "var(--text-primary)" },
                    { label: "Avg Order", value: formatCurrency(salesSummary.avgOrder), color: "var(--success)" },
                    { label: "COGS (est.)", value: formatCurrency(salesSummary.totalCOGS), color: "var(--text-secondary)" },
                    { label: "Gross Profit", value: formatCurrency(salesSummary.grossProfit), color: salesSummary.grossProfit >= 0 ? "var(--success)" : "var(--danger)" },
                    { label: "Date Range", value: `${startDate} to ${endDate}`, color: "var(--text-muted)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px" }}>
                      <div style={labelStyle}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Daily Breakdown Table */}
                {salesData.length > 0 && (
                  <div style={{ background: "var(--bg-surface)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                      Daily Breakdown
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Date</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Orders</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.map((d) => (
                          <tr key={d.date} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{d.date}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{d.orders}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>{formatCurrency(d.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* INVENTORY REPORT */}
            {activeReport === "inventory" && (
              <div>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{inventoryItems.length}</div>
                    <div style={labelStyle}>Total Items</div>
                  </div>
                  <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e8a020" }}>{lowStockItems.length}</div>
                    <div style={labelStyle}>Low Stock</div>
                  </div>
                  <div style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)" }}>{outOfStockItems.length}</div>
                    <div style={labelStyle}>Out of Stock</div>
                  </div>
                </div>

                {/* Low Stock Alert Table */}
                {lowStockItems.length > 0 && (
                  <div style={{ background: "var(--bg-surface)", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: 9, fontWeight: 600, color: "#e8a020", letterSpacing: 1.5, textTransform: "uppercase" }}>
                      Low Stock Alerts
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Item</th>
                          <th style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Category</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Alert At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockItems.map((item: any) => (
                          <tr key={item.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "8px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{item.name}</td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)" }}>{item.category}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: item.stock <= 0 ? "var(--danger)" : "#e8a020", fontWeight: 600 }}>
                              {item.stock} {item.unit}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                              {item.low_stock_threshold} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Full Inventory Table */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    All Inventory Items
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Item</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Category</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Stock</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Unit</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Purchase Cost</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item: any) => (
                        <tr key={item.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--text-muted)" }}>{item.category}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: item.stock <= (item.low_stock_threshold || 10) ? "var(--danger)" : "var(--text-secondary)" }}>
                            {item.stock}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{item.unit}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                            {item.purchase_cost != null ? formatCurrency(item.purchase_cost) : "-"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                            {item.unit_cost != null ? formatCurrency(item.unit_cost) : "-"}
                          </td>
                        </tr>
                      ))}
                      {inventoryItems.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                            No inventory items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* STAFF REPORT */}
            {activeReport === "staff" && (
              <div>
                {/* Staff Summary Table */}
                <div style={{ background: "var(--bg-surface)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Staff Performance ({startDate} to {endDate})
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Staff</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Orders</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Revenue</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Avg/Order</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffStats.map((s) => (
                        <tr key={s.name} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{s.name}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>{s.orders}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>{formatCurrency(s.revenue)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }}>
                            {s.orders > 0 ? formatCurrency(s.revenue / s.orders) : "-"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                            {s.hoursWorked ? `${s.hoursWorked.toFixed(1)}h` : "-"}
                          </td>
                        </tr>
                      ))}
                      {staffStats.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                            No staff data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

// Print Modal Component
const PrintModal: React.FC<{
  show: boolean;
  onClose: () => void;
  printType: "summary" | "items" | "stock";
  setPrintType: (t: "summary" | "items" | "stock") => void;
  salesData: RevenueDataPoint[];
  salesSummary: { totalRevenue: number; totalOrders: number; avgOrder: number; totalCOGS: number; grossProfit: number };
  inventoryItems: any[];
  startDate: string;
  endDate: string;
}> = ({ show, onClose, printType, setPrintType, salesData, salesSummary, inventoryItems, startDate, endDate }) => {
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
          <title>{(() => { try { const s = localStorage.getItem('erlbrew_company_settings'); return s ? JSON.parse(s).company_name || 'Erlbrew Café POS' : 'Erlbrew Café POS'; } catch { return 'Erlbrew Café POS'; } })()}</title>
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
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 998 }} onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
        <div style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-medium)", borderRadius: 16, padding: "1.5rem", width: 380, maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>
            Print Report
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {([
              ["summary", "Sales Summary", "Revenue, orders, profit overview"],
              ["items", "Item Sales", "Best selling items breakdown"],
              ["stock", "Current Stock", "All inventory items with stock levels"],
            ] as const).map(([value, label, desc]) => (
              <button key={value} onClick={() => setPrintType(value)} style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: `2px solid ${printType === value ? "var(--gold)" : "var(--border-default)"}`,
                background: printType === value ? "rgba(201,135,58,0.15)" : "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                textAlign: "left",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{desc}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handlePrint} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--gold)", color: "var(--bg-sidebar)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print Content */}
      <div id="print-area" style={{ display: "none" }}>
        <div className="header">
          <h1>{(() => { try { const s = localStorage.getItem('erlbrew_company_settings'); return s ? JSON.parse(s).company_name || 'Erlbrew Café POS' : 'Erlbrew Café POS'; } catch { return 'Erlbrew Café POS'; } })()}</h1>
          <h2>{printType === "summary" ? "Sales Summary Report" : printType === "items" ? "Item Sales Report" : "Current Stock Report"}</h2>
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
                <div className="label">COGS (est.)</div>
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
                  <th style={{ textAlign: "right" }}>Profit (est.)</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map(d => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td style={{ textAlign: "right" }}>{d.orders}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(d.revenue)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(d.profit)}</td>
                  </tr>
                ))}
                {salesData.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "#999" }}>No sales data</td></tr>
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
                <th style={{ textAlign: "right" }}>Profit (est.)</th>
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