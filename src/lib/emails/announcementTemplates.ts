import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Shared style primitives — mirrored from customer/installer templates so
// every announcement email renders identically. Marketing/feature blasts
// are installer-facing: B2B voice, money + leverage angles, real feature
// names (Custom 3D Designer, Automated Cut Lists, AI Asset Forge,
// Heavy-Duty Tote System, Auto-Routed Leads, Instant Stripe Payouts).
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

function ghostButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #333;">${label}</a>`;
}

function detailRow(label: string, value: string, opts: { highlight?: boolean; topBorder?: boolean } = {}): string {
  const valueColor = opts.highlight ? "#facc15" : "#ffffff";
  const topBorder = opts.topBorder ? "border-top:1px solid #222;" : "";
  return `<tr><td style="padding:10px 0;color:#a3a3a3;font-size:14px;${topBorder}">${label}</td><td style="padding:10px 0;color:${valueColor};font-size:14px;font-weight:700;text-align:right;${topBorder}">${value}</td></tr>`;
}

export interface FeatureAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  guidesUrl: string;
}

export async function sendFeatureAnnouncement(
  email: string,
  data: FeatureAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, guidesUrl } = data;

  const featureRow = (label: string, body: string, last = false) => `
    <tr>
      <td style="padding:18px 0;${last ? "" : "border-bottom:1px solid #222;"}color:#ffffff;font-size:14px;line-height:1.7;vertical-align:top;">
        <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${label}</p>
        <p style="margin:0;">${body}</p>
      </td>
    </tr>`;

  const html = masterEmailLayout(
    "Platform Update",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      We've been building. Here's what just shipped on Storage Network — every release is designed to close more jobs and save you hours per install.
    </p>

    ${eyebrow("What's new")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${featureRow("Open Shelving Units", `Customers can now drop <strong>standalone open shelving</strong> into the Custom 3D Designer — 4', 5', 6' widths in short or tall, same 30" depth as your tote racks. Plywood top and shelves included.`)}
      ${featureRow("Organizer Customization", `Per-bay add-ons: <strong>plywood shelves</strong>, <strong>doors with Blum hinges</strong>, <strong>side panels</strong>, and <strong>rail removal</strong>. Plus a full paint system on frames, doors, and panels — every choice flows straight into the Automated Cut List.`)}
      ${featureRow("Full Toggle Control", `Every feature lives behind a switch in your settings. Don't want to offer Open Shelving? Disable it. Want custom add-on pricing? Override every line item. Your branded page only shows what you say it shows.`)}
      ${featureRow("Guides &amp; Training", `The Guides page now hosts step-by-step videos, install checklists, and a social-media playbook for your branded link. First-time installer or scaling a crew — it's all there.`, true)}
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 28px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Open Settings</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">Toggle features on or off and lock in your custom pricing.</p>
      ${ctaButton(dashboardUrl, "Open Settings")}
      <span style="display:inline-block;width:8px;"></span>
      ${ghostButton(guidesUrl, "View Guides")}
    </div>

    ${eyebrow("Coming soon — Pro only")}
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;font-weight:700;">Auto-Marketing Agent</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      An AI agent that generates SEO-optimized portfolio + service-area pages on your behalf — drives inbound, pre-sold leads directly to your branded link. Zero effort on your end.
    </p>

    <p style="margin:0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: Open Shelving, Organizer Add-Ons + full toggle control",
    html,
  });
}

export interface BountyAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  referralsUrl: string;
}

