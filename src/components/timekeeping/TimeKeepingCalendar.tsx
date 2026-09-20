import React, { useState, useEffect } from "react";
import { DayRecord } from "../../types";
import { apiGet } from "../../utils/api";
import { toLocalDateStr } from "../../utils";

interface Props {
  isAdmin: boolean;
  selectedDate: string | null;
  onSelectedDateChange: (date: string | null) => void;
  dayRecords: DayRecord[];
  dayLoading: boolean;
  onDayRecordsChange: (records: DayRecord[]) => void;
  onDayLoadingChange: (loading: boolean) => void;
  onEditRecord: (record: DayRecord) => void;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TimeKeepingCalendar: React.FC<Props> = ({
  isAdmin,
  selectedDate,
  onSelectedDateChange,
  dayRecords,
  dayLoading,
  onDayRecordsChange,
  onDayLoadingChange,
  onEditRecord,
}) => {
  const [calDate, setCalDate] = useState(() => new Date());
  const [summary, setSummary] = useState<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>({});

  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const todayStr = toLocalDateStr();

  // Fetch monthly summary
  useEffect(() => {
    apiGet<Record<string, { staff_id: number; name: string; initials: string; color: string }[]>>(`/clock/summary/${monthStr}`)
      .then(setSummary)
      .catch(() => setSummary({}));
  }, [monthStr]);

  // Fetch selected day records
  useEffect(() => {
    if (!selectedDate) {
      onDayRecordsChange([]);
      return;
    }
    onDayLoadingChange(true);
    apiGet<DayRecord[]>(`/clock/calendar/${selectedDate}`)
      .then(onDayRecordsChange)
      .catch(() => onDayRecordsChange([]))
      .finally(() => onDayLoadingChange(false));
  }, [selectedDate, onDayRecordsChange, onDayLoadingChange]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCalDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalDate(new Date(calYear, calMonth + 1, 1));

  const dateStr = (d: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <>
      {/* Month Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
          <div className="w-8 h-8 rounded-lg bg-erl-accent/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tabular-nums leading-tight text-erl-text-primary">
              {Object.keys(summary).length}
            </span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Active Days</span>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-surface border-erl-border-subtle">
          <div className="w-8 h-8 rounded-lg bg-erl-accent/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tabular-nums leading-tight text-erl-text-primary">
              {Object.values(summary).reduce((acc, arr) => acc + arr.length, 0)}
            </span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">Clock-ins</span>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border bg-erl-accent/[0.06] border-erl-accent/20">
          <div className="w-8 h-8 rounded-lg bg-erl-accent/15 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tabular-nums leading-tight text-erl-accent">
              {selectedDate ? dayRecords.reduce((acc, r) => acc + Number(r.total_hours || 0), 0).toFixed(1) : "—"}
            </span>
            <span className="text-[10px] text-erl-text-faint tracking-wider uppercase font-semibold">
              {selectedDate ? "Day Hours" : "Select a date"}
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <div className="flex flex-col items-center">
          <div className="font-display text-lg sm:text-xl font-bold text-erl-text-primary tracking-wide">
            {monthNames[calMonth]}
          </div>
          <div className="text-xs text-erl-text-muted font-medium tracking-wider mt-0.5">
            {calYear}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { const now = new Date(); setCalDate(new Date(now.getFullYear(), now.getMonth(), 1)); onSelectedDateChange(todayStr); }} className="px-3 py-2 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer text-[11px] font-semibold tracking-wide hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
            Today
          </button>
          <button onClick={nextMonth} className="w-10 h-10 rounded-xl border border-erl-border-default bg-erl-surface/50 text-erl-text-secondary cursor-pointer flex items-center justify-center hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card-glass overflow-hidden rounded-2xl">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-erl-border-subtle bg-erl-base/60">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
            <div key={d} className={`py-3 text-center text-[11px] font-bold tracking-[0.15em] uppercase ${idx === 0 || idx === 6 ? "text-erl-accent/60" : "text-erl-text-faint"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            if (d === null) return <div key={`e${i}`} className="min-h-[60px] sm:min-h-[80px] bg-erl-base/20" />;
            const ds = dateStr(d);
            const dayStaff = summary[ds] || [];
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDate;
            const isWeekend = i % 7 === 0 || i % 7 === 6;

            return (
              <div
                key={ds}
                onClick={() => onSelectedDateChange(isSelected ? null : ds)}
                className={`
                  relative p-1.5 sm:p-2 min-h-[60px] sm:min-h-[80px] cursor-pointer transition-all duration-200
                  ${i % 7 !== 6 ? "border-r border-erl-border-subtle" : ""}
                  ${days.length - i > 7 ? "border-b border-erl-border-subtle" : ""}
                  ${isSelected ? "bg-erl-accent/10" : isToday ? "bg-erl-accent/[0.04]" : isWeekend ? "bg-erl-base/[0.03]" : "hover:bg-erl-accent/[0.02]"}
                `}
              >
                {/* Today indicator ring */}
                <div className={`flex items-center justify-center mb-2 ${isToday ? "relative" : ""}`}>
                  {isToday && (
                    <div className="absolute inset-0 -m-0.5 rounded-full border-2 border-erl-accent/40" />
                  )}
                  <span className={`text-sm font-semibold ${isToday ? "text-erl-accent" : isWeekend ? "text-erl-text-muted" : "text-erl-text-secondary"}`}>
                    {d}
                  </span>
                </div>

                {/* Staff indicators */}
                {dayStaff.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center">
                    {dayStaff.slice(0, 3).map((s) => (
                      <div key={s.staff_id} title={s.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[6px] sm:text-[7px] font-bold text-white shadow-sm"
                        style={{ background: s.color || "#555" }}>
                        {s.initials}
                      </div>
                    ))}
                    {dayStaff.length > 3 && (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-erl-border-default flex items-center justify-center text-[6px] sm:text-[7px] font-bold text-erl-text-muted">
                        +{dayStaff.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtle dot for days with records */}
                {dayStaff.length > 0 && !isSelected && (
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-erl-accent/40" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Panel */}
      {selectedDate && (
        <div className="flex flex-col gap-4">
          {/* Panel header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-erl-accent/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-erl-accent">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <div className="font-display text-sm font-bold text-erl-text-primary tracking-wide">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className="text-[10px] text-erl-text-muted tracking-wider uppercase font-semibold">
                  {dayLoading ? "Loading records..." : `${dayRecords.length} staff ${dayRecords.length === 1 ? "member" : "members"}`}
                </div>
              </div>
            </div>
            {dayLoading && (
              <div className="w-5 h-5 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
            )}
          </div>

          {/* Staff cards */}
          {dayLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-erl-accent/30 border-t-erl-accent rounded-full animate-spin" />
              <span className="text-sm text-erl-text-muted">Loading records...</span>
            </div>
          ) : dayRecords.length === 0 ? (
            <div className="card-glass rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-erl-accent/5 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-erl-text-faint">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="text-sm text-erl-text-muted font-medium">No time records for this date</div>
              <div className="text-[11px] text-erl-text-faint mt-1">Select another day to view records</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {dayRecords.map((rec) => {
                const hours = rec.total_hours ? Number(rec.total_hours) : 0;
                return (
                  <div key={rec.id} className="card-glass rounded-xl px-4 py-3.5 flex items-center gap-3.5 transition-all duration-200 hover:border-erl-accent/15">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${rec.color || "#555"}, ${(rec.color || "#555")}cc)`,
                        boxShadow: `0 3px 12px ${(rec.color || "#555")}30`,
                      }}>
                      {rec.initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-erl-text-primary">{rec.name}</div>
                      <div className="text-[10px] text-erl-text-faint tracking-[0.1em] uppercase font-semibold mt-0.5">{rec.role}</div>
                    </div>

                    {/* Times */}
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
                      <div className="text-xs text-erl-text-secondary font-semibold">
                        {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}
                        {rec.clock_out ? (
                          <span className="text-erl-text-faint"> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}</span>
                        ) : (
                          <span className="ml-1.5 inline-flex items-center gap-1">
                            <span className="animate-pulse text-erl-success">●</span>
                            <span className="text-[10px] font-semibold text-erl-success">Active</span>
                          </span>
                        )}
                      </div>
                      {hours > 0 && (
                        <div className="text-[10px] text-erl-accent font-bold">
                          {hours.toFixed(1)}h
                        </div>
                      )}

                      {/* Edit button for admins */}
                      {isAdmin && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => onEditRecord(rec)} className="text-[11px] px-2 py-1 rounded-lg border border-erl-border-default text-erl-text-faint font-bold hover:border-erl-accent/30 hover:text-erl-accent transition-colors">
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Day total summary */}
              <div className="mt-1 rounded-xl border border-erl-accent/20 bg-erl-accent/[0.06] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-erl-accent shadow-[0_0_8px_rgba(196,149,106,0.4)]" />
                  <span className="text-[11px] font-bold tracking-[0.15em] text-erl-text-secondary uppercase">Day Total</span>
                </div>
                <span className="font-display text-base font-bold text-erl-accent tabular-nums">
                  {dayRecords.reduce((acc, r) => acc + Number(r.total_hours || 0), 0).toFixed(1)}h
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default TimeKeepingCalendar;
