// ═══════════════════════════════════════════════════════════════════════════
// SCAN DATA — UPC-based tote identification for AI measurement
// ═══════════════════════════════════════════════════════════════════════════

export interface ScanToteData {
  id: string;
  brand: string;
  name: string;
  retailer: string;
  width: number;      // Width in inches (used as reference for AI measurement)
  depth: number;      // Depth in inches
  height: number;     // Height in inches
  configKey: "HDX" | "GM";
}

// ── UPC to Tote Database ──────────────────────────────────────────────────
export const TOTE_DATABASE: Record<string, ScanToteData> = {
  // HDX 27 Gallon (Home Depot) - Multiple UPCs
  "025947172085": {
    id: "hdx-27-gal",
    brand: "HDX",
    name: "27 Gallon Storage Tote",
    retailer: "Home Depot",
    width: 30.25,
    depth: 20.5,
    height: 14.5,
    configKey: "HDX",
  },
  "840059616999": {
    id: "hdx-27-gal",
    brand: "HDX",
    name: "27 Gallon Storage Tote",
    retailer: "Home Depot",
    width: 30.25,
    depth: 20.5,
    height: 14.5,
    configKey: "HDX",
  },

  // Greenmade 27 Gallon (Costco)
  "760655026216": {
    id: "greenmade-27-gal",
    brand: "Greenmade",
    name: "27 Gallon Storage Tote",
    retailer: "Costco",
    width: 30.5,
    depth: 20.5,
    height: 15.0,
    configKey: "GM",
  },

  // Project Source 27 Gallon (Lowe's) — Multiple UPCs
  "840059628008": {
    id: "project-source-27-gal",
    brand: "Project Source",
    name: "27 Gallon Storage Tote",
    retailer: "Lowe's",
    width: 30.5,
    depth: 20.5,
    height: 14.75,
    configKey: "GM",
  },
  "840059616984": {
    id: "project-source-27-gal",
    brand: "Project Source",
    name: "27 Gallon Storage Tote",
    retailer: "Lowe's",
    width: 30.5,
    depth: 20.5,
    height: 14.75,
    configKey: "GM",
  },
  "075457685703": {
    id: "project-source-27-gal",
    brand: "Project Source",
    name: "27 Gallon Storage Tote",
    retailer: "Lowe's",
    width: 30.5,
    depth: 20.5,
    height: 14.75,
    configKey: "GM",
  },
  "079682126115": {
    id: "project-source-27-gal",
    brand: "Project Source",
    name: "27 Gallon Storage Tote",
    retailer: "Lowe's",
    width: 30.5,
    depth: 20.5,
    height: 14.75,
    configKey: "GM",
  },
};

// ── Helper Functions ──────────────────────────────────────────────────────

/**
 * Look up a tote by its UPC barcode
 * @param code - The UPC barcode string
 * @returns The matching ScanToteData or undefined
 */
export function getToteByUPC(code: string): ScanToteData | undefined {
  // Normalize the code (remove spaces, dashes)
  const normalizedCode = code.replace(/[\s-]/g, "").trim();

  // Try exact match first
  let tote = TOTE_DATABASE[normalizedCode];
  if (tote) return tote;

  // Try without leading zeros
  const stripped = normalizedCode.replace(/^0+/, "");
  for (const [upc, data] of Object.entries(TOTE_DATABASE)) {
    if (upc.replace(/^0+/, "") === stripped) {
      return data;
    }
  }

  // Try padding to 12 digits (standard UPC-A)
  const padded = normalizedCode.padStart(12, "0");
  tote = TOTE_DATABASE[padded];
  if (tote) return tote;

  return undefined;
}

/**
 * Get all unique totes for manual selection
 * @returns Array of unique tote definitions
 */
export function getAllUniqueTotes(): ScanToteData[] {
  const seen = new Set<string>();
  const totes: ScanToteData[] = [];

  for (const tote of Object.values(TOTE_DATABASE)) {
    if (!seen.has(tote.id)) {
      seen.add(tote.id);
      totes.push(tote);
    }
  }

  return totes;
}

/**
 * Format tote width for display
 */
export function formatToteWidth(tote: ScanToteData): string {
  return `${tote.width}"`;
}
