import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "Barista" | "Senior Barista" | "Shift Supervisor" | "Manager";
type Category = "Signature Brews" | "Espresso" | "Pastries" | "Cold Drinks";
type OrderStatus = "pending" | "preparing" | "ready" | "completed";
type Screen = "login" | "pos" | "orders" | "summary";

interface Staff {
  rfid: string;
  pin: string;
  name: string;
  role: Role;
  initials: string;
  color: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: Category;
  price: number;
  badge?: string;
  description: string;
  emoji: string;
  popular?: boolean;
}

interface CartItem {
  item: MenuItem;
  qty: number;
  notes?: string;
}

interface Order {
  id: string;
  items: CartItem[];
  staff: Staff;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  table?: string;
  type: "dine-in" | "takeout";
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const STAFF: Staff[] = [
  { rfid: "RF001", pin: "1234", name: "Jane Dela Cruz", role: "Senior Barista", initials: "JD", color: "#C9873A" },
  { rfid: "RF002", pin: "5678", name: "Marco Santos", role: "Barista", initials: "MS", color: "#7a9e6e" },
  { rfid: "RF003", pin: "9012", name: "Ana Reyes", role: "Shift Supervisor", initials: "AR", color: "#7a6eb0" },
  { rfid: "RF004", pin: "3456", name: "Luis Garcia", role: "Manager", initials: "LG", color: "#b06e6e" },
];

const MENU: MenuItem[] = [
  { id: "m1", name: "Smoked Sea Salt Mocha", category: "Signature Brews", price: 6.75, badge: "SIGNATURE", description: "Single-origin dark chocolate, espresso, steamed oat milk, topped with house-smoked Maldon sea salt.", emoji: "☕", popular: true },
  { id: "m2", name: "Velvet Matcha Latte", category: "Signature Brews", price: 6.25, badge: "SIGNATURE", description: "Ceremonial grade Uji matcha whisked with Madagascar vanilla bean and creamy macadamia milk.", emoji: "🍵", popular: true },
  { id: "m3", name: "Honey Lavender Cortado", category: "Signature Brews", price: 5.50, badge: "SIGNATURE", description: "Local wildflower honey, dried culinary lavender, and a double shot of our house 'Heritage' roast.", emoji: "☕" },
  { id: "m4", name: "Cold Brew Reserve", category: "Signature Brews", price: 5.75, badge: "HAND-POURED", description: "24-hour slow steeped concentrate. Served over a single clear ice sphere.", emoji: "🧊", popular: true },
  { id: "m5", name: "Heritage Double Espresso", category: "Espresso", price: 4.00, badge: "CLASSIC", description: "Two shots of our house Heritage blend. Clean, balanced, with a honey-toned finish.", emoji: "☕" },
  { id: "m6", name: "Flat White", category: "Espresso", price: 4.75, badge: "CLASSIC", description: "Velvety micro-foam poured over a ristretto double shot.", emoji: "☕" },
  { id: "m7", name: "Spiced Americano", category: "Espresso", price: 4.25, badge: "SEASONAL", description: "Cardamom and Ceylon cinnamon infused hot water, finished with a Heritage espresso shot.", emoji: "☕" },
  { id: "m8", name: "Macchiato Lungo", category: "Espresso", price: 4.50, badge: "CLASSIC", description: "Long pull espresso with a delicate cloud of steamed milk.", emoji: "☕" },
  { id: "m9", name: "Kouign-Amann", category: "Pastries", price: 4.25, badge: "BAKED DAILY", description: "Buttery, caramelized Breton pastry. Crisp outside, tender within.", emoji: "🥐", popular: true },
  { id: "m10", name: "Cardamom Knot", category: "Pastries", price: 3.75, badge: "BAKED DAILY", description: "Soft brioche twisted with house-ground cardamom sugar.", emoji: "🍞" },
  { id: "m11", name: "Almond Financier", category: "Pastries", price: 3.50, badge: "BAKED DAILY", description: "Brown butter almond cake with flaked Marcona almonds on top.", emoji: "🧁" },
  { id: "m12", name: "Seasonal Tart", category: "Pastries", price: 5.00, badge: "SEASONAL", description: "Chef's daily selection using locally sourced seasonal produce.", emoji: "🥧" },
  { id: "m13", name: "Hibiscus Fizz", category: "Cold Drinks", price: 5.25, badge: "HOUSE-MADE", description: "Dried hibiscus flowers steeped overnight with citrus zest, topped with sparkling water.", emoji: "🌺" },
  { id: "m14", name: "Cascara Lemonade", category: "Cold Drinks", price: 5.50, badge: "RARE", description: "Coffee cherry husks brewed into a sweet tea blended with fresh Meyer lemon.", emoji: "🍋" },
  { id: "m15", name: "Oat Horchata Cold Brew", category: "Cold Drinks", price: 6.00, badge: "SIGNATURE", description: "House oat horchata swirled through our cold brew concentrate. Creamy, nutty, mellow.", emoji: "🥤", popular: true },
  { id: "m16", name: "Still Water", category: "Cold Drinks", price: 1.50, badge: "", description: "Filtered still water.", emoji: "💧" },
];

const CATEGORIES: Category[] = ["Signature Brews", "Espresso", "Pastries", "Cold Drinks"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genOrderId = () => `#${Math.floor(1000 + Math.random() * 9000)}`;
const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
const formatTime = (d: Date) => d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  // Layout
  app: { fontFamily: "'Lato', sans-serif", background: "#1A0F07", minHeight: "100vh", color: "#e8c99a", userSelect: "none", overflow: "hidden" },
  
  // Login
  loginWrap: { minHeight: "100vh", display: "flex", background: "#1A0F07" },
  loginSide: { width: 240, background: "#120A04", borderRight: "1px solid #3a1f0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", gap: 0 },
  loginMain: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1A0F07" },
  loginCard: { background: "#2a1508", border: "1px solid #4a2612", borderRadius: 16, padding: "2.5rem 2rem", width: 360 },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#C9873A", letterSpacing: 3, textAlign: "center" as const },
  logoSub: { fontSize: 10, color: "#5a3318", letterSpacing: 5, textTransform: "uppercase" as const, textAlign: "center" as const, marginBottom: 40 },
  
  // POS Main
  posWrap: { display: "flex", height: "100vh", overflow: "hidden" },
  posLeft: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#1A0F07" },
  posRight: { width: 340, background: "#120A04", borderLeft: "1px solid #3a1f0d", display: "flex", flexDirection: "column" },
  
  // Topbar
  topbar: { height: 60, background: "#120A04", borderBottom: "1px solid #3a1f0d", display: "flex", alignItems: "center", padding: "0 1.5rem", gap: 16, flexShrink: 0 },
  
  // Menu
  menuArea: { flex: 1, overflowY: "auto" as const, padding: "1.2rem 1.5rem" },
  menuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  menuCard: { background: "#2a1508", border: "1px solid #3a1f0d", borderRadius: 12, padding: "1rem", cursor: "pointer", transition: "all 0.15s", position: "relative" as const, overflow: "hidden" },
  menuCardPopular: { border: "1px solid #5a3318" },
  
  // Cart
  cartHeader: { padding: "1rem 1.2rem", borderBottom: "1px solid #2a1508", flexShrink: 0 },
  cartItems: { flex: 1, overflowY: "auto" as const, padding: "0.8rem 1.2rem" },
  cartFooter: { padding: "1rem 1.2rem", borderTop: "1px solid #2a1508", flexShrink: 0 },
  cartRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #2a1508" },
  
  // Buttons
  btnGold: { background: "#C9873A", color: "#120A04", border: "none", borderRadius: 8, fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" as const, cursor: "pointer", padding: "10px 16px" },
  btnOutline: { background: "transparent", color: "#9a6b3a", border: "1px solid #3a1f0d", borderRadius: 8, fontFamily: "'Lato', sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" as const, cursor: "pointer", padding: "10px 16px" },
  btnDanger: { background: "transparent", color: "#c97a7a", border: "1px solid #5a2a2a", borderRadius: 8, fontFamily: "'Lato', sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" as const, cursor: "pointer", padding: "8px 14px" },
  
  // Misc
  badge: { fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#C9873A", fontWeight: 700 },
  divider: { width: "100%", height: 1, background: "#2a1508", margin: "12px 0" },
  pill: { display: "inline-block", background: "#3a1f0d", color: "#C9873A", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 4, fontWeight: 700 },
  pillGreen: { display: "inline-block", background: "#1a2e1a", color: "#7ac97a", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 4, fontWeight: 700 },
  pillAmber: { display: "inline-block", background: "#2e1f0a", color: "#C9873A", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as const, padding: "3px 8px", borderRadius: 4, fontWeight: 700 },
};

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (staff: Staff) => void }) {
  const [mode, setMode] = useState<"rfid" | "pin">("rfid");
  const [pin, setPin] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanIdx, setScanIdx] = useState(0);
  const [msg, setMsg] = useState<{ text: string; type: "error" | "info" | "success" }>({ text: "", type: "info" });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const simulateScan = () => {
    if (scanning) return;
    setScanning(true);
    setMsg({ text: "Reading RFID card…", type: "info" });
    setTimeout(() => {
      const s = STAFF[scanIdx % STAFF.length];
      setScanIdx(i => i + 1);
      setScanning(false);
      setMsg({ text: `Welcome, ${s.name}!`, type: "success" });
      setTimeout(() => onLogin(s), 800);
    }, 1600);
  };

