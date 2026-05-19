"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendBountyAnnouncementEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Bounty System Announcement Email — One-Time Blast to All Installers
//
// Educates installers about the passive income referral/bounty system:
//   - How the 3-step referral flow works
//   - Sample bounty earnings at different deposit levels
//   - Dashboard snapshot showing what referrals look like
//   - Quick recap of upcoming Auto-Marketing Agent
//
// Uses a `bounty_email_mar2026_sent` flag on the profiles table
// to ensure each installer only receives the email once, even if
// the cron runs multiple times.
//
// Called by /api/cron/bounty-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface BountyAnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processBountyAnnouncement(): Promise<BountyAnnouncementResult> {
  const result: BountyAnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    // Skip installers who signed up less than 7 days ago (let onboarding drip finish)
    // and who already received an announcement email today (max 1/day)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name, slug")
      .or("bounty_email_mar2026_sent.is.null,bounty_email_mar2026_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .or("is_realtor.is.null,is_realtor.eq.false,is_pro.eq.true")
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[BountyAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[BountyAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[BountyAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const dashboardUrl = `${baseUrl}/dashboard`;
    const referralsUrl = `${baseUrl}/dashboard/referrals`;

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
          const emailResult = await sendBountyAnnouncementEmail(email, {
            installerName: name,
            dashboardUrl,
            referralsUrl,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[BountyAnnouncement] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          // Retry on rate limit, otherwise break
          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1); // 1s, 2s
            console.log(`[BountyAnnouncement] Rate limited for ${email}, retrying in ${backoff}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[BountyAnnouncement] Failed for ${email}:`, lastError);
        }

        // Only mark as sent if the email was actually delivered
        if (sent) {
          await db()
            .from("profiles")
            .update({
              bounty_email_mar2026_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms delay between sends to stay under Resend's 2 req/sec limit
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[BountyAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[BountyAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[BountyAnnouncement] Fatal error:", msg);
    return result;
  }
}
