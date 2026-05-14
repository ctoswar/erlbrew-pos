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
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header with tabs */}
      <div className="glass-panel px-5 py-3.5 border-b border-erl-accent/[0.08] flex items-center justify-between flex-shrink-0 rounded-none">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="font-display text-lg font-bold text-erl-text-primary tracking-wide">Timekeeping</div>
          <div className="flex gap-1 bg-erl-base rounded-xl p-0.5 border border-erl-border-subtle">
            {([["today", "Today"], ["calendar", "Calendar"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key as Tab)} className={`
                px-3.5 py-1.5 text-xs rounded-lg cursor-pointer transition-all duration-200 font-semibold tracking-wide
                ${tab === key
                  ? "bg-erl-accent/15 text-erl-accent shadow-sm"
                  : "text-erl-text-faint hover:text-erl-text-secondary"}
              `}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-erl-text-faint tracking-wide font-medium">{todayDateStr}</div>
      </div>

      {/* Body */}
      <div className="scroll-area flex-1 p-5 flex flex-col gap-5 overflow-y-auto min-h-0">

        {tab === "today" && (
          <>
            {/* Last tap feedback */}
            {lastTap && (
              <div className={`animate-scale-in rounded-2xl overflow-hidden transition-all duration-500 ${
                lastTap.action === "clock_in" ? "border border-erl-success/30" : "border border-erl-accent/30"
              }`}>
                <div className="h-[2px]" style={{
                  background: lastTap.action === "clock_in"
                    ? 'linear-gradient(90deg, rgba(122,191,122,0.6), transparent)'
                    : 'linear-gradient(90deg, rgba(196,149,106,0.6), transparent)'
                }} />
                <div className={`px-5 py-4 ${lastTap.action === "clock_in" ? "bg-erl-success-bg" : "bg-erl-accent/[0.06]"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center text-lg flex-shrink-0
                      ${lastTap.action === "clock_in"
                        ? "bg-erl-success/15 text-erl-success"
                        : "bg-erl-accent/15 text-erl-accent"}
                    `}>
                      {lastTap.action === "clock_in" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-erl-text-primary">
                        {lastTap.action === "clock_in" ? "Clocked In" : "Clocked Out"}
                      </div>
                      <div className="text-sm text-erl-accent font-semibold mt-0.5">
                        {lastTap.staff.name} · {lastTap.staff.role}
                      </div>
                      {lastTap.record?.clock_in && (
                        <div className="text-xs text-erl-text-muted mt-1 font-medium">
                          {`In: ${new Date(lastTap.record.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
                          {lastTap.record?.clock_out ? `  Out: ${new Date(lastTap.record.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RFID Scan Box */}
            <div className="card-glass p-5 text-center relative">
              <div className="relative z-10 flex flex-col items-center">
                <div className="text-2xl mb-2">📲</div>
                <div className="font-display text-sm text-erl-text-primary font-bold tracking-wide mb-0.5">Scan Your Card</div>
                <div className="text-[10px] text-erl-text-faint mb-3 tracking-wide">Tap to clock in or out</div>
                <RfidInput onScan={handleTap} />
              </div>
            </div>

            {/* Staff status groups */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
                <span className="text-sm text-erl-text-muted">Loading...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <StaffGroup label="Clocked In" count={clockedIn.length} color="rgb(122,191,122)" records={clockedIn} />
                <StaffGroup label="Not Yet In" count={notIn.length} color="rgb(138,112,88)" records={notIn} />
                <StaffGroup label="Clocked Out" count={clockedOut.length} color="rgb(196,149,106)" records={clockedOut} />
              </div>
            )}
          </>
        )}

        {tab === "calendar" && (
          <>
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="w-9 h-9 rounded-xl border border-erl-border-default bg-transparent text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent transition-all duration-200 text-sm">
                ◀
              </button>
              <div className="font-display text-lg font-bold text-erl-accent tracking-wide">
                {monthNames[calMonth]} {calYear}
              </div>
              <button onClick={nextMonth} className="w-9 h-9 rounded-xl border border-erl-border-default bg-transparent text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent transition-all duration-200 text-sm">
                ▶
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="card-glass overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-erl-border-subtle bg-erl-base/50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2 text-center text-[10px] font-bold text-erl-text-faint tracking-[0.15em] uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} className="min-h-[64px]" />;
                  const ds = dateStr(d);
                  const dayStaff = summary[ds] || [];
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDate(isSelected ? null : ds)}
                      className={`
                        p-1.5 min-h-[64px] cursor-pointer transition-all duration-200 relative
                        ${i % 7 !== 6 ? "border-r border-erl-border-subtle" : ""}
                        ${days.length - i > 7 ? "border-b border-erl-border-subtle" : ""}
                        ${isSelected ? "bg-erl-accent/10" : isToday ? "bg-erl-accent/[0.04]" : "hover:bg-erl-accent/[0.02]"}
                      `}
                    >
                      <div className={`text-xs mb-1 ${isToday ? "font-extrabold text-erl-accent" : "font-medium text-erl-text-secondary"}`}>
                        {isToday ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-erl-accent/20">{d}</span>
                        ) : d}
                      </div>
                      {dayStaff.length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {dayStaff.slice(0, 4).map((s) => (
                            <div key={s.staff_id} title={s.name} className="w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold text-white shadow-sm"
                              style={{ background: s.color || "#555" }}>
                              {s.initials}
                            </div>
                          ))}
                          {dayStaff.length > 4 && (
                            <div className="text-[8px] text-erl-text-faint self-center ml-0.5">
                              +{dayStaff.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Detail Table */}
            {selectedDate && (
              <div className="card-glass overflow-hidden">
                <div className="px-4 py-3 border-b border-erl-border-subtle flex justify-between items-center">
                  <span className="text-xs font-bold tracking-[0.15em] text-erl-accent uppercase">Records for {selectedDate}</span>
                  {dayLoading && <span className="text-[10px] text-erl-text-faint">Loading...</span>}
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-erl-base/50">
                      <th className="px-4 py-2.5 text-left text-erl-text-muted font-semibold text-[10px] tracking-wider uppercase">Staff</th>
                      <th className="px-4 py-2.5 text-left text-erl-text-muted font-semibold text-[10px] tracking-wider uppercase">Clock In</th>
                      <th className="px-4 py-2.5 text-left text-erl-text-muted font-semibold text-[10px] tracking-wider uppercase">Clock Out</th>
                      <th className="px-4 py-2.5 text-right text-erl-text-muted font-semibold text-[10px] tracking-wider uppercase">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayLoading ? (
                      <tr><td colSpan={4} className="p-6 text-center text-erl-text-muted text-sm">Loading...</td></tr>
                    ) : dayRecords.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-erl-text-faint text-sm">No time records for this date</td></tr>
                    ) : (
                      dayRecords.map((rec) => {
                        const hours = rec.total_hours ? Number(rec.total_hours) : 0;
                        return (
                          <tr key={rec.id} className="border-t border-erl-border-subtle/50 hover:bg-erl-accent/[0.02] transition-colors">
                            <td className="px-4 py-2.5 flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${rec.color || "#555"}, ${(rec.color || "#555")}aa)` }}>
                                {rec.initials}
                              </div>
                              <span className="text-erl-text-primary font-semibold">{rec.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-erl-text-secondary font-medium">
                              {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-2.5 text-erl-text-secondary font-medium">
                              {rec.clock_out
                                ? new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
                                : <span className="inline-flex items-center gap-1 text-erl-success"><span className="animate-pulse">●</span> Active</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-erl-accent font-bold">
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
    <div className="flex justify-center">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="fixed top-0 left-0 w-px h-px opacity-0 -z-[1]"
        autoFocus
      />
      <div onClick={() => inputRef.current?.focus()} className="flex flex-col items-center gap-3 cursor-pointer py-2">
        <div className="relative w-[140px] h-[88px]">
          {/* Subtle ambient glow */}
          <div className="absolute -inset-2 rounded-[16px] bg-erl-accent/[0.03] blur-md animate-pulse-glow pointer-events-none" />

          {/* Card body */}
          <div
            className="absolute inset-0 rounded-[14px] cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(145deg, rgba(196,149,106,0.13) 0%, rgba(196,149,106,0.04) 35%, rgba(42,27,18,0.55) 100%)',
              border: '1.5px solid rgba(196,149,106,0.2)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px rgba(196,149,106,0.04)',
            }}
          >
            {/* Light diffusion */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Chip */}
            <div className="absolute top-3.5 left-3.5 w-7 h-[18px] rounded-sm overflow-hidden" style={{
              background: 'linear-gradient(135deg, #d4a87a, #8a6a4a)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.35)',
            }}>
              <div className="absolute inset-[2px] border border-white/15 rounded-[1px]" />
            </div>

            {/* Contactless icon — compact SVG */}
            <div className="absolute top-3 left-[48px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent/35">
                <path d="M2 12C2 6.5 6.5 2 12 2"/><path d="M6 12C6 8.7 8.7 6 12 6"/><path d="M10 12C10 10.9 10.9 10 12 10"/>
              </svg>
            </div>

            {/* Card number dots */}
            <div className="absolute bottom-[18px] left-3.5 flex gap-1.5">
              {[1,2,3].map((g) => (
                <div key={g} className="flex gap-[2px]">
                  {[1,2,3].map((d) => (
                    <div key={d} className="w-[2.5px] h-[2.5px] rounded-full bg-erl-accent/20" />
                  ))}
                </div>
              ))}
            </div>

            {/* Brand */}
            <div className="absolute bottom-2.5 right-3">
              <span className="text-[6px] font-bold text-erl-accent tracking-[2px] opacity-40" style={{ fontFamily: "'Playfair Display', serif" }}>TAP</span>
            </div>

            {/* Scan line */}
            <div className="absolute left-2 right-2 h-[1.5px] bg-gradient-to-r from-transparent via-erl-accent/70 to-transparent shadow-[0_0_16px_rgba(196,149,106,0.5),0_0_32px_rgba(196,149,106,0.15)] animate-scan-line rounded-full" />
          </div>

          {/* Bottom reflection — subtle */}
          <div className="absolute -bottom-2.5 left-[20%] right-[20%] h-5 bg-gradient-to-t from-erl-accent/[0.02] to-transparent rounded-full blur-md" />
        </div>
        <div className="text-xs text-erl-text-muted tracking-wide font-medium">
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
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
      <span className="text-[10px] font-bold tracking-[0.2em] text-erl-text-faint uppercase">{label}</span>
      <span className="text-[10px] text-erl-text-faint font-semibold">({count})</span>
    </div>
    {records.length === 0 ? (
      <div className="text-xs text-erl-text-faint py-3 italic px-2">No one yet</div>
    ) : (
      <div className="flex flex-col gap-2">
        {records.map((r) => {
          const rec = r.record;
          const hours = rec?.total_hours ? parseFloat(String(rec.total_hours)) : 0;
          const statusColor = r.status === "clocked_in" ? "rgb(122,191,122)" : r.status === "clocked_out" ? "rgb(196,149,106)" : "rgb(90,69,53)";
          return (
            <div key={r.staff_id} className="card-glass px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 hover:border-erl-accent/15">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${r.color || "#555"}, ${(r.color || "#555")}cc)`,
                  boxShadow: `0 3px 12px ${(r.color || "#555")}30`,
                }}>
                {r.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-erl-text-primary">{r.name}</div>
                <div className="text-[10px] text-erl-text-faint tracking-[0.1em] uppercase font-semibold mt-0.5">{r.role}</div>
              </div>

              {/* Time */}
              <div className="text-right flex-shrink-0">
                {rec ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-xs text-erl-text-secondary font-semibold">
                      {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      {rec.clock_out ? (
                        <span className="text-erl-text-faint"> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
                      ) : (
                        <span className="ml-1.5 inline-flex items-center gap-1">
                          <span className="animate-pulse" style={{ color: statusColor }}>●</span>
                          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>Active</span>
                        </span>
                      )}
                    </div>
                    {hours > 0 && (
                      <div className="text-[10px] text-erl-accent font-bold">
                        {hours.toFixed(1)}h
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-erl-text-faint">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);