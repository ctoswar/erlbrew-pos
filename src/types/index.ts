export type Role = "Barista" | "Senior Barista" | "Shift Supervisor" | "Manager";
export type Category = "Signature Brews" | "Espresso" | "Pastries" | "Cold Drinks";
export type OrderStatus = "pending" | "preparing" | "ready" | "completed";
export type Screen = "login" | "pos" | "kitchen" | "checkout" | "payment" | "success" | "dashboard" | "admin";
export type LoginMode = "rfid" | "pin";
export type OrderType = "dine-in" | "takeout";
export type PayMethod = "cash" | "card" | "ewallet";

export interface Staff {
  id?: number;
  rfid: string;
  pin: string;
  name: string;
  role: Role;
  initials: string;
  color: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: Category;
  price: number;
  badge?: string;
  description: string;
  emoji: string;
  popular?: boolean;
}

export interface CartItem {
  item: MenuItem;
  qty: number;
  notes?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  staff: Staff;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  completedAt?: Date;
  table?: string;
  type: OrderType;
  payMethod: PayMethod;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  created_at?: string;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topItems: { name: string; qty: number }[];
  byCategory: { category: Category; revenue: number; count: number }[];
  byPayMethod: { method: PayMethod; count: number; total: number }[];
}
