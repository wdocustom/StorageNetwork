"use server";

import { createClient } from "@supabase/supabase-js";

// Uses the SERVICE ROLE key so we can insert without a logged-in user.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Types — matches the UnitConfig shape from page.tsx
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
}

export interface SubmitQuoteInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  quote_data: QuoteUnit[];
  grand_total: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Server Action
// ═══════════════════════════════════════════════════════════════════════════

export async function submitNetworkLead(input: SubmitQuoteInput) {
  // Validation
  if (!input.customer_name?.trim()) {
    throw new Error("Name is required.");
  }
  if (!input.customer_email?.trim()) {
    throw new Error("Email is required.");
  }
  if (!input.quote_data || input.quote_data.length === 0) {
    throw new Error("At least one unit is required in the quote.");
  }

  // Build a human-readable summary for the dimensions field (backward compat)
  const dimensionsSummary = {
    unit_count: input.quote_data.length,
    grand_total: input.grand_total,
    units: input.quote_data.map((u, i) => ({
      unit: i + 1,
      cols: u.cols,
      rows: u.rows,
      tote_type: u.toteType,
      includes_totes: u.hasTotes,
      includes_wheels: u.hasWheels,
      includes_top: u.hasTop,
      width_inches: u.totalW,
      height_inches: u.totalH,
      unit_price: u.price,
    })),
  };

  const { data, error } = await supabase
    .from("leads")
    .insert({
      installer_id: null,
      is_network_lead: true,
      customer_name: input.customer_name.trim(),
      customer_email: input.customer_email.trim(),
      customer_phone: input.customer_phone?.trim() || null,
      address: input.address?.trim() || null,
      dimensions: dimensionsSummary,
      quote_data: input.quote_data,
      estimated_price: input.grand_total,
      source: "network",
      status: "new",
      notes: `${input.quote_data.length} unit(s) — Grand Total: $${input.grand_total.toLocaleString()}`,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Failed to submit quote request. Please try again.");
  }

  return { id: data.id };
}
