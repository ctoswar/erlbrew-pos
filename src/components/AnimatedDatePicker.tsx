import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

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
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_FULL = [
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

type View = { mode: "days"; year: number; month: number } | { mode: "months"; year: number };

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
  const [view, setView] = useState<View>({
    mode: "days",
    year: selected?.getFullYear() ?? today.getFullYear(),
    month: selected?.getMonth() ?? today.getMonth(),
  });
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

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
    setDropdownPos(null);
  }, []);

  const DROPDOWN_WIDTH = 340;
  const DROPDOWN_HEIGHT = 420;

  // Calculate dropdown position when opening
  const calcPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_HEIGHT + 16;

    let top = openUp ? rect.top - DROPDOWN_HEIGHT - 16 : rect.bottom + 16;
    let left = rect.left;

    // Keep calendar within viewport horizontally
    if (left + DROPDOWN_WIDTH > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - DROPDOWN_WIDTH - 16);
    }
    // Keep calendar within viewport vertically
    if (top < 16) top = 16;
    if (top + DROPDOWN_HEIGHT > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - DROPDOWN_HEIGHT - 16);
    }

    setDropdownPos({ top, left, width: DROPDOWN_WIDTH, openUp });
  }, []);

  // Open/close
  useEffect(() => {
    if (!open) return;
    calcPosition();
    const handleResize = () => calcPosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open, calcPosition]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      close();
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
    if (view.mode !== "days") return;
    setSlideDir(dir > 0 ? "right" : "left");
    setTimeout(() => {
      let newMonth = view.month + dir;
      let newYear = view.year;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      if (newMonth < 0) { newMonth = 11; newYear--; }
      setView({ mode: "days", year: newYear, month: newMonth });
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

  // Calendar grid (days mode)
  const renderDays = () => {
    if (view.mode !== "days") return null;
    const { year, month } = view;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const cells: { day: number; month: "prev" | "current" | "next"; date: Date }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, month: "prev", date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: "current", date: new Date(year, month, d) });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, month: "next", date: new Date(year, month + 1, d) });
    }

    return (
      <>
        {/* Month/Year header — click month to open month picker */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setView({ mode: "months", year })}
            className="text-base font-bold text-erl-text-primary tracking-wide hover:text-erl-accent transition-colors px-4 py-2 rounded-xl hover:bg-erl-accent/10"
          >
            {MONTHS_FULL[month]} {year}
          </button>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-3">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-erl-text-faint tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className={`grid grid-cols-7 gap-1.5 transition-all duration-200 ${
            slideDir === "left" ? "animate-slide-left" : slideDir === "right" ? "animate-slide-right" : ""
          }`}
        >
          {cells.map((cell, i) => {
            const isCurrent = cell.month === "current";
            const isSelected = selected && isSameDay(cell.date, selected);
            const isToday = isSameDay(cell.date, today);
            const dis = isDisabled(cell.date);

            return (
              <button
                key={i}
                type="button"
                onClick={() => selectDate(cell.date)}
                disabled={dis}
                className={`
                  relative w-full aspect-square flex items-center justify-center
                  rounded-xl text-sm font-medium
                  transition-all duration-150
                  ${!isCurrent ? "text-erl-text-disabled/30" : ""}
                  ${isCurrent && !dis ? "text-erl-text-secondary hover:text-erl-text-primary hover:bg-erl-accent/10 cursor-pointer" : ""}
                  ${isCurrent && dis ? "text-erl-text-disabled cursor-not-allowed" : ""}
                  ${isSelected ? "!bg-erl-accent !text-white hover:!bg-erl-accent/90 shadow-[0_2px_12px_rgba(196,149,106,0.45)]" : ""}
                  ${isToday && !isSelected ? "font-bold" : ""}
                  active:scale-90
                `}
              >
                {cell.day}
                {isToday && !isSelected && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-erl-accent" />
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  // Month picker (months mode)
  const renderMonths = () => {
    if (view.mode !== "months") return null;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return (
      <>
        {/* Year header with nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => setView({ mode: "months", year: view.year - 1 })}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-base font-bold text-erl-text-primary tracking-wide">{view.year}</div>
          <button
            type="button"
            onClick={() => setView({ mode: "months", year: view.year + 1 })}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-erl-text-muted hover:text-erl-accent hover:bg-erl-accent/10 transition-all duration-200 active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-3">
          {MONTHS_SHORT.map((m, i) => {
            const isThisMonth = view.year === currentYear && i === currentMonth;
            const isSelectedMonth = selected && selected.getFullYear() === view.year && selected.getMonth() === i;

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setView({ mode: "days", year: view.year, month: i });
                }}
                className={`
                  py-4 rounded-xl text-sm font-semibold
                  transition-all duration-200 active:scale-95
                  ${isSelectedMonth
                    ? "!bg-erl-accent !text-white shadow-[0_2px_12px_rgba(196,149,106,0.45)]"
                    : isThisMonth
                      ? "bg-erl-accent/10 text-erl-accent hover:bg-erl-accent/20"
                      : "text-erl-text-secondary hover:bg-erl-accent/10 hover:text-erl-accent"
                  }
                `}
              >
                {m}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const calendarContent = (
    <div
      ref={dropdownRef}
      className={`
        rounded-2xl
        border border-erl-border-default
        bg-erl-surface
        shadow-[0_16px_64px_rgba(0,0,0,0.55),0_4px_20px_rgba(0,0,0,0.35)]
        backdrop-blur-xl
        transition-all duration-300
        ease-[cubic-bezier(0.16,1,0.3,1)]
        ${open
          ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
          : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        }
      `}
      style={{
        willChange: "transform, opacity",
        position: "fixed",
        top: dropdownPos ? dropdownPos.top : 0,
        left: dropdownPos ? dropdownPos.left : 0,
        width: DROPDOWN_WIDTH,
        minWidth: DROPDOWN_WIDTH,
        zIndex: 99999,
      }}
    >
      <div className="p-5">
        {view.mode === "days" ? renderDays() : renderMonths()}

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-erl-border-subtle">
          <button
            type="button"
            onClick={() => { onChange(""); close(); }}
            className="text-xs text-erl-text-muted hover:text-[#e5484d] font-semibold tracking-wide px-4 py-2.5 rounded-xl hover:bg-[#e5484d]/10 transition-all duration-200"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => { onChange(toStr(today)); close(); }}
            className="text-xs text-erl-accent hover:text-erl-accent-light font-semibold tracking-wide px-4 py-2.5 rounded-xl hover:bg-erl-accent/10 transition-all duration-200"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setView({
              mode: "days",
              year: selected?.getFullYear() ?? today.getFullYear(),
              month: selected?.getMonth() ?? today.getMonth(),
            });
          }
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

      {/* Portal the calendar to document body — prevents clipping by any parent overflow */}
      {createPortal(calendarContent, document.body)}
    </div>
  );
};
