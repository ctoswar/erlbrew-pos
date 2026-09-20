import React, { useState, useEffect } from "react";
import { Staff } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { POSScreen } from "./components/POSScreen";
import { CustomerDisplay } from "./components/CustomerDisplay";
import { AdminDashboard } from "./components/AdminDashboard";
import { OnlineStatus } from "./components/OnlineStatus";
import { LocationProvider } from "./contexts/LocationContext";
import { getStoredTheme } from "./hooks/useTheme";
import { getStoredFontSize, applyFontSize } from "./hooks/useFontSize";
import { apiAdminGet, getAuthToken, clearAuthToken } from "./utils/api";
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

  // Re-validate cached staff on mount so role/name/color changes are picked up
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    const token = getAuthToken();
    if (!stored || !token) {
      if (stored || token) {
        setStaff(null);
        clearAuthToken();
      }
      return;
    }

    let cancelled = false;
    apiAdminGet<Staff>("/staff/me")
      .then((fresh) => {
        if (!cancelled) setStaff(fresh);
      })
      .catch(() => {
        if (!cancelled) {
          setStaff(null);
          clearAuthToken();
        }
      });

    return () => { cancelled = true; };
  }, []);

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
      <LocationProvider>
        <OnlineStatus />
        <AdminDashboard
          staff={staff}
          onLogout={() => setStaff(null)}
        />
      </LocationProvider>
    );
  }

  return (
    <>
      <OnlineStatus />
      <POSScreen
        staff={staff}
        onLogout={() => setStaff(null)}
      />
    </>
  );
};

export default App;
