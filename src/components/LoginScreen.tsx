import React, { useState, useEffect } from "react";
import { Staff } from "../types";
import { useClock } from "../hooks/useClock";
import { formatTime, formatDate } from "../utils";
import { apiGet, apiPost, setAuthToken } from "../utils/api";

interface Props {
  onLogin: (staff: Staff) => void;
}



export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const time = useClock();
  
  const [pin, setPin] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [msg, setMsg] = useState({ text: "", type: "info" as "info" | "error" | "success" });
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet<Staff[]>('/staff')
      .then(setStaffList)
      .catch(() => setStaffList([]));
  }, []);

  

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const handleStaffSelect = (staff: Staff) => {
    setSelectedStaff(staff);
    setPin("");
    setMsg({ text: `Enter PIN for ${staff.name}`, type: "info" });
  };

  const submitPin = () => {
    if (!selectedStaff) {
      setMsg({ text: "Please select your name first", type: "error" });
      return;
    }
    if (pin.length !== 4) {
      setMsg({ text: "Enter all 4 digits", type: "error" });
      return;
    }
    setLoading(true);
    apiPost<{ token: string }>('/staff/login', { username: selectedStaff.name, password: pin })
      .then((data) => {
        if (data?.token) {
          setAuthToken(data.token);
          setMsg({ text: `Welcome, ${selectedStaff.name}!`, type: "success" });
          setTimeout(() => { setLoading(false); onLogin(selectedStaff); }, 500);
        } else {
          throw new Error('No token');
        }
      })
      .catch(() => {
        setLoading(false);
        setMsg({ text: "Incorrect PIN. Try again.", type: "error" });
        setPin("");
        setTimeout(() => setMsg({ text: `Enter PIN for ${selectedStaff.name}`, type: "info" }), 2000);
      });
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
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem", padding: "2rem" }}>
        {/* Staff Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 220 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Select Your Name
          </div>
          {staffList.map((staff) => (
            <button
              key={staff.id}
              onClick={() => handleStaffSelect(staff)}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: `1.5px solid ${selectedStaff?.id === staff.id ? "var(--gold)" : "var(--border-default)"}`,
                background: selectedStaff?.id === staff.id ? "rgba(201,135,58,0.12)" : "var(--card-bg)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: "50%", background: staff.color || "#C9873A",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {staff.initials || staff.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{staff.name}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{staff.role}</div>
              </div>
            </button>
          ))}
          {staffList.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "1rem" }}>
              Loading staff...
            </div>
          )}
        </div>

        {/* PIN Pad */}
        <div className="animate-fadeInUp card-elevated" style={{ padding: "2rem 1.75rem", width: 300 }}>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", marginBottom: 3 }}>
            {selectedStaff ? selectedStaff.name : "Enter Your PIN"}
          </div>
          <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 3, textTransform: "uppercase", textAlign: "center", marginBottom: 18 }}>
            {selectedStaff ? `${selectedStaff.role}` : "Select your name at left first"}
          </div>

          {/* PIN dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            {[0,1,2,3].map((i) => (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: 10,
                background: "var(--bg-base)",
                border: `1.5px solid ${i < pin.length ? "var(--gold)" : "var(--border-default)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, color: "var(--gold)", transition: "all 0.12s",
              }}>
                {i < pin.length ? "●" : ""}
              </div>
            ))}
          </div>

          {/* Keypad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 12 }}>
            {(["1","2","3","4","5","6","7","8","9","CLR","0","⌫"] as string[]).map((k) => (
              <button
                key={k}
                className="btn"
                onClick={() => !loading && pressPin(k)}
                disabled={loading}
                style={{
                  background: k === "CLR" || k === "⌫" ? "var(--bg-base)" : "var(--card-bg)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  color: k === "CLR" || k === "⌫" ? "var(--text-muted)" : "var(--text-primary)",
                  fontSize: 16,
                  padding: "12px 0",
                  fontFamily: "'Lato', sans-serif",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            className="btn btn-gold"
            onClick={submitPin}
            disabled={loading || pin.length !== 4}
            style={{ width: "100%", fontSize: 11, padding: 13, borderRadius: 9, opacity: (loading || pin.length !== 4) ? 0.5 : 1 }}
          >
            {loading ? "Logging in…" : "LOGIN"}
          </button>

          {/* Message */}
          <div style={{ textAlign: "center", fontSize: 11, marginTop: 12, letterSpacing: 1, color: msgColor, minHeight: 18, transition: "color 0.3s" }}>
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