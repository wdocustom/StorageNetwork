// ═══════════════════════════════════════════════════════════════════════════
// Rack Inventory Eligibility
//
// Decides which quote lines get a customer-facing tote inventory (the QR
// code, the shareable link, the "Email Customer" button on the job ticket).
//
// A unit qualifies when it's a rack — something with a cols × rows grid of
// slots to catalog.
//
// Deliberately NOT gated on `hasTotes`. That flag records whether the
// installer supplied the bins, which says nothing about whether the customer
// wants a catalog of what's in them. 54% of installed rack units have it
// false, and the largest single group is frame-only builds (2x4 rails /
// totes_disabled) where the customer brings their own containers and has no
// packing list at all — the people who need this most. Gating on it hid the
// feature from 17 of 44 paid jobs.
//
// The grid test alone keeps non-rack products out: shelving, chairs, raised
// beds and custom line items are all written with cols: 0, rows: 0 (see
// app/dashboard/build/page.tsx). The explicit ids below cover overhead
// ceiling grids, which do carry real cols/rows but are a different physical
// product with its own layout.
// ═══════════════════════════════════════════════════════════════════════════

/** A quote line as stored in leads.quote_data — shape is not validated on write. */
export interface RackCandidate {
  cols?: number | null;
  rows?: number | null;
  /** Legacy aliases seen on older records. */
  width?: number | null;
  height?: number | null;
  shelvingConfigId?: string | null;
  overheadGridPresetId?: string | null;
  chairId?: string | null;
}

export function isInventoryRackUnit(unit: RackCandidate | null | undefined): boolean {
  if (!unit) return false;

  const cols = unit.cols ?? unit.width ?? 0;
  const rows = unit.rows ?? unit.height ?? 0;

  return (
    cols > 0 &&
    rows > 0 &&
    !unit.shelvingConfigId &&
    !unit.overheadGridPresetId &&
    !unit.chairId
  );
}
