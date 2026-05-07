import React, { useState } from "react";
import { AdminMenu } from "./AdminMenu";
import { AdminInventory } from "./AdminInventory";
import { AdminStaff } from "./AdminStaff";
import { AdminPrintSettings } from "./AdminPrintSettings";
import { ZReportScreen } from "./ZReportScreen";
import { CashDrawerScreen } from "./CashDrawerScreen";

type AdminTab = "menu" | "inventory" | "staff" | "reports" | "cash" | "print";

export const AdminScreen: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>("menu");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      {/* Sub-tab bar */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}>
        <button onClick={() => setTab("menu")} style={{
          padding: "7px 20px", borderRadius: 9,
          border: `1.5px solid ${tab === "menu" ? "var(--gold)" : "var(--border-default)"}`,
          background: tab === "menu" ? "rgba(201,135,58,0.15)" : "transparent",
          color: tab === "menu" ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          Menu Items
        </button>
<button onClick={() => setTab("inventory")} style={{
        padding: "7px 20px", borderRadius: 9,
        border: `1.5px solid ${tab === "inventory" ? "var(--gold)" : "var(--border-default)"}`,
        background: tab === "inventory" ? "rgba(201,135,58,0.15)" : "transparent",
        color: tab === "inventory" ? "var(--gold)" : "var(--text-secondary)",
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
        textTransform: "uppercase" as const,
      }}>
        Inventory
      </button>
<button onClick={() => setTab("staff")} style={{
          padding: "7px 20px", borderRadius: 9,
          border: `1.5px solid ${tab === "staff" ? "var(--gold)" : "var(--border-default)"}`,
          background: tab === "staff" ? "rgba(201,135,58,0.15)" : "transparent",
          color: tab === "staff" ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          Staff
        </button>
        <button onClick={() => setTab("print")} style={{
          padding: "7px 20px", borderRadius: 9,
          border: `1.5px solid ${tab === "print" ? "var(--gold)" : "var(--border-default)"}`,
          background: tab === "print" ? "rgba(201,135,58,0.15)" : "transparent",
          color: tab === "print" ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          🖨 Print Settings
        </button>
        <button onClick={() => setTab("reports")} style={{
          padding: "7px 20px", borderRadius: 9,
          border: `1.5px solid ${tab === "reports" ? "var(--gold)" : "var(--border-default)"}`,
          background: tab === "reports" ? "rgba(201,135,58,0.15)" : "transparent",
          color: tab === "reports" ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          📊 Z-Report
        </button>
        <button onClick={() => setTab("cash")} style={{
          padding: "7px 20px", borderRadius: 9,
          border: `1.5px solid ${tab === "cash" ? "var(--gold)" : "var(--border-default)"}`,
          background: tab === "cash" ? "rgba(201,135,58,0.15)" : "transparent",
          color: tab === "cash" ? "var(--gold)" : "var(--text-secondary)",
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
          textTransform: "uppercase" as const,
        }}>
          💰 Cash Drawer
        </button>
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