"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendFeedbackCallInvite } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Feedback Call Invite — One-Time Email Blast to All Installers
//
// Sends a personal invite to every installer to schedule a video call
// for a platform walkthrough, check-in, and feature feedback.
//
// Uses `feedback_call_email_sent` flag on profiles to ensure each
// installer only receives this once, even if the cron runs multiple times.
//
// Respects the 7-day signup guard and 1-email-per-day throttle from
// the announcement email system.
//
// Called by /api/cron/feedback-call-invite
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface FeedbackCallResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processFeedbackCallInvite(): Promise<FeedbackCallResult> {
  const result: FeedbackCallResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    // Skip installers who signed up less than 7 days ago (let onboarding drip finish)
    // and who already received an announcement email today (max 1/day)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("feedback_call_email_sent.is.null,feedback_call_email_sent.eq.false")
      .not("email", "is", null)
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[FeedbackCallInvite] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[FeedbackCallInvite] No installers to email.");
      return result;
    }

    console.log(`[FeedbackCallInvite] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const bookingUrl = `${baseUrl}/demo`;

    for (const installer of installers) {
      result.processed++;

      const email = installer.email as string;
      if (!email) {
        result.skipped++;
        continue;
      }

      const name =
        (installer.business_name as string) ||
        (installer.first_name as string) ||
        "there";

      try {
        let sent = false;
        let lastError = "";

        // Retry up to 3 times for rate-limit errors
        for (let attempt = 0; attempt < 3; attempt++) {
          const emailResult = await sendFeedbackCallInvite(email, {
            installerName: name,
            bookingUrl,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[FeedbackCallInvite] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          // Retry on rate limit, otherwise break
          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1);
            console.log(`[FeedbackCallInvite] Rate limited for ${email}, retrying in ${backoff}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[FeedbackCallInvite] Failed for ${email}:`, lastError);
        }

        // Only mark as sent if the email was actually delivered
        if (sent) {
          await db()
            .from("profiles")
            .update({
              feedback_call_email_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms delay between sends to stay under Resend's 2 req/sec limit
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[FeedbackCallInvite] Error for ${email}:`, msg);
      }
    }

    console.log("[FeedbackCallInvite] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[FeedbackCallInvite] Fatal error:", msg);
    return result;
  }
}
