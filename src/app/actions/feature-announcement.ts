"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendFeatureAnnouncement } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Feature Announcement Email — One-Time Blast to All Installers
//
// Sends the March 2026 platform update email covering:
//   - Open Shelving units in the configurator
//   - Organizer Customization (plywood shelves, doors, paint, etc.)
//   - Toggle controls in Profile & Settings
//   - Tutorial videos on the Guides page
//   - Coming Soon: Auto-Marketing Agent for Pro subscribers
//
// Uses a `feature_email_mar2026_sent` flag on the profiles table
// to ensure each installer only receives the email once, even if
// the cron runs multiple times.
//
// Called by /api/cron/feature-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processFeatureAnnouncement(): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

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
      .or("feature_email_mar2026_sent.is.null,feature_email_mar2026_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .or("is_realtor.is.null,is_realtor.eq.false,is_pro.eq.true")
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[FeatureAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[FeatureAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[FeatureAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const dashboardUrl = `${baseUrl}/dashboard`;
    const guidesUrl = `${baseUrl}/dashboard/guides`;

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
          const emailResult = await sendFeatureAnnouncement(email, {
            installerName: name,
            dashboardUrl,
            guidesUrl,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[FeatureAnnouncement] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          // Retry on rate limit, otherwise break
          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1); // 1s, 2s
            console.log(`[FeatureAnnouncement] Rate limited for ${email}, retrying in ${backoff}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[FeatureAnnouncement] Failed for ${email}:`, lastError);
        }

        // Only mark as sent if the email was actually delivered
        if (sent) {
          await db()
            .from("profiles")
            .update({
              feature_email_mar2026_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms delay between sends to stay under Resend's 2 req/sec limit
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[FeatureAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[FeatureAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[FeatureAnnouncement] Fatal error:", msg);
    return result;
  }
}
