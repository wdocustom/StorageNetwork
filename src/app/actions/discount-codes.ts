"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Discount Code Validation — Server Action
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DiscountCode {
  id: string;
  installer_id: string;
  code: string;
  discount_type: "percent" | "fixed" | "percentage";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  current_uses: number;
  active: boolean;
  expires_at: string | null;
  min_order: number | null;
  max_discount: number | null;
  min_units: number | null;
  created_at: string;
}

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
  orderTotal: number,
  options?: { noDepositCap?: boolean; unitCount?: number }
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
  if (data.max_uses !== null && (data.used_count || data.current_uses || 0) >= data.max_uses) {
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

  // Check minimum units (bundle/volume discount)
  if (data.min_units && options?.unitCount !== undefined && options.unitCount < data.min_units) {
    return {
      valid: false,
      discountAmount: 0,
      error: `This code requires ${data.min_units} or more units in your order. You have ${options.unitCount}.`,
    };
  }

  // Calculate discount amount
  let discountAmount: number;
  if (data.discount_type === "percentage" || data.discount_type === "percent") {
    discountAmount = roundMoney(orderTotal * (Number(data.discount_value) / 100));
    // Apply cap if set
    if (data.max_discount && discountAmount > Number(data.max_discount)) {
      discountAmount = Number(data.max_discount);
    }
  } else {
    discountAmount = Number(data.discount_value);
  }

  // Never discount more than the remaining balance
  // For unpaid quotes (no deposit), allow discount on full amount
  const maxDiscountable = options?.noDepositCap
    ? orderTotal
    : roundMoney(orderTotal * 0.85);
  discountAmount = Math.min(discountAmount, maxDiscountable);

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
    .select("id, used_count, current_uses")
    .eq("installer_id", installerId)
    .ilike("code", normalizedCode)
    .single();

  if (data) {
    await supabase
      .from("discount_codes")
      .update({
        used_count: ((data.used_count || data.current_uses || 0) as number) + 1,
        current_uses: ((data.current_uses || data.used_count || 0) as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Installer Management — CRUD for discount codes
// ═══════════════════════════════════════════════════════════════════════════

export async function getInstallerDiscountCodes(
  installerId: string
): Promise<{ success: boolean; codes?: DiscountCode[]; error?: string }> {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("installer_id", installerId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, codes: (data || []) as DiscountCode[] };
}

export async function createDiscountCode(input: {
  installerId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  minUnits?: number | null;
}): Promise<{ success: boolean; code?: DiscountCode; error?: string }> {
  const { installerId, code, discountType, discountValue, maxUses, expiresAt, minUnits } = input;

  if (!code?.trim()) {
    return { success: false, error: "Code is required." };
  }

  if (discountValue <= 0) {
    return { success: false, error: "Discount value must be greater than 0." };
  }

  if (discountType === "percent" && discountValue > 100) {
    return { success: false, error: "Percentage discount cannot exceed 100%." };
  }

  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      installer_id: installerId,
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      expires_at: expiresAt || null,
      min_units: minUnits || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This code already exists." };
    }
    return { success: false, error: error.message };
  }

  return { success: true, code: data as DiscountCode };
}

export async function toggleDiscountCode(
  codeId: string,
  installerId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("discount_codes")
    .update({ active })
    .eq("id", codeId)
    .eq("installer_id", installerId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteDiscountCode(
  codeId: string,
  installerId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("discount_codes")
    .delete()
    .eq("id", codeId)
    .eq("installer_id", installerId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
