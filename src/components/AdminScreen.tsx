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
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Sub-tab bar */}
      <div className="glass-panel flex gap-1.5 px-4 py-3 border-b border-erl-accent/10 flex-shrink-0 relative rounded-none overflow-x-auto scrollbar-none">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`
              relative px-4 py-[7px] rounded-lg text-[9px] font-bold tracking-wider uppercase cursor-pointer transition-all duration-150 ease-out flex-shrink-0 whitespace-nowrap
              ${
                tab === key
                  ? "bg-erl-accent/10 border-[1.5px] border-erl-accent text-erl-accent"
                  : "bg-transparent border-[1.5px] border-erl-border-default text-erl-secondary"
              }
            `}
          >
            <span className="mr-1">{icon}</span>
            {label}
            {tab === key && (
              <div className="absolute -bottom-px left-[15%] right-[15%] h-0.5 bg-erl-accent rounded-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
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
