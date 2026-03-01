"use server";

import { createClient } from "@supabase/supabase-js";
import {
  sendOnboardingEmail2_QRCode,
  sendOnboardingEmail3_FirstSale,
  sendOnboardingEmail4_Scarcity,
} from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Onboarding Email Drip Sequence — Server Action
//
// Processes installers who need drip emails based on their signup date
// and current onboarding_step.
//
// Step 1 = Welcome email (sent at signup)
// Step 2 = QR Code email (Day 2)
// Step 3 = First Sale Playbook (Day 4)
// Step 4 = Scarcity Reminder (Day 7) — sequence complete
//
// Called by /api/cron/onboarding-drip
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DripResult {
  processed: number;
  sent: number;
  errors: string[];
}

/**
 * Process all pending onboarding drip emails.
 * Checks each installer's created_at + onboarding_step to determine
 * which email to send next.
 */
export async function processOnboardingDrip(): Promise<DripResult> {
  const result: DripResult = { processed: 0, sent: 0, errors: [] };

  try {
    // Fetch installers who haven't completed the sequence (step < 4)
    // and were created at least 2 days ago (Day 0 email is sent at signup)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: installers, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, business_name, slug, onboarding_step, created_at")
      .lt("onboarding_step", 4)
      .lte("created_at", twoDaysAgo.toISOString())
      .limit(50); // Batch size to avoid rate limits

    if (error) {
      console.error("[Onboarding Drip] Query error:", error.message);
      result.errors.push(error.message);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[Onboarding Drip] No installers due for drip emails.");
      return result;
    }

    const now = new Date();

    for (const installer of installers) {
      result.processed++;

      const displayName =
        installer.business_name ||
        installer.first_name ||
        "there";

      const createdAt = new Date(installer.created_at);
      const daysSinceSignup = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const currentStep = installer.onboarding_step ?? 0;

      try {
        // ── Step 1 → 2: QR Code email (Day 2+) ─────────────────────
        if (currentStep <= 1 && daysSinceSignup >= 2) {
          await sendOnboardingEmail2_QRCode(installer.email, {
            name: displayName,
            slug: installer.slug,
          });

          await supabase
            .from("profiles")
            .update({ onboarding_step: 2 })
            .eq("id", installer.id);

          result.sent++;
          console.log(`[Onboarding Drip] Email 2 (QR Code) sent to ${installer.email}`);
          continue; // Only send one email per run per installer
        }

        // ── Step 2 → 3: First Sale Playbook (Day 4+) ───────────────
        if (currentStep === 2 && daysSinceSignup >= 4) {
          await sendOnboardingEmail3_FirstSale(installer.email, {
            name: displayName,
            slug: installer.slug,
          });

          await supabase
            .from("profiles")
            .update({ onboarding_step: 3 })
            .eq("id", installer.id);

          result.sent++;
          console.log(`[Onboarding Drip] Email 3 (First Sale) sent to ${installer.email}`);
          continue;
        }

        // ── Step 3 → 4: Scarcity Reminder (Day 7+) ─────────────────
        if (currentStep === 3 && daysSinceSignup >= 7) {
          // Count completed jobs for this installer
          const { count: jobsCompleted } = await supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("installer_id", installer.id)
            .eq("status", "paid");

          await sendOnboardingEmail4_Scarcity(installer.email, {
            name: displayName,
            jobsCompleted: jobsCompleted ?? 0,
          });

          await supabase
            .from("profiles")
            .update({ onboarding_step: 4 })
            .eq("id", installer.id);

          result.sent++;
          console.log(`[Onboarding Drip] Email 4 (Scarcity) sent to ${installer.email}`);
          continue;
        }
      } catch (emailErr) {
        const msg = `Failed to send drip email to ${installer.email}: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`;
        console.error(`[Onboarding Drip] ${msg}`);
        result.errors.push(msg);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Onboarding Drip] Fatal error:", msg);
    result.errors.push(msg);
  }

  return result;
}
