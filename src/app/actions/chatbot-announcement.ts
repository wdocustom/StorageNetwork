"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// AI Chatbot Feature Announcement — One-Time Blast to All Installers
//
// Announces the AI-powered design assistant that helps their customers
// build storage systems before booking. Covers both the inline guided
// configurator on the landing page and the floating chat on /design.
//
// Uses `chatbot_announcement_email_sent` flag on profiles.
// Respects: 7-day signup guard, 1-email-per-day throttle, suspension check.
//
// Called by /api/cron/chatbot-announcement
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

export interface AnnouncementResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function processChatbotAnnouncement(): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: installers, error } = await db()
      .from("profiles")
      .select("id, email, first_name, business_name")
      .or("chatbot_announcement_email_sent.is.null,chatbot_announcement_email_sent.eq.false")
      .not("email", "is", null)
      .neq("is_suspended", true)
      .lt("created_at", sevenDaysAgo)
      .or(`last_announcement_email_at.is.null,last_announcement_email_at.lt.${todayISO}`)
      .limit(200);

    if (error) {
      console.error("[ChatbotAnnouncement] Query error:", error.message);
      result.errors.push(`Query failed: ${error.message}`);
      return result;
    }

    if (!installers || installers.length === 0) {
      console.log("[ChatbotAnnouncement] No installers to email.");
      return result;
    }

    console.log(`[ChatbotAnnouncement] Processing ${installers.length} installers...`);

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

      const pricingUrl = `${baseUrl}/dashboard/pricing`;

      const html = emailShell(
        "New Feature: AI Design Assistant",
        `
        <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${name},</p>

        <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
          We just launched something that&rsquo;s going to change how your customers find and book you &mdash;
          an <strong style="color:#facc15;">AI-powered design assistant</strong> that guides customers through
          building their perfect storage system before they ever hit the checkout button.
        </p>

        <!-- Feature Hero -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #facc15;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">&#10024;&#129302;&#10024;</div>
          <p style="margin:0 0 8px;color:#facc15;font-size:22px;font-weight:900;">AI Design Assistant</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">
            Guides your customers step-by-step &bull; Uses YOUR pricing &bull; Only offers what YOU provide
          </p>
        </div>

        <!-- Landing Page Flow -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">On the Landing Page</p>
          <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.8;">
            When a customer visits Storage Network and enters their ZIP code, the system finds you as their
            local installer. Then it walks them through a clean, step-by-step configurator &mdash; right there on the page:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">1.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Wall measurements</strong> &mdash; asks how wide and tall the space is, recommends the right number of columns and tiers
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">2.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Totes</strong> &mdash; include HDX totes or bring your own? Black or clear? Uses <em>your</em> per-tote price.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">3.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Add-ons</strong> &mdash; wheels, plywood top. Shows <em>your</em> add-on prices.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">4.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Multiple units</strong> &mdash; asks if they need more than one unit for different walls
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;font-weight:bold;">5.</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Summary &amp; 3D</strong> &mdash; shows the estimated price, then sends them to the 3D designer <em>pre-configured</em>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            By the time they reach the 3D designer, they already know what they want and how much it costs.
            <strong style="color:#e2e8f0;">That means higher conversion and fewer abandoned builds.</strong>
          </p>
        </div>

        <!-- Design Page Chat -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">On the 3D Design Page</p>
          <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.8;">
            Some customers get to the 3D designer and feel overwhelmed by all the options.
            Now there&rsquo;s a <strong>floating chat bubble</strong> in the corner they can tap to get help.
          </p>
          <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.8;">
            The AI assistant uses <strong>your name</strong>, <strong>your pricing</strong>, and <strong>your product catalog</strong>
            to walk them through the build conversationally. It:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;color:#e2e8f0;font-size:14px;">
                &#10003; Only offers services you&rsquo;ve enabled (totes, shelving, overhead, planters)
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#e2e8f0;font-size:14px;">
                &#10003; Uses your exact per-slot, per-tote, and add-on prices
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#e2e8f0;font-size:14px;">
                &#10003; Never mentions products you don&rsquo;t offer (no mini totes if you haven&rsquo;t enabled them)
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#e2e8f0;font-size:14px;">
                &#10003; Only suggests presets you haven&rsquo;t disabled
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#e2e8f0;font-size:14px;">
                &#10003; Gives accurate price quotes using pre-computed lookup tables (no AI math errors)
              </td>
            </tr>
          </table>
        </div>

        <!-- What You Need to Do -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px 24px;margin-bottom:16px;border-left:3px solid #facc15;">
          <p style="margin:0 0 10px;color:#facc15;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">What You Need to Do</p>
          <p style="margin:0 0 12px;color:#e2e8f0;font-size:14px;line-height:1.8;">
            <strong>Nothing.</strong> The AI assistant is already live and using your existing configuration.
            But here are a few things to double-check:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#128161;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Review your pricing</strong> &mdash; the AI uses your exact rates. Make sure per-slot, per-tote, wheels, and top prices are current.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#9881;&#65039;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Check your feature toggles</strong> &mdash; if you offer overhead storage, shelving, or planters, make sure they&rsquo;re enabled in your pricing settings.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;vertical-align:top;width:24px;">
                <span style="color:#facc15;font-size:14px;">&#128683;</span>
              </td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">
                <strong>Disable what you don&rsquo;t offer</strong> &mdash; if you don&rsquo;t install mini tote systems, make sure <em>mini_enabled</em> is off. The AI respects every toggle.
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA -->
        <div style="background:#0f172a;border:2px solid #facc15;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 4px;color:#facc15;font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">
            Make Sure Your Config is Dialed In
          </p>
          <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;line-height:1.6;">
            The AI assistant is only as good as your settings. Take 60 seconds to verify.
          </p>
          <a href="${pricingUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
            Review My Pricing Settings &rarr;
          </a>
        </div>

        <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
          This is a major upgrade to how customers interact with your builds.<br />
          The AI does the selling for you &mdash; 24/7, using your prices, representing your brand.
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
            subject: "New: AI Design Assistant \u2014 Your Customers Can Now Build Before They Book",
            html,
          });

          if (emailResult.success) {
            sent = true;
            result.sent++;
            console.log(`[ChatbotAnnouncement] Sent to ${email} (${name})`);
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
          console.error(`[ChatbotAnnouncement] Failed for ${email}:`, lastError);
        }

        if (sent) {
          await db()
            .from("profiles")
            .update({
              chatbot_announcement_email_sent: true,
              last_announcement_email_at: new Date().toISOString(),
            })
            .eq("id", installer.id);
        }

        // 600ms between sends (Resend rate limit: 2 req/sec)
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${email}: ${msg}`);
        console.error(`[ChatbotAnnouncement] Error for ${email}:`, msg);
      }
    }

    console.log("[ChatbotAnnouncement] Complete:", result);
  } catch (err) {
    console.error("[ChatbotAnnouncement] Fatal error:", err);
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}
