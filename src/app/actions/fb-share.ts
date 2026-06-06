"use server";

import { getServiceClient } from "@/lib/supabase-server";

const FB_SHARE_DISCOUNT_RATE = 0.10; // 10% off — absorbed by platform's 15% network fee

export async function applyFbShareDiscount(leadId: string): Promise<{
  success: boolean;
  discountAmount: number;
  error?: string;
}> {
  if (!leadId) return { success: false, discountAmount: 0, error: "Missing lead ID." };

  const supabase = getServiceClient();

  const { data: lead, error: fetchErr } = await supabase
    .from("leads")
    .select("estimated_price, source, fb_share_discount")
    .eq("id", leadId)
    .single();

  if (fetchErr || !lead) {
    return { success: false, discountAmount: 0, error: "Lead not found." };
  }

  if (lead.fb_share_discount && lead.fb_share_discount > 0) {
    return { success: true, discountAmount: lead.fb_share_discount };
  }

  if (lead.source !== "platform" && lead.source !== "facebook_referral") {
    return { success: false, discountAmount: 0, error: "Share discount only available for network leads." };
  }

  const buildPrice = lead.estimated_price || 0;
  if (buildPrice <= 0) {
    return { success: false, discountAmount: 0, error: "No price on this lead." };
  }

  const discountAmount = Math.round(buildPrice * FB_SHARE_DISCOUNT_RATE * 100) / 100;

  const { error: updateErr } = await supabase
    .from("leads")
    .update({ fb_share_discount: discountAmount })
    .eq("id", leadId);

  if (updateErr) {
    console.error("[FB Share] Failed to apply discount:", updateErr);
    return { success: false, discountAmount: 0, error: "Failed to apply discount." };
  }

  console.log(`[FB Share] Applied $${discountAmount} discount (10% of $${buildPrice}) to lead ${leadId}`);
  return { success: true, discountAmount };
}