  const submitPin = () => {
    const s = STAFF.find(x => x.pin === pin);
    if (s) { setMsg({ text: `Welcome, ${s.name}!`, type: "success" }); setTimeout(() => onLogin(s), 600); }
    else { setMsg({ text: "Incorrect PIN. Try again.", type: "error" }); setPin(""); setTimeout(() => setMsg({ text: "", type: "info" }), 2000); }
  };

  const msgColor = msg.type === "error" ? "#c97a7a" : msg.type === "success" ? "#7ac97a" : "#7a5535";

  return (
    <div style={S.loginWrap}>
      {/* Sidebar */}
      <div style={S.loginSide}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 20, opacity: 0.8 }}>
          <rect x="8" y="18" width="26" height="22" rx="3" stroke="#C9873A" strokeWidth="1.4" />
          <path d="M34 22C40 22 42 25.5 40.5 28.5C39 31.5 34 32 34 32" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d="M13 18C13 14.5 16.5 11 20 12.5C21.5 9.5 26.5 9.5 27 13C30 11 32 14.5 32 18" stroke="#C9873A" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.5" />
          <rect x="8" y="40" width="26" height="2.5" rx="1.25" fill="#C9873A" opacity="0.25" />
        </svg>
        <div style={S.logoText}>ERLBREW</div>
        <div style={S.logoSub}>Café</div>
        <div style={{ width: 40, height: 1, background: "#3a1f0d", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: "#C9873A", fontFamily: "'Playfair Display', serif" }}>
          {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 11, color: "#5a3318", letterSpacing: 1, marginTop: 4 }}>
          {time.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
        </div>
        <div style={{ width: 40, height: 1, background: "#3a1f0d", margin: "20px auto 16px" }} />
        <div style={{ fontSize: 10, color: "#3a1f0d", letterSpacing: 2, textTransform: "uppercase", textAlign: "center" }}>
          Point of Sale<br />v2.0
        </div>
      </div>

      {/* Main */}
      <div style={S.loginMain}>
        <div style={S.loginCard}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: "#e8c99a", textAlign: "center", marginBottom: 4 }}>
            Staff Login
          </div>
          <div style={{ fontSize: 10, color: "#5a3318", letterSpacing: 3, textTransform: "uppercase", textAlign: "center", marginBottom: 24 }}>
            Tap your card or enter PIN
          </div>

          {/* Mode Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["rfid", "pin"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setPin(""); setMsg({ text: "", type: "info" }); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, transition: "all 0.2s",
                  background: mode === m ? "#C9873A" : "transparent",
                  borderColor: mode === m ? "#C9873A" : "#3a1f0d",
                  color: mode === m ? "#120A04" : "#5a3318" }}>
                {m === "rfid" ? "RFID Card" : "PIN Code"}
              </button>
            ))}
          </div>

          {mode === "rfid" ? (
            <>
              <div onClick={simulateScan} style={{ background: "#1A0F07", border: `2px dashed ${scanning ? "#C9873A" : "#3a1f0d"}`, borderRadius: 12, padding: "2rem 1rem", textAlign: "center", cursor: "pointer", transition: "all 0.3s", marginBottom: 12, position: "relative", overflow: "hidden" }}>
                {scanning && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", border: "1.5px solid #C9873A", animation: "rfidPulse 1.4s ease-out infinite" }} />
                )}
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 10px", display: "block" }}>
                  <rect x="14" y="9" width="20" height="30" rx="3" stroke="#C9873A" strokeWidth="1.4" />
                  <rect x="17" y="13" width="8" height="5" rx="1" fill="#C9873A" opacity="0.5" />
                  <line x1="17" y1="22" x2="31" y2="22" stroke="#C9873A" strokeWidth="1" opacity="0.4" />
                  <line x1="17" y1="26" x2="28" y2="26" stroke="#C9873A" strokeWidth="1" opacity="0.4" />
                  <line x1="17" y1="30" x2="25" y2="30" stroke="#C9873A" strokeWidth="1" opacity="0.4" />
                  <path d="M6 24C6 13.5 14 6 24 6" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" fill="none" />
                  <path d="M42 24C42 13.5 34 6 24 6" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" fill="none" />
                </svg>
                <div style={{ fontSize: 10, color: "#7a5535", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                  {scanning ? "Scanning…" : "Tap to scan"}
                </div>
                <div style={{ fontSize: 12, color: "#3a1f0d" }}>
                  {scanning ? "" : "Hold RFID card near reader"}
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: msgColor, minHeight: 18, letterSpacing: 1 }}>{msg.text}</div>
            </>
          ) : (
            <>
              {/* PIN dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: 8, background: "#1A0F07", border: `1px solid ${i < pin.length ? "#C9873A" : "#3a1f0d"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#C9873A", transition: "border-color 0.2s" }}>
                    {i < pin.length ? "●" : ""}
                  </div>
                ))}
              </div>
              {/* Numpad */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {["1","2","3","4","5","6","7","8","9","CLR","0","⌫"].map(k => (
                  <button key={k} onClick={() => {
                    if (k === "CLR") setPin("");
                    else if (k === "⌫") setPin(p => p.slice(0, -1));
                    else if (pin.length < 4) setPin(p => p + k);
                  }}
                    style={{ background: "#1A0F07", border: "1px solid #3a1f0d", borderRadius: 8, color: k === "CLR" || k === "⌫" ? "#7a5535" : "#e8c99a", fontSize: 15, padding: "11px 0", cursor: "pointer", fontFamily: "'Lato', sans-serif", transition: "all 0.15s" }}>
                    {k}
                  </button>
                ))}
              </div>
              <button onClick={submitPin} style={{ ...S.btnGold, width: "100%", fontSize: 12, padding: 12, borderRadius: 8 }}>
                LOGIN
              </button>
              <div style={{ textAlign: "center", fontSize: 11, color: msgColor, minHeight: 18, letterSpacing: 1, marginTop: 10 }}>{msg.text}</div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes rfidPulse { 0%{transform:translate(-50%,-50%) scale(0.8);opacity:0.8} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} } @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');`}</style>
    </div>
  );
}

