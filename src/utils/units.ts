/**
 * Unit conversion utilities for recipe ingredients.
 *
 * Supports three categories:
 *   Mass:  mg, g, kg   (base unit: g)
 *   Volume: ml, L, oz   (base unit: ml)
 *   Piece:  pcs          (no conversion)
 *
 * When the user enters a quantity in a different unit than the inventory's
 * native unit, we convert to the native unit before saving to the DB.
 */

// ── Conversion factors to base unit ──────────────────────────────────────────

const MASS_TO_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  L: 1000,
  oz: 29.5735,
};

// All supported units grouped by category
export const UNIT_CATEGORIES = {
  mass: ["mg", "g", "kg"],
  volume: ["ml", "L", "oz"],
  piece: ["pcs"],
} as const;

export type UnitCategory = keyof typeof UNIT_CATEGORIES;
export type Unit = (typeof UNIT_CATEGORIES)[UnitCategory][number];

// ── Detection ────────────────────────────────────────────────────────────────

/** Normalise a raw inventory-unit string to a known unit key. */
function normaliseUnit(raw: string): string {
  const s = raw.trim().toLowerCase();
  // Handle common variants
  if (s === "l" || s === "liter" || s === "litre" || s === "liters" || s === "litres") return "L";
  if (s === "ml" || s === "milliliter" || s === "millilitre" || s === "milliliters" || s === "millilitres") return "ml";
  if (s === "kg" || s === "kilogram" || s === "kilograms") return "kg";
  if (s === "g" || s === "gram" || s === "grams") return "g";
  if (s === "mg" || s === "milligram" || s === "milligrams") return "mg";
  if (s === "oz" || s === "ounce" || s === "ounces") return "oz";
  if (s === "pcs" || s === "piece" || s === "pieces") return "pcs";
  return s; // return as-is if unknown (will be treated as its own unit)
}

/** Return the category a unit belongs to, or null if unknown. */
export function getUnitCategory(unit: string): UnitCategory | null {
  const u = normaliseUnit(unit);
  if ((UNIT_CATEGORIES.mass as readonly string[]).includes(u)) return "mass";
  if ((UNIT_CATEGORIES.volume as readonly string[]).includes(u)) return "volume";
  if ((UNIT_CATEGORIES.piece as readonly string[]).includes(u)) return "piece";
  return null;
}

/** Get the display-friendly list of compatible units for a given inventory unit. */
export function getCompatibleUnits(inventoryUnit: string): string[] {
  const cat = getUnitCategory(inventoryUnit);
  if (!cat) return [inventoryUnit]; // unknown unit — no conversion options
  return [...UNIT_CATEGORIES[cat]];
}

// ── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a quantity from `fromUnit` to the inventory's native `toUnit`.
 * Both units must be in the same category (mass↔mass, volume↔volume).
 * Returns the converted value, or NaN if units are incompatible.
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  const from = normaliseUnit(fromUnit);
  const to = normaliseUnit(toUnit);

  if (from === to) return quantity;

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);

  if (!fromCat || !toCat || fromCat !== toCat || fromCat === "piece") return NaN;

  // Mass conversion
  if (fromCat === "mass") {
    const grams = quantity * (MASS_TO_GRAMS[from] ?? 1);
    return grams / (MASS_TO_GRAMS[to] ?? 1);
  }

  // Volume conversion
  if (fromCat === "volume") {
    const ml = quantity * (VOLUME_TO_ML[from] ?? 1);
    return ml / (VOLUME_TO_ML[to] ?? 1);
  }

  return NaN;
}

/**
 * Convert an entered recipe quantity to the inventory's native unit for DB storage.
 *
 * Example: user enters 200 ml, inventory unit is "L" → returns 0.2
 */
export function toInventoryUnit(
  enteredQty: number,
  enteredUnit: string,
  inventoryUnit: string,
): number {
  const result = convertUnit(enteredQty, enteredUnit, inventoryUnit);
  return isNaN(result) ? enteredQty : result; // fallback: store as-is
}

/**
 * Convert a stored DB quantity (in inventory native unit) back to a display unit.
 *
 * Example: DB has 0.2 L, user prefers ml → returns 200
 */
export function fromInventoryUnit(
  storedQty: number,
  inventoryUnit: string,
  displayUnit: string,
): number {
  const result = convertUnit(storedQty, inventoryUnit, displayUnit);
  return isNaN(result) ? storedQty : result; // fallback
}

/**
 * Given a raw inventory unit string, return a sensible default "recipe unit"
 * that's more human-friendly.
 *
 * Example: inventory unit "L" → default recipe unit "ml"
 *          inventory unit "kg" → default recipe unit "g"
 *          inventory unit "ml" → default recipe unit "ml" (already fine)
 */
export function defaultRecipeUnit(inventoryUnit: string): string {
  const u = normaliseUnit(inventoryUnit);
  if (u === "L") return "ml";
  if (u === "kg") return "g";
  if (u === "mg") return "g";
  if (u === "oz") return "ml";
  // ml, g, pcs — keep as-is
  return u;
}

/**
 * Format a quantity for display with a reasonable number of decimals.
 */
export function formatQty(value: number, unit: string): string {
  const u = normaliseUnit(unit);
  // Small units → more decimals; large units → fewer
  if (u === "mg" || u === "g") return value < 1 ? value.toFixed(4) : value.toFixed(2);
  if (u === "ml" || u === "L" || u === "oz") return value < 1 ? value.toFixed(4) : value.toFixed(2);
  return value.toFixed(2);
}
