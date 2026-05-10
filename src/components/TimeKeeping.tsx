import React, { useState, useEffect, useCallback, useRef } from "react";
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
      <div className="glass-panel" style={{
        padding: "0.8rem 1rem",
        borderBottom: "1px solid rgba(201,135,58,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, borderRadius: 0,
      }}>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>
          Timekeeping
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{dateStr}</div>
      </div>

      {/* Body */}
      <div className="scroll-area" style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", minHeight: 0 }}>

        {/* ── Last tap feedback ── */}
        {lastTap && (
          <div className="animate-scaleIn" style={{
            background: lastTap.action === "clock_in" ? "var(--success-bg)" : "rgba(201,135,58,0.12)",
            border: `1.5px solid ${lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)"}`,
            borderRadius: 14, padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0, boxShadow: "0 0 0 3px rgba(255,255,255,0.08)",
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
        <div className="card-glass" style={{
          padding: "24px", textAlign: "center", borderStyle: "dashed",
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
          <div className="font-display" style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.replace(/[\x00-\x1f]/g, '').trim());
      setValue("");
    }
  };

  // Force focus whenever component is mounted
  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {/* Invisible input for USB RFID reader */}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed", top: 0, left: 0,
          width: 1, height: 1, opacity: 0,
          zIndex: -1,
        }}
        autoFocus
      />

      {/* Animated card visual */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          cursor: "pointer", padding: "4px 0",
        }}
      >
        <div style={{
          position: "relative", width: 140, height: 96,
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(145deg, rgba(201,135,58,0.18), rgba(201,135,58,0.06))",
            border: "1.5px solid rgba(201,135,58,0.3)", borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 14, left: 18, width: 20, height: 14,
              background: "linear-gradient(135deg, var(--gold), rgba(201,135,58,0.5))",
              borderRadius: 3, opacity: 0.7,
            }} />
            <div style={{
              position: "absolute", bottom: 16, left: 18,
              display: "flex", gap: 4,
            }}>
              {[1,2,3,4].map((g) => (
                <div key={g} style={{ display: "flex", gap: 2 }}>
                  {[1,2,3,4].map((d) => (
                    <div key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--gold)", opacity: 0.25 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            position: "absolute", left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
            boxShadow: "0 0 8px rgba(201,135,58,0.6)",
            animation: "scanLine 2.2s ease-in-out infinite",
          }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.5 }}>
          Tap your card to clock in/out
        </div>
      </div>
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
            <div key={r.staff_id} className="card" style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: `linear-gradient(135deg, ${r.color || "#555"}, ${(r.color || "#555")}cc)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {r.initials}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</div>
                <div style={{ fontSize: 9, color: "var(--text-faint)" }}>{r.role}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                {rec ? (
                  <>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>
                      {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      {rec.clock_out ? (
                        <span style={{ color: "var(--text-faint)" }}> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                      ) : (
                        <span className="animate-pulse" style={{ color: "var(--success)", fontSize: 9, marginLeft: 4 }}>● IN</span>
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