import React, { useState, useEffect } from "react";
import { Staff } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { POSScreen } from "./components/POSScreen";
import { CustomerDisplay } from "./components/CustomerDisplay";
import { AdminDashboard } from "./components/AdminDashboard";
import { getStoredTheme } from "./hooks/useTheme";
import { getStoredFontSize, applyFontSize } from "./hooks/useFontSize";
import "./styles/global.css";

// Apply stored theme on app load
const storedTheme = getStoredTheme();
if (storedTheme === 'white') {
  document.documentElement.setAttribute('data-theme', 'white');
}

// Apply stored font size on app load
applyFontSize(getStoredFontSize());

const AUTH_KEY = 'erlbrew_staff';
const App: React.FC = () => {
  const [staff, setStaff] = useState<Staff | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Persist auth state to localStorage so refresh doesn't log out
  useEffect(() => {
    if (staff) localStorage.setItem(AUTH_KEY, JSON.stringify(staff));
    else localStorage.removeItem(AUTH_KEY);
  }, [staff]);

  // ?customer → fullscreen customer-facing display (second monitor)
  if (window.location.search.includes("customer")) {
    return <CustomerDisplay />;
  }

  if (!staff) {
    return <LoginScreen onLogin={setStaff} />;
  }

  // Manager role goes to Admin Dashboard, others go to POS
  if (staff.role === 'Manager') {
    return (
      <AdminDashboard
        staff={staff}
        onLogout={() => setStaff(null)}
      />
    );
  }

  return (
    <POSScreen
      staff={staff}
      onLogout={() => setStaff(null)}
    />
  );
};

export default App;
