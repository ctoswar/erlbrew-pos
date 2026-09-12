import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Location } from "../types";
import { apiGet } from "../utils/api";

interface LocationContextValue {
  locations: Location[];
  currentLocationId: number | null; // null = "All Locations"
  currentLocation: Location | null;
  loading: boolean;
  setCurrentLocationId: (id: number | null) => void;
  refresh: () => void;
}

const LocationContext = createContext<LocationContextValue>({
  locations: [],
  currentLocationId: null,
  currentLocation: null,
  loading: false,
  setCurrentLocationId: () => {},
  refresh: () => {},
});

const STORAGE_KEY = "erlbrew_location_id";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Location[]>("/locations");
      setLocations(data);
      // If stored location no longer exists, reset to null
      if (currentLocationId !== null && !data.find((l) => l.id === currentLocationId)) {
        setCurrentLocationIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to load locations:", e);
    } finally {
      setLoading(false);
    }
  }, [currentLocationId]);

  useEffect(() => {
    fetchLocations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setCurrentLocationId = useCallback((id: number | null) => {
    setCurrentLocationIdState(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  const currentLocation = currentLocationId !== null
    ? locations.find((l) => l.id === currentLocationId) || null
    : null;

  return (
    <LocationContext.Provider
      value={{
        locations,
        currentLocationId,
        currentLocation,
        loading,
        setCurrentLocationId,
        refresh: fetchLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
