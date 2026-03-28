"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendOverheadAnnouncementEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Overhead Storage Announcement Email — One-Time Blast to All Installers
//
// Promotes the new overhead ceiling storage system and educates installers
// on the "complete garage" upsell: tote racks + overhead + open shelving.
// Also highlights the updated AI script generator with new topic presets.
//
// Uses an `overhead_email_mar2026_sent` flag on the profiles table
// to ensure each installer only receives the email once.
//
// Called by /api/cron/overhead-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processOverheadAnnouncement(): Promise<AnnouncementResult> {
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
      .or("overhead_email_mar2026_sent.is.null,overhead_email_mar2026_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[OverheadAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[OverheadAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[OverheadAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const dashboardUrl = `${baseUrl}/dashboard`;
    const marketingUrl = `${baseUrl}/dashboard/marketing`;

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

      const slug = installer.slug as string | null;

      try {
        let sent = false;
        let lastError = "";

        // Retry up to 3 times for rate-limit errors
        for (let attempt = 0; attempt < 3; attempt++) {
          const emailResult = await sendOverheadAnnouncementEmail(email, {
            installerName: name,
            dashboardUrl,
            marketingUrl,
            configuratorSlug: slug || undefined,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[OverheadAnnouncement] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          // Retry on rate limit, otherwise break
          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1); // 1s, 2s
            console.log(`[OverheadAnnouncement] Rate limited for ${email}, retrying in ${backoff}ms...`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[OverheadAnnouncement] Failed for ${email}:`, lastError);
        }

        // Only mark as sent if the email was actually delivered
        if (sent) {
          await db()
            .from("profiles")
            .update({
              overhead_email_mar2026_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms delay between sends to stay under Resend's 2 req/sec limit
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[OverheadAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[OverheadAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[OverheadAnnouncement] Fatal error:", msg);
    return result;
  }
}