export async function sendBountyAnnouncementEmail(
  email: string,
  data: BountyAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, referralsUrl } = data;

  const html = masterEmailLayout(
    "Network Bounty",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Out-of-area leads now pay you. Every time a homeowner uses your branded link but their ZIP is outside your service radius, we hand them off to a vetted installer in their area — and you collect a referral cut.
    </p>

    ${eyebrow("How it pays")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Bounty rate", "30% of the deposit", { highlight: true })}
      ${detailRow("Floor per bounty", "$15 minimum", { topBorder: true })}
      ${detailRow("Payout", "Instant Stripe — same as your jobs", { topBorder: true })}
      ${detailRow("Lead source", "Auto-routed from your Partner Link", { topBorder: true })}
    </table>

    ${eyebrow("Why this matters")}
    <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">
      Every Facebook post, business card, and truck decal you've ever shared is now generating passive income on jobs you can't physically drive to. Same link. Wider catchment. Pure upside.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Track Every Bounty</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">See pending payouts, referral history, and link performance in your dashboard.</p>
      ${ctaButton(referralsUrl, "Open Referral Dashboard")}
      <span style="display:inline-block;width:8px;"></span>
      ${ghostButton(dashboardUrl, "Copy My Link")}
    </div>

    <p style="margin:0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: get paid for out-of-area leads (30% of every deposit)",
    html,
  });
}

export interface OverheadAnnouncementData {
  installerName: string;
  dashboardUrl: string;
  marketingUrl: string;
  configuratorSlug?: string;
}

export async function sendOverheadAnnouncementEmail(
  email: string,
  data: OverheadAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl, marketingUrl, configuratorSlug } = data;
  const baseUrl = getAppUrl();
  const img1 = `${baseUrl}/images/Overhead-Storage-1.png`;
  const img2 = `${baseUrl}/images/Overhead-Storage-2.png`;
  const configuratorUrl = configuratorSlug ? `${baseUrl}/design/${configuratorSlug}` : dashboardUrl;

  const html = masterEmailLayout(
    "Overhead Storage Is Live",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You're already on the floor and the walls. Now you sell the ceiling. <strong style="color:#ffffff;">Overhead Ceiling Storage</strong> is live in the Custom 3D Designer — every tote rack quote can become a wall + ceiling combo.
    </p>

    <img src="${img1}" alt="Overhead Ceiling Storage" style="width:100%;border-radius:6px;border:1px solid #222;display:block;margin:0 0 16px;" />
    <img src="${img2}" alt="Overhead Ceiling Storage detail" style="width:100%;border-radius:6px;border:1px solid #222;display:block;margin:0 0 28px;" />

    ${eyebrow("How it works")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Customer drops "Overhead" into the Custom 3D Designer alongside their wall build.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Auto-priced by ceiling area; the Automated Cut List adds joist-mount hardware automatically.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Single deposit, single install visit. One trip, two systems.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Toggle in your settings if you don't want to offer it yet — your branded page only shows what you allow.</td></tr>
    </table>

    ${eyebrow("Why it matters")}
    <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">
      Average overhead add-on lifts ticket size by <strong style="color:#facc15;">$400–$900</strong> with 20 minutes of extra install time. Pure margin. Holiday decorations, camping gear, seasonal totes — every customer has stuff that belongs up there.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Try It in Your Designer</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">Open your branded link, add Overhead, see the live price.</p>
      ${ctaButton(configuratorUrl, "Open the Designer")}
      <span style="display:inline-block;width:8px;"></span>
      ${ghostButton(marketingUrl, "Marketing Tools")}
    </div>

    <p style="margin:0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: Overhead Ceiling Storage — sell the wall + the ceiling",
    html,
  });
}

export interface JigAnnouncementData {
  installerName: string;
  guidesUrl: string;
  profileUrl: string;
}

