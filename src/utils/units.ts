/**
 * Unit conversion utilities for recipe ingredients.
 *
 * Supports three categories:
 *   Mass:  mg, g, kg   (base unit: g)
 *   Volume: ml, L, oz   (base unit: ml)
 *   Piece:  pcs          (converted via "pack size", see below)
 *
 * When the user enters a quantity in a different unit than the inventory's
 * native unit, we convert to the native unit before saving to the DB.
 *
 * ── Pack size (pcs conversion) ───────────────────────────────────────────────
 * Items counted in `pcs` (e.g. Emborg cartons, Doreen tubs) can define how
 * much one single piece holds: `pack_quantity` + `pack_unit` on the inventory
 * item. Examples:
 *   Emborg 1L  → 1 pcs = 1000 ml   (recipe needs 200 ml → 0.2 pcs)
 *   Doreen 1kg → 1 pcs = 1 kg      (recipe needs 500 g  → 0.5 pcs)
 * With a pack size set, `pcs` becomes convertible with every unit in the
 * pack unit's category (mass↔mass, volume↔volume).
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

// ── Pack size (pcs → mass/volume conversion) ─────────────────────────────────

/** How much one single piece of a `pcs` item contains. */
export interface PackInfo {
  /** Amount contained in one piece (e.g. 1000) */
  quantity: number;
  /** Unit of that amount (e.g. "ml") — must be a mass or volume unit */
  unit: string;
}

/**
 * Read the pack size off an inventory item, or null if there isn't a usable one.
 *
 * Accepts the raw API row (DECIMAL columns may arrive as strings).
 */
export function getPackInfo(item: {
  unit: string;
  pack_quantity?: number | string | null;
  pack_unit?: string | null;
}): PackInfo | null {
  const quantity = Number(item.pack_quantity);
  if (!item.pack_unit || !Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = normaliseUnit(item.pack_unit);
  const cat = getUnitCategory(unit);
  if (!cat || cat === "piece") return null; // needs a mass or volume unit
  return { quantity, unit };
}

/** Get the display-friendly list of compatible units for a given inventory unit. */
export function getCompatibleUnits(inventoryUnit: string, pack?: PackInfo | null): string[] {
  const u = normaliseUnit(inventoryUnit);
  // pcs with a pack size → pieces + every unit of the pack's category
  if (u === "pcs" && pack) {
    const packCat = getUnitCategory(pack.unit);
    if (packCat && packCat !== "piece") {
      return ["pcs", ...UNIT_CATEGORIES[packCat]];
    }
  }
  const cat = getUnitCategory(inventoryUnit);
  if (!cat) return [inventoryUnit]; // unknown unit — no conversion options
  return [...UNIT_CATEGORIES[cat]];
}

// ── Conversion ───────────────────────────────────────────────────────────────

/** Convert within a single category (mass↔mass or volume↔volume). */
function convertSameCategory(quantity: number, from: string, to: string): number {
  if (from === to) return quantity;

  if (getUnitCategory(from) === "mass") {
    const grams = quantity * (MASS_TO_GRAMS[from] ?? 1);
    return grams / (MASS_TO_GRAMS[to] ?? 1);
  }

  if (getUnitCategory(from) === "volume") {
    const ml = quantity * (VOLUME_TO_ML[from] ?? 1);
    return ml / (VOLUME_TO_ML[to] ?? 1);
  }

  return NaN;
}

/**
 * Convert a quantity from `fromUnit` to the inventory's native `toUnit`.
 *
 * - mass ↔ mass and volume ↔ volume convert directly.
 * - If a `pack` size is provided, `pcs` converts against any unit in the
 *   pack unit's category (e.g. 1 pcs = 1000 ml → 200 ml = 0.2 pcs).
 *
 * Returns the converted value, or NaN if units are incompatible.
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  pack?: PackInfo | null,
): number {
  const from = normaliseUnit(fromUnit);
  const to = normaliseUnit(toUnit);

  if (from === to) return quantity;

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);
  if (!fromCat || !toCat) return NaN;

  // pcs ↔ measured unit, using the item's pack size
  if (pack && pack.quantity > 0) {
    const packUnit = normaliseUnit(pack.unit);
    const packCat = getUnitCategory(packUnit);
    if (packCat && packCat !== "piece") {
      if (from === "pcs" && toCat === packCat) {
        return convertSameCategory(quantity * pack.quantity, packUnit, to);
      }
      if (to === "pcs" && fromCat === packCat) {
        const inPackUnit = convertSameCategory(quantity, from, packUnit);
        return inPackUnit / pack.quantity;
      }
    }
  }

  if (fromCat !== toCat || fromCat === "piece") return NaN;
  return convertSameCategory(quantity, from, to);
}

/**
 * Convert an entered recipe quantity to the inventory's native unit for DB storage.
 *
 * Example: user enters 200 ml, inventory unit is "L" → returns 0.2
 * Example: user enters 200 ml, inventory unit is "pcs" with pack 1 pcs = 1000 ml
 *          → returns 0.2
 */
export function toInventoryUnit(
  enteredQty: number,
  enteredUnit: string,
  inventoryUnit: string,
  pack?: PackInfo | null,
): number {
  const result = convertUnit(enteredQty, enteredUnit, inventoryUnit, pack);
  return isNaN(result) ? enteredQty : result; // fallback: store as-is
}

/**
 * Convert a stored DB quantity (in inventory native unit) back to a display unit.
 *
 * Example: DB has 0.2 L, user prefers ml → returns 200
 * Example: DB has 0.2 pcs (pack 1 pcs = 1000 ml), display unit ml → returns 200
 */
export function fromInventoryUnit(
  storedQty: number,
  inventoryUnit: string,
  displayUnit: string,
  pack?: PackInfo | null,
): number {
  const result = convertUnit(storedQty, inventoryUnit, displayUnit, pack);
  return isNaN(result) ? storedQty : result; // fallback
}

/**
 * Given a raw inventory unit string, return a sensible default "recipe unit"
 * that's more human-friendly.
 *
 * Example: inventory unit "L" → default recipe unit "ml"
 *          inventory unit "kg" → default recipe unit "g"
 *          inventory unit "ml" → default recipe unit "ml" (already fine)
 *          inventory unit "pcs" with pack 1 pcs = 1 kg → default recipe unit "kg"
 */
export function defaultRecipeUnit(inventoryUnit: string, pack?: PackInfo | null): string {
  const u = normaliseUnit(inventoryUnit);
  if (u === "pcs") {
    // Pack size defined (e.g. 1 Emborg = 1000 ml) → enter recipes in that unit
    if (pack && getUnitCategory(pack.unit) !== "piece") return normaliseUnit(pack.unit);
    return u;
  }
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
