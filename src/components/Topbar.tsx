import React, { useEffect, useState } from "react";
import { Staff, Screen } from "../types";
import { useClock } from "../hooks/useClock";
import { formatTime } from "../utils";

interface Props {
  staff: Staff;
  screen: Screen;
  activeOrderCount: number;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}

export const Topbar: React.FC<Props> = ({ staff, screen, activeOrderCount, onNavigate, onLogout }) => {
  const time = useClock();
  // Font-size toggle state
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  // Initialize font-size from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('erlbrew_font_size');
      const isLarge = saved === 'large';
      setIsLargeFont(isLarge);
      if (isLarge) {
        document.documentElement.setAttribute('data-font-size', 'large');
      } else {
        document.documentElement.removeAttribute('data-font-size');
      }
    } catch {
      // ignore
    }
  }, []);

  // Toggle handler
  const toggleFontSize = () => {
    const next = isLargeFont ? 'normal' : 'large';
    setIsLargeFont(!isLargeFont);
    try {
      localStorage.setItem('erlbrew_font_size', next);
    } catch {
      // ignore
    }
    if (next === 'large') {
      document.documentElement.setAttribute('data-font-size', 'large');
    } else {
      document.documentElement.removeAttribute('data-font-size');
    }
  };

const navItems: { screen: Screen; label: string; badge?: number; adminOnly?: boolean }[] = [
    { screen: "pos", label: "ORDER" },
    { screen: "time", label: "TIME" },
    { screen: "kitchen", label: "KITCHEN", badge: activeOrderCount },
    { screen: "dashboard", label: "DASHBOARD" },
    { screen: "admin", label: "ADMIN", adminOnly: true },
  ];

  const visibleNavItems = navItems.filter((n) => !n.adminOnly || staff.role === "Manager");

  const isOrderRelated = screen === "pos" || screen === "checkout" || screen === "payment" || screen === "success";

  // Computed scale for this render
  const scale = isLargeFont ? 1.35 : 1;
  const headerStyle: React.CSSProperties = {
    height: Math.round(58 * scale),
    background: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border-subtle)",
    display: "flex",
    alignItems: "center",
    padding: `0 ${Math.round(1.2 * 16 * scale)}px`,
    gap: Math.round(10 * scale),
    flexShrink: 0
  };

  const navWrapper: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: Math.round(8 * scale),
    overflowX: "auto",
    whiteSpace: "nowrap",
    maxWidth: "60rem",
    padding: `0 ${Math.round(6 * scale)}px`,
  };

  const logoStyle: React.CSSProperties = {
    fontSize: Math.round(16 * scale),
    fontWeight: 700,
    color: "var(--gold)",
    letterSpacing: 2,
    marginRight: "auto"
  };

  const navBtnBase: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border-subtle)",
    borderRadius: Math.round(8 * scale),
    color: "var(--text-disabled)",
    fontSize: Math.round(9 * scale),
    padding: `${Math.round(7 * scale)}px ${Math.round(14 * scale)}px`,
    position: "relative"
  };

  const toggleBtnStyle: React.CSSProperties = {
    borderRadius: Math.round(8 * scale),
    padding: `${Math.round(6 * scale)}px ${Math.round(10 * scale)}px`,
    fontSize: Math.round(9 * scale),
    border: '1px solid var(--border-default)',
    background: isLargeFont ? 'var(--gold)' : 'transparent',
    color: isLargeFont ? 'var(--bg-sidebar)' : 'var(--text-muted)',
    cursor: 'pointer'
  };

  return (
    <header style={headerStyle}>
      {/* Logo */}
      <div className="font-display" style={logoStyle}>
        ERLBREW
      </div>

      {/* Nav - wrap in a horizontally scrollable container to prevent wrapping on tablet/narrow screens */}
      <div style={navWrapper}>
        {visibleNavItems.map(({ screen: s, label, badge }) => {
        const isActive = s === "pos" ? isOrderRelated : screen === s;
        return (
          <button key={s} className={`btn tab ${isActive ? "active-subtle" : ""}`}
            onClick={() => onNavigate(s)}
            style={{ ...navBtnBase }}>
            {label}
            {badge ? (
              <span style={{ position: "absolute", top: -5, right: -5, background: "var(--gold)", color: "var(--bg-sidebar)", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
      </div>
      <button onClick={toggleFontSize} aria-pressed={isLargeFont} title={isLargeFont ? 'Large text active' : 'Normal text'} style={toggleBtnStyle}>
        {isLargeFont ? '☀' : 'Aa'}
      </button>
      
      <div style={{ width: 1, height: 22, background: "var(--border-default)" }} />

      {/* Staff avatar */}
      <div style={{ width: Math.round(30 * scale), height: Math.round(30 * scale), borderRadius: "50%", background: staff.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(10 * scale), fontWeight: 700, color: "var(--bg-sidebar)", flexShrink: 0 }}>
        {staff.initials}
      </div>
      <div>
        <div style={{ fontSize: Math.round(11 * scale), color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{staff.name.split(" ")[0]}</div>
        <div style={{ fontSize: Math.round(8 * scale), color: "var(--gold-muted)", letterSpacing: 0.8 }}>{staff.role}</div>
      </div>

      {/* Clock */}
      <div style={{ fontSize: Math.round(10 * scale), color: "var(--gold-muted)", letterSpacing: 1, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(time)}
      </div>

      <button className="btn btn-outline" onClick={onLogout} style={{ fontSize: Math.round(9 * scale), padding: `${Math.round(7 * scale)}px ${Math.round(12 * scale)}px` }}>
        Logout
      </button>
    </header>
  );
};
