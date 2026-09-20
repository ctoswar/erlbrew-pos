import React from "react";
import { TimeRecord } from "../../types";
import { fmtTime, isWithinBreak, getLateMinutes } from "../../utils";

interface Props {
  label: string;
  count: number;
  color: string;
  records: TimeRecord[];
}

const StaffGroup: React.FC<Props> = ({ label, count, color, records }) => (
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
          const now = new Date();
          const onLunch = r.status === "clocked_in" && isWithinBreak(now, r.lunch_start, r.lunch_end);
          const onSnack = r.status === "clocked_in" && isWithinBreak(now, r.snack_start, r.snack_end);
          const lateMins = rec ? getLateMinutes(rec.clock_in, r.shift_start) : 0;
          const isLate = lateMins > 0;
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
                {/* Schedule pills */}
                {(r.shift_start || r.shift_end || isLate) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(r.shift_start || r.shift_end) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-accent/8 text-erl-accent font-semibold tracking-wide">
                        Shift {fmtTime(r.shift_start)} – {fmtTime(r.shift_end)}
                      </span>
                    )}
                    {isLate && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-danger/10 text-erl-danger font-semibold tracking-wide">
                        Late {lateMins}m
                      </span>
                    )}
                    {onLunch && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-erl-success/10 text-erl-success font-semibold tracking-wide">
                        On Lunch
                      </span>
                    )}
                    {onSnack && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#d4a87a]/15 text-[#d4a87a] font-semibold tracking-wide">
                        Snack Break
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="text-right flex-shrink-0">
                {rec ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-xs text-erl-text-secondary font-semibold">
                      {new Date(rec.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}
                      {rec.clock_out ? (
                        <span className="text-erl-text-faint"> → {new Date(rec.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}</span>
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

export default StaffGroup;
