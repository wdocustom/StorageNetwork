"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendToteRentalAnnouncementEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Tote-Rental Program Announcement — One-Time Blast to All Installers
//
// Announces the realtor closing-gift tote-rental program so installers know
// the network just opened a B2B channel they can plug into. Explains the
// per-job payout structure, the homeowner rack-upsell angle, and points
// them at the Tote Rentals card in their dashboard to opt in.
//
// Uses `tote_rental_announcement_sent_at` (migration 118) for dedup.
// Respects the 7-day signup guard + 1-email-per-day throttle that the
// other announcement crons use so we don't pile launch emails onto
// brand-new installers or hammer existing inboxes.
//
// Called by /api/cron/tote-rental-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processToteRentalAnnouncement(): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .is("tote_rental_announcement_sent_at", null)
      .not("email", "is", null)
      .neq("is_suspended", true)
      .or("is_realtor.is.null,is_realtor.eq.false,is_pro.eq.true")
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[ToteRentalAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[ToteRentalAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[ToteRentalAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const toteRentalsUrl = `${baseUrl}/dashboard/tote-rentals`;

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

      // Personalised unsubscribe URL with the installer id so the handler
      // can flip the right flag(s) without an auth round-trip.
      const unsubscribeUrl = `${baseUrl}/unsubscribe?id=${installer.id}&campaign=tote-rental-announcement`;

      try {
        let sent = false;
        let lastError = "";

        for (let attempt = 0; attempt < 3; attempt++) {
          const emailResult = await sendToteRentalAnnouncementEmail(email, {
            installerName: name,
            toteRentalsUrl,
            unsubscribeUrl,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[ToteRentalAnnouncement] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          // Resend's rate limiter — back off + retry, same pattern the
          // other announcement crons use.
          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[ToteRentalAnnouncement] Failed for ${email}:`, lastError);
        }

        if (sent) {
          await db()
            .from("profiles")
            .update({
              tote_rental_announcement_sent_at: new Date().toISOString(),
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // Pace ourselves to stay well under Resend's per-second cap.
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[ToteRentalAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[ToteRentalAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[ToteRentalAnnouncement] Fatal error:", msg);
    return result;
  }
}
