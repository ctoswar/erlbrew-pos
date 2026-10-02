import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Location, Staff } from "../types";
import { apiGet } from "../utils/api";

interface LocationContextValue {
  locations: Location[];
  currentLocationId: number | null;
  currentLocation: Location | null;
  deviceLocationId: number | null;
  isDeviceConfigured: boolean;
  staffLocationLocked: boolean;
  loading: boolean;
  setCurrentLocationId: (id: number | null) => void;
  configureDeviceLocation: (id: number) => void;
  refresh: () => void;
}

const LocationContext = createContext<LocationContextValue>({
  locations: [],
  currentLocationId: null,
  currentLocation: null,
  deviceLocationId: null,
  isDeviceConfigured: false,
  staffLocationLocked: false,
  loading: false,
  setCurrentLocationId: () => {},
  configureDeviceLocation: () => {},
  refresh: () => {},
});

const DEVICE_LOCATION_KEY = "erlbrew_device_location_id";
const CURRENT_LOCATION_KEY = "erlbrew_location_id";

function readStoredLocation(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const value = Number(stored);
  return Number.isInteger(value) && value > 0 ? value : null;
}

interface Props {
  children: React.ReactNode;
  staff?: Staff | null;
}

export function LocationProvider({ children, staff = null }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [deviceLocationId, setDeviceLocationId] = useState<number | null>(() => {
    const current = readStoredLocation(DEVICE_LOCATION_KEY);
    if (current !== null) return current;

    // Migrate the selector key used by the earlier multi-location UI so a
    // configured terminal does not unexpectedly ask for setup again.
    const legacy = readStoredLocation(CURRENT_LOCATION_KEY);
    if (legacy !== null) localStorage.setItem(DEVICE_LOCATION_KEY, String(legacy));
    return legacy;
  });
  const [currentLocationId, setCurrentLocationIdState] = useState<number | null>(() => (
    readStoredLocation(CURRENT_LOCATION_KEY) ?? readStoredLocation(DEVICE_LOCATION_KEY)
  ));
  const [loading, setLoading] = useState(true);
  const staffLocationLocked = Boolean(staff && staff.role !== "Manager");

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Location[]>("/locations");
      setLocations(data);

      const valid = (id: number | null): boolean => id === null || Boolean(data.find((location) => location.id === id && location.is_active));
      if (!valid(deviceLocationId)) {
        setDeviceLocationId(null);
        localStorage.removeItem(DEVICE_LOCATION_KEY);
      }
      if (!valid(currentLocationId) && !staffLocationLocked) {
        setCurrentLocationIdState(null);
        localStorage.removeItem(CURRENT_LOCATION_KEY);
      }
    } catch (e) {
      console.error("Failed to load locations:", e);
    } finally {
      setLoading(false);
    }
  }, [currentLocationId, deviceLocationId, staffLocationLocked]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // A regular staff member's assignment always wins over the terminal's
  // manager-selected location. Managers retain the terminal selection.
  useEffect(() => {
    if (staffLocationLocked && staff?.locationId) {
      setCurrentLocationIdState(staff.locationId);
      localStorage.setItem(CURRENT_LOCATION_KEY, String(staff.locationId));
    }
  }, [staff?.locationId, staffLocationLocked]);

  const configureDeviceLocation = useCallback((id: number) => {
    setDeviceLocationId(id);
    setCurrentLocationIdState(id);
    localStorage.setItem(DEVICE_LOCATION_KEY, String(id));
    localStorage.setItem(CURRENT_LOCATION_KEY, String(id));
  }, []);

  const setCurrentLocationId = useCallback((id: number | null) => {
    if (staffLocationLocked) return;
    setCurrentLocationIdState(id);
    if (id === null) localStorage.removeItem(CURRENT_LOCATION_KEY);
    else localStorage.setItem(CURRENT_LOCATION_KEY, String(id));
  }, [staffLocationLocked]);

  const currentLocation = currentLocationId !== null
    ? locations.find((location) => location.id === currentLocationId) || null
    : null;

  return (
    <LocationContext.Provider
      value={{
        locations,
        currentLocationId,
        currentLocation,
        deviceLocationId,
        isDeviceConfigured: deviceLocationId !== null,
        staffLocationLocked,
        loading,
        setCurrentLocationId,
        configureDeviceLocation,
        refresh: fetchLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  return useContext(LocationContext);
}
