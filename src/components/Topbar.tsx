import React from "react";
import { Staff, Screen } from "../types";
import { useClock } from "../hooks/useClock";
import { useTheme } from "../hooks/useTheme";
import { useFontSize, FONT_SIZE_LABELS, type FontSize } from "../hooks/useFontSize";
import { formatTime } from "../utils";

interface Props {
  staff: Staff;
  screen: Screen;
  activeOrderCount: number;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}

const NAV_ICONS: Record<string, string> = {
  pos: "☕",
  time: "⏱",
  kitchen: "🍳",
  dashboard: "📊",
  admin: "⚙",
};

export const Topbar: React.FC<Props> = ({ staff, screen, activeOrderCount, onNavigate, onLogout }) => {
  const time = useClock();
  const { theme, setThemeByName } = useTheme();
  const { fontSize, setFontSize } = useFontSize();

  const navItems: { screen: Screen; label: string; badge?: number; adminOnly?: boolean }[] = [
    { screen: "pos", label: "ORDER" },
    { screen: "time", label: "TIME" },
    { screen: "kitchen", label: "KITCHEN", badge: activeOrderCount },
    { screen: "dashboard", label: "DASHBOARD" },
    { screen: "admin", label: "ADMIN", adminOnly: true },
  ];

  const visibleNavItems = navItems.filter((n) => !n.adminOnly || staff.role === "Manager");
  const isOrderRelated = screen === "pos" || screen === "checkout" || screen === "payment" || screen === "success";

  const handleLogout = () => {
    onLogout();
  };

  return (
    <header
      className="glass-panel"
      style={{
        height: 46,
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 6,
        flexShrink: 0,
        borderBottom: "1px solid rgba(201,135,58,0.08)",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        className="font-display"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--gold)",
          letterSpacing: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        ERLBREW
        <div style={{ width: 1, height: 18, background: "rgba(201,135,58,0.2)", margin: "0 4px", flexShrink: 0 }} />
      </div>

      {/* Nav */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          overflowX: "auto",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {visibleNavItems.map(({ screen: s, label, badge }) => {
          const isActive = s === "pos" ? isOrderRelated : screen === s;
          return (
            <button
              key={s}
              onClick={() => onNavigate(s)}
              style={{
                position: "relative",
                background: isActive ? "rgba(201,135,58,0.1)" : "transparent",
                border: "none",
                borderRadius: 8,
                color: isActive ? "var(--gold)" : "var(--text-faint)",
                fontSize: 8.5,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 1,
                padding: "6px 10px",
                cursor: "pointer",
                transition: "all 0.15s var(--ease-out)",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
              onMouseEnter={(e) => {
                if (!isActive) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }
              }}
              onMouseLeave={(e) => {
                if (!isActive) { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "transparent"; }
              }}
            >
              <span style={{ fontSize: 10, lineHeight: 1 }}>{NAV_ICONS[s]}</span>
              {label}
              {badge != null && badge > 0 ? (
                <span
                  style={{
                    background: isActive ? "var(--gold)" : "rgba(201,135,58,0.3)",
                    color: isActive ? "var(--bg-sidebar)" : "var(--gold)",
                    borderRadius: 4,
                    padding: "0 5px",
                    fontSize: 7,
                    fontWeight: 700,
                    lineHeight: "14px",
                    display: "inline-flex",
                    alignItems: "center",
                    minWidth: 14,
                    justifyContent: "center",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Font size */}
        <button
          onClick={() => {
            const sizes: FontSize[] = ["small", "normal", "large", "extra-large"];
            const idx = sizes.indexOf(fontSize);
            const next = sizes[(idx + 1) % sizes.length];
            setFontSize(next);
          }}
          className="btn-ghost"
          style={{
            fontSize: 8,
            color: fontSize !== "normal" ? "var(--gold)" : "var(--text-muted)",
            padding: "4px 6px",
            letterSpacing: 0.5,
          }}
        >
          {FONT_SIZE_LABELS[fontSize]}
        </button>

        {/* Theme */}
        <button
          onClick={() => setThemeByName(theme === "brown" ? "white" : "brown")}
          className="btn-ghost"
          style={{
            fontSize: 12,
            padding: "4px 5px",
            opacity: 0.7,
          }}
        >
          {theme === "brown" ? "☁" : "☕"}
        </button>

        <div style={{ width: 1, height: 16, background: "rgba(201,135,58,0.12)", flexShrink: 0 }} />

        {/* Staff pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${staff.color}, ${staff.color}cc)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 0 0 2px rgba(201,135,58,0.15)",
            }}
          >
            {staff.initials}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 9, color: "var(--text-primary)", fontWeight: 700 }}>
              {staff.name.split(" ")[0]}
            </div>
            <div style={{ fontSize: 7, color: "var(--text-faint)", letterSpacing: 0.5 }}>
              {staff.role}
            </div>
          </div>
        </div>

        {/* Clock */}
        <div
          style={{
            fontSize: 9,
            color: "var(--gold-dim)",
            letterSpacing: 0.5,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          {formatTime(time)}
        </div>

        <button
          className="btn-ghost"
          onClick={handleLogout}
          style={{
            fontSize: 7.5,
            padding: "5px 8px",
            letterSpacing: 1,
            flexShrink: 0,
            color: "var(--text-disabled)",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
};