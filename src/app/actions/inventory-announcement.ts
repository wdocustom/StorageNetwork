"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendInventoryAnnouncementEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Inventory Feature Announcement — One-Time Blast to All Installers
//
// Announces the customer tote inventory system with AI photo scanning.
// Explains: always free for customers, drives repeat business to installer.
//
// Uses `inventory_announcement_email_sent` flag on profiles.
// Respects 7-day signup guard and 1-email-per-day throttle.
//
// Called by /api/cron/inventory-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processInventoryAnnouncement(): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("inventory_announcement_email_sent.is.null,inventory_announcement_email_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .or("is_realtor.is.null,is_realtor.eq.false,is_pro.eq.true")
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[InventoryAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[InventoryAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[InventoryAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const dashboardUrl = `${baseUrl}/dashboard`;

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

        for (let attempt = 0; attempt < 3; attempt++) {
          const emailResult = await sendInventoryAnnouncementEmail(email, {
            installerName: name,
            dashboardUrl,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[InventoryAnnouncement] Sent to ${email} (${name})`);
            break;
          }

          lastError = emailResult.error || "Unknown error";

          if (lastError.includes("Too many requests") && attempt < 2) {
            const backoff = 1000 * (attempt + 1);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          break;
        }

        if (!sent) {
          result.errors.push(`${email}: ${lastError}`);
          console.error(`[InventoryAnnouncement] Failed for ${email}:`, lastError);
        }

        if (sent) {
          await db()
            .from("profiles")
            .update({
              inventory_announcement_email_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[InventoryAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[InventoryAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[InventoryAnnouncement] Fatal error:", msg);
    return result;
  }
}
