export type Role = "Barista" | "Senior Barista" | "Shift Supervisor" | "Manager";
export type Category = string;
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
  qty?: number; // For modifiers like Extra Shot that can have quantity
}

export interface MenuItemSize {
  id?: number;
  label: string;
  price: number;
  sortOrder?: number;
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
  sizes?: MenuItemSize[];
}

export interface CartItem {
  item: MenuItem;
  qty: number;
  notes?: string;
  modifiers?: CartItemModifier[];
  selectedSize?: MenuItemSize;
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
  location_id?: number;
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

// ── Payroll Types ────────────────────────────────────────────────────────────

export type PayBasis = 'daily' | 'monthly';
export type TaxStatus = 'single' | 'married' | 'head_of_family';
export type PayrollPeriodStatus = 'open' | 'computed' | 'approved' | 'paid';

export interface PayrollPeriod {
  id: number;
  label: string;
  date_from: string;
  date_to: string;
  pay_date: string | null;
  status: PayrollPeriodStatus;
  created_at: string;
  updated_at: string;
}

export interface PayrollEntry {
  id: number;
  payroll_period_id: number;
  staff_id: number;
  // Hours
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  rest_day_hours: number;
  night_diff_hours: number;
  late_minutes: number;
  // Earnings
  basic_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  night_differential_pay: number;
  rest_day_pay: number;
  allowances: number;
  bonuses: number;
  gross_pay: number;
  // Deductions
  sss_employee: number;
  philhealth_employee: number;
  pagibig_employee: number;
  withholding_tax: number;
  absence_deductions: number;
  other_deductions: number;
  total_deductions: number;
  // Net
  net_pay: number;
  // Employer contributions
  sss_employer: number;
  philhealth_employer: number;
  pagibig_employer: number;
  // Audit
  computed_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  // Joined staff info
  name?: string;
  role?: string;
  initials?: string;
  color?: string;
  pay_basis?: PayBasis;
  daily_rate?: number;
  monthly_salary?: number;
}

export interface StaffPayrollInfo {
  id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  pay_basis: PayBasis | null;
  daily_rate: number | null;
  monthly_salary: number | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tin: string | null;
  tax_status: TaxStatus | null;
  hire_date: string | null;
}

// ── Multi-location Types ─────────────────────────────────────────────────────

export interface Location {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export type TransferStatus = 'pending' | 'approved' | 'in_transit' | 'received' | 'cancelled';

export interface InventoryTransfer {
  id: number;
  from_location_id: number;
  to_location_id: number;
  inventory_item_id: string;
  quantity: number;
  status: TransferStatus;
  requested_by: number | null;
  approved_by: number | null;
  received_by: number | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  // Joined fields
  from_location_name?: string;
  to_location_name?: string;
  item_name?: string;
  item_unit?: string;
  requested_by_name?: string;
  approved_by_name?: string;
  received_by_name?: string;
}

// ── Timekeeping Types ────────────────────────────────────────────────────────

export interface ScheduleDay {
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

export interface ScheduleTemplate {
  id: number;
  name: string;
  days: Record<string, ScheduleDay>;
}

export interface StaffSchedule {
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  schedule_id: number | null;
  schedule_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

export interface StaffScheduleRaw {
  id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  schedule_id?: number | null;
  schedule_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  lunch_start?: string | null;
  lunch_end?: string | null;
  snack_start?: string | null;
  snack_end?: string | null;
}

export interface TimeRecord {
  id: number;
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  status: "clocked_in" | "clocked_out" | "not_in";
  record: {
    id: number;
    clock_in: string;
    clock_out: string | null;
    total_hours: number;
  } | null;
  shift_start: string | null;
  shift_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  snack_start: string | null;
  snack_end: string | null;
}

export interface ClockResponse {
  action: "clock_in" | "clock_out";
  staff: { staff_id: number; name: string; role: string; initials: string; color: string };
  record: TimeRecord["record"];
}

export interface DayRecord {
  id: number;
  staff_id: number;
  clock_in: string;
  clock_out: string | null;
  total_hours: number;
  name: string;
  role: string;
  initials: string;
  color: string;
}

export interface PrintStaffRecord {
  staff_id: number;
  name: string;
  role: string;
  initials: string;
  color: string;
  shift_start: string | null;
  shift_end: string | null;
  schedule_name: string | null;
  records: {
    id: number;
    staff_id: number;
    clock_in: string;
    clock_out: string | null;
    total_hours: number;
    record_date: string;
  }[];
}

export interface PrintDateEntry {
  date: string;
  day_of_week: string;
  staff: PrintStaffRecord[];
  total_hours: number;
  staff_present: number;
}

export interface PrintResponse {
  from: string;
  to: string;
  total_days: number;
  total_staff: number;
  unique_staff_present: number;
  grand_total_hours: number;
  dates: PrintDateEntry[];
  all_staff: { staff_id: number; name: string; role: string; initials: string; color: string }[];
}

export type TimekeepingTab = "today" | "calendar" | "schedules";

