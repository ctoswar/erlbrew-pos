import React, { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  value: string; // "YYYY-MM-DD" format
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const parseDate = (val: string): Date | null => {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

export const AnimatedDatePicker: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "Select date…",
  min,
  max,
  className = "",
  disabled = false,
}) => {
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selected || today);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);

  // Build calendar grid
  const cells: { day: number; month: "prev" | "current" | "next"; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
    cells.push({ day: prevMonthDays - i, month: "prev", date: d });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    cells.push({ day: d, month: "current", date });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(viewYear, viewMonth + 1, d);
    cells.push({ day: d, month: "next", date });
  }

  const minDate = min ? parseDate(min) : null;
  const maxDate = max ? parseDate(max) : null;

  const isDisabled = (d: Date) => {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  };

  const close = useCallback(() => {
    setOpen(false);
    setSlideDir(null);
  }, []);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const navigateMonth = (dir: number) => {
    setSlideDir(dir > 0 ? "right" : "left");
    setTimeout(() => {
      setViewDate(new Date(viewYear, viewMonth + dir, 1));
      setTimeout(() => setSlideDir(null), 200);
    }, 100);
  };

  const selectDate = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toStr(d));
    close();
  };

  const formatDisplay = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) setViewDate(selected || today);
          setOpen((o) => !o);
        }}
        className={`
          w-full flex items-center justify-between gap-2
          px-3 py-2.5 rounded-xl text-left
          border transition-all duration-200 cursor-pointer select-none
          ${open
            ? "border-erl-accent bg-erl-surface shadow-[0_0_0_3px_rgba(196,149,106,0.12)]"
            : "border-erl-border-medium bg-erl-base hover:border-erl-border-strong"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
        `}
      >
        <span className={`text-sm truncate ${selected ? "text-erl-text-primary" : "text-erl-text-disabled"}`}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-erl-text-muted transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "rotate-180" : ""}`}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      <div
        className={`
          absolute z-50 mt-2 left-0 right-0
          rounded-2xl overflow-hidden
          border border-erl-border-default
          bg-erl-surface
          shadow-[0_12px_48px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3)]
          backdrop-blur-xl
          origin-top
          transition-all duration-300
          ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open
            ? "opacity-100 scale-y-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-y-85 -translate-y-2 pointer-events-none"
          }
        `}
        style={{ willChange: "transform, opacity" }}
      >
        <div className="p-3">
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="text-xs font-bold text-erl-text-primary tracking-wide">
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[9px] font-bold text-erl-text-faint tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className={`grid grid-cols-7 gap-0.5 transition-all duration-200 ${
              slideDir === "left" ? "animate-slide-left" : slideDir === "right" ? "animate-slide-right" : ""
            }`}
          >
            {cells.map((cell, i) => {
              const isCurrent = cell.month === "current";
              const isSelected = selected && isSameDay(cell.date, selected);
              const isToday = isSameDay(cell.date, today);
              const disabled = isDisabled(cell.date);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDate(cell.date)}
                  disabled={disabled}
                  className={`
                    relative w-full aspect-square flex items-center justify-center
                    rounded-lg text-[11px] font-medium
                    transition-all duration-150
                    ${!isCurrent ? "text-erl-text-disabled/40" : ""}
                    ${isCurrent && !disabled ? "text-erl-text-secondary hover:text-erl-text-primary hover:bg-erl-accent/10" : ""}
                    ${isCurrent && disabled ? "text-erl-text-disabled cursor-not-allowed" : ""}
                    ${isSelected ? "!bg-erl-accent !text-white hover:!bg-erl-accent/90 shadow-[0_2px_8px_rgba(196,149,106,0.4)]" : ""}
                    ${isToday && !isSelected ? "font-bold" : ""}
                    active:scale-90
                  `}
                >
                  {cell.day}
                  {isToday && !isSelected && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-erl-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-erl-border-subtle">
            <button
              type="button"
              onClick={() => { onChange(""); close(); }}
              className="text-[10px] text-erl-text-muted hover:text-erl-danger font-semibold tracking-wide px-2 py-1.5 rounded-lg hover:bg-erl-danger/10 transition-all duration-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { onChange(toStr(today)); close(); }}
              className="text-[10px] text-erl-accent hover:text-erl-accent-light font-semibold tracking-wide px-2 py-1.5 rounded-lg hover:bg-erl-accent/10 transition-all duration-200"
            >
              Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
