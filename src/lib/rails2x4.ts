// ═══════════════════════════════════════════════════════════════════════════
// Ripped-2×4 rail construction — the ONE source for rail heights and upright
// lengths (DIY plans, installer 2×4-rail builds, 3D models, diagrams, jig).
//
// Each tote hangs by its rim on two rails. A rail is half a 2×4 ripped
// lengthwise: (3-1/2" − blade kerf) / 2 → 1-9/16" tall, 1-1/2" thick.
// (Plywood-strip rails are a different system: 1-7/8", unchanged.)
//
// Heights are measured from the BOTTOM END OF THE UPRIGHT (it stands on a
// 1-1/2" bottom plate, so add 1-1/2" — plus casters — for height from floor):
//   • first rail top at 14", then 16" between rail tops: 14, 30, 46, 62, 78, 94
//   • 1–5 high: upright = top rail + 1-7/8"  → 15-7/8, 31-7/8 … 79-7/8
//   • 6 high: a full, uncut 8' upright (96") — 2" above the top rail
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
export const RAIL_2X4_FIRST_TOP = 14;
/** Rail top to rail top. */
export const RAIL_2X4_PITCH = 16;
export const RAIL_2X4_MAX_ROWS = 6;
/** Upright above the top rail's top edge, for 1–5 high frames. */
export const RAIL_2X4_ABOVE_TOP = 1.875;
/** 2×4×8' stock — a 6-high upright is a full, uncut board. */
export const RAIL_2X4_STOCK = 96;
/** Plate under (and over) the uprights. */
export const RAIL_2X4_PLATE_H = 1.5;

/** Rail TOP edges from the bottom of the upright: 14, 30, 46, 62, 78, 94. */
export const RAIL_2X4_TOPS: readonly number[] = Array.from(
  { length: RAIL_2X4_MAX_ROWS },
  (_, i) => RAIL_2X4_FIRST_TOP + i * RAIL_2X4_PITCH,
);

/** Rail CENTERS from the bottom of the upright (for drawing / 3D placement). */
export const RAIL_2X4_CENTERS: readonly number[] = RAIL_2X4_TOPS.map((t) => t - RAIL_2X4_H / 2);

/** Rail top edges for a frame `rows` high, from the bottom of the upright. */
export function railTops2x4(rows: number): number[] {
  return RAIL_2X4_TOPS.slice(0, Math.max(1, Math.min(rows, RAIL_2X4_MAX_ROWS)));
}

/** Upright length for a 2×4-rail frame `rows` high (rows ≤ 6). */
export function upright2x4Length(rows: number): number {
  const r = Math.max(1, Math.min(rows, RAIL_2X4_MAX_ROWS));
  return r >= RAIL_2X4_MAX_ROWS ? RAIL_2X4_STOCK : RAIL_2X4_TOPS[r - 1] + RAIL_2X4_ABOVE_TOP;
}