// ─── POS Main Screen ──────────────────────────────────────────────────────────
function POSScreen({ staff, onLogout }: { staff: Staff; onLogout: () => void }) {
  const [category, setCategory] = useState<Category>("Signature Brews");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [screen, setScreen] = useState<"pos" | "orders" | "checkout">("pos");
  const [orderType, setOrderType] = useState<"dine-in" | "takeout">("dine-in");
  const [tableNo, setTableNo] = useState("1");
  const [checkoutStep, setCheckoutStep] = useState<"review" | "payment" | "success">("review");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "ewallet">("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const menuItems = MENU.filter(m => m.category === category);
  const cartTotal = cart.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0);
  const tax = cartTotal * 0.12;
  const grandTotal = cartTotal + tax;

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const ex = prev.find(ci => ci.item.id === item.id);
      if (ex) return prev.map(ci => ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci);
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(ci => ci.item.id === id ? { ...ci, qty: ci.qty + delta } : ci);
      return updated.filter(ci => ci.qty > 0);
    });
  };

  const placeOrder = () => {
    const order: Order = {
      id: genOrderId(), items: [...cart], staff, status: "preparing",
      total: grandTotal, createdAt: new Date(), type: orderType,
      table: orderType === "dine-in" ? `Table ${tableNo}` : undefined,
    };
    setOrders(prev => [order, ...prev]);
    setCart([]);
    setCheckoutStep("success");
    setTimeout(() => { setScreen("pos"); setCheckoutStep("review"); }, 3000);
  };

  const activeOrders = orders.filter(o => o.status !== "completed");
  const change = parseFloat(cashGiven) - grandTotal;

  return (
    <div style={S.posWrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap'); ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#120A04} ::-webkit-scrollbar-thumb{background:#3a1f0d;border-radius:4px} * {box-sizing:border-box}`}</style>

      {/* Left Panel */}
      <div style={S.posLeft}>
        {/* Topbar */}
        <div style={S.topbar}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#C9873A", letterSpacing: 2, marginRight: "auto" }}>
            ERLBREW
          </div>

          {/* Nav */}
          {(["pos", "orders"] as const).map(s => (
            <button key={s} onClick={() => setScreen(s)}
              style={{ background: screen === s ? "#3a1f0d" : "transparent", border: `1px solid ${screen === s ? "#C9873A" : "#2a1508"}`, borderRadius: 8, color: screen === s ? "#C9873A" : "#5a3318", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", padding: "7px 14px", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              {s === "pos" ? "Order" : `Kitchen${activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}`}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: "#2a1508" }} />

          {/* Staff */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: staff.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#120A04" }}>
              {staff.initials}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#e8c99a", fontWeight: 700, lineHeight: 1.2 }}>{staff.name.split(" ")[0]}</div>
              <div style={{ fontSize: 9, color: "#5a3318", letterSpacing: 1 }}>{staff.role}</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#5a3318", letterSpacing: 1 }}>
            {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
          </div>

          <button onClick={onLogout} style={{ ...S.btnOutline, fontSize: 9, padding: "7px 12px" }}>Logout</button>
        </div>

        {screen === "pos" && (
          <>
            {/* Category Tabs */}
            <div style={{ display: "flex", gap: 8, padding: "1rem 1.5rem 0", flexShrink: 0 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{ background: category === cat ? "#C9873A" : "transparent", border: `1px solid ${category === cat ? "#C9873A" : "#2a1508"}`, borderRadius: 8, color: category === cat ? "#120A04" : "#7a5535", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", padding: "8px 14px", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, transition: "all 0.2s", whiteSpace: "nowrap" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div style={S.menuArea}>
              <div style={S.menuGrid}>
                {menuItems.map(item => {
                  const inCart = cart.find(ci => ci.item.id === item.id);
                  return (
                    <div key={item.id} onClick={() => addToCart(item)}
                      style={{ ...S.menuCard, ...(item.popular ? S.menuCardPopular : {}), ...(inCart ? { border: "1px solid #C9873A" } : {}), position: "relative" }}>
                      {item.popular && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: "#C9873A", color: "#120A04", fontSize: 8, letterSpacing: 1, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                          Popular
                        </div>
                      )}
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{item.emoji}</div>
                      {item.badge && <div style={S.badge}>{item.badge}</div>}
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e8c99a", margin: "4px 0", lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#5a3318", lineHeight: 1.4, marginBottom: 10, minHeight: 32 }}>{item.description.slice(0, 60)}…</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#C9873A", fontFamily: "'Playfair Display', serif" }}>{formatCurrency(item.price)}</div>
                        {inCart && (
                          <div style={{ background: "#C9873A", color: "#120A04", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                            {inCart.qty}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {screen === "orders" && <KitchenView orders={orders} onUpdateStatus={(id, status) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))} />}
      </div>

      {/* Right Panel - Cart */}
      {screen === "pos" && (
        <div style={S.posRight}>
          {checkoutStep === "success" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#7ac97a", marginBottom: 8 }}>Order Placed!</div>
              <div style={{ fontSize: 12, color: "#5a3318", letterSpacing: 1 }}>Sent to kitchen</div>
            </div>
          ) : checkoutStep === "payment" ? (
            <PaymentPanel
              total={grandTotal} payMethod={payMethod} setPayMethod={setPayMethod}
              cashGiven={cashGiven} setCashGiven={setCashGiven} change={change}
              onBack={() => setCheckoutStep("review")} onConfirm={placeOrder}
            />
          ) : (
            <>
              <div style={S.cartHeader}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8c99a" }}>Current Order</div>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} style={{ ...S.btnDanger, fontSize: 9, padding: "5px 10px" }}>Clear</button>
                  )}
                </div>

                {/* Order Type */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {(["dine-in", "takeout"] as const).map(t => (
                    <button key={t} onClick={() => setOrderType(t)}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, transition: "all 0.2s",
                        background: orderType === t ? "#3a1f0d" : "transparent",
                        borderColor: orderType === t ? "#C9873A" : "#2a1508",
                        color: orderType === t ? "#C9873A" : "#3a1f0d" }}>
                      {t === "dine-in" ? "Dine In" : "Takeout"}
                    </button>
                  ))}
                </div>

                {orderType === "dine-in" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#5a3318", letterSpacing: 1 }}>Table:</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["1","2","3","4","5","6"].map(t => (
                        <button key={t} onClick={() => setTableNo(t)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid", fontSize: 11, cursor: "pointer", fontFamily: "'Lato', sans-serif",
                            background: tableNo === t ? "#C9873A" : "transparent",
                            borderColor: tableNo === t ? "#C9873A" : "#2a1508",
                            color: tableNo === t ? "#120A04" : "#5a3318" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div style={S.cartItems}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "#2a1508", fontSize: 12, letterSpacing: 1 }}>
                    No items added yet
                  </div>
                ) : cart.map(ci => (
                  <div key={ci.item.id} style={S.cartRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#e8c99a", fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ci.item.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#7a5535" }}>{formatCurrency(ci.item.price)} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => updateQty(ci.item.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#1A0F07", border: "1px solid #3a1f0d", color: "#9a6b3a", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato', sans-serif" }}>−</button>
                      <span style={{ fontSize: 13, color: "#e8c99a", fontWeight: 700, minWidth: 18, textAlign: "center" }}>{ci.qty}</span>
                      <button onClick={() => updateQty(ci.item.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, background: "#1A0F07", border: "1px solid #3a1f0d", color: "#C9873A", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato', sans-serif" }}>+</button>
                    </div>
                    <div style={{ fontSize: 13, color: "#C9873A", fontWeight: 700, minWidth: 48, textAlign: "right" }}>
                      {formatCurrency(ci.item.price * ci.qty)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Footer */}
              <div style={S.cartFooter}>
                <div style={{ marginBottom: 12 }}>
                  {[["Subtotal", cartTotal], ["VAT (12%)", tax]].map(([label, val]) => (
                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5a3318", marginBottom: 6 }}>
                      <span>{label}</span>
                      <span>{formatCurrency(val as number)}</span>
                    </div>
                  ))}
                  <div style={S.divider} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, color: "#9a6b3a", letterSpacing: 1, textTransform: "uppercase" }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "#C9873A", fontFamily: "'Playfair Display', serif" }}>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
                <button onClick={() => cart.length > 0 && setCheckoutStep("payment")}
                  style={{ ...S.btnGold, width: "100%", fontSize: 11, padding: 13, borderRadius: 10, opacity: cart.length > 0 ? 1 : 0.4, cursor: cart.length > 0 ? "pointer" : "not-allowed" }}>
                  Proceed to Payment
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Payment Panel ────────────────────────────────────────────────────────────
function PaymentPanel({ total, payMethod, setPayMethod, cashGiven, setCashGiven, change, onBack, onConfirm }: {
  total: number; payMethod: "cash" | "card" | "ewallet"; setPayMethod: (m: "cash" | "card" | "ewallet") => void;
  cashGiven: string; setCashGiven: (v: string) => void; change: number;
  onBack: () => void; onConfirm: () => void;
}) {
  const quickAmounts = [Math.ceil(total), Math.ceil(total / 10) * 10 + 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100];
  const uniqueAmounts = [...new Set(quickAmounts)].slice(0, 4);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ ...S.cartHeader, borderBottom: "1px solid #2a1508" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#7a5535", fontSize: 16, cursor: "pointer", padding: 0 }}>←</button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#e8c99a" }}>Payment</div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#5a3318", letterSpacing: 2, marginBottom: 4 }}>AMOUNT DUE</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#C9873A", fontFamily: "'Playfair Display', serif" }}>{formatCurrency(total)}</div>
        </div>

        {/* Pay Method */}
        <div style={{ display: "flex", gap: 6 }}>
          {([["cash", "Cash"], ["card", "Card"], ["ewallet", "E-Wallet"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setPayMethod(m)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700,
                background: payMethod === m ? "#3a1f0d" : "transparent",
                borderColor: payMethod === m ? "#C9873A" : "#2a1508",
                color: payMethod === m ? "#C9873A" : "#3a1f0d" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "1rem 1.2rem", overflowY: "auto" }}>
        {payMethod === "cash" && (
          <>
            <div style={{ fontSize: 10, color: "#5a3318", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Cash Tendered</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {uniqueAmounts.map(amt => (
                <button key={amt} onClick={() => setCashGiven(String(amt))}
                  style={{ background: cashGiven === String(amt) ? "#C9873A" : "#1A0F07", border: `1px solid ${cashGiven === String(amt) ? "#C9873A" : "#2a1508"}`, color: cashGiven === String(amt) ? "#120A04" : "#7a5535", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700 }}>
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
            <input value={cashGiven} onChange={e => setCashGiven(e.target.value)} placeholder="Enter amount"
              style={{ width: "100%", background: "#1A0F07", border: "1px solid #3a1f0d", borderRadius: 8, color: "#e8c99a", fontSize: 16, padding: "10px 12px", fontFamily: "'Lato', sans-serif", outline: "none", marginBottom: 12 }} />
            {cashGiven && parseFloat(cashGiven) >= total && (
              <div style={{ background: "#1a2e1a", border: "1px solid #2a5a2a", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#7ac97a", letterSpacing: 2, marginBottom: 4 }}>CHANGE</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#7ac97a", fontFamily: "'Playfair Display', serif" }}>{formatCurrency(change)}</div>
              </div>
            )}
          </>
        )}
        {payMethod === "card" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <div style={{ fontSize: 13, color: "#7a5535", lineHeight: 1.6 }}>Tap or insert card on the payment terminal.</div>
          </div>
        )}
        {payMethod === "ewallet" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ background: "#2a1508", borderRadius: 12, padding: "1.5rem", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#5a3318", letterSpacing: 2, marginBottom: 8 }}>SCAN QR CODE</div>
              <div style={{ fontSize: 60, lineHeight: 1 }}>▣</div>
            </div>
            <div style={{ fontSize: 12, color: "#5a3318" }}>GCash / Maya / PayMaya accepted</div>
          </div>
        )}
      </div>

      <div style={{ padding: "1rem 1.2rem", borderTop: "1px solid #2a1508" }}>
        <button onClick={onConfirm}
          style={{ ...S.btnGold, width: "100%", fontSize: 11, padding: 13, borderRadius: 10, opacity: (payMethod !== "cash" || (!!cashGiven && parseFloat(cashGiven) >= total)) ? 1 : 0.4 }}>
          Confirm & Place Order
        </button>
      </div>
    </div>
  );
}

// ─── Kitchen View ─────────────────────────────────────────────────────────────
function KitchenView({ orders, onUpdateStatus }: { orders: Order[]; onUpdateStatus: (id: string, status: OrderStatus) => void }) {
  const cols: { status: OrderStatus; label: string; color: string }[] = [
    { status: "preparing", label: "Preparing", color: "#C9873A" },
    { status: "ready", label: "Ready", color: "#7ac97a" },
    { status: "completed", label: "Completed", color: "#5a3318" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: 1, padding: "1.2rem 1.5rem", gap: 12 } as React.CSSProperties}>
      {cols.map(col => (
        <div key={col.status} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
            <div style={{ fontSize: 10, color: col.color, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>{col.label}</div>
            <div style={{ fontSize: 10, color: "#3a1f0d", marginLeft: "auto" }}>
              {orders.filter(o => o.status === col.status).length}
            </div>
          </div>
          {orders.filter(o => o.status === col.status).map(order => (
            <div key={order.id} style={{ background: "#2a1508", border: `1px solid ${col.status === "preparing" ? "#5a3318" : col.status === "ready" ? "#2a5a2a" : "#2a1508"}`, borderRadius: 10, padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8c99a", fontFamily: "'Playfair Display', serif" }}>{order.id}</div>
                <div style={{ fontSize: 9, color: "#5a3318", letterSpacing: 1 }}>{formatTime(order.createdAt)}</div>
              </div>
              <div style={{ fontSize: 10, color: col.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                {order.type === "dine-in" ? order.table : "Takeout"}
              </div>
              {order.items.map(ci => (
                <div key={ci.item.id} style={{ fontSize: 11, color: "#7a5535", marginBottom: 3 }}>
                  {ci.qty}× {ci.item.name}
                </div>
              ))}
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                {col.status === "preparing" && (
                  <button onClick={() => onUpdateStatus(order.id, "ready")}
                    style={{ flex: 1, background: "#1a2e1a", border: "1px solid #2a5a2a", color: "#7ac97a", borderRadius: 6, padding: "7px 0", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700 }}>
                    Mark Ready
                  </button>
                )}
                {col.status === "ready" && (
                  <button onClick={() => onUpdateStatus(order.id, "completed")}
                    style={{ flex: 1, background: "#C9873A", border: "none", color: "#120A04", borderRadius: 6, padding: "7px 0", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700 }}>
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders.filter(o => o.status === col.status).length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem 0", color: "#2a1508", fontSize: 11, letterSpacing: 1 }}>Empty</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [staff, setStaff] = useState<Staff | null>(null);

  if (!staff) return <LoginScreen onLogin={setStaff} />;
  return <POSScreen staff={staff} onLogout={() => setStaff(null)} />;
}
