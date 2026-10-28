// Job ticket data — shared by the server page (first load) and JobTicketView
// (re-load after an edit).

import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
import type { MaterialPrices } from "@/utils/calculateMaterials";
import type { MaterialInventory } from "@/utils/inventoryManager";

export const LEAD_COLUMNS =
  "id, customer_name, customer_email, customer_phone, address, status, estimated_price, deposit_paid, deposit_amount, balance_due, payout_status, fee_status, photo_url, quote_data, created_at, scheduled_at, time_preference, installer_id, address_line1, address_city, address_state, address_zip, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip, source, en_route_notified, sales_tax_amount, review_token, review_submitted, discount_code, discount_amount, stripe_payment_method_id, stripe_payment_method_brand, stripe_payment_method_last4, customer_id";

export const INSTALLER_COLUMNS = "stripe_account_id, material_inventory, material_pricing_config";

export interface SavedCard {
  brand: string | null;
  last4: string | null;
}

export interface InstallerTicketData {
  stripeId: string | null;
  inventory: MaterialInventory | null;
  materialPrices: MaterialPrices | undefined;
}

/** The installer's material price overrides, in the units the calculator takes. */
export function toInstallerTicketData(profile: {
  stripe_account_id?: string | null;
  material_inventory?: unknown;
  material_pricing_config?: unknown;
} | null): InstallerTicketData {
  let materialPrices: MaterialPrices | undefined;
  const mpc = profile?.material_pricing_config as MaterialPricingConfig | null | undefined;
  if (mpc) {
    const p: Record<string, number> = {};
    if (mpc.lumber_2x4_8ft !== undefined) p.lumber_2x4_8ft = mpc.lumber_2x4_8ft;
    if (mpc.plywood_sheet !== undefined) p.plywood_sheet = mpc.plywood_sheet;
    if (mpc.tote !== undefined) p.tote = mpc.tote;
    if (mpc.wheels_4pk !== undefined) p.wheels_4pk = mpc.wheels_4pk;
    if (mpc.screw_1in) p.screw_1in_90ct = mpc.screw_1in.price / mpc.screw_1in.count * 90;
    if (mpc.screw_1_5_8in) p.screw_1_5_8in_158ct = mpc.screw_1_5_8in.price / mpc.screw_1_5_8in.count * 158;
    if (mpc.screw_3in) p.screw_3in_137ct = mpc.screw_3in.price / mpc.screw_3in.count * 137;
    if (Object.keys(p).length > 0) materialPrices = p as MaterialPrices;
  }
  return {
    stripeId: profile?.stripe_account_id ?? null,
    inventory: (profile?.material_inventory as MaterialInventory | null) ?? null,
    materialPrices,
  };
}
