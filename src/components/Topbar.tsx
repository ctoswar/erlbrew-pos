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
  time: "⏱️",
  kitchen: "🍳",
  dashboard: "📊",
  admin: "⚙️",
};

export const Topbar: React.FC<Props> = ({ staff, screen, activeOrderCount, onNavigate, onLogout }) => {
  const time = useClock();
  const { theme, setThemeByName } = useTheme();
  const { fontSize, setFontSize } = useFontSize();

  const fontScaleMap: Record<FontSize, number> = {
    small: 0.85,
    normal: 1,
    large: 1.2,
    "extra-large": 1.35,
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
  const scale = fontScaleMap[fontSize];

  return (
    <header
      className="glass-panel"
      style={{
        height: Math.round(52 * scale),
        display: "flex",
        alignItems: "center",
        padding: `0 ${Math.round(14 * scale)}px`,
        gap: Math.round(6 * scale),
        flexShrink: 0,
        borderBottom: "1px solid rgba(201,135,58,0.08)",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Gold accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(201,135,58,0.3), transparent)",
        }}
      />

      {/* Logo — fixed, no shrink */}
      <div
        className="font-display"
        style={{
          fontSize: Math.round(14 * scale),
          fontWeight: 700,
          color: "var(--gold)",
          letterSpacing: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          marginRight: Math.round(4 * scale),
        }}
      >
        ERLBREW
      </div>

      {/* Nav — fills remaining space, scrolls only if truly needed */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: Math.round(2 * scale),
          overflowX: "auto",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
          paddingRight: Math.round(4 * scale),
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
                background: "transparent",
                border: "none",
                borderRadius: Math.round(6 * scale),
                color: isActive ? "var(--gold)" : "var(--text-disabled)",
                fontSize: Math.round(9 * scale),
                fontWeight: 700,
                letterSpacing: 1.2,
                padding: `${Math.round(5 * scale)}px ${Math.round(9 * scale)}px`,
                cursor: "pointer",
                transition: "color 0.2s var(--ease-out), background 0.2s var(--ease-out)",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(201,135,58,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ marginRight: 3 }}>{NAV_ICONS[s]}</span>
              {label}
              {badge ? (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "var(--gold)",
                    color: "var(--bg-sidebar)",
                    borderRadius: "50%",
                    width: 14,
                    height: 14,
                    fontSize: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {badge}
                </span>
              ) : null}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: "15%",
                    right: "15%",
                    height: 2,
                    background: "var(--gold)",
                    borderRadius: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right side — all fixed, no shrink */}
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(4 * scale), flexShrink: 0 }}>
        {/* Font size toggle */}
        <button
          onClick={() => {
            const sizes: FontSize[] = ["small", "normal", "large", "extra-large"];
            const idx = sizes.indexOf(fontSize);
            const next = sizes[(idx + 1) % sizes.length];
            setFontSize(next);
          }}
          title={`Font size: ${fontSize}`}
          className="btn-ghost"
          style={{
            minWidth: 28,
            fontSize: Math.round(9 * scale),
            color: fontSize !== "normal" ? "var(--gold)" : "var(--text-muted)",
            padding: `${Math.round(4 * scale)}px ${Math.round(6 * scale)}px`,
          }}
        >
          {FONT_SIZE_LABELS[fontSize]}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setThemeByName(theme === "brown" ? "white" : "brown")}
          title={theme === "brown" ? "Switch to white theme" : "Switch to brown theme"}
          className="btn-ghost"
          style={{
            fontSize: Math.round(12 * scale),
            padding: `${Math.round(4 * scale)}px ${Math.round(6 * scale)}px`,
          }}
        >
          {theme === "brown" ? "☁" : "☕"}
        </button>

        <div style={{ width: 1, height: 16, background: "var(--border-default)", flexShrink: 0 }} />

        {/* Staff avatar */}
        <div
          style={{
            width: Math.round(26 * scale),
            height: Math.round(26 * scale),
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${staff.color}, ${staff.color}dd)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(9 * scale),
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 0 0 2px rgba(201,135,58,0.15)",
          }}
        >
          {staff.initials}
        </div>

        {/* Staff name (hide on very narrow) */}
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <div
            style={{
              fontSize: Math.round(10.5 * scale),
              color: "var(--text-primary)",
              fontWeight: 700,
            }}
          >
            {staff.name.split(" ")[0]}
          </div>
          <div
            style={{
              fontSize: Math.round(7 * scale),
              color: "var(--gold-muted)",
              letterSpacing: 0.8,
            }}
          >
            {staff.role}
          </div>
        </div>

        {/* Clock */}
        <div
          style={{
            fontSize: Math.round(9.5 * scale),
            color: "var(--gold-muted)",
            letterSpacing: 1,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {formatTime(time)}
        </div>

        <button
          className="btn btn-outline"
          onClick={onLogout}
          style={{
            fontSize: Math.round(8 * scale),
            padding: `${Math.round(5 * scale)}px ${Math.round(8 * scale)}px`,
            letterSpacing: 1,
            flexShrink: 0,
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
};