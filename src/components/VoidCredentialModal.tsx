import React, { useState, useRef, useEffect } from "react";
import { apiAdminPost } from "../utils/api";

interface Props {
  orderId: string;
  onCancel: () => void;
  onVoidSuccess: () => void;
  action?: "void" | "refund";
}

export const VoidCredentialModal: React.FC<Props> = ({ orderId, onCancel, onVoidSuccess, action = "void" }) => {
  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"reason" | "auth">(action === "refund" ? "reason" : "reason");
  const rfidRef = useRef<HTMLInputElement>(null);
  const isRefund = action === "refund";

  // Force focus on hidden RFID input when modal opens
  useEffect(() => {
    rfidRef.current?.focus();
    const interval = setInterval(() => {
      if (document.activeElement !== rfidRef.current) {
        rfidRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const pressPin = (key: string) => {
    if (key === "CLR") { setPin(""); return; }
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length < 4) setPin((p) => p + key);
  };

  const handleSubmit = async () => {
    if (!rfid.trim() || pin.length !== 4) {
      setError("Enter manager RFID and 4-digit PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const loginRes = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid: rfid.replace(/[\x00-\x1f]/g, '').trim().toUpperCase(), pin }),
      });
      if (!loginRes.ok) throw new Error("Invalid credentials");
      const loginData = await loginRes.json();

      // Fetch manager info to check role
      const meRes = await fetch("/api/staff/me", {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      const meData = await meRes.json();
      if (!meRes.ok || !["Manager", "Shift Supervisor"].includes(meData.role)) {
        setError(`Manager credentials required to ${isRefund ? "refund" : "void"}`);
        setLoading(false);
        return;
      }
      // Authorize void or refund on server
      if (isRefund) {
        await apiAdminPost(`/orders/${orderId}/refund`, { reason });
      } else {
        await apiAdminPost(`/orders/${orderId}/void`, { reason });
      }
      onVoidSuccess();
    } catch {
      setError("Invalid manager credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="animate-scaleIn" style={{
        background: "var(--bg-elevated)", border: `1.5px solid ${isRefund ? "var(--gold)" : "var(--danger)"}`,
        borderRadius: 14, padding: "1.3rem", width: 300,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: isRefund ? "rgba(201,135,58,0.15)" : "rgba(201,122,122,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>{isRefund ? "↩" : "✕"}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{isRefund ? "Refund Order" : "Void Order"}</div>
            <div style={{ fontSize: 9, color: "var(--text-faint)" }}>#{orderId.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: isRefund ? "var(--gold)" : "var(--danger)", marginBottom: 14, lineHeight: 1.5 }}>
          {isRefund ? "Manager authorization required to refund this order." : "Manager authorization required to void this order."}
        </div>

        {/* Step 1: Reason */}
        {step === "reason" ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" }}>{isRefund ? "Refund Reason" : "Void Reason"}</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={isRefund ? "e.g. Customer returned…" : "e.g. Customer cancelled…"}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) setStep("auth"); }}
              style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)", borderRadius: 7, color: "var(--text-primary)", padding: "8px 12px", fontSize: 10, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={onCancel} style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                border: "1px solid var(--border-default)", background: "var(--bg-base)",
                color: "var(--text-secondary)", fontSize: 9, fontWeight: 700,
                cursor: "pointer", textTransform: "uppercase", letterSpacing: 1,
              }}>Cancel</button>
              <button onClick={() => reason.trim() && setStep("auth")} disabled={!reason.trim()}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: reason.trim() ? (isRefund ? "var(--gold)" : "var(--danger)") : "var(--bg-surface)",
                  color: reason.trim() ? "#fff" : "var(--text-disabled)",
                  fontSize: 9, fontWeight: 700, cursor: reason.trim() ? "pointer" : "default",
                  textTransform: "uppercase", letterSpacing: 1,
                }}>Continue →</button>
            </div>
          </div>
        ) : (
        <>
        {/* Step 2: RFID */}
        <div style={{ marginBottom: 10, position: "relative" }}>
          <input ref={rfidRef} value={rfid}
            onChange={(e) => setRfid(e.target.value.replace(/[\x00-\x1f]/g, '').toUpperCase())}
            style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, zIndex: -1 }} autoFocus />
          <div onClick={() => rfidRef.current?.focus()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 0" }}>
            <div style={{ position: "relative", width: 110, height: 74 }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(145deg, rgba(201,135,58,0.18), rgba(201,135,58,0.06))",
                border: "1.5px solid rgba(201,135,58,0.3)", borderRadius: 10, overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 10, left: 12, width: 14, height: 10, background: "linear-gradient(135deg, var(--gold), rgba(201,135,58,0.5))", borderRadius: 2, opacity: 0.6 }} />
              </div>
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
                boxShadow: "0 0 6px rgba(201,135,58,0.6)",
                animation: "scanLine 2.2s ease-in-out infinite",
              }} />
            </div>
            <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 0.5 }}>Scan manager card</div>
          </div>
        </div>

        {/* PIN pad */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" }}>Manager PIN</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "center" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: 7,
                border: `1.5px solid ${pin.length > i ? "var(--gold)" : "var(--border-medium)"}`,
                background: pin.length > i ? "rgba(201,135,58,0.08)" : "var(--bg-base)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: pin.length > i ? "var(--gold)" : "var(--text-disabled)",
                transition: "all 0.12s",
              }}>
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
            {[["1","2","3"],["4","5","6"],["7","8","9"],["CLR","0","⌫"]].map((row) =>
              row.map((key) => (
                <button key={key} onClick={() => pressPin(key)}
                  style={{
                    padding: "8px 0", borderRadius: 7,
                    border: "1px solid var(--border-medium)",
                    background: key === "CLR" || key === "⌫" ? "var(--bg-base)" : "var(--bg-surface)",
                    color: key === "CLR" ? "var(--danger)" : key === "⌫" ? "var(--gold)" : "var(--text-primary)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>{key}</button>
              ))
            )}
          </div>
        </div>

        {error && <div style={{ fontSize: 9, color: "var(--danger)", textAlign: "center", marginBottom: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-base)", color: "var(--text-secondary)", fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading || pin.length !== 4 || !rfid.trim()}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
              background: pin.length === 4 && rfid.trim() ? (isRefund ? "var(--gold)" : "var(--danger)") : "var(--bg-surface)",
              color: pin.length === 4 && rfid.trim() ? "#fff" : "var(--text-disabled)",
              fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: pin.length === 4 && rfid.trim() ? "pointer" : "default",
              textTransform: "uppercase",
            }}>{loading ? "Verifying…" : isRefund ? "Authorize Refund" : "Authorize Void"}</button>
        </div>
        </>
      )}
      </div>
    </div>
  );
};