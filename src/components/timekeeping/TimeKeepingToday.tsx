import React from "react";
import { Staff, TimeRecord, ClockResponse } from "../../types";
import RfidInput from "./RfidInput";
import StaffGroup from "./StaffGroup";

interface Props {
  staff: Staff;
  records: TimeRecord[];
  loading: boolean;
  lastTap: ClockResponse | null;
  tapError: string | null;
  onScan: (rfid: string) => void;
}

const TimeKeepingToday: React.FC<Props> = ({ records, loading, lastTap, tapError, onScan }) => {
  const clockedIn = records.filter((r) => r.status === "clocked_in");
  const clockedOut = records.filter((r) => r.status === "clocked_out");
  const notIn = records.filter((r) => r.status === "not_in");

  return (
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
                    {`In: ${new Date(lastTap.record.clock_in).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}`}
                    {lastTap.record?.clock_out ? `  Out: ${new Date(lastTap.record.clock_out).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tap error feedback */}
      {tapError && (
        <div className="animate-scale-in rounded-2xl border border-erl-danger/30 bg-erl-danger-bg px-5 py-3.5 text-sm font-bold text-erl-danger">
          {tapError}
        </div>
      )}

      {/* RFID Scan Box */}
      <div className="card-glass p-5 text-center relative">
        <div className="relative z-10 flex flex-col items-center">
          <div className="text-2xl mb-2">📲</div>
          <div className="font-display text-sm text-erl-text-primary font-bold tracking-wide mb-0.5">Scan Your Card</div>
          <div className="text-[10px] text-erl-text-faint mb-3 tracking-wide">Tap to clock in or out</div>
          <RfidInput onScan={onScan} />
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
  );
};

export default TimeKeepingToday;
