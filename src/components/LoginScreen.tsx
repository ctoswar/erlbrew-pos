import React, { useState } from "react";
import { Staff, LoginMode } from "../types";
import { STAFF } from "../data";
import { useClock } from "../hooks/useClock";
import { formatTime, formatDate } from "../utils";

interface Props {
  onLogin: (staff: Staff) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const time = useClock();
  const [mode, setMode] = useState<LoginMode>("rfid");
  const [pin, setPin] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanIdx, setScanIdx] = useState(0);
  const [msg, setMsg] = useState({ text: "", type: "info" as "info" | "error" | "success" });

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setPin("");
    setMsg({ text: "", type: "info" });
  };

  const simulateScan = () => {
    if (scanning) return;
    setScanning(true);
    setMsg({ text: "Reading RFID card…", type: "info" });
    setTimeout(() => {
      const staff = STAFF[scanIdx % STAFF.length];
      setScanIdx((i) => i + 1);
      setScanning(false);
      setMsg({ text: `Welcome, ${staff.name}!`, type: "success" });
      setTimeout(() => onLogin(staff), 800);
    }, 1700);
  };

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "⌫")  { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const submitPin = () => {
    const staff = STAFF.find((s) => s.pin === pin);
    if (staff) {
      setMsg({ text: `Welcome, ${staff.name}!`, type: "success" });
      setTimeout(() => onLogin(staff), 600);
    } else {
      setMsg({ text: "Incorrect PIN. Try again.", type: "error" });
      setPin("");
      setTimeout(() => setMsg({ text: "", type: "info" }), 2000);
    }
  };

  const msgColor = msg.type === "error" ? "var(--danger)" : msg.type === "success" ? "var(--success)" : "var(--text-muted)";

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-default)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.2rem", flexShrink: 0 }}>
        <CoffeeSVG />
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", letterSpacing: 3, marginBottom: 2 }}>ERLBREW</div>
        <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 5, textTransform: "uppercase", marginBottom: 32 }}>Café</div>
        <div style={{ width: 36, height: 1, background: "var(--border-default)", marginBottom: 14 }} />
        <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{formatTime(time)}</div>
        <div style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 1, marginTop: 4 }}>{formatDate(time)}</div>
        <div style={{ width: 36, height: 1, background: "var(--border-default)", margin: "20px 0 16px" }} />
        <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", lineHeight: 2 }}>
          Point of Sale<br />v2.0
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-fadeInUp card-elevated" style={{ padding: "2.5rem 2rem", width: 360 }}>
          <div className="font-display" style={{ fontSize: 21, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", marginBottom: 3 }}>
            Staff Login
          </div>
          <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 3, textTransform: "uppercase", textAlign: "center", marginBottom: 22 }}>
            Tap your card or enter PIN
          </div>

          {/* Mode Tabs */}
          <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
            {(["rfid", "pin"] as LoginMode[]).map((m) => (
              <button key={m} className={`btn tab ${mode === m ? "active" : ""}`}
                onClick={() => switchMode(m)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 9, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-disabled)" }}>
                {m === "rfid" ? "RFID Card" : "PIN Code"}
              </button>
            ))}
          </div>

          {mode === "rfid" ? (
            <RFIDSection scanning={scanning} onScan={simulateScan} />
          ) : (
            <PinSection pin={pin} onPress={pressPin} onSubmit={submitPin} />
          )}

          <div style={{ textAlign: "center", fontSize: 11, marginTop: 10, letterSpacing: 1, color: msgColor, minHeight: 18, transition: "color 0.3s" }}>
            {msg.text}
          </div>
        </div>
      </main>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const CoffeeSVG: React.FC = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.8 }}>
    <rect x="8" y="18" width="26" height="22" rx="3" stroke="#C9873A" strokeWidth="1.4" />
    <path d="M34 22C40 22 42 26 40 29C38 32 34 32 34 32" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M13 18C13 14.5 16.5 11 20 13C22 10 27 10 27 13C30 11 33 14.5 33 18" stroke="#C9873A" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
    <rect x="8" y="40" width="26" height="2.5" rx="1.25" fill="#C9873A" opacity="0.2" />
  </svg>
);

const RFIDSection: React.FC<{ scanning: boolean; onScan: () => void }> = ({ scanning, onScan }) => (
  <div onClick={onScan} style={{ background: "var(--bg-base)", border: `2px dashed ${scanning ? "var(--gold)" : "var(--border-default)"}`, borderRadius: 12, padding: "2rem 1rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.3s", marginBottom: 10, position: "relative", overflow: "hidden" }}>
    {scanning && (
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 70, height: 70, borderRadius: "50%", border: "1.5px solid var(--gold)", animation: "rfidPulse 1.3s ease-out infinite", pointerEvents: "none" }} />
    )}
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 10px", display: "block" }}>
      <rect x="14" y="9" width="20" height="30" rx="3" stroke="#C9873A" strokeWidth="1.4" />
      <rect x="17" y="13" width="8" height="5" rx="1" fill="#C9873A" opacity="0.5" />
      <line x1="17" y1="22" x2="31" y2="22" stroke="#C9873A" strokeWidth="1" opacity="0.35" />
      <line x1="17" y1="26" x2="28" y2="26" stroke="#C9873A" strokeWidth="1" opacity="0.35" />
      <line x1="17" y1="30" x2="25" y2="30" stroke="#C9873A" strokeWidth="1" opacity="0.35" />
      <path d="M5 24C5 12.9 13.4 4 24 4" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" fill="none" />
      <path d="M43 24C43 12.9 34.6 4 24 4" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" fill="none" />
    </svg>
    <div style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
      {scanning ? "Scanning…" : "Tap to scan"}
    </div>
    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
      {scanning ? "" : "Hold RFID card near reader"}
    </div>
  </div>
);

const NUM_KEYS = ["1","2","3","4","5","6","7","8","9","CLR","0","⌫"];

const PinSection: React.FC<{ pin: string; onPress: (k: string) => void; onSubmit: () => void }> = ({ pin, onPress, onSubmit }) => (
  <>
    <div style={{ display: "flex", justifyContent: "center", gap: 9, marginBottom: 14 }}>
      {[0,1,2,3].map((i) => (
        <div key={i} style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg-base)", border: `1px solid ${i < pin.length ? "var(--gold)" : "var(--border-default)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--gold)", transition: "border-color 0.2s" }}>
          {i < pin.length ? "●" : ""}
        </div>
      ))}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 12 }}>
      {NUM_KEYS.map((k) => (
        <button key={k} className="btn" onClick={() => onPress(k)}
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: 8, color: k === "CLR" || k === "⌫" ? "var(--text-muted)" : "var(--text-primary)", fontSize: 15, padding: "11px 0", fontFamily: "'Lato', sans-serif" }}>
          {k}
        </button>
      ))}
    </div>
    <button className="btn btn-gold" onClick={onSubmit} style={{ width: "100%", fontSize: 11, padding: 12, borderRadius: 9 }}>
      LOGIN
    </button>
  </>
);
