// ═══════════════════════════════════════════════════════════════════════════
// Ripped-2×4 rail construction — the ONE source for rail heights and upright
// lengths (DIY plans, installer 2×4-rail builds, 3D models, diagrams, jig).
// Plywood-strip rails sit at the SAME top-edge heights (railTopFromBottom).
//
// Each tote hangs by its rim on two rails. A rail is half a 2×4 ripped
// lengthwise: (3-1/2" − blade kerf) / 2 → 1-9/16" tall, 1-1/2" thick.
// (Plywood-strip rails are a different system: 1-7/8", unchanged.)
//
// Heights are measured from the BOTTOM END OF THE UPRIGHT (it stands on a
// 1-1/2" bottom plate, so add 1-1/2" — plus casters — for height from floor):
//   • first rail top at 13" (14-1/2" from the floor), then 16" between rail
//     tops: 13, 29, 45, 61, 77, 93
//   • at least 2-1/2" from the top of the top rail to the top plate (hard
//     minimum — tote lids need it)
//   • 1–5 high: upright = top rail + 2-1/2"  → 15-1/2, 31-1/2 … 79-1/2
//   • 6 high: a full, uncut 8' upright (96") — 3" above the top rail
// Two uprights whose rows add up to 6 (1+5, 2+4, 3+3) come out of ONE 8'
// board with the saw kerf to spare, so mixed designs pack with no scrap.
// ═══════════════════════════════════════════════════════════════════════════

/** Ripped rail height: half a 2×4 less the blade kerf (1-9/16"). */
export const RAIL_2X4_H = 1.5625;
/** Rail thickness — the 2×4's 1-1/2" face. */
export const RAIL_2X4_W = 1.5;
/** Table-saw fence setting for the rip. */
export const RAIL_2X4_RIP_FENCE = RAIL_2X4_H;
/** Top of the first rail, from the bottom of the upright. */
export const RAIL_2X4_FIRST_TOP = 13;
/** Rail top to rail top. */
export const RAIL_2X4_PITCH = 16;
export const RAIL_2X4_MAX_ROWS = 6;
/** Hard minimum from the top of the top rail to the top plate (tote lids). */
export const RAIL_2X4_MIN_ABOVE_TOP = 2.5;
/** Upright above the top rail's top edge, for 1–5 high frames. */
export const RAIL_2X4_ABOVE_TOP = RAIL_2X4_MIN_ABOVE_TOP;
/** 2×4×8' stock — a 6-high upright is a full, uncut board. */
export const RAIL_2X4_STOCK = 96;
/** Plate under (and over) the uprights. */
export const RAIL_2X4_PLATE_H = 1.5;

/** Rail TOP edges from the bottom of the upright: 13, 29, 45, 61, 77, 93. */
export const RAIL_2X4_TOPS: readonly number[] = Array.from(
  { length: RAIL_2X4_MAX_ROWS },
  (_, i) => RAIL_2X4_FIRST_TOP + i * RAIL_2X4_PITCH,
);

/** Rail CENTERS from the bottom of the upright (for drawing / 3D placement). */
export const RAIL_2X4_CENTERS: readonly number[] = RAIL_2X4_TOPS.map((t) => t - RAIL_2X4_H / 2);

// ═══════════════════════════════════════════════════════════════════════════
// EVERY rail — ripped 2×4 or 3/4" plywood strip — is positioned by its TOP
// edge, measured up from the bottom end of the upright: 13", then every 16"
// (29, 45, 61, 77, 93 …). Never by its center, never from the floor. The
// marking step, the ladder jig, the 3D guide, the blueprint and the PDF all
// use these same numbers; drawings that need a center derive it here.
// ═══════════════════════════════════════════════════════════════════════════

/** Top edge of rail `row` (0 = bottom) from the bottom of the upright, for 2×4 and plywood rails. */
export function railTopFromBottom(row: number): number {
  return RAIL_2X4_FIRST_TOP + row * RAIL_2X4_PITCH;
}

/** Center of rail `row` for a rail `railHeight` tall (drawing / 3D only), from its top edge. */
export function railCenterFromBottom(row: number, railHeight: number): number {
  return railTopFromBottom(row) - railHeight / 2;
}

/** Rail top edges for a frame `rows` high, from the bottom of the upright. */
export function railTops2x4(rows: number): number[] {
  return RAIL_2X4_TOPS.slice(0, Math.max(1, Math.min(rows, RAIL_2X4_MAX_ROWS)));
}

/** Upright length for a 2×4-rail frame `rows` high (rows ≤ 6). */
export function upright2x4Length(rows: number): number {
  const r = Math.max(1, Math.min(rows, RAIL_2X4_MAX_ROWS));
  return r >= RAIL_2X4_MAX_ROWS ? RAIL_2X4_STOCK : RAIL_2X4_TOPS[r - 1] + RAIL_2X4_ABOVE_TOP;
}

// ═══════════════════════════════════════════════════════════════════════════
// BAY OPENINGS — the clear width between two uprights, by tote brand.
//
// Each rail sticks 1-1/2" into the bay from the upright's side face, so the
// gap a tote drops into is the bay minus 3". The tote has to HANG BY ITS RIM
// on both rails (rim wider than the gap) and its BODY has to drop between
// them (body narrower than the gap).
//
// Measured 27-gallon totes (long × short side):
//   HDX / Performax size     rim 28-1/2 × 19-5/8   body 26 × 17-1/8 (measured)
//   Greenmade / Project Source / Hyper Tough size
//                            rim 30-1/8 × 20-1/8   body ≈ 27-5/8 × 17-5/8
//                            (rim measured; body = rim − the same 1-1/4" lip
//                             HDX has — the conservative estimate)
//
// Upright: one 21" bay (18" gap) holds both — HDX rests 13/16" per side with
//   7/16" body clearance, Greenmade 1-1/16" with ~3/16".
// Sideways: no single bay fits both. A Greenmade body needs a gap over ~28",
//   an HDX rim falls through anything over ~27-1/2". So sideways bays follow
//   the brand:
//     HDX size        30-1/4" bay (27-1/4" gap): 5/8" rim on each rail, 5/8" clearance
//     Greenmade size  32" bay     (29" gap):     9/16" rim on each rail, ~11/16" clearance
//   A rack built for one brand does NOT take the other sideways — the plans
//   and quotes say so.
// tote-fit.test.ts checks every combination against these numbers.
// (Plywood-strip racks have their own openings in buildEngine — not these.)
// ═══════════════════════════════════════════════════════════════════════════

/** 27-gallon tote size class used for 2×4-rail bays. Unknown → HDX (the original sizing). */
export type ToteSizeClass = "HDX" | "GM";

export interface ToteRimBody {
  label: string;
  brands: string;
  rimLong: number;
  rimShort: number;
  bodyLong: number;
  bodyShort: number;
}

export const TOTE_27GAL: Record<ToteSizeClass, ToteRimBody> = {
  HDX: { label: "HDX-size", brands: "HDX (Home Depot), Performax (Menards)", rimLong: 28.5, rimShort: 19.625, bodyLong: 26, bodyShort: 17.125 },
  GM: {
    label: "Greenmade-size",
    brands: "Greenmade (Costco), Project Source (Lowe's), Hyper Tough (Walmart)",
    rimLong: 30.125,
    rimShort: 20.125,
    bodyLong: 27.625,
    bodyShort: 17.625,
  },
};

/** Upright bay: one size fits both brands. */
export const RAIL_2X4_BAY = 21;
/** Sideways bays by tote size class. */
export const RAIL_2X4_BAY_SIDEWAYS: Record<ToteSizeClass, number> = { HDX: 30.25, GM: 32 };
/** Rack depth (= rail length): 30" upright, 20" sideways. */
export const RAIL_2X4_DEPTH_UPRIGHT = 30;
export const RAIL_2X4_DEPTH_SIDEWAYS = 20;

/** "GM" for a Greenmade-size tote, otherwise "HDX" (including unknown / legacy designs). */
export function toteSizeClass(toteType: string | null | undefined): ToteSizeClass {
  return toteType === "GM" ? "GM" : "HDX";
}

/** Clear width between two uprights of a 2×4-rail rack. */
export function rails2x4Bay(sideways: boolean | undefined, toteType?: string | null): number {
  return sideways ? RAIL_2X4_BAY_SIDEWAYS[toteSizeClass(toteType)] : RAIL_2X4_BAY;
}

/** Rack depth for a 2×4-rail rack. */
export function rails2x4Depth(sideways: boolean | undefined): number {
  return sideways ? RAIL_2X4_DEPTH_SIDEWAYS : RAIL_2X4_DEPTH_UPRIGHT;
}

/**
 * How a tote sits in a 2×4-rail bay: rim resting on each rail (must be > 0)
 * and body clearance per side (must be > 0). Inches.
 */
export function toteFit2x4(toteType: string | null | undefined, sideways: boolean, bay = rails2x4Bay(sideways, toteType)) {
  const t = TOTE_27GAL[toteSizeClass(toteType)];
  const gap = bay - 2 * RAIL_2X4_W;
  const rim = sideways ? t.rimLong : t.rimShort;
  const body = sideways ? t.bodyLong : t.bodyShort;
  return { gap, rimBearing: (rim - gap) / 2, bodyClearance: (gap - body) / 2 };
}
