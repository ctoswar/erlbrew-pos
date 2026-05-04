import { CartItem, Order, DailySummary, PayMethod, Category, Discount } from "../types";

export const formatCurrency = (n: number | string): string => `₱${Number(n).toFixed(2)}`;

export const formatTime = (d: Date): string =>
  d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (d: Date): string =>
  d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

export const formatFullDate = (d: Date): string =>
  d.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export const generateOrderId = (): string =>
  `#${Math.floor(1000 + Math.random() * 9000)}`;

export const calcSubtotal = (cart: CartItem[]): number =>
  cart.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0);

export const calcTax = (_subtotal: number): number => 0;

export const calcGrand = (subtotal: number, discount?: Discount | null): number => {
  if (!discount) return subtotal;
  return Math.max(0, subtotal - discount.amount);
};

export const getQuickCashAmounts = (total: number): number[] => {
  const amounts = [
    Math.ceil(total),
    Math.ceil(total / 10) * 10 + 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ];
  return [...new Set(amounts)].slice(0, 4);
};

export const buildDailySummary = (orders: Order[], cogsData?: { cogs: number; details: { order_id: string; total: number; cogs: number; profit: number }[] }): DailySummary => {
  const completed = orders.filter((o) => o.status === "completed");
  const totalRevenue = completed.reduce((s, o) => s + o.total, 0);
  const totalOrders = completed.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalCOGS = cogsData?.cogs ?? 0;
  const grossProfit = totalRevenue - totalCOGS;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Top items
  const itemMap: Record<string, number> = {};
  completed.forEach((o) =>
    o.items.forEach((ci) => {
      itemMap[ci.item.name] = (itemMap[ci.item.name] || 0) + ci.qty;
    })
  );
  const topItems = Object.entries(itemMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // By category
  const catMap: Record<string, { revenue: number; count: number }> = {};
  completed.forEach((o) =>
    o.items.forEach((ci) => {
      const cat = ci.item.category;
      if (!catMap[cat]) catMap[cat] = { revenue: 0, count: 0 };
      catMap[cat].revenue += ci.item.price * ci.qty;
      catMap[cat].count += ci.qty;
    })
  );
  const byCategory = Object.entries(catMap).map(([category, data]) => ({
    category: category as Category,
    ...data,
  }));

  // By payment method
  const payMap: Record<string, { count: number; total: number }> = {};
  completed.forEach((o) => {
    const m = o.payMethod;
    if (!payMap[m]) payMap[m] = { count: 0, total: 0 };
    payMap[m].count++;
    payMap[m].total += o.total;
  });
  const byPayMethod = Object.entries(payMap).map(([method, data]) => ({
    method: method as PayMethod,
    ...data,
  }));

  return {
    date: formatFullDate(new Date()),
    totalRevenue,
    totalOrders,
    avgOrderValue,
    topItems,
    byCategory,
    byPayMethod,
    totalCOGS,
    grossProfit,
    profitMargin,
    cogsDetails: cogsData?.details ?? [],
  };
};
