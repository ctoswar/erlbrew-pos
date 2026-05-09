import React, { useState, useEffect, useRef } from "react";
import { Staff } from "../types";
import { useClock } from "../hooks/useClock";
import { formatTime, formatDate } from "../utils";
import { apiPost, setAuthToken } from "../utils/api";

interface CompanyInfo {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo: string;
}

interface Props {
  onLogin: (staff: Staff) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const time = useClock();
  const [company] = useState<CompanyInfo>(() => {
    try {
      const s = localStorage.getItem('erlbrew_company_settings');
      return s ? JSON.parse(s) : { company_name: 'Erlbrew Cafe', company_address: '', company_phone: '', company_email: '', company_logo: '' };
    } catch { return { company_name: 'Erlbrew Cafe', company_address: '', company_phone: '', company_email: '', company_logo: '' }; }
  });

  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [msg, setMsg] = useState({ text: "", type: "info" as "info" | "error" | "success" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"rfid" | "pin">("rfid");

  const rfidInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus RFID input on mount
  useEffect(() => {
    rfidInputRef.current?.focus();
  }, []);

  // Force refocus RFID input whenever RFID step is active (handles click loss)
  useEffect(() => {
    if (step === "rfid") {
      rfidInputRef.current?.focus();
      const interval = setInterval(() => {
        if (document.activeElement !== rfidInputRef.current) {
          rfidInputRef.current?.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [step]);

  // When staff is selected, focus PIN input
  useEffect(() => {
    if (step === "pin" && selectedStaff) {
      pinInputRef.current?.focus();
    }
  }, [step, selectedStaff]);

  // Handle RFID scan (Enter key or button)
  const handleRfidSubmit = async (rfidValue: string) => {
    const trimmed = rfidValue.replace(/[\x00-\x1f]/g, '').trim().toUpperCase();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/staff/rfid/${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error();
      const staff = await res.json();
      if (!staff || !staff.id) {
        setMsg({ text: "Card not registered. See admin.", type: "error" });
        setRfid("");
        return;
      }
      setSelectedStaff(staff);
      setRfid(trimmed);
      setStep("pin");
      setMsg({ text: `${staff.name} — enter your PIN`, type: "info" });
      pinInputRef.current?.focus();
    } catch {
      setMsg({ text: "Card not recognized. Try again.", type: "error" });
      setRfid("");
    }
  };

  const handleRfidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleRfidSubmit(rfid);
  };

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const submitLogin = () => {
    if (!selectedStaff || pin.length !== 4) return;
    setLoading(true);
    apiPost<{ token: string; clockAction?: string }>('/staff/login', {
      rfid: selectedStaff.rfid,
      pin,
    })
      .then((data) => {
        if (data?.token) {
          setAuthToken(data.token);
          const clockMsg = data.clockAction === 'clock_in' ? ' ✓ Clocked in!' : data.clockAction === 'clock_out' ? ' ✓ Clocked out!' : '';
          setMsg({ text: `Welcome, ${selectedStaff.name}${clockMsg}`, type: "success" });
          setTimeout(() => { setLoading(false); onLogin(selectedStaff); }, 600);
        } else {
          throw new Error('No token');
        }
      })
      .catch(() => {
        setLoading(false);
        setMsg({ text: "Incorrect PIN. Try again.", type: "error" });
        setPin("");
      });
  };

  const goBack = () => {
    setStep("rfid");
    setSelectedStaff(null);
    setPin("");
    setMsg({ text: "", type: "info" });
    rfidInputRef.current?.focus();
  };

  const msgColor = msg.type === "error" ? "var(--danger)" : msg.type === "success" ? "var(--success)" : "var(--text-muted)";

    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>
        {/* ── Sidebar ── */}
        <aside style={{
          width: 220, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-default)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "2rem 1.2rem", flexShrink: 0,
        }}>
          {company.company_logo ? (
            <img src={company.company_logo} alt="Company Logo" style={{ width: 48, height: 48, marginBottom: 8 }} />
          ) : (
            <CoffeeSVG />
          )}
          <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", letterSpacing: 3, marginBottom: 2 }}>
            {company.company_name || 'Erlbrew Cafe'}
          </div>
          {company.company_address && (
            <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 32 }}>
              {company.company_address}
            </div>
          )}
          <div style={{ width: 36, height: 1, background: "var(--border-default)", marginBottom: 14 }} />
          <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{formatTime(time)}</div>
          <div style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 1, marginTop: 4 }}>{formatDate(time)}</div>
          <div style={{ width: 36, height: 1, background: "var(--border-default)", margin: "20px 0 16px" }} />
          <div style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", lineHeight: 2 }}>
            Point of Sale<br />v2.0
          </div>
        </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", overflowY: "auto" }}>

        {/* ── Step 1: Scan RFID ── */}
        {step === "rfid" && (
          <div className="animate-fadeInUp" style={{ padding: "2.5rem 2rem", width: 360, textAlign: "center", position: "relative" }} onClick={() => rfidInputRef.current?.focus()}>
            {/* Invisible input for USB RFID reader (must stay in viewport to receive keystrokes) */}
            <input
              ref={rfidInputRef}
              value={rfid}
              onChange={(e) => setRfid(e.target.value.toUpperCase())}
              onKeyDown={handleRfidKeyDown}
              style={{
                position: "fixed", top: 0, left: 0,
                width: 1, height: 1, opacity: 0,
                zIndex: -1,
              }}
              autoFocus
            />

            {/* Animated card scan visual */}
            <div style={{
              position: "relative", width: 160, height: 110, margin: "0 auto 24px",
              perspective: 600,
            }}>
              {/* Card body */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(145deg, rgba(201,135,58,0.18), rgba(201,135,58,0.06))",
                border: "1.5px solid rgba(201,135,58,0.3)",
                borderRadius: 16,
                overflow: "hidden",
                backdropFilter: "blur(4px)",
              }}>
                {/* Card chip */}
                <div style={{
                  position: "absolute", top: 16, left: 20,
                  width: 22, height: 16,
                  background: "linear-gradient(135deg, var(--gold), rgba(201,135,58,0.5))",
                  borderRadius: 3,
                  opacity: 0.7,
                }} />
                {/* Card rings */}
                <div style={{
                  position: "absolute", top: 14, left: 48,
                  width: 8, height: 8, borderRadius: "50%",
                  border: "1.5px solid rgba(201,135,58,0.25)",
                }} />
                <div style={{
                  position: "absolute", top: 18, left: 58,
                  width: 6, height: 6, borderRadius: "50%",
                  border: "1px solid rgba(201,135,58,0.15)",
                }} />

                {/* Wifi icon */}
                <div style={{
                  position: "absolute", top: 38, left: 20,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                }}>
                  {[16, 12, 8].map((w, i) => (
                    <div key={i} style={{
                      width: w, height: 3, borderRadius: 2,
                      background: "var(--gold)",
                      opacity: 0.4 - i * 0.1,
                    }} />
                  ))}
                </div>

                {/* Card number dots */}
                <div style={{
                  position: "absolute", bottom: 22, left: 20,
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  {[1,2,3,4].map((g) => (
                    <div key={g} style={{
                      display: "flex", gap: 3,
                    }}>
                      {[1,2,3,4].map((d) => (
                        <div key={d} style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: "var(--gold)", opacity: 0.25,
                        }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scan line — sweeps up and down */}
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
                boxShadow: "0 0 8px rgba(201,135,58,0.6), 0 0 20px rgba(201,135,58,0.2)",
                animation: "scanLine 2.2s ease-in-out infinite",
              }} />

              {/* Outer glow ring */}
              <div style={{
                position: "absolute", inset: -6, borderRadius: 20,
                border: "1px solid rgba(201,135,58,0.08)",
                animation: "pulseGlow 3s ease-in-out infinite",
              }} />
            </div>

            {/* Tap prompt */}
            <div style={{
              fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
              marginBottom: 6, letterSpacing: 1,
              fontFamily: "'Playfair Display', serif",
            }}>
              Tap Your Card
            </div>
            <div style={{
              fontSize: 10, color: "var(--text-faint)", lineHeight: 1.6, letterSpacing: 0.5,
            }}>
              Place your card near the reader to scan<br />
              or tap the button below
            </div>

            {/* Manual trigger button (fallback for test) */}
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => handleRfidSubmit(rfid)}
                style={{
                  background: "rgba(201,135,58,0.1)", color: "var(--gold)",
                  border: "1px solid rgba(201,135,58,0.3)", borderRadius: 10,
                  padding: "10px 24px", fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,135,58,0.2)"; e.currentTarget.style.borderColor = "var(--gold)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201,135,58,0.1)"; e.currentTarget.style.borderColor = "rgba(201,135,58,0.3)"; }}
              >
                SIMULATE SCAN
              </button>
            </div>

            {/* Status message */}
            <div style={{ textAlign: "center", fontSize: 11, marginTop: 16, letterSpacing: 1, color: msgColor, minHeight: 18 }}>
              {msg.text}
            </div>
          </div>
        )}

        {/* ── Step 2: Enter PIN ── */}
        {step === "pin" && selectedStaff && (
          <div className="animate-fadeInUp card-elevated" style={{ padding: "2rem 1.75rem", width: 320, textAlign: "center" }}>
            <button onClick={goBack} style={{
              background: "none", border: "none", color: "var(--text-faint)", fontSize: 11,
              cursor: "pointer", marginBottom: 16, padding: "4px 8px",
            }}>
              ← Back
            </button>

            {/* Staff card */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, textAlign: "left" }}>
              <div style={{
                width: 46, height: 46, borderRadius: "50%",
                background: selectedStaff.color || "#C9873A",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {selectedStaff.initials}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{selectedStaff.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{selectedStaff.role}</div>
              </div>
            </div>

            <div style={{ fontSize: 9, color: "var(--gold-muted)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Enter Your PIN
            </div>

            {/* PIN dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 18 }}>
              {[0,1,2,3].map((i) => (
                <div key={i} style={{
                  width: 46, height: 46, borderRadius: 10,
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 14 }}>
              {(["1","2","3","4","5","6","7","8","9","CLR","0","⌫"] as string[]).map((k) => (
                <button
                  key={k}
                  className="btn"
                  onClick={() => !loading && pressPin(k)}
                  disabled={loading}
                  style={{
                    background: k === "CLR" || k === "⌫" ? "var(--bg-base)" : "var(--card-bg)",
                    border: "1px solid var(--border-default)", borderRadius: 8,
                    color: k === "CLR" || k === "⌫" ? "var(--text-muted)" : "var(--text-primary)",
                    fontSize: 16, padding: "13px 0", cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              className="btn btn-gold"
              onClick={submitLogin}
              disabled={loading || pin.length !== 4}
              style={{ width: "100%", fontSize: 11, padding: 13, borderRadius: 9, opacity: (loading || pin.length !== 4) ? 0.5 : 1 }}
            >
              {loading ? "Logging in…" : "LOGIN"}
            </button>

            <div style={{ textAlign: "center", fontSize: 11, marginTop: 12, letterSpacing: 1, color: msgColor, minHeight: 18 }}>
              {msg.text}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const CoffeeSVG: React.FC = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.8 }}>
    <rect x="8" y="18" width="26" height="22" rx="3" stroke="#C9873A" strokeWidth="1.4" />
    <path d="M34 22C40 22 42 26 40 29C38 32 34 32 34 32" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M13 18C13 14.5 16.5 11 20 13C22 10 27 10 27 13C30 11 33 14.5 33 18" stroke="#C9873A" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
    <rect x="8" y="40" width="26" height="2.5" rx="1.25" fill="#C9873A" opacity="0.2" />
  </svg>
);