export async function sendJigAnnouncementEmail(
  email: string,
  data: JigAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, guidesUrl, profileUrl } = data;

  const html = masterEmailLayout(
    "Jig Plans + Custom Material Pricing",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Two upgrades this week. One makes you build faster. One makes you buy smarter. Both stack on top of the Automated Cut List that's already saving you the math.
    </p>

    ${eyebrow("Build Faster — Ladder Jig Plans")}
    <p style="margin:0 0 14px;color:#ffffff;font-size:14px;line-height:1.7;">
      Battle-tested jig plans for $9 that turn out a square, identical ladder every time. Cut once, set once, replicate forever — even your apprentices nail it on day one.
    </p>
    <p style="margin:0 0 14px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Includes the cut list, hardware list, assembly photos, and the lock-down clamps that make a 5-minute ladder repeatable. Pays for itself in saved minutes on your first install.
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      ${ctaButton(guidesUrl, "Get Jig Plans")}
    </div>

    ${eyebrow("Buy Smarter — Custom Material Pricing")}
    <p style="margin:0 0 14px;color:#ffffff;font-size:14px;line-height:1.7;">
      Have a Home Depot Pro account? A friend at the lumberyard? Bulk pricing on rod and totes? Drop your real numbers into Profile → Material Pricing and the platform recalculates margin per job — no more guessing.
    </p>
    <p style="margin:0 0 14px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Your Net Profit on the Job Ticket now reflects exactly what <em>you</em> pay, not the platform default. Hidden margin gets visible.
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      ${ghostButton(profileUrl, "Set My Material Pricing")}
    </div>

    <p style="margin:0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: Ladder Jig Plans ($9) + Custom Material Pricing",
    html,
  });
}

interface FeedbackCallData {
  installerName: string;
  bookingUrl: string;
}

export async function sendFeedbackCallInvite(
  email: string,
  data: FeedbackCallData
): Promise<SendEmailResult> {
  const { installerName, bookingUrl } = data;

  const html = masterEmailLayout(
    "Let's Connect",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      I want to grab 15 minutes on a quick video call. Walk through the platform together, make sure your dashboard is dialed in, and get your honest feedback on what to build next. Your input directly shapes the roadmap.
    </p>

    ${eyebrow("On the call")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Tour your Custom 3D Designer + branded Partner Link.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Audit the Job Ticket workflow — Automated Cut Lists, Stripe payouts, scheduling.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>What's working, what's friction, what would unlock more bookings for you.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>A look at what's coming next — AI Asset Forge, Auto-Marketing Agent, more.</td></tr>
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Pick a Time</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">15 minutes, video or phone. Whatever works.</p>
      ${ctaButton(bookingUrl, "Book My Call")}
    </div>

    <p style="margin:0;color:#a3a3a3;font-size:13px;">
      If now isn't the right time, just reply with what's on your mind &mdash; I read every email.
    </p>
    <p style="margin:12px 0 0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "15 minutes — feedback call on your dashboard",
    html,
  });
}

interface InventoryAnnouncementData {
  installerName: string;
  dashboardUrl: string;
}

export async function sendInventoryAnnouncementEmail(
  email: string,
  data: InventoryAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, dashboardUrl } = data;

  const html = masterEmailLayout(
    "Customer Tote Inventory",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Just shipped: an AI-powered inventory system bolted onto every rack you install. Free for your customers, branded to <em>you</em>, and engineered to drive repeat business straight back to your inbox.
    </p>

    ${eyebrow("How it works")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">1.</span>Hit "Create Inventory QR" on any completed Job Ticket — the platform generates one unique QR per rack you built.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">2.</span>Print + stick the QR labels on the racks before you leave the site (takes 90 seconds).</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">3.</span>Customer opens any tote, snaps a photo, and AI identifies every item inside — "Christmas ornaments (12), string lights, tree skirt." Searchable forever.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">4.</span>Every scan keeps your branded link in front of them — repeat orders, referrals, friends and family.</td></tr>
    </table>

    ${eyebrow("Why it matters")}
    <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">
      Every shelf builder in town stops at the install. You're the only one whose racks <strong style="color:#facc15;">talk to the customer six months later</strong>. That's the moat — and it costs you a 90-second QR sticker.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Generate Your First QR</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">Open any completed Job Ticket and look for the new "Create Inventory QR" button.</p>
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:13px;">— The Storage Network Team</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: AI Tote Inventory — your racks talk to customers forever",
    html,
  });
}

export interface WeeklyDigestData {
  email: string;
  displayName: string;
  pageViews: number;
  quotesCreated: number;
  leadsReceived: number;
  jobsCompleted: number;
  cta: { label: string; href: string; reason: string };
  topInstallers: Array<{ name: string; score: number }>;
  unsubscribeUrl: string;
}

