import React, { useState } from "react";
import { AdminMenu } from "./AdminMenu";
import { AdminInventory } from "./AdminInventory";
import { AdminStaff } from "./AdminStaff";
import { AdminPrintSettings } from "./AdminPrintSettings";
import { ZReportScreen } from "./ZReportScreen";
import { CashDrawerScreen } from "./CashDrawerScreen";

type AdminTab = "menu" | "inventory" | "staff" | "reports" | "cash" | "print";

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "menu", label: "Menu Items", icon: "🍽️" },
  { key: "inventory", label: "Inventory", icon: "📦" },
  { key: "staff", label: "Staff", icon: "👥" },
  { key: "print", label: "Print Settings", icon: "🖨️" },
  { key: "reports", label: "Z-Report", icon: "📊" },
  { key: "cash", label: "Cash Drawer", icon: "💰" },
];

export const AdminScreen: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>("menu");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* Sub-tab bar */}
      <div
        className="glass-panel"
        style={{
          display: "flex",
          gap: 6,
          padding: "0.75rem 1rem",
          borderBottom: "1px solid rgba(201,135,58,0.08)",
          flexShrink: 0,
          position: "relative",
          borderRadius: 0,
        }}
      >
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              position: "relative",
              padding: "7px 16px",
              borderRadius: 9,
              border: `1.5px solid ${
                tab === key ? "var(--gold)" : "var(--border-default)"
              }`,
              background:
                tab === key ? "rgba(201,135,58,0.12)" : "transparent",
              color: tab === key ? "var(--gold)" : "var(--text-secondary)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.2,
              cursor: "pointer",
              textTransform: "uppercase",
              transition: "all 0.15s var(--ease-out)",
            }}
          >
            <span style={{ marginRight: 4 }}>{icon}</span>
            {label}
            {tab === key && (
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: "15%",
                  right: "15%",
                  height: 2,
                  background: "var(--gold)",
                  borderRadius: 2,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {tab === "menu" && <AdminMenu />}
        {tab === "inventory" && <AdminInventory />}
        {tab === "staff" && <AdminStaff />}
        {tab === "reports" && <ZReportScreen />}
        {tab === "cash" && <CashDrawerScreen />}
        {tab === "print" && <AdminPrintSettings />}
      </div>
    </div>
  );
};