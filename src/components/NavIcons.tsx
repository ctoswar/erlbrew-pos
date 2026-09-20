import React from "react";

export const getNavIcon = (iconName: string): React.ReactNode => {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (iconName) {
    case "dashboard":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="3" y="3" width="7" height="9" rx="1.5" fill="#C4956A" stroke="#8B5E3C"/><rect x="14" y="3" width="7" height="5" rx="1.5" fill="#E8D5C4" stroke="#8B5E3C"/><rect x="14" y="12" width="7" height="9" rx="1.5" fill="#D4A87A" stroke="#8B5E3C"/><rect x="3" y="16" width="7" height="5" rx="1.5" fill="#B8956A" stroke="#8B5E3C"/></svg>;
    case "reports":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><path d="M3 3v18h18" stroke="#8B5E3C"/><path d="M7 14l3-3 4 4 5-5" stroke="#C4956A" strokeWidth="2"/><circle cx="7" cy="14" r="1.5" fill="#C4956A"/><circle cx="10" cy="11" r="1.5" fill="#C4956A"/><circle cx="14" cy="15" r="1.5" fill="#C4956A"/><circle cx="19" cy="10" r="1.5" fill="#C4956A"/></svg>;
    case "history":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="5" y="4" width="14" height="17" rx="2" fill="#E8D5C4" stroke="#8B5E3C"/><path d="M9 4V2h6v2" fill="none" stroke="#8B5E3C"/><line x1="9" y1="10" x2="15" y2="10" stroke="#8B5E3C"/><line x1="9" y1="14" x2="13" y2="14" stroke="#8B5E3C"/><line x1="9" y1="18" x2="11" y2="18" stroke="#8B5E3C"/></svg>;
    case "customers":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><circle cx="12" cy="8" r="4" fill="#C8E6C9" stroke="#4A7C59"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" fill="#C8E6C9" stroke="#4A7C59"/></svg>;
    case "menu":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><path d="M17 8h1a4 4 0 1 1 0 8h-1" stroke="#C4956A"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" fill="#E8D5C4" stroke="#8B5E3C"/><line x1="6" y1="2" x2="6" y2="4" stroke="#8B5E3C"/><line x1="10" y1="2" x2="10" y2="4" stroke="#8B5E3C"/><line x1="14" y1="2" x2="14" y2="4" stroke="#8B5E3C"/></svg>;
    case "staff":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><circle cx="9" cy="8" r="4" fill="#BBDEFB" stroke="#1565C0"/><circle cx="17" cy="10" r="3" fill="#90CAF9" stroke="#1565C0"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" fill="#BBDEFB" stroke="#1565C0"/><path d="M15 21c0-3 2.5-5 5-5s5 2 5 5" fill="#90CAF9" stroke="#1565C0"/></svg>;
    case "time":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><circle cx="12" cy="13" r="8" fill="#F5E6D3" stroke="#8B5E3C"/><path d="M12 9v4l2 2" stroke="#8B5E3C" strokeWidth="2"/><path d="M12 5V2" stroke="#8B5E3C"/><path d="M10 2h4" stroke="#8B5E3C"/></svg>;
    case "payroll":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="2" y="6" width="20" height="12" rx="2" fill="#C8E6C9" stroke="#4A7C59"/><circle cx="12" cy="12" r="3" fill="#E8F5E9" stroke="#4A7C59"/><path d="M6 12h.01M18 12h.01" stroke="#4A7C59" strokeWidth="2"/></svg>;
    case "inventory":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="3" y="8" width="18" height="12" rx="2" fill="#D7CCC8" stroke="#5D4037"/><path d="M3 8l2-4h14l2 4" fill="#BCAAA4" stroke="#5D4037"/><line x1="10" y1="12" x2="14" y2="12" stroke="#5D4037"/></svg>;
    case "transfers":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><path d="M17 3l4 4-4 4" fill="none" stroke="#7B1FA2" strokeWidth="2"/><path d="M21 7H8" stroke="#7B1FA2" strokeWidth="2"/><path d="M7 21l-4-4 4-4" fill="none" stroke="#7B1FA2" strokeWidth="2"/><path d="M3 17h13" stroke="#7B1FA2" strokeWidth="2"/></svg>;
    case "zreport":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="5" y="4" width="14" height="17" rx="2" fill="#FFF9C4" stroke="#F9A825"/><path d="M9 4V2h6v2" fill="none" stroke="#F9A825"/><line x1="9" y1="10" x2="15" y2="10" stroke="#F9A825"/><line x1="9" y1="14" x2="13" y2="14" stroke="#F9A825"/><path d="M9 18h2l2-3" fill="none" stroke="#F9A825"/></svg>;
    case "cashdrawer":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="3" y="8" width="18" height="12" rx="2" fill="#FFF9C4" stroke="#F9A825"/><rect x="3" y="4" width="18" height="4" rx="1" fill="#FFECB3" stroke="#F9A825"/><circle cx="12" cy="14" r="3" fill="#FFECB3" stroke="#F9A825"/><path d="M12 12v4" stroke="#F9A825"/></svg>;
    case "cogs":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><path d="M3 3v18h18" stroke="#8B5E3C"/><path d="M7 16l3-4 4 3 5-6" stroke="#C4956A" strokeWidth="2"/><path d="M7 16l3-4 4 3 5-6" fill="none" stroke="#C4956A" strokeWidth="2"/><circle cx="7" cy="16" r="1.5" fill="#C4956A"/><circle cx="10" cy="12" r="1.5" fill="#C4956A"/><circle cx="14" cy="15" r="1.5" fill="#C4956A"/><circle cx="19" cy="9" r="1.5" fill="#C4956A"/></svg>;
    case "suppliers":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><rect x="5" y="4" width="14" height="17" rx="2" fill="#E8EAF6" stroke="#3F51B5"/><path d="M9 4V2h6v2" fill="none" stroke="#3F51B5"/><line x1="9" y1="10" x2="15" y2="10" stroke="#3F51B5"/><line x1="9" y1="14" x2="13" y2="14" stroke="#3F51B5"/><line x1="9" y1="18" x2="11" y2="18" stroke="#3F51B5"/></svg>;
    case "locations":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" fill="#F8BBD0" stroke="#C2185B"/><circle cx="12" cy="9" r="2.5" fill="#FFF" stroke="#C2185B"/></svg>;
    case "audit":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><circle cx="10" cy="10" r="6" fill="#E1BEE7" stroke="#7B1FA2"/><path d="M15 15l5 5" stroke="#7B1FA2" strokeWidth="2"/></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" width="18" height="18" {...s}><circle cx="12" cy="12" r="3" fill="#D7CCC8" stroke="#5D4037"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#5D4037"/></svg>;
    default:
      return <span className="text-sm">{iconName}</span>;
  }
};
