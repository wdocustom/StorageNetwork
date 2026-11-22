import "server-only";

import { randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// The one-time installer review link (/review/<token>) for a job. Internal:
// called by job completion and the Stripe webhook. The installer-facing
// "copy link" goes through generateReviewToken in @/app/actions/reviews,
// which checks the signed-in installer owns the job first.
// ═══════════════════════════════════════════════════════════════════════════

export async function ensureLeadReviewToken(leadId: string): Promise<string | null> {
  try {
    const db = getServiceClient();
    const { data: lead, error } = await db.from("leads").select("review_token").eq("id", leadId).maybeSingle();
    if (error || !lead) {
      if (error) console.error("[Reviews] Failed to fetch lead:", error.message);
      return null;
    }
    if (lead.review_token) return lead.review_token as string;

    const token = randomBytes(16).toString("hex");
    const { error: updateError } = await db.from("leads").update({ review_token: token }).eq("id", leadId);
    if (updateError) {
      console.error("[Reviews] Failed to save review token:", updateError.message);
      return null;
    }
    return token;
  } catch (err) {
    console.error("[Reviews] ensureLeadReviewToken crashed:", err);
    return null;
  }
}
