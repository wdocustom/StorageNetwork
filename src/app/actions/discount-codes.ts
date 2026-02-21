"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Discount Code Validation — Server Action
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DiscountValidationResult {
  valid: boolean;
  discountAmount: number;       // Resolved dollar amount to deduct
  discountType?: "fixed" | "percentage";
  discountValue?: number;       // Raw value (dollars or percent)
  code?: string;
  error?: string;
}

/**
 * Validate a discount code for a specific installer and order total.
 * Returns the resolved dollar discount amount if valid.
 */
export async function validateDiscountCode(
  code: string,
  installerId: string,
  orderTotal: number
): Promise<DiscountValidationResult> {
  if (!code?.trim() || !installerId) {
    return { valid: false, discountAmount: 0, error: "Missing code or installer." };
  }

  const normalizedCode = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("installer_id", installerId)
    .ilike("code", normalizedCode)
    .eq("active", true)
    .single();

  if (error || !data) {
    return { valid: false, discountAmount: 0, error: "Invalid discount code." };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, discountAmount: 0, error: "This code has expired." };
  }

  // Check usage limit
  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    return { valid: false, discountAmount: 0, error: "This code has reached its usage limit." };
  }

  // Check minimum order
  if (data.min_order && orderTotal < Number(data.min_order)) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Minimum order of $${Number(data.min_order).toFixed(0)} required for this code.`,
    };
  }

  // Calculate discount amount
  let discountAmount: number;
  if (data.discount_type === "percentage") {
    discountAmount = Math.round(orderTotal * (Number(data.discount_value) / 100) * 100) / 100;
    // Apply cap if set
    if (data.max_discount && discountAmount > Number(data.max_discount)) {
      discountAmount = Number(data.max_discount);
    }
  } else {
    discountAmount = Number(data.discount_value);
  }

  // Never discount more than the remaining balance (85% of order — deposit is untouched)
  const remainingBalance = Math.round(orderTotal * 0.85 * 100) / 100;
  discountAmount = Math.min(discountAmount, remainingBalance);

  return {
    valid: true,
    discountAmount,
    discountType: data.discount_type as "fixed" | "percentage",
    discountValue: Number(data.discount_value),
    code: normalizedCode,
  };
}

/**
 * Increment the used_count for a discount code after successful payment.
 */
export async function incrementDiscountCodeUsage(
  code: string,
  installerId: string
): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();

  // Fetch current count, then increment
  const { data } = await supabase
    .from("discount_codes")
    .select("id, used_count")
    .eq("installer_id", installerId)
    .ilike("code", normalizedCode)
    .single();

  if (data) {
    await supabase
      .from("discount_codes")
      .update({
        used_count: (data.used_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
  }
}
