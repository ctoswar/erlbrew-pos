import React, { useState, useRef } from "react";

interface Props {
  orderId: string;
  onCancel: () => void;
  onAuthorize: (managerName: string) => void;
}

export const VoidCredentialModal: React.FC<Props> = ({ orderId, onCancel, onAuthorize }) => {
  const [rfid, setRfid] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const rfidRef = useRef<HTMLInputElement>(null);

  // Auto-focus RFID on mount
  React.useEffect(() => { rfidRef.current?.focus(); }, []);

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
        body: JSON.stringify({ rfid: rfid.trim().toUpperCase(), pin }),
      });
      if (!loginRes.ok) throw new Error("Invalid credentials");
      const loginData = await loginRes.json();

      // Fetch manager info to check role
      const meRes = await fetch("/api/staff/me", {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      const meData = await meRes.json();
      if (!meRes.ok || !["Manager", "Shift Supervisor"].includes(meData.role)) {
        setError("Manager credentials required to void");
        setLoading(false);
        return;
      }
      onAuthorize(meData.name || "Manager");
    } catch {
      setError("Invalid manager credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        background: "var(--bg-elevated)", border: "1.5px solid var(--danger)",
        borderRadius: 14, padding: "1.5rem", width: 320,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 24 }}>✕</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Void Order</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>#{orderId.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: "var(--danger)", marginBottom: 16, lineHeight: 1.5 }}>
          Manager authorization required to void this order.
        </div>

        {/* RFID */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>Manager RFID</div>
          <input
            ref={rfidRef}
            value={rfid}
            onChange={(e) => setRfid(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { /* move to pin */ } }}
            placeholder="e.g. RF004"
            style={{
              width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-medium)",
              borderRadius: 8, color: "var(--text-primary)", padding: "10px 14px",
              fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* PIN pad */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>Manager PIN</div>
          {/* PIN display */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 10,
            justifyContent: "center",
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 8,
                border: `1.5px solid ${pin.length > i ? "var(--gold)" : "var(--border-medium)"}`,
                background: "var(--bg-base)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: pin.length > i ? "var(--gold)" : "var(--text-disabled)",
              }}>
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
          {/* Keypad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {[["1","2","3"],["4","5","6"],["7","8","9"],["CLR","0","⌫"]].map((row) =>
              row.map((key) => (
                <button
                  key={key}
                  onClick={() => pressPin(key)}
                  style={{
                    padding: "10px 0", borderRadius: 8,
                    border: "1px solid var(--border-medium)",
                    background: key === "CLR" || key === "⌫" ? "var(--bg-base)" : "var(--bg-surface)",
                    color: key === "CLR" ? "var(--danger)" : key === "⌫" ? "var(--gold)" : "var(--text-primary)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {key}
                </button>
              ))
            )}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 10, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 9,
              border: "1px solid var(--border-default)",
              background: "var(--bg-base)", color: "var(--text-secondary)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || pin.length !== 4 || !rfid.trim()}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 9,
              border: "none",
              background: pin.length === 4 && rfid.trim() ? "var(--danger)" : "var(--bg-surface)",
              color: pin.length === 4 && rfid.trim() ? "#fff" : "var(--text-disabled)",
              fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: pin.length === 4 && rfid.trim() ? "pointer" : "default",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Verifying…" : "Authorize Void"}
          </button>
        </div>
      </div>
    </div>
  );
};