export async function sendWeeklyDigestEmail(
  data: WeeklyDigestData
): Promise<SendEmailResult> {
  const {
    email,
    displayName,
    pageViews,
    quotesCreated,
    leadsReceived,
    jobsCompleted,
    cta,
    topInstallers,
    unsubscribeUrl,
  } = data;

  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const totalActivity = pageViews + quotesCreated + leadsReceived + jobsCompleted;

  // Stat tile — bordered black cell. Mobile email clients respect td padding.
  const statTd = (value: number, label: string) => `
    <td width="25%" style="text-align:center;padding:18px 8px;border:1px solid #222;">
      <p style="margin:0;color:#facc15;font-size:28px;font-weight:900;line-height:1;">${value}</p>
      <p style="margin:8px 0 0;color:#a3a3a3;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${label}</p>
    </td>`;

  const leaderboardRows = topInstallers
    .map((t, i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #222;color:#facc15;font-size:13px;font-weight:900;width:24px;">${i + 1}.</td>
        <td style="padding:12px 0;border-bottom:1px solid #222;color:#ffffff;font-size:13px;font-weight:600;">${t.name}</td>
        <td style="padding:12px 0;border-bottom:1px solid #222;color:#a3a3a3;font-size:13px;text-align:right;">${t.score} pts</td>
      </tr>`)
    .join("");

  const html = masterEmailLayout(
    "Weekly Scorecard",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${displayName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Here's how your week looked. Numbers don't lie.
    </p>

    ${totalActivity === 0 ? `
      ${eyebrow("Heads up")}
      <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">
        You haven't logged in this week. Your competitors are posting on Facebook and landing Pre-Sold Jobs &mdash; don't fall behind. The Custom 3D Designer + AI Asset Forge are still right where you left them.
      </p>
    ` : ""}

    ${eyebrow("Your week")}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px;">
      <tr>
        ${statTd(pageViews, "Page Views")}
        ${statTd(quotesCreated, "Quotes")}
        ${statTd(leadsReceived, "Leads")}
        ${statTd(jobsCompleted, "Jobs Done")}
      </tr>
    </table>

    ${eyebrow("Next move")}
    <p style="margin:0 0 16px;color:#ffffff;font-size:14px;line-height:1.7;">${cta.reason}</p>
    <div style="text-align:center;margin:0 0 28px;">
      ${ctaButton(cta.href, cta.label)}
    </div>

    ${topInstallers.length > 0 ? `
      ${eyebrow("Top Installers This Month")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px;">
        ${leaderboardRows}
      </table>
    ` : ""}

    <div style="text-align:center;margin:0 0 28px;">
      ${ghostButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:11px;text-align:center;">
      <a href="${unsubscribeUrl}" style="color:#555;text-decoration:underline;">Unsubscribe from weekly digests</a>
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: `Weekly Scorecard — ${pageViews} views, ${leadsReceived} leads, ${jobsCompleted} jobs`,
    html,
  });
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// AI Asset Forge launch announcement
//
// Triggered manually via /api/cron/asset-forge-announcement when the
// Storage-Network LoRA finishes training. Uses the newest pure-black
// masterEmailLayout (not the slate emailShell).
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

export interface AssetForgeAnnouncementData {
  installerName: string;
  marketingUrl: string;
  unsubscribeUrl: string;
}

export async function sendAssetForgeAnnouncementEmail(
  email: string,
  data: AssetForgeAnnouncementData
): Promise<SendEmailResult> {
  const { installerName, marketingUrl, unsubscribeUrl } = data;

  const html = masterEmailLayout(
    "AI Asset Forge",
    `
    <!-- Hook -->
    <p style="margin:0 0 8px;color:#ffffff;font-size:18px;font-weight:700;">
      Hey ${installerName} &mdash; meet your new photo studio.
    </p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Stop hunting for stock photos. The <strong style="color:#facc15;">AI Asset Forge</strong> generates scroll-stopping marketing images in seconds &mdash; trained on real Storage-Network installs so the racks, totes, and finishes look like <strong style="color:#ffffff;">your work</strong>, not someone else&rsquo;s warehouse.
    </p>

    <!-- 3-step explainer -->
    <div style="background-color:#0a0a0a;border:1px solid #1a1a1a;border-radius:14px;padding:22px;margin:0 0 24px;">
      <p style="margin:0 0 14px;color:#facc15;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">How it works</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td valign="top" style="width:32px;padding:8px 0;">
            <div style="width:24px;height:24px;border-radius:999px;background:#facc15;color:#000000;text-align:center;line-height:24px;font-weight:900;font-size:12px;">1</div>
          </td>
          <td style="padding:8px 0 8px 12px;color:#e5e5e5;font-size:14px;line-height:1.6;">
            <strong style="color:#ffffff;">Pick a Scene.</strong> Pristine luxury garage, disaster &ldquo;before&rdquo; shot, or close-up tool detail.
          </td>
        </tr>
        <tr>
          <td valign="top" style="width:32px;padding:8px 0;border-top:1px solid #1a1a1a;">
            <div style="width:24px;height:24px;border-radius:999px;background:#facc15;color:#000000;text-align:center;line-height:24px;font-weight:900;font-size:12px;">2</div>
          </td>
          <td style="padding:8px 0 8px 12px;color:#e5e5e5;font-size:14px;line-height:1.6;border-top:1px solid #1a1a1a;">
            <strong style="color:#ffffff;">Set the Vibe.</strong> Bright &amp; airy, industrial dark, or suburban clean.
          </td>
        </tr>
        <tr>
          <td valign="top" style="width:32px;padding:8px 0;border-top:1px solid #1a1a1a;">
            <div style="width:24px;height:24px;border-radius:999px;background:#facc15;color:#000000;text-align:center;line-height:24px;font-weight:900;font-size:12px;">3</div>
          </td>
          <td style="padding:8px 0 8px 12px;color:#e5e5e5;font-size:14px;line-height:1.6;border-top:1px solid #1a1a1a;">
            <strong style="color:#ffffff;">Generate.</strong> Square / landscape / portrait, brand colors, custom details &mdash; all optional. One click and you have an ad-ready asset.
          </td>
        </tr>
      </table>
    </div>

    <!-- Use cases -->
    <p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">
      Use it for
    </p>
    <p style="margin:0 0 24px;color:#e5e5e5;font-size:14px;line-height:1.8;">
      Facebook posts &middot; Instagram feed &amp; Reels &middot; Marketplace listings &middot; Nextdoor neighborhood ads &middot; Website hero images &middot; Flyer art &middot; Anywhere a generic stock photo would water down your brand.
    </p>

    <!-- Credit economy -->
    <div style="background-color:#0a0a0a;border:1px solid #1a1a1a;border-radius:14px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">
        How credits work
      </p>
      <p style="margin:0 0 6px;color:#e5e5e5;font-size:14px;line-height:1.7;">
        &bull; <strong style="color:#ffffff;">10 credits</strong> on the house, just for being on the network.
      </p>
      <p style="margin:0 0 6px;color:#e5e5e5;font-size:14px;line-height:1.7;">
        &bull; <strong style="color:#ffffff;">+10 credits</strong> automatically every time you complete a job.
      </p>
      <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.7;">
        &bull; Each generated asset costs <strong style="color:#ffffff;">1 credit</strong>.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:8px 0 28px;">
      <a href="${marketingUrl}" style="display:inline-block;background:#facc15;color:#000000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:900;font-size:15px;letter-spacing:0.5px;text-transform:uppercase;">
        Open the Forge &rarr;
      </a>
    </div>

    <p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;line-height:1.6;text-align:center;">
      Generate a few. Post them. Watch what happens.
    </p>

    <!-- Unsubscribe -->
    <p style="margin:32px 0 0;color:#444;font-size:11px;line-height:1.6;text-align:center;">
      <a href="${unsubscribeUrl}" style="color:#555;text-decoration:underline;">Unsubscribe from launch announcements</a>
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: "New: AI Asset Forge \u2014 Generate Marketing Photos in Seconds",
    html,
  });
}
