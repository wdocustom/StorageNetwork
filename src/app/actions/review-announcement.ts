"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Review System Announcement — One-Time Blast to All Installers
//
// Announces the verified customer review system. Encourages installers
// to request reviews from past completed jobs. Explains how reviews
// build trust, win more jobs, and appear on their portfolio page.
//
// Uses `review_announcement_email_sent` flag on profiles.
// Respects: 7-day signup guard, 1-email-per-day throttle, suspension check.
//
// Called by /api/cron/review-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processReviewAnnouncement(): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("review_announcement_email_sent.is.null,review_announcement_email_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[ReviewAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[ReviewAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[ReviewAnnouncement] Processing ${installers.length} installers...`);

    const baseUrl = getAppUrl();
    const { sendTransactionalEmail, emailShell } = await import("@/lib/email");

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

      const dashboardUrl = `${baseUrl}/dashboard/leads`;
      const profileUrl = `${baseUrl}/dashboard/profile`;

      const html = emailShell(
        "New Feature: Verified Customer Reviews",
        `
        <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${name},</p>

        <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
          We just launched something big &mdash; <strong style="color:#facc15;">verified customer reviews</strong>.
          This is the feature that turns your completed jobs into a sales engine.
          Real reviews from real customers, verified by the platform, displayed on your portfolio page.
        </p>

        <!-- Feature Hero -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #facc15;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
          <p style="margin:0 0 8px;color:#facc15;font-size:22px;font-weight:900;">Verified Customer Reviews</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">
            One click to request &bull; Verified badge on every review &bull; Showcased on your portfolio
          </p>
        </div>

        <!-- Why Reviews Matter -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Why This Matters</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
            When a customer is deciding between you and another installer, <strong>reviews are the tiebreaker</strong>.
            92% of consumers read reviews before making a purchase. Your portfolio page now shows your
            average rating, a star distribution chart, and individual reviews with a <span style="color:#22c55e;">&#10003; Verified</span>
            badge. This is the kind of social proof that converts browsers into booked jobs.
          </p>
        </div>

        <!-- How It Works for You -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">How It Works</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
            Open any <strong>completed job</strong> in your dashboard. You&rsquo;ll see a new <strong>&ldquo;Customer Review&rdquo;</strong>
            section with two options:
          </p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">1.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Send via Email</strong> &mdash; sends a branded email to your customer with a one-click review link
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">2.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Copy Link</strong> &mdash; copies the review URL so you can text it, DM it, or share however you like
              </td>
            </tr>
          </table>
        </div>

        <!-- What Customers See -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">What Your Customers See</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
            Your customer gets a simple, beautiful review page. <strong>No login required.</strong>
            They tap a star rating, pick quick tags like <em>&ldquo;Professional&rdquo;</em>, <em>&ldquo;On Time&rdquo;</em>,
            <em>&ldquo;Quality Build&rdquo;</em>, and optionally write a few words. It takes less than 30 seconds.
            Every review is marked <span style="color:#22c55e;">&#10003; Verified Purchase</span> because it&rsquo;s tied to an actual paid job on the platform.
          </p>
        </div>

        <!-- Portfolio Display -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Your Portfolio, Upgraded</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.8;">
            Reviews automatically appear on your <strong>/p/ portfolio page</strong> with your average rating,
            star distribution bars, and top tags. Customers who visit your page see real testimonials
            from real homeowners. You can toggle reviews on or off anytime from your
            <a href="${profileUrl}" style="color:#facc15;text-decoration:none;font-weight:700;">profile settings</a>.
          </p>
        </div>

        <!-- Action: Go request reviews NOW -->
        <div style="background:#0f172a;border:2px solid #facc15;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 4px;color:#facc15;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">
            Start Collecting Reviews Today
          </p>
          <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
            Go to any completed job and hit <strong style="color:#e2e8f0;">&ldquo;Request Review&rdquo;</strong> or <strong style="color:#e2e8f0;">&ldquo;Copy Link&rdquo;</strong>.
            <br />We recommend starting with your happiest customers.
          </p>
          <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
            Open My Jobs &rarr;
          </a>
        </div>

        <!-- Tips -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:24px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Pro Tips for Getting Great Reviews</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#128161;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Ask right after the install</strong> &mdash; the experience is fresh and they&rsquo;re excited about their new storage
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#128241;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Text the link</strong> &mdash; texts have a 98% open rate vs. 20% for email. Use &ldquo;Copy Link&rdquo; and send via text
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#127942;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Start with your best jobs</strong> &mdash; request from customers you know were thrilled with the work
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#128640;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>5 reviews is the magic number</strong> &mdash; that&rsquo;s when your portfolio starts converting significantly more visitors into bookings
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
          Every review strengthens your reputation on the platform.<br />
          The installers who collect reviews first will have a major advantage.
        </p>
        `
      );

      try {
        let sent = false;
        let lastError = "";

        for (let attempt = 0; attempt < 3; attempt++) {
          const emailResult = await sendTransactionalEmail({
            to: email,
            toName: name,
            subject: "New: Verified Customer Reviews \u2014 Start Collecting Today",
            html,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[ReviewAnnouncement] Sent to ${email} (${name})`);
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
          console.error(`[ReviewAnnouncement] Failed for ${email}:`, lastError);
        }

        if (sent) {
          await db()
            .from("profiles")
            .update({
              review_announcement_email_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms between sends (Resend rate limit: 2 req/sec)
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[ReviewAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[ReviewAnnouncement] Complete:", result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[ReviewAnnouncement] Fatal error:", msg);
    return result;
  }
}
