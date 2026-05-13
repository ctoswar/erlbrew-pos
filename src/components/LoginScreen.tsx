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
      const s = localStorage.getItem("erlbrew_company_settings");
      return s
        ? JSON.parse(s)
        : { company_name: "Erlbrew Cafe", company_address: "", company_phone: "", company_email: "", company_logo: "" };
    } catch {
      return { company_name: "Erlbrew Cafe", company_address: "", company_phone: "", company_email: "", company_logo: "" };
    }
  });

  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [msg, setMsg] = useState({ text: "", type: "info" as "info" | "error" | "success" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"rfid" | "pin">("rfid");

  const rfidInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    rfidInputRef.current?.focus();
  }, []);

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

  useEffect(() => {
    if (step === "pin" && selectedStaff) {
      pinInputRef.current?.focus();
    }
  }, [step, selectedStaff]);

  const handleRfidSubmit = async (rfidValue: string) => {
    const trimmed = rfidValue.replace(/[\x00-\x1f]/g, "").trim().toUpperCase();
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
    apiPost<{ token: string; clockAction?: string }>("/staff/login", {
      rfid: selectedStaff.rfid,
      pin,
    })
      .then((data) => {
        if (data?.token) {
          setAuthToken(data.token);
          const clockMsg =
            data.clockAction === "clock_in"
              ? " ✓ Clocked in!"
              : "";
          setMsg({ text: `Welcome, ${selectedStaff.name}${clockMsg}`, type: "success" });
          setTimeout(() => {
            setLoading(false);
            onLogin(selectedStaff);
          }, 600);
        } else {
          throw new Error("No token");
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

  const msgColor =
    msg.type === "error"
      ? "var(--danger)"
      : msg.type === "success"
        ? "var(--success)"
        : "var(--text-muted)";

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>
      {/* ── Left Brand Sidebar ── */}
      <aside
        className="glass-panel"
        style={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 2rem",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(201,135,58,0.08)",
          borderLeft: "none",
          borderTop: "none",
          borderBottom: "none",
        }}
      >
        {/* Background coffee grain */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 20%, rgba(201,135,58,0.06) 0%, transparent 60%), radial-gradient(ellipse at 50% 80%, rgba(201,135,58,0.04) 0%, transparent 50%)",
            pointerEvents: "none",
          }}
        />

        {/* Decorative lines */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "10%",
            width: "80%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(201,135,58,0.12), transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            left: "10%",
            width: "80%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(201,135,58,0.12), transparent)",
          }}
        />

        {company.company_logo ? (
          <img
            src={company.company_logo}
            alt="Logo"
            style={{ width: 56, height: 56, marginBottom: 12, borderRadius: 12, objectFit: "contain" }}
          />
        ) : (
          <CoffeeSVG />
        )}

        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gold)",
            letterSpacing: 3,
            marginBottom: 2,
          }}
        >
          {company.company_name || "Erlbrew Cafe"}
        </div>

        <div
          style={{
            fontSize: 8,
            color: "var(--gold-dim)",
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 40,
          }}
        >
          Point of Sale
        </div>

        <div
          className="font-display"
          style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}
        >
          {formatTime(time)}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--gold-muted)",
            letterSpacing: 1.5,
            marginTop: 4,
            textTransform: "uppercase",
          }}
        >
          {formatDate(time)}
        </div>

        {company.company_address && (
          <>
            <div
              style={{
                width: 30,
                height: 1,
                background: "var(--border-default)",
                margin: "28px 0 14px",
              }}
            />
            <div
              style={{
                fontSize: 9,
                color: "var(--text-faint)",
                letterSpacing: 1.5,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {company.company_address}
            </div>
          </>
        )}

        <div
          style={{
            marginTop: "auto",
            fontSize: 8,
            color: "var(--text-disabled)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          v2.0
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,135,58,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* ── Step 1: RFID Scan ── */}
        {step === "rfid" && (
          <div
            className="animate-scaleIn card-glass"
            style={{
              padding: "2.5rem 2rem",
              width: 380,
              textAlign: "center",
              position: "relative",
            }}
            onClick={() => rfidInputRef.current?.focus()}
          >
            <input
              ref={rfidInputRef}
              value={rfid}
              onChange={(e) => setRfid(e.target.value.toUpperCase())}
              onKeyDown={handleRfidKeyDown}
              style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, zIndex: -1 }}
              autoFocus
            />

            {/* Animated RFID Card */}
            <div
              style={{
                position: "relative",
                width: 180,
                height: 120,
                margin: "0 auto 28px",
                perspective: 800,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(145deg, rgba(201,135,58,0.2), rgba(201,135,58,0.05))",
                  border: "1.5px solid rgba(201,135,58,0.25)",
                  borderRadius: 18,
                  overflow: "hidden",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transform: "rotateY(2deg) rotateX(1deg)",
                  transition: "transform 0.3s ease",
                }}
              >
                {/* Card chip */}
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    left: 22,
                    width: 26,
                    height: 20,
                    background: "linear-gradient(135deg, var(--gold), rgba(201,135,58,0.4))",
                    borderRadius: 4,
                    opacity: 0.8,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                />
                {/* Contactless icon */}
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 56,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {[18, 14, 10].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        width: w,
                        height: 3,
                        borderRadius: 2,
                        background: "var(--gold)",
                        opacity: 0.35 - i * 0.08,
                      }}
                    />
                  ))}
                </div>
                {/* Card number dots */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 24,
                    left: 22,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {[1, 2, 3, 4].map((g) => (
                    <div key={g} style={{ display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4].map((d) => (
                        <div
                          key={d}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: "var(--gold)",
                            opacity: 0.2,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {/* Card brand */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 18,
                    right: 20,
                    fontSize: 7,
                    fontWeight: 700,
                    color: "var(--gold)",
                    letterSpacing: 1.5,
                    opacity: 0.4,
                  }}
                >
                  ERLBREW
                </div>
              </div>

              {/* Scan line */}
              <div
                style={{
                  position: "absolute",
                  left: -4,
                  right: -4,
                  height: 2,
                  background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
                  boxShadow: "0 0 10px rgba(201,135,58,0.6), 0 0 30px rgba(201,135,58,0.15)",
                  animation: "scanLine 2.2s ease-in-out infinite",
                }}
              />

              {/* Glow ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: 22,
                  border: "1px solid rgba(201,135,58,0.06)",
                  animation: "pulseGlow 3s ease-in-out infinite",
                }}
              />
            </div>

            <div
              className="font-display"
              style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, letterSpacing: 1 }}
            >
              Tap Your Card
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)", lineHeight: 1.6, letterSpacing: 0.3 }}>
              Place your card near the reader or type below
            </div>

            {/* Simulate scan */}
            <button
              className="btn-glass"
              onClick={() => handleRfidSubmit(rfid)}
              style={{
                marginTop: 20,
                padding: "10px 28px",
                fontSize: 9,
                letterSpacing: 1.5,
                cursor: "pointer",
              }}
            >
              SIMULATE SCAN
            </button>

            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                marginTop: 16,
                letterSpacing: 1,
                color: msgColor,
                minHeight: 18,
              }}
            >
              {msg.text}
            </div>
          </div>
        )}

        {/* ── Step 2: PIN Entry ── */}
        {step === "pin" && selectedStaff && (
          <div className="animate-scaleIn card-glass" style={{ padding: "2rem 1.75rem", width: 340, textAlign: "center" }}>
            <button
              onClick={goBack}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-faint)",
                fontSize: 11,
                cursor: "pointer",
                marginBottom: 20,
                padding: "4px 8px",
              }}
            >
              ← Back
            </button>

            {/* Staff card */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, textAlign: "left" }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${selectedStaff.color || "#C9873A"}, ${selectedStaff.color || "#C9873A"}cc)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: `0 0 0 3px rgba(201,135,58,0.15)`,
                }}
              >
                {selectedStaff.initials}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{selectedStaff.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{selectedStaff.role}</div>
              </div>
            </div>

            <div
              style={{
                fontSize: 9,
                color: "var(--gold-dim)",
                letterSpacing: 3,
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              Enter Your PIN
            </div>

            {/* PIN dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: i < pin.length ? "rgba(201,135,58,0.12)" : "var(--bg-base)",
                    border: `1.5px solid ${i < pin.length ? "var(--gold)" : "var(--border-default)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    color: "var(--gold)",
                    transition: "all 0.12s var(--ease-out)",
                    boxShadow: i < pin.length ? "0 0 12px rgba(201,135,58,0.1)" : "none",
                  }}
                >
                  {i < pin.length ? "●" : ""}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {(["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "⌫"] as string[]).map((k) => (
                <button
                  key={k}
                  className="btn"
                  onClick={() => !loading && pressPin(k)}
                  disabled={loading}
                  style={{
                    background: k === "CLR" || k === "⌫" ? "var(--bg-base)" : "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 10,
                    color:
                      k === "CLR" || k === "⌫" ? "var(--text-muted)" : "var(--text-primary)",
                    fontSize: 17,
                    padding: "14px 0",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                    transition: "all 0.12s var(--ease-out)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.background = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    if (!loading)
                      e.currentTarget.style.background =
                        k === "CLR" || k === "⌫" ? "var(--bg-base)" : "var(--bg-surface)";
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
              style={{
                width: "100%",
                fontSize: 11,
                padding: 13,
                borderRadius: 10,
                opacity: loading || pin.length !== 4 ? 0.5 : 1,
              }}
            >
              {loading ? "Logging in…" : "LOGIN"}
            </button>

            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                marginTop: 12,
                letterSpacing: 1,
                color: msgColor,
                minHeight: 18,
              }}
            >
              {msg.text}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const CoffeeSVG: React.FC = () => (
  <svg width="50" height="50" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.85 }}>
    <rect x="8" y="18" width="26" height="22" rx="3" stroke="#C9873A" strokeWidth="1.4" />
    <path d="M34 22C40 22 42 26 40 29C38 32 34 32 34 32" stroke="#C9873A" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M13 18C13 14.5 16.5 11 20 13C22 10 27 10 27 13C30 11 33 14.5 33 18" stroke="#C9873A" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
    <rect x="8" y="40" width="26" height="2.5" rx="1.25" fill="#C9873A" opacity="0.2" />
  </svg>
);