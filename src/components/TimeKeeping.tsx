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

interface DayRecord {
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

type Tab = "today" | "calendar";

export const TimeKeeping: React.FC = () => {
  const [tab, setTab] = useState<Tab>("today");

  // ── Tab: Today ──
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTap, setLastTap] = useState<ClockResponse | null>(null);

  // ── Tab: Calendar ──
  const [calDate, setCalDate] = useState(() => new Date());
  const [summary, setSummary] = useState<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

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

  // Auto-poll every 30s
  useEffect(() => {
    const id = setInterval(loadToday, 30000);
    return () => clearInterval(id);
  }, [loadToday]);

  // ── Calendar logic ──
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  // Fetch monthly summary
  useEffect(() => {
    if (tab !== "calendar") return;
    apiGet<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>(`/clock/summary/${monthStr}`)
      .then(setSummary)
      .catch(() => setSummary({}));
  }, [tab, monthStr]);

  // Fetch selected day records
  useEffect(() => {
    if (!selectedDate) { setDayRecords([]); return; }
    setDayLoading(true);
    apiGet<DayRecord[]>(`/clock/calendar/${selectedDate}`)
      .then(setDayRecords)
      .catch(() => setDayRecords([]))
      .finally(() => setDayLoading(false));
  }, [selectedDate]);

  // Build calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const todayStr = new Date().toISOString().split("T")[0];

  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCalDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalDate(new Date(calYear, calMonth + 1, 1));

  const dateStr = (d: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const now = new Date();
  const todayDateStr = now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const clockedIn = records.filter((r) => r.status === "clocked_in");
  const clockedOut = records.filter((r) => r.status === "clocked_out");
  const notIn = records.filter((r) => r.status === "not_in");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Header with tabs */}
      <div className="glass-panel" style={{ padding: "0.7rem 1rem", borderBottom: "1px solid rgba(201,135,58,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderRadius: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 1 }}>Timekeeping</div>
          <div style={{ display: "flex", gap: 4 }}>
            {([["today", "Today"], ["calendar", "Calendar"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "4px 10px",
                fontSize: 8,
                borderRadius: 6,
                border: `1px solid ${tab === key ? "var(--gold)" : "var(--border-subtle)"}`,
                background: tab === key ? "rgba(201,135,58,0.15)" : "transparent",
                color: tab === key ? "var(--gold)" : "var(--text-muted)",
                cursor: "pointer",
                fontWeight: tab === key ? 700 : 400,
                letterSpacing: 0.5,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 9, color: "var(--text-faint)" }}>{todayDateStr}</div>
      </div>

      {/* ── Body ── */}
      <div className="scroll-area" style={{ flex: 1, padding: "0.8rem", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0 }}>

        {tab === "today" && (
          <>
            {/* Last tap feedback */}
            {lastTap && (
              <div className="animate-scaleIn" style={{
                background: lastTap.action === "clock_in" ? "var(--success-bg)" : "rgba(201,135,58,0.12)",
                border: `1.5px solid ${lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)"}`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%",
                    background: lastTap.action === "clock_in" ? "var(--success)" : "var(--gold)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {lastTap.action === "clock_in" ? "✅" : "🔴"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {lastTap.action === "clock_in" ? "Clocked In" : "Clocked Out"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
                      {lastTap.staff.name} · {lastTap.staff.role}
                    </div>
                    {lastTap.record?.clock_in && (
                      <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 1 }}>
                        {`In: ${new Date(lastTap.record.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
                        {lastTap.record?.clock_out ? `  Out: ${new Date(lastTap.record.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RFID Scan Box */}
            <div className="card-glass" style={{ padding: "20px", textAlign: "center", border: "1.5px dashed rgba(201,135,58,0.2)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
              <div className="font-display" style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>Scan your RFID Card</div>
              <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 12 }}>Tap to clock in or out automatically</div>
              <RfidInput onScan={handleTap} />
            </div>

            {/* Staff status groups */}
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem", fontSize: 11 }}>Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <StaffGroup label="Clocked In" count={clockedIn.length} color="var(--success)" records={clockedIn} />
                <StaffGroup label="Not Yet In" count={notIn.length} color="var(--text-faint)" records={notIn} />
                <StaffGroup label="Clocked Out" count={clockedOut.length} color="var(--gold)" records={clockedOut} />
              </div>
            )}
          </>
        )}

        {tab === "calendar" && (
          <>
            {/* ── Calendar Navigation ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button onClick={prevMonth} style={{
                padding: "4px 12px", fontSize: 14, borderRadius: 6,
                border: "1px solid var(--border-subtle)", background: "transparent",
                color: "var(--text-secondary)", cursor: "pointer",
              }}>◀</button>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                {monthNames[calMonth]} {calYear}
              </div>
              <button onClick={nextMonth} style={{
                padding: "4px 12px", fontSize: 14, borderRadius: 6,
                border: "1px solid var(--border-subtle)", background: "transparent",
                color: "var(--text-secondary)", cursor: "pointer",
              }}>▶</button>
            </div>

            {/* ── Calendar Grid ── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border-subtle)" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} style={{
                    padding: "6px 0", textAlign: "center",
                    fontSize: 8, fontWeight: 700, color: "var(--text-faint)",
                    letterSpacing: 1, textTransform: "uppercase",
                  }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {days.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} />;
                  const ds = dateStr(d);
                  const dayStaff = summary[ds] || [];
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDate(isSelected ? null : ds)}
                      style={{
                        padding: "6px 4px",
                        minHeight: 60,
                        borderRight: i % 7 !== 6 ? "1px solid var(--border-subtle)" : "none",
                        borderBottom: days.length - i > 7 ? "1px solid var(--border-subtle)" : "none",
                        background: isSelected ? "rgba(201,135,58,0.12)" : isToday ? "rgba(201,135,58,0.05)" : "transparent",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{
                        fontSize: 9, fontWeight: isToday ? 800 : 500,
                        color: isToday ? "var(--gold)" : "var(--text-secondary)",
                        marginBottom: 3,
                      }}>{d}</div>
                      {dayStaff.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                          {dayStaff.slice(0, 5).map((s) => (
                            <div key={s.staff_id} title={s.name} style={{
                              width: 14, height: 14, borderRadius: "50%",
                              background: s.color || "#555",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 6, fontWeight: 700, color: "#fff",
                            }}>{s.initials}</div>
                          ))}
                          {dayStaff.length > 5 && (
                            <div style={{ fontSize: 7, color: "var(--text-faint)", alignSelf: "center" }}>
                              +{dayStaff.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Day Detail Table ── */}
            {selectedDate && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
                  fontSize: 9, fontWeight: 600, color: "var(--gold)",
                  letterSpacing: 1.5, textTransform: "uppercase",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>Records for {selectedDate}</span>
                  {dayLoading && <span style={{ fontSize: 8, color: "var(--text-faint)" }}>Loading...</span>}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Staff</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Clock In</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Clock Out</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayLoading ? (
                      <tr><td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr>
                    ) : dayRecords.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No time records for this date</td></tr>
                    ) : (
                      dayRecords.map((rec) => {
                        const hours = rec.total_hours ? Number(rec.total_hours) : 0;
                        return (
                          <tr key={rec.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: "50%",
                                background: rec.color || "#555",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 7, fontWeight: 700, color: "#fff", flexShrink: 0,
                              }}>{rec.initials}</div>
                              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{rec.name}</span>
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                              {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                              {rec.clock_out
                                ? new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
                                : <span className="animate-pulse" style={{ color: "var(--success)" }}>● In Progress</span>}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                              {hours > 0 ? `${hours.toFixed(1)}h` : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── RFID Scan Input ──
const RfidInput: React.FC<{ onScan: (rfid: string) => void }> = ({ onScan }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onScan(value.replace(/[\x00-\x1f]/g, '').trim());
      setValue("");
    }
  };

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
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, zIndex: -1 }}
        autoFocus
      />
      <div onClick={() => inputRef.current?.focus()} style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        cursor: "pointer", padding: "4px 0",
      }}>
        <div style={{ position: "relative", width: 140, height: 96 }}>
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
              position: "absolute", bottom: 16, left: 18, display: "flex", gap: 4,
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

// ── Staff Group ──
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
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: `linear-gradient(135deg, ${r.color || "#555"}, ${(r.color || "#555")}cc)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>{r.initials}</div>
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