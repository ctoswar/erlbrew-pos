import React, { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "../utils/api";

interface TimeRecord {
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
}

interface ClockResponse {
  action: "clock_in" | "clock_out";
  staff: { staff_id: number; name: string; role: string; initials: string; color: string };
  record: TimeRecord["record"];
}

export const TimeKeeping: React.FC = () => {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTap, setLastTap] = useState<ClockResponse | null>(null);

  const loadToday = useCallback(() => {
    apiGet<TimeRecord[]>("/clock")
      .then(setRecords)
      .catch((err) => console.error("Failed to load clock records:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Auto-hide tap message after 4s
  useEffect(() => {
    if (!lastTap) return;
    const t = setTimeout(() => setLastTap(null), 4000);
    return () => clearTimeout(t);
  }, [lastTap]);

  const handleTap = useCallback(async (rfid: string) => {
    try {
      const data = await apiPost<ClockResponse>("/clock", { rfid });
      setLastTap(data);
      loadToday();
    } catch (err) { console.error("RFID tap handler error:", err); }
  }, [loadToday]);

  // Auto-poll every 30s to keep status fresh
  useEffect(() => {
    const id = setInterval(loadToday, 30000);
    return () => clearInterval(id);
  }, [loadToday]);

  const clockedIn = records.filter((r) => r.status === "clocked_in");
  const clockedOut = records.filter((r) => r.status === "clocked_out");
  const notIn = records.filter((r) => r.status === "not_in");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        padding: "0.9rem 1rem",
        borderBottom: "1px solid var(--border-default)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Timekeeping
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{dateStr}</div>
      </div>

      {/* Body */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", minHeight: 0 }}>

        {/* ── Last tap feedback ── */}
        {lastTap && (
          <div style={{
            background: lastTap.action === "clock_in" ? "var(--success-bg)" : "rgba(201,135,58,0.12)",
            border: `1.5px solid ${lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)"}`,
            borderRadius: 14, padding: "16px 20px",
            animation: "fadeInUp 0.3s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>
                {lastTap.action === "clock_in" ? "✅" : "🔴"}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  {lastTap.action === "clock_in" ? "Clocked In" : "Clocked Out"}
                </div>
                <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
                  {lastTap.staff.name} · {lastTap.staff.role}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                  {lastTap.record?.clock_in ? `In: ${new Date(lastTap.record.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  {lastTap.record?.clock_out ? `  Out: ${new Date(lastTap.record.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RFID Scan Box ── */}
        <div style={{
          background: "var(--bg-elevated)",
          border: "2px dashed var(--gold-dim)",
          borderRadius: 16, padding: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>
            Scan your RFID Card
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 16 }}>
            Tap to clock in or out automatically
          </div>
          <RfidInput onScan={handleTap} />
        </div>

        {/* ── Staff status groups ── */}
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <StaffGroup label="Clocked In" count={clockedIn.length} color="var(--success)" records={clockedIn} />
            <StaffGroup label="Not Yet In" count={notIn.length} color="var(--text-faint)" records={notIn} />
            <StaffGroup label="Clocked Out" count={clockedOut.length} color="var(--gold)" records={clockedOut} />
          </div>
        )}
      </div>
    </div>
  );
};

// ── RFID Scan Input ──────────────────────────────────────────────────────────
const RfidInput: React.FC<{ onScan: (rfid: string) => void }> = ({ onScan }) => {
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.trim());
      setValue("");
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan RFID card or type ID…"
        autoFocus
        style={{
          background: "var(--bg-base)", border: "1px solid var(--border-medium)",
          borderRadius: 10, color: "var(--text-primary)", padding: "10px 16px",
          fontSize: 12, width: 240, textAlign: "center", outline: "none",
        }}
      />
      <button
        onClick={() => { if (value.trim()) { onScan(value.trim()); setValue(""); } }}
        style={{
          background: "var(--gold)", color: "var(--bg-sidebar)", border: "none",
          borderRadius: 10, padding: "10px 18px", fontSize: 10, fontWeight: 700,
          letterSpacing: 1, cursor: "pointer", textTransform: "uppercase",
        }}
      >
        Tap
      </button>
    </div>
  );
};

// ── Staff Group ───────────────────────────────────────────────────────────────
const StaffGroup: React.FC<{
  label: string;
  count: number;
  color: string;
  records: TimeRecord[];
}> = ({ label, count, color, records }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "var(--text-faint)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 9, color: "var(--text-faint)" }}>({count})</span>
    </div>
    {records.length === 0 ? (
      <div style={{ fontSize: 10, color: "var(--text-faint)", padding: "6px 0 4px", fontStyle: "italic" }}>—</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {records.map((r) => {
          const rec = r.record;
          const hours = rec?.total_hours ? parseFloat(String(rec.total_hours)) : 0;

          return (
            <div key={r.staff_id} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg-surface)", borderRadius: 10, padding: "10px 14px",
            }}>
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: r.color || "#555",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {r.initials}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</div>
                <div style={{ fontSize: 9, color: "var(--text-faint)" }}>{r.role}</div>
              </div>

              {/* Times */}
              <div style={{ textAlign: "right" }}>
                {rec ? (
                  <>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
                      {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      {rec.clock_out ? (
                        <span style={{ color: "var(--text-faint)" }}> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                      ) : (
                        <span style={{ color: "var(--success)", fontSize: 9, marginLeft: 4 }}>● IN</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--gold)" }}>
                      {hours > 0 ? `${hours.toFixed(1)}h` : "—"}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: "var(--text-faint)" }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);