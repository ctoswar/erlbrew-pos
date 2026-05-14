import React, { useState, useCallback, useEffect } from "react";
import { Staff, Screen } from "../types";
import { useClock } from "../hooks/useClock";
import { useTheme } from "../hooks/useTheme";
import { useFontSize, FONT_SIZE_LABELS, type FontSize } from "../hooks/useFontSize";
import { formatTime } from "../utils";
import { apiPost } from "../utils/api";

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return { isFullscreen, toggle };
}

interface Props {
  staff: Staff;
  screen: Screen;
  activeOrderCount: number;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { screen: Screen; label: string; adminOnly?: boolean }[] = [
  { screen: "pos", label: "Order" },
  { screen: "time", label: "Time" },
  { screen: "kitchen", label: "Kitchen" },
  { screen: "dashboard", label: "Dashboard" },
  { screen: "admin", label: "Admin", adminOnly: true },
];

export const Topbar: React.FC<Props> = ({ staff, screen, activeOrderCount, onNavigate, onLogout }) => {
  const time = useClock();
  const { theme, setThemeByName } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  const [drawerStatus, setDrawerStatus] = useState<'idle' | 'opening' | 'ok' | 'error'>('idle');
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const handleOpenDrawer = useCallback(async () => {
    setDrawerStatus('opening');
    try {
      await apiPost('/open-drawer', {});
      setDrawerStatus('ok');
      setTimeout(() => setDrawerStatus('idle'), 2000);
    } catch {
      setDrawerStatus('error');
      setTimeout(() => setDrawerStatus('idle'), 3000);
    }
  }, []);

  const visibleNavItems = NAV_ITEMS.filter((n) => !n.adminOnly || staff.role === "Manager");
  const isOrderRelated = screen === "pos" || screen === "checkout" || screen === "payment" || screen === "success";

  return (
    <header className="glass-panel h-[56px] flex items-center px-5 gap-3 shrink-0 border-b border-erl-accent/[0.06] relative z-[100]">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-erl-accent/10 flex items-center justify-center">
          <span className="text-erl-accent text-lg leading-none">☕</span>
        </div>
        <div className="font-display text-sm font-bold text-erl-accent tracking-[4px]">ERLBREW</div>
        <div className="w-px h-6 bg-erl-accent/10 shrink-0 ml-1" />
      </div>

      {/* Nav */}
      <nav className="hide-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap flex-1 min-w-0 ml-2">
        {visibleNavItems.map(({ screen: s, label }) => {
          const isActive = s === "pos" ? isOrderRelated : screen === s;
          const badge = s === "kitchen" ? activeOrderCount : undefined;
          return (
            <button
              key={s}
              onClick={() => onNavigate(s)}
              className={`relative flex items-center gap-1.5 border-none rounded-xl text-xs font-semibold tracking-wide py-2 px-3.5 cursor-pointer transition-all duration-250 ease-out shrink-0 ${
                isActive
                  ? "bg-erl-accent/10 text-erl-accent shadow-[0_0_16px_rgba(196,149,106,0.08)]"
                  : "bg-transparent text-erl-text-faint hover:text-erl-text-secondary hover:bg-white/[0.03]"
              }`}
            >
              <span className="text-[13px] leading-none">{label}</span>
              {badge != null && badge > 0 ? (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-lg px-1 text-[9px] font-bold ${
                  isActive ? "bg-erl-accent text-erl-base" : "bg-erl-accent/15 text-erl-accent"
                }`}>
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Font size */}
        <button
          onClick={() => {
            const sizes: FontSize[] = ["small", "normal", "large", "extra-large"];
            const idx = sizes.indexOf(fontSize);
            const next = sizes[(idx + 1) % sizes.length];
            setFontSize(next);
          }}
          className={`btn-ghost text-[9px] py-1.5 px-2.5 tracking-wide rounded-xl transition-all duration-200 ${fontSize !== "normal" ? "text-erl-accent font-bold" : "text-erl-text-muted"}`}
        >
          {FONT_SIZE_LABELS[fontSize]}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setThemeByName(theme === "brown" ? "white" : "brown")}
          className="btn-ghost text-sm py-1.5 px-2.5 rounded-xl transition-all duration-200 opacity-60 hover:opacity-100"
          title={theme === "brown" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "brown" ? "☁" : "☕"}
        </button>

        <button
          onClick={toggleFullscreen}
          className="btn-ghost text-sm py-1.5 px-2.5 rounded-xl transition-all duration-200 opacity-60 hover:opacity-100"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>

        <div className="w-px h-5 bg-erl-accent/[0.08] shrink-0" />

        {/* Cash drawer */}
        <button
          onClick={handleOpenDrawer}
          disabled={drawerStatus !== 'idle'}
          className="btn-ghost text-xs py-1.5 px-2.5 rounded-xl transition-all duration-200"
          style={{
            opacity: drawerStatus === 'ok' ? 1 : 0.6,
            color: drawerStatus === 'ok' ? 'var(--success)' : drawerStatus === 'error' ? 'var(--danger)' : 'var(--accent-dim)',
            cursor: drawerStatus !== 'idle' ? 'default' : 'pointer',
          }}
          title="Open cash drawer"
        >
          {drawerStatus === 'opening' ? '⟳' : drawerStatus === 'ok' ? '✓' : '💰'}
        </button>

        {/* Staff pill */}
        <div className="flex items-center gap-2.5 ml-0.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${staff.color}, ${staff.color}cc)`,
              boxShadow: `0 3px 12px ${staff.color}30`,
            }}
          >
            {staff.initials}
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-xs text-erl-text-primary font-bold">{staff.name.split(" ")[0]}</div>
            <div className="text-[9px] text-erl-text-faint tracking-wide uppercase font-semibold">{staff.role}</div>
          </div>
        </div>

        {/* Clock */}
        <div className="text-[11px] text-erl-accent-dim tracking-wide tabular-nums shrink-0 font-medium">
          {formatTime(time)}
        </div>

        <button
          className="btn-ghost text-[9px] py-1.5 px-3 tracking-[0.1em] uppercase font-bold shrink-0 text-erl-text-disabled hover:text-erl-text-muted rounded-xl transition-all duration-200 hover:bg-white/[0.03]"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
};