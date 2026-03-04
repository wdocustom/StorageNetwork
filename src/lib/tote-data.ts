// ═══════════════════════════════════════════════════════════════════════════
// TOTE DATABASE — UPC-based tote identification system
// ═══════════════════════════════════════════════════════════════════════════

export interface ToteDefinition {
  id: string;
  brand: string;
  name: string;
  retailer: string;
  capacity: string;
  upcs: string[];
  dimensions: {
    width: number;   // inches
    depth: number;   // inches
    height: number;  // inches
  };
  color: string;
  imageUrl?: string;
  configKey: "HDX" | "GM"; // Maps to existing tote type in configurator
}

// ── Tote Database ─────────────────────────────────────────────────────────
export const TOTE_DATABASE: ToteDefinition[] = [
  {
    id: "hdx-27-gal",
    brand: "HDX",
    name: "27 Gallon Storage Tote",
    retailer: "Home Depot",
    capacity: "27 Gallon",
    upcs: ["025947172085", "840059616999"],
    dimensions: {
      width: 30.25,
      depth: 20.5,
      height: 14.5,
    },
    color: "Yellow/Black",
    configKey: "HDX",
  },
  {
    id: "greenmade-27-gal",
    brand: "Greenmade",
    name: "27 Gallon Storage Tote",
    retailer: "Costco",
    capacity: "27 Gallon",
    upcs: ["760655026216"],
    dimensions: {
      width: 30.5,
      depth: 20.5,
      height: 15.0,
    },
    color: "Green/Black",
    configKey: "GM",
  },
  {
    id: "project-source-27-gal",
    brand: "Project Source",
    name: "27 Gallon Storage Tote",
    retailer: "Lowe's",
    capacity: "27 Gallon",
    upcs: ["840059628008", "840059616984", "075457685703", "079682126115", "899441002823"],
    dimensions: {
      width: 30.5,
      depth: 20.5,
      height: 14.75,
    },
    color: "Yellow/Black",
    configKey: "GM", // 20-3/4" opening — same size class as GreenMade
  },
  {
    id: "performax-27-gal",
    brand: "Performax",
    name: "27 Gallon Storage Tote",
    retailer: "Menards",
    capacity: "27 Gallon",
    upcs: [],
    dimensions: {
      width: 30.25,
      depth: 20.5,
      height: 14.5,
    },
    color: "Yellow/Black",
    configKey: "HDX", // 19-3/4" opening — same size class as HDX
  },
  {
    id: "hyper-tough-27-gal",
    brand: "Hyper Tough",
    name: "27 Gallon Storage Tote",
    retailer: "Walmart / Sam's Club",
    capacity: "27 Gallon",
    upcs: [],
    dimensions: {
      width: 30.5,
      depth: 20.5,
      height: 14.75,
    },
    color: "Yellow/Black",
    configKey: "GM", // 20-3/4" opening — same size class as GreenMade
  },
];

// ── UPC Lookup Map (for O(1) lookups) ─────────────────────────────────────
const UPC_LOOKUP_MAP: Map<string, ToteDefinition> = new Map();

// Build the lookup map on module load
TOTE_DATABASE.forEach((tote) => {
  tote.upcs.forEach((upc) => {
    UPC_LOOKUP_MAP.set(upc, tote);
    // Also add without leading zeros (some scanners strip them)
    UPC_LOOKUP_MAP.set(upc.replace(/^0+/, ""), tote);
  });
});

// ── Helper Functions ──────────────────────────────────────────────────────

/**
 * Look up a tote by its UPC barcode
 * @param code - The UPC barcode string
 * @returns The matching ToteDefinition or undefined if not found
 */
export function getToteByUPC(code: string): ToteDefinition | undefined {
  // Normalize the code (remove spaces, dashes)
  const normalizedCode = code.replace(/[\s-]/g, "").trim();

  // Try exact match first
  let tote = UPC_LOOKUP_MAP.get(normalizedCode);
  if (tote) return tote;

  // Try without leading zeros
  tote = UPC_LOOKUP_MAP.get(normalizedCode.replace(/^0+/, ""));
  if (tote) return tote;

  // Try padding to 12 digits (standard UPC-A)
  const padded = normalizedCode.padStart(12, "0");
  tote = UPC_LOOKUP_MAP.get(padded);
  if (tote) return tote;

  return undefined;
}

/**
 * Get a tote by its ID
 * @param id - The tote ID (e.g., "hdx-27-gal")
 * @returns The matching ToteDefinition or undefined
 */
export function getToteById(id: string): ToteDefinition | undefined {
  return TOTE_DATABASE.find((tote) => tote.id === id);
}

/**
 * Get all totes for manual selection
 * @returns Array of all tote definitions
 */
export function getAllTotes(): ToteDefinition[] {
  return TOTE_DATABASE;
}

/**
 * Format tote dimensions as a human-readable string
 * @param tote - The tote definition
 * @returns Formatted dimension string
 */
export function formatToteDimensions(tote: ToteDefinition): string {
  const { width, depth, height } = tote.dimensions;
  return `${width}" W × ${depth}" D × ${height}" H`;
}
