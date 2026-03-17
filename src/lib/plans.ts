// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS CATALOG — Purchasable build plans for tote organizer units
//
// Each plan defines a unit configuration that customers can buy as a
// comprehensive, printable DIY guide. Plans are dynamically generated
// from the same build engine that powers the installer dashboard.
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanConfig {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
  hasWheels: boolean;
  hasTop: boolean;
}

export interface PlanCatalogItem {
  /** URL-safe slug, e.g. "4x4-hdx-wheels-top" */
  slug: string;
  /** Display name, e.g. "4×4 Tote Organizer" */
  name: string;
  /** Short marketing description */
  description: string;
  /** Number of totes this unit holds */
  toteCount: number;
  /** Approximate finished dimensions for display */
  approxDimensions: { width: string; height: string; depth: string };
  /** Skill level: beginner, intermediate, advanced */
  skill: "beginner" | "intermediate" | "advanced";
  /** Estimated build time in hours */
  buildTimeHours: number;
  /** Price to purchase the plan (in dollars) */
  price: number;
  /** The unit config that drives plan generation */
  config: PlanConfig;
  /** Tags for filtering */
  tags: string[];
  /** Whether this is a featured/popular plan */
  featured?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Plan Catalog — All purchasable configurations
// ═══════════════════════════════════════════════════════════════════════════

export const PLAN_CATALOG: PlanCatalogItem[] = [
  // ── Small Units (Beginner) ──────────────────────────────────────────────
  {
    slug: "2x2-hdx-starter",
    name: "2×2 Starter Unit",
    description: "Perfect first project. 4 totes, compact footprint — fits a closet or small wall.",
    toteCount: 4,
    approxDimensions: { width: '46-1/2"', height: '32"', depth: '30"' },
    skill: "beginner",
    buildTimeHours: 1.5,
    price: 12,
    config: { cols: 2, rows: 2, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false },
    tags: ["small", "beginner", "closet", "starter"],
  },
  {
    slug: "2x3-hdx-basic",
    name: "2×3 Basic Unit",
    description: "6-tote organizer. Great for a laundry room, utility closet, or side wall.",
    toteCount: 6,
    approxDimensions: { width: '46-1/2"', height: '48"', depth: '30"' },
    skill: "beginner",
    buildTimeHours: 2,
    price: 12,
    config: { cols: 2, rows: 3, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false },
    tags: ["small", "beginner", "laundry"],
  },

  // ── Medium Units (Intermediate) ────────────────────────────────────────
  {
    slug: "2x4-hdx-worktop",
    name: "2×4 Worktop Unit",
    description: "8-tote tower with plywood work surface on top. Ideal for a workbench combo.",
    toteCount: 8,
    approxDimensions: { width: '46-1/2"', height: '64"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 2.5,
    price: 15,
    config: { cols: 2, rows: 4, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: true },
    tags: ["medium", "workbench", "worktop"],
  },
  {
    slug: "3x3-hdx",
    name: "3×3 Mid-Size Unit",
    description: "9-tote organizer. A solid mid-range build for a single garage wall section.",
    toteCount: 9,
    approxDimensions: { width: '65-1/4"', height: '48"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 2.5,
    price: 15,
    config: { cols: 3, rows: 3, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false },
    tags: ["medium", "garage"],
  },
  {
    slug: "3x4-hdx-wheels",
    name: "3×4 Rolling Unit",
    description: "12-tote organizer on heavy-duty casters. Roll it where you need it.",
    toteCount: 12,
    approxDimensions: { width: '65-1/4"', height: '67"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 3,
    price: 15,
    config: { cols: 3, rows: 4, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: false },
    tags: ["medium", "rolling", "casters", "mobile"],
  },

  // ── Large Units (Popular) ──────────────────────────────────────────────
  {
    slug: "4x4-hdx-wheels-top",
    name: "4×4 Full Build",
    description: "The Cornhusker. 16-tote powerhouse on wheels with a plywood work surface. Our most popular plan.",
    toteCount: 16,
    approxDimensions: { width: '86-1/2"', height: '69-3/4"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 3.5,
    price: 20,
    config: { cols: 4, rows: 4, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: true },
    tags: ["large", "popular", "cornhusker", "wheels", "worktop"],
    featured: true,
  },
  {
    slug: "4x4-hdx-stationary",
    name: "4×4 Stationary Unit",
    description: "16-tote wall unit without wheels. Maximum storage, lowest profile.",
    toteCount: 16,
    approxDimensions: { width: '86-1/2"', height: '64"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 3,
    price: 18,
    config: { cols: 4, rows: 4, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false },
    tags: ["large", "wall-mount", "stationary"],
  },
  {
    slug: "4x5-hdx-wheels-top",
    name: "4×5 XL Unit",
    description: "20-tote monster with casters and worktop. For serious organizers.",
    toteCount: 20,
    approxDimensions: { width: '86-1/2"', height: '82-3/4"', depth: '30"' },
    skill: "advanced",
    buildTimeHours: 4,
    price: 22,
    config: { cols: 4, rows: 5, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: true },
    tags: ["xlarge", "advanced", "maximum"],
  },

  // ── Costco Tote Variants ───────────────────────────────────────────────
  {
    slug: "4x4-gm-wheels-top",
    name: "4×4 Costco (Greenmade)",
    description: "16-tote full build sized for Greenmade/Costco 27-gallon totes.",
    toteCount: 16,
    approxDimensions: { width: '90-1/2"', height: '69-3/4"', depth: '30"' },
    skill: "intermediate",
    buildTimeHours: 3.5,
    price: 20,
    config: { cols: 4, rows: 4, toteType: "GM", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: true },
    tags: ["large", "costco", "greenmade", "wheels", "worktop"],
  },

  // ── Sideways Orientation ───────────────────────────────────────────────
  {
    slug: "2x4-hdx-sideways",
    name: '2×4 Sideways (20" Deep)',
    description: "8 totes rotated 90°. Only 20\" deep — fits narrow spaces like hallways.",
    toteCount: 8,
    approxDimensions: { width: '67"', height: '64"', depth: '20"' },
    skill: "intermediate",
    buildTimeHours: 2.5,
    price: 15,
    config: { cols: 2, rows: 4, toteType: "HDX", unitType: "standard", orientation: "sideways", hasWheels: false, hasTop: true },
    tags: ["sideways", "narrow", "shallow"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function getPlanBySlug(slug: string): PlanCatalogItem | undefined {
  return PLAN_CATALOG.find((p) => p.slug === slug);
}

export function getFeaturedPlans(): PlanCatalogItem[] {
  return PLAN_CATALOG.filter((p) => p.featured);
}

export function getPlansBySkill(skill: PlanCatalogItem["skill"]): PlanCatalogItem[] {
  return PLAN_CATALOG.filter((p) => p.skill === skill);
}

export function getPlansByTag(tag: string): PlanCatalogItem[] {
  return PLAN_CATALOG.filter((p) => p.tags.includes(tag));
}
