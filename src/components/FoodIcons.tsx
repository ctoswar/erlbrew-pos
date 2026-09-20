import React from "react";

export interface FoodIcon {
  emoji: string;
  label: string;
  icon: React.ReactNode;
}

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const FOOD_ICONS: FoodIcon[] = [
  {
    emoji: "☕", label: "Hot Coffee",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
  },
  {
    emoji: "🍵", label: "Tea",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M12 3c-1.5 0-2.5.5-2.5 2S10 7 10 7s-1.5 0-2-1.5S6.5 3 5 3"/></svg>,
  },
  {
    emoji: "🧋", label: "Bubble Tea",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M8 2l-1 4h10l-1-4"/><path d="M6 6h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/><circle cx="10" cy="16" r="1.5" fill="currentColor"/><circle cx="14" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>,
  },
  {
    emoji: "🥤", label: "Iced Drink",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M6 4h12l-1 16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/><path d="M6 4h12"/><path d="M12 4v10"/><path d="M8 14l4 4 4-4"/></svg>,
  },
  {
    emoji: "🧊", label: "Cold/Ice",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>,
  },
  {
    emoji: "🫖", label: "Teapot",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M5 11h11a5 5 0 0 1 5 5v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1a5 5 0 0 1 5-5Z"/><path d="M5 11V7a3 3 0 0 1 3-3h8"/><path d="M16 11V7a2 2 0 0 0-2-2h-2"/><path d="M12 4c0-1 .5-2 2-2s2 1 2 2"/></svg>,
  },
  {
    emoji: "🥐", label: "Croissant",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M5.5 8c-1.5 1.5-2.5 3-2.5 5s1 3.5 2.5 5c1 1 2 2 4 2s3-1 4-2c1.5-1.5 2.5-3 2.5-5s-1-3.5-2.5-5c-1-1-2-2-4-2s-3 1-4 2Z"/><path d="M8 10c.5-1 1-2 4-2s3.5 1 4 2"/><path d="M7 14c1 1.5 2 2.5 5 2.5s4-1 5-2.5"/></svg>,
  },
  {
    emoji: "🍞", label: "Bread",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M4 9a8 3 0 0 1 16 0v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M8 9c0-1 .5-2 1.5-2S11 8 11 9"/><path d="M13 9c0-1 .5-2 1.5-2S16 8 16 9"/></svg>,
  },
  {
    emoji: "🧁", label: "Cupcake",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M7 20h10l-1-8H8Z"/><path d="M8 12c0-2 1.5-4 4-4s4 2 4 4"/><path d="M9 8c0-1.5.5-2.5 1-3s1.5-1 2-1 1.5.5 2 1 1 1.5 1 3"/><circle cx="12" cy="3" r="1" fill="currentColor"/></svg>,
  },
  {
    emoji: "🥧", label: "Pie",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M4 16h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M4 16a8 8 0 0 1 16 0"/><path d="M8 8c0-1 .5-2 1.5-2S11 7 11 8"/><path d="M13 8c0-1 .5-2 1.5-2S16 7 16 8"/></svg>,
  },
  {
    emoji: "🍋", label: "Lemon",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><ellipse cx="12" cy="14" rx="7" ry="6"/><path d="M12 8c0-2 1-4 3-4s3 2 3 4"/><path d="M15 4c0-1 .5-2 2-2s2 1 2 2"/></svg>,
  },
  {
    emoji: "🌺", label: "Flower/Floral",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><circle cx="12" cy="12" r="3"/><path d="M12 5c0-1 .5-2 2-2s2 1 2 2"/><path d="M12 19c0 1-.5 2-2 2s-2-1-2-2"/><path d="M5 12c-1 0-2-.5-2-2s1-2 2-2"/><path d="M19 12c1 0 2 .5 2 2s-1 2-2 2"/></svg>,
  },
  {
    emoji: "💧", label: "Water",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M12 14c-1.5 0-3-1-3-2.5S10.5 9 12 9"/></svg>,
  },
  {
    emoji: "🌼", label: "Daisy",
    icon: <svg viewBox="0 0 24 24" width="22" height="22" {...s}><circle cx="12" cy="12" r="2"/><circle cx="12" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></svg>,
  },
];

export const getIconByEmoji = (emoji: string): React.ReactNode => {
  const found = FOOD_ICONS.find((f) => f.emoji === emoji);
  return found ? found.icon : <span className="text-lg">{emoji}</span>;
};
