import React from "react";
import { TimekeepingTab } from "../../types";

interface Props {
  isAdmin: boolean;
  activeTab: TimekeepingTab;
  onTabChange: (tab: TimekeepingTab) => void;
  onExportClick: () => void;
}

const todayDateStr = new Date().toLocaleDateString("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const TimeKeepingHeader: React.FC<Props> = ({ isAdmin, activeTab, onTabChange, onExportClick }) => {
  return (
    <div className="glass-panel px-4 md:px-5 py-3.5 border-b border-erl-accent/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between flex-shrink-0 rounded-none gap-2">
      <div className="flex items-center gap-3 md:gap-4 flex-wrap">
        <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center flex-shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-erl-accent">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div className="font-display text-lg font-bold text-erl-text-primary tracking-wide">Timekeeping</div>
        <div className="flex gap-1 bg-erl-base rounded-xl p-0.5 border border-erl-border-subtle">
          {([["today", "Today"], ...(isAdmin ? [["calendar", "Calendar"] as const, ["schedules", "Schedules"] as const] : [])] as const).map(([key, label]) => (
            <button key={key} onClick={() => onTabChange(key as TimekeepingTab)} className={`
              px-3 py-1.5 sm:px-3.5 text-xs rounded-lg cursor-pointer transition-all duration-200 font-semibold tracking-wide min-h-[44px]
              ${activeTab === key
                ? "bg-erl-accent/15 text-erl-accent shadow-sm"
                : "text-erl-text-faint hover:text-erl-text-secondary"}
            `}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-erl-text-faint tracking-wide font-medium hidden sm:block">{todayDateStr}</div>
      <button
        onClick={onExportClick}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-erl-border-default text-erl-text-secondary text-xs font-semibold tracking-wide cursor-pointer hover:border-erl-accent/30 hover:text-erl-accent hover:bg-erl-accent/5 transition-all duration-200 min-h-[44px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Export Report
      </button>
    </div>
  );
};

export default TimeKeepingHeader;
