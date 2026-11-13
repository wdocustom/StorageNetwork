// ═══════════════════════════════════════════════════════════════════════════
// How wide one module of a tote rack can be
//
// Every module's front and back plates must come out of one 8' (96") 2×4.
// A standard bay is ~21" (4 wide → 91-1/2" plate). A sideways bay is
// 30-1/4" because the tote's long side faces out: 2 wide is a 65" plate,
// 3 wide (96-3/4") would no longer fit. Shared by the build engine (cut
// lists), the materials calculator, the job ticket diagram and DIY plans.
// ═══════════════════════════════════════════════════════════════════════════

export const MAX_MODULE_COLS = 4;
export const MAX_MODULE_COLS_SIDEWAYS = 2;

/** Most totes across one module for this orientation. */
export function maxModuleCols(orientation?: string | null): number {
  return orientation === "sideways" ? MAX_MODULE_COLS_SIDEWAYS : MAX_MODULE_COLS;
}

/** Width split: greedy full modules, remainder last. */
export function splitModuleWidths(cols: number, orientation?: string | null): number[] {
  const max = maxModuleCols(orientation);
  const mods: number[] = [];
  let remaining = cols;
  while (remaining > max) {
    mods.push(max);
    remaining -= max;
  }
  if (remaining > 0) mods.push(remaining);
  return mods;
}
