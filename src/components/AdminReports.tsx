import React, { useState, useEffect, useCallback } from "react";
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

type DateRange = "today" | "this_week" | "this_month" | "last_month" | "last_2_weeks" | "custom";

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

  // Sales report data
  const [salesData, setSalesData] = useState<RevenueDataPoint[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalRevenue: 0, totalOrders: 0, avgOrder: 0, totalCOGS: 0, grossProfit: 0 });

  // Inventory report data
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Staff report data
  const [staffStats, setStaffStats] = useState<any[]>([]);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const getDateRange = useCallback((): { start: string; end: string } => {
    const today = new Date();
    const d = (offset: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + offset);
      return x;
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
      case "custom":
        return { start: startDate, end: endDate };
      default:
        return { start: fmt(today), end: fmt(today) };
    }
  }, [dateRange, startDate, endDate]);

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
      const orders = await apiGet<any[]>(`/orders?start=${start}&end=${end}`);

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
      // Get orders and group by staff
      const orders = await apiGet<any[]>(`/orders?start=${start}&end=${end}`);
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
      }}>
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

      {/* Date Range Selector (only for Sales and Staff reports) */}
      {activeReport !== "inventory" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.7rem 1rem", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1 }}>PERIOD:</div>
          {([
            ["Today", "today"],
            ["This Week", "this_week"],
            ["Last 2 Weeks", "last_2_weeks"],
            ["This Month", "this_month"],
            ["Last Month", "last_month"],
            ["Custom", "custom"],
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
    </div>
  );
};