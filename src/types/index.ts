export type Role = "Barista" | "Senior Barista" | "Shift Supervisor" | "Manager";
export type Category = "Signature Brews" | "Espresso" | "Pastries" | "Cold Drinks";
export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "voided" | "refunded";
export type DiscountType = "pwd" | "senior" | "custom_pct" | "custom_fixed" | null;

export interface Discount {
  type: DiscountType;
  label: string;          // "PWD Discount", "Senior Discount", "Event Promo", etc.
  value: number;          // percentage (e.g. 20) or fixed peso amount
  amount: number;         // computed peso discount (e.g. subtotal * 0.20)
}
export type Screen = "login" | "pos" | "kitchen" | "checkout" | "payment" | "success" | "dashboard" | "admin" | "time";
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

export interface Modifier {
  id?: number;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface CartItemModifier {
  name: string;
  price: number;
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
  image?: string;
  modifiers?: Modifier[];
}

export interface CartItem {
  item: MenuItem;
  qty: number;
  notes?: string;
  modifiers?: CartItemModifier[];
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
  customerName?: string;
  type: OrderType;
  payMethod: PayMethod;
  /** Cash amount tendered — needed to compute change on cash orders */
  cashTendered?: number;
  /** Applied discount (if any) */
  discount?: Discount;
  /** Reference number for E-Wallet payments (e.g., GCash reference) */
  referenceNumber?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  purchase_cost?: number;
  unit_cost?: number;
  created_at?: string;
}

export type MovementType = 'sale' | 'restock' | 'adjustment' | 'void';

export interface InventoryMovement {
  id: number;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  inventory_name: string;
  inventory_category: string;
  unit: string;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topItems: { name: string; qty: number }[];
  byCategory: { category: Category; revenue: number; count: number }[];
  byPayMethod: { method: PayMethod; count: number; total: number }[];
  totalCOGS?: number;
  grossProfit?: number;
  profitMargin?: number;
  cogsDetails?: { order_id: string; total: number; cogs: number; profit: number }[];
}
