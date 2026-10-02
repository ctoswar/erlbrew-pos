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
import { installAudioUnlock } from "./utils/sound";
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
  const [authChecking, setAuthChecking] = useState(true);

  // Persist auth state to localStorage so refresh doesn't log out
  useEffect(() => {
    if (staff) localStorage.setItem(AUTH_KEY, JSON.stringify(staff));
    else localStorage.removeItem(AUTH_KEY);
  }, [staff]);

  // Autoplay policy: unlock the shared AudioContext from the first gesture on any
  // screen. Session restore skips LoginScreen, so that call alone isn't enough.
  useEffect(() => {
    installAudioUnlock();
  }, []);

  // Re-validate cached staff on mount so role/name/color changes are picked up
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    const token = getAuthToken();
    if (!stored || !token) {
      if (stored || token) {
        setStaff(null);
        clearAuthToken();
      }
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    apiAdminGet<Staff>("/staff/me")
      .then((fresh) => {
        if (!cancelled) {
          setStaff({ ...fresh, locationId: (fresh as Staff & { location_id?: number | null }).location_id ?? fresh.locationId });
          setAuthChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStaff(null);
          clearAuthToken();
          setAuthChecking(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ?customer → fullscreen customer-facing display (second monitor)
  if (new URLSearchParams(window.location.search).has("customer")) {
    return <CustomerDisplay />;
  }

  return (
    <LocationProvider staff={staff}>
      {authChecking ? (
        <div className="flex h-screen items-center justify-center bg-erl-base text-sm text-erl-text-muted">Checking session…</div>
      ) : !staff ? (
        <LoginScreen onLogin={setStaff} />
      ) : staff.role === 'Manager' ? (
        <>
          <OnlineStatus />
          <AdminDashboard
            staff={staff}
            onLogout={() => setStaff(null)}
          />
        </>
      ) : (
        <>
          <OnlineStatus />
          <POSScreen
            staff={staff}
            onLogout={() => setStaff(null)}
          />
        </>
      )}
    </LocationProvider>
  );
};

export default App;
