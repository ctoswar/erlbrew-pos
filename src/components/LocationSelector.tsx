import React from "react";
import { useLocation } from "../contexts/LocationContext";

interface Props {
  className?: string;
}

export const LocationSelector: React.FC<Props> = ({ className = "" }) => {
  const { locations, currentLocationId, setCurrentLocationId, loading } = useLocation();

  if (loading || locations.length <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-[8px] text-erl-text-faint tracking-wide uppercase whitespace-nowrap">
        Location
      </label>
      <select
        value={currentLocationId ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          setCurrentLocationId(val === "" ? null : Number(val));
        }}
        className="bg-erl-base border border-erl-border-default rounded-md text-erl-text-primary px-2 py-1 text-[11px] min-w-[120px]"
      >
        <option value="">All Locations</option>
        {locations
          .filter((l) => l.is_active)
          .map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
      </select>
    </div>
  );
};
