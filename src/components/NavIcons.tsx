import React from "react";

import auditLogIcon from "../../svg icon/erlbrew-nav-icons/audit-log.svg";
import backupIcon from "../../svg icon/erlbrew-nav-icons/backup.svg";
import cashDrawerIcon from "../../svg icon/erlbrew-nav-icons/cash-drawer.svg";
import chevronDownIcon from "../../svg icon/erlbrew-nav-icons/chevron-down.svg";
import chevronUpIcon from "../../svg icon/erlbrew-nav-icons/chevron-up.svg";
import cogsIcon from "../../svg icon/erlbrew-nav-icons/cogs.svg";
import customersIcon from "../../svg icon/erlbrew-nav-icons/customers.svg";
import dashboardIcon from "../../svg icon/erlbrew-nav-icons/dashboard.svg";
import displayMessagesIcon from "../../svg icon/erlbrew-nav-icons/display-messages.svg";
import insightsIcon from "../../svg icon/erlbrew-nav-icons/insights.svg";
import integrationsIcon from "../../svg icon/erlbrew-nav-icons/integrations.svg";
import inventoryIcon from "../../svg icon/erlbrew-nav-icons/inventory.svg";
import locationsIcon from "../../svg icon/erlbrew-nav-icons/locations.svg";
import menuItemsIcon from "../../svg icon/erlbrew-nav-icons/menu-items.svg";
import orderHistoryIcon from "../../svg icon/erlbrew-nav-icons/order-history.svg";
import payrollIcon from "../../svg icon/erlbrew-nav-icons/payroll.svg";
import printSettingsIcon from "../../svg icon/erlbrew-nav-icons/print-settings.svg";
import reportsIcon from "../../svg icon/erlbrew-nav-icons/reports.svg";
import settingsIcon from "../../svg icon/erlbrew-nav-icons/settings.svg";
import staffIcon from "../../svg icon/erlbrew-nav-icons/staff.svg";
import supplierInvoicesIcon from "../../svg icon/erlbrew-nav-icons/supplier-invoices.svg";
import timeKeepingIcon from "../../svg icon/erlbrew-nav-icons/time-keeping.svg";
import transfersIcon from "../../svg icon/erlbrew-nav-icons/transfers.svg";
import zReportIcon from "../../svg icon/erlbrew-nav-icons/z-report.svg";

const NAV_ICON_SOURCES: Record<string, string> = {
  audit: auditLogIcon,
  backup: backupIcon,
  cashdrawer: cashDrawerIcon,
  "chevron-down": chevronDownIcon,
  "chevron-up": chevronUpIcon,
  cogs: cogsIcon,
  customers: customersIcon,
  dashboard: dashboardIcon,
  "display-messages": displayMessagesIcon,
  insights: insightsIcon,
  integrations: integrationsIcon,
  inventory: inventoryIcon,
  locations: locationsIcon,
  menu: menuItemsIcon,
  history: orderHistoryIcon,
  payroll: payrollIcon,
  "print-settings": printSettingsIcon,
  reports: reportsIcon,
  settings: settingsIcon,
  staff: staffIcon,
  suppliers: supplierInvoicesIcon,
  time: timeKeepingIcon,
  transfers: transfersIcon,
  zreport: zReportIcon,
};

export const getNavIcon = (iconName: string): React.ReactNode => {
  const source = NAV_ICON_SOURCES[iconName];
  if (!source) return <span className="text-sm">{iconName}</span>;

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      width="18"
      height="18"
      draggable={false}
      className="block h-[18px] w-[18px] object-contain"
    />
  );
};
