import React from "react";
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

  const navItems: { screen: Screen; label: string; badge?: number }[] = [
    { screen: "pos",       label: "ORDER" },
    { screen: "kitchen",   label: "KITCHEN", badge: activeOrderCount },
    { screen: "dashboard", label: "DASHBOARD" },
  ];

  const isOrderRelated = screen === "pos" || screen === "checkout" || screen === "payment" || screen === "success";

  return (
    <header style={{ height: 58, background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", padding: "0 1.2rem", gap: 10, flexShrink: 0 }}>
      {/* Logo */}
      <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", letterSpacing: 2, marginRight: "auto" }}>
        ERLBREW
      </div>

      {/* Nav */}
      {navItems.map(({ screen: s, label, badge }) => {
        const isActive = s === "pos" ? isOrderRelated : screen === s;
        return (
          <button key={s} className={`btn tab ${isActive ? "active-subtle" : ""}`}
            onClick={() => onNavigate(s)}
            style={{ background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-disabled)", fontSize: 9, padding: "7px 14px", position: "relative" }}>
            {label}
            {badge ? (
              <span style={{ position: "absolute", top: -5, right: -5, background: "var(--gold)", color: "var(--bg-sidebar)", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}

      <div style={{ width: 1, height: 22, background: "var(--border-default)" }} />

      {/* Staff avatar */}
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: staff.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--bg-sidebar)", flexShrink: 0 }}>
        {staff.initials}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}>{staff.name.split(" ")[0]}</div>
        <div style={{ fontSize: 8, color: "var(--gold-muted)", letterSpacing: 0.8 }}>{staff.role}</div>
      </div>

      {/* Clock */}
      <div style={{ fontSize: 10, color: "var(--gold-muted)", letterSpacing: 1, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(time)}
      </div>

      <button className="btn btn-outline" onClick={onLogout} style={{ fontSize: 9, padding: "7px 12px" }}>
        Logout
      </button>
    </header>
  );
};
