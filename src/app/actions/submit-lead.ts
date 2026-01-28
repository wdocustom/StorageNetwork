"use server";

import { createClient } from "@supabase/supabase-js";

// Uses the SERVICE ROLE key so we can insert without a logged-in user.
// These env vars are server-only (no NEXT_PUBLIC_ prefix for the service key).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SubmitLeadInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  dimensions: {
    width: number;
    height: number;
    tote_type: string;
  };
  estimated_price: number;
}

export async function submitNetworkLead(input: SubmitLeadInput) {
  // Basic server-side validation
  if (!input.customer_name.trim()) {
    throw new Error("Name is required.");
  }
  if (!input.customer_email.trim()) {
    throw new Error("Email is required.");
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      installer_id: null,
      is_network_lead: true,
      customer_name: input.customer_name.trim(),
      customer_email: input.customer_email.trim(),
      customer_phone: input.customer_phone.trim() || null,
      address: input.address.trim() || null,
      dimensions: input.dimensions,
      source: "network",
      status: "new",
      notes: `Estimated price: $${input.estimated_price}`,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Failed to submit quote request. Please try again.");
  }

  return { id: data.id };
}
