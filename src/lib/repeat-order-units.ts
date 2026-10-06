// Pure helpers: which units from a past order can be re-ordered on the
// installer's /book configurator (standard tote racks with the options that
// page supports). Everything else is shown as "not available online".

export interface ReorderableUnit {
  cols: number;
  rows: number;
  toteType: "HDX" | "GM";
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  quantity: number;
}

export interface PastUnit extends Partial<ReorderableUnit> {
  /** Why it can't be re-ordered here; absent when it can. */
  unavailableLabel?: string;
  /** Short description of a custom build, e.g. "4 Wide × 4 High". */
  desc?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Turns a lead's quote_data into units the /book page can rebuild. */
export function extractPastUnits(quoteData: unknown): PastUnit[] {
  if (!Array.isArray(quoteData)) return [];
  const out: PastUnit[] = [];

  for (const raw of quoteData) {
    if (!isRecord(raw)) continue;
    // Services (cleanout, paint) aren't racks — nothing to re-add here.
    if (raw.type === "cleanout_service" || raw.type === "paint") continue;

    const cols = Number(raw.cols);
    const rows = Number(raw.rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) continue;

    const quantity = Math.min(Math.max(Math.trunc(Number(raw.quantity)) || 1, 1), 10);
    const hasAddons = Array.isArray(raw.addons) && raw.addons.length > 0;
    const unusual =
      hasAddons ||
      !!raw.shelvingConfigId ||
      !!raw.overheadGridPresetId ||
      (raw.unitType && raw.unitType !== "standard") ||
      (raw.orientation && raw.orientation !== "standard") ||
      (raw.toteColor && raw.toteColor !== "black") ||
      raw.use2x4Rails === true ||
      cols > 12 ||
      rows > 10;

    if (unusual) {
      out.push({
        unavailableLabel: "Custom build — ask your installer",
        desc: `${cols} Wide × ${rows} High`,
      });
      continue;
    }

    out.push({
      cols,
      rows,
      toteType: raw.toteType === "GM" ? "GM" : "HDX",
      hasTotes: raw.hasTotes !== false,
      hasWheels: raw.hasWheels === true,
      hasTop: raw.hasTop === true,
      quantity,
    });
  }
  return out;
}

/** One-line installation address from whatever the lead recorded. */
export function pickInstallAddress(lead: Record<string, unknown>): { address: string; zip: string } {
  const s = (k: string) => (typeof lead[k] === "string" ? (lead[k] as string).trim() : "");
  const hasDelivery = !!(s("delivery_address_line1") || s("delivery_address_zip"));
  const p = hasDelivery ? "delivery_address_" : "address_";
  const parts = [s(`${p}line1`), hasDelivery ? s("delivery_address_line2") : "", s(`${p}city`), s(`${p}state`)]
    .filter(Boolean);
  const zip = s(`${p}zip`);
  const joined = parts.join(", ");
  return { address: joined || (hasDelivery ? "" : s("address")), zip: /^\d{5}$/.test(zip) ? zip : "" };
}
