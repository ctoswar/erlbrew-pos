import React, { useState } from "react";
import { AdminMenu } from "./AdminMenu";
import { AdminInventory } from "./AdminInventory";

type AdminTab = "menu" | "inventory";

export const AdminScreen: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>("menu");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
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
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "menu" && <AdminMenu />}
        {tab === "inventory" && <AdminInventory />}
      </div>
    </div>
  );
};