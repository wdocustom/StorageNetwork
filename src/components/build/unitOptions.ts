import type { UnitConfig, UnitOption } from "./types";

// Slot count of a quote line. A saved bestseller line keeps only its first
// section's cols/rows, but its description records the real total
// ("… — 48 slots, …"), so prefer that.
export function slotsOf(u: { cols?: number; rows?: number; desc?: string }): number {
  const m = /(\d+)\s+slots/.exec(u.desc || "");
  return m ? Number(m[1]) : (u.cols || 0) * (u.rows || 0);
}

// Price of adding one option to an existing unit: the calculator's price with
// the option minus without it. Totes are priced per slot, so the per-slot
// difference is scaled to the line's real slot count (see slotsOf).
export function optionPriceDelta(
  option: UnitOption,
  priceWithout: number,
  priceWith: number,
  unit: { cols: number; rows: number; desc?: string }
): number {
  let delta = priceWith - priceWithout;
  const calcSlots = unit.cols * unit.rows;
  if (option === "totes" && calcSlots > 0) delta = (delta / calcSlots) * slotsOf(unit);
  return Math.round(delta * 100) / 100;
}

// A tote rack (standard or mini): the only kind of line where top / wheels
// / totes are options. Overheads, shelving, chairs, raised beds and custom
// line items don't take them.
export function isRackUnit(unit: UnitConfig): boolean {
  return (
    unit.cols > 0 &&
    unit.rows > 0 &&
    !unit.overheadGridPresetId &&
    !unit.shelvingConfigId &&
    !unit.chairId &&
    !unit.raisedBedConfig
  );
}
