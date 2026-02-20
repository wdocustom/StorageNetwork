"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DiscountCode {
  id: string;
  installer_id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface ValidatedDiscount {
  valid: boolean;
  code?: string;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  discount_id?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validate a discount code for a specific installer
// Called from the booking flow — no auth required (customer isn't logged in)
// ═══════════════════════════════════════════════════════════════════════════

export async function validateDiscountCode(
  code: string,
  installerId: string
): Promise<ValidatedDiscount> {
  if (!code?.trim() || !installerId) {
    return { valid: false, error: "Invalid code." };
  }

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("installer_id", installerId)
    .ilike("code", code.trim())
    .eq("active", true)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid discount code." };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "This discount code has expired." };
  }

  // Check usage limit
  if (data.max_uses !== null && data.current_uses >= data.max_uses) {
    return { valid: false, error: "This discount code has reached its usage limit." };
  }

  return {
    valid: true,
    code: data.code,
    discount_type: data.discount_type,
    discount_value: Number(data.discount_value),
    discount_id: data.id,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Increment usage count (called after successful payment)
// ═══════════════════════════════════════════════════════════════════════════

export async function incrementDiscountUsage(discountId: string): Promise<void> {
  const { data } = await supabase
    .from("discount_codes")
    .select("current_uses")
    .eq("id", discountId)
    .single();

  if (data) {
    await supabase
      .from("discount_codes")
      .update({ current_uses: (data.current_uses || 0) + 1 })
      .eq("id", discountId);
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
}): Promise<{ success: boolean; code?: DiscountCode; error?: string }> {
  const { installerId, code, discountType, discountValue, maxUses, expiresAt } = input;

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
