import React from "react";
import { useLocation } from "../contexts/LocationContext";
import { AnimatedSelect } from "./AnimatedSelect";

interface Props {
  className?: string;
}

export const LocationSelector: React.FC<Props> = ({ className = "" }) => {
  const { locations, currentLocationId, setCurrentLocationId, loading } = useLocation();

  if (loading || locations.length <= 1) return null;

  const options = [
    { value: "", label: "All Locations" },
    ...locations
      .filter((l) => l.is_active)
      .map((l) => ({ value: String(l.id), label: l.name })),
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-[8px] text-erl-text-faint tracking-wide uppercase whitespace-nowrap">
        Location
      </label>
      <AnimatedSelect
        options={options}
        value={currentLocationId != null ? String(currentLocationId) : ""}
        onChange={(val) => setCurrentLocationId(val === "" ? null : Number(val))}
        className="min-w-[120px]"
      />
    </div>
  );
};
