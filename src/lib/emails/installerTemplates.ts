import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { maskEmail, maskPhone, maskName } from "@/lib/mask";

// ═══════════════════════════════════════════════════════════════════════════
// Shared style primitives — mirrored from customerTemplates so installer
// emails render identically. Brand voice for installer audience: B2B,
// punchy, money-and-time-focused (Auto-routed leads, Pre-sold jobs,
// Automated Cut Lists, Instant Stripe Payouts, Heavy-Duty Tote System).
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

const HR = `<div style="border-top:1px solid #222;margin:24px 0;"></div>`;

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

export async function sendNewBookingAlert(
  installerEmail: string,
  city: string,
  leadDetails: {
    customerName: string;
    customerEmail?: string;
    address?: string;
    unitCount: number;
    totalPrice: number;
    leadId: string;
    buildSnapshotUrl?: string;
  }
): Promise<SendEmailResult> {
  console.log("[Email] sendNewBookingAlert triggered for:", installerEmail, "| Lead:", leadDetails.leadId);
  const jobUrl = `${getAppUrl()}/dashboard/leads/${leadDetails.leadId}`;
  const profitEstimate = Math.round(leadDetails.totalPrice * 0.85);

  const unitsLabel = `${leadDetails.unitCount} unit${leadDetails.unitCount !== 1 ? "s" : ""}`;

  const snapshotHtml = leadDetails.buildSnapshotUrl
    ? `<img src="${leadDetails.buildSnapshotUrl}" alt="Customer Build" style="width:100%;border-radius:6px;border:1px solid #222;margin:0 0 28px;display:block;" />`
    : "";

  const html = masterEmailLayout(
    "New Pre-Sold Job",
    `
    ${eyebrow("Auto-Routed Lead")}
    <p style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;line-height:1.4;">
      ${leadDetails.customerName} &middot; ${city}
    </p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.6;">
      Deposit cleared. The Custom 3D Design and Automated Cut List are waiting in your dashboard &mdash; zero math, zero re-quoting.
    </p>

    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;margin:0 0 28px;">
      <table style="width:100%;">
        <tr>
          <td style="color:#a3a3a3;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;vertical-align:bottom;">Estimated Take-Home</td>
          <td style="text-align:right;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$${profitEstimate.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:8px 0 0;color:#555;font-size:11px;font-style:italic;">After platform fee. Paid via Instant Stripe Payout once the install is marked complete.</p>
    </div>

    ${eyebrow("Job Details")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Customer", leadDetails.customerName)}
      ${leadDetails.customerEmail ? detailRow("Email", leadDetails.customerEmail, { topBorder: true }) : ""}
      ${detailRow("ZIP / Address", leadDetails.address || city, { topBorder: true })}
      ${detailRow("Build", `${unitsLabel} &middot; Heavy-Duty Tote System`, { topBorder: true })}
      ${detailRow("Order Total", `$${leadDetails.totalPrice.toLocaleString()}`, { highlight: true, topBorder: true })}
    </table>

    ${snapshotHtml}

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Open the Job Ticket</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">Cut list, blueprint, customer details, and one-tap call &mdash; all in one place.</p>
      ${ctaButton(jobUrl, "Open Job Ticket")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;line-height:1.6;">
      Best practice: contact the customer within 24 hours to lock in your reputation as a top installer.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `New job in ${city} — $${profitEstimate.toLocaleString()} take-home`,
    html,
  });
}

export async function sendPaymentReceivedAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    amountReceived: number;
    jobTotal: number;
    leadId: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/leads/${data.leadId}`;

  const html = masterEmailLayout(
    "Payment Cleared",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${data.customerName}</strong> just settled the balance. Funds are queued for your next Instant Stripe Payout.
    </p>

    ${eyebrow("Amount Received")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$${data.amountReceived.toLocaleString()}</p>
    </div>

    ${eyebrow("Job")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Customer", data.customerName)}
      ${detailRow("Job Total", `$${data.jobTotal.toLocaleString()}`, { topBorder: true })}
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Job Ticket")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;line-height:1.6;">
      Funds transfer to your connected bank per your Stripe payout schedule. Update your schedule anytime in Stripe.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Payment Received — $${data.amountReceived.toLocaleString()} from ${data.customerName}`,
    html,
  });
}


/**
 * Email 1 — Day 0 (Instant)
 * Subject: Welcome to the Network. Let's get your first job booked.
 * Angle: Don't talk about features. Talk about money.
 */
export async function sendInstallerOnboardingEmail(
  email: string,
  data: {
    name: string;
    isPro?: boolean;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const profileUrl = `${getAppUrl()}/dashboard/profile`;

  void dashboardUrl;

  const html = masterEmailLayout(
    "Welcome to the Network",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Welcome aboard, ${data.name}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You now have a Custom 3D Designer that closes the sale before you swing a hammer, Automated Cut Lists with zero math required, and Auto-Routed Leads that arrive pre-sold &mdash; deposit already paid.
    </p>

    ${eyebrow("First 3 jobs")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$0 Platform Fees</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;">on your first three completed installs.</p>
    </div>

    ${eyebrow("What you unlock today")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Custom 3D Designer that converts visitors to deposits.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Automated Cut Lists &mdash; framing, totes, hardware, calculated.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Instant Stripe Payouts straight to your bank.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Auto-Routed leads matched to your service area.</td></tr>
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">One Setup Step Left</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">Connect your Stripe account so we can route the <strong style="color:#ffffff;">15% deposit</strong> on every quote directly into your bank.</p>
      ${ctaButton(profileUrl, "Connect Stripe & Activate")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to the Network — let's book your first job",
    html,
  });
}

/**
 * Email 2 — Day 2
 * Subject: Your custom QR code is ready.
 * Angle: Get the software into the physical world.
 */
export async function sendOnboardingEmail2_QRCode(
  email: string,
  data: { name: string; slug?: string | null }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const portfolioUrl = data.slug
    ? `${getAppUrl()}/p/${data.slug}`
    : `${getAppUrl()}/dashboard/profile`;

  const html = masterEmailLayout(
    "Your Custom QR Code is Ready",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your public portfolio is live. Homeowners can now Design Their Own unit and book directly &mdash; pre-sold by the time the lead lands in your inbox.
    </p>

    ${data.slug ? `
      ${eyebrow("Your Public Portfolio")}
      <p style="margin:0 0 28px;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;border-bottom:1px solid #222;padding-bottom:18px;">${portfolioUrl}</p>
    ` : ""}

    ${eyebrow("Pro tip")}
    <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">
      Your custom QR code is in the dashboard. Stick it on your <strong style="color:#facc15;">truck</strong>, your <strong style="color:#facc15;">business cards</strong>, and the bottom of every <strong style="color:#facc15;">invoice</strong>. Every scan is an inbound, pre-sold lead.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Download Your QR Code</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">High-res PNG, ready to print on anything.</p>
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Your custom QR code is ready",
    html,
  });
}

/**
 * Email 3 — Day 4
 * Subject: Copy & paste this to get your first custom storage lead.
 * Angle: Do the marketing work for them.
 */
export async function sendOnboardingEmail3_FirstSale(
  email: string,
  data: { name: string; slug?: string | null }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const portfolioUrl = data.slug
    ? `${getAppUrl()}/p/${data.slug}`
    : "[Your Link — set up in Dashboard]";

  const html = masterEmailLayout(
    "First Sale Playbook",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Fastest path to your first pre-sold lead: drop this script in Facebook Marketplace or your local community group. The Custom 3D Designer does the rest.
    </p>

    ${eyebrow("Copy + paste")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:20px 0;margin:0 0 28px;">
      <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.8;font-style:italic;">
        &ldquo;Hey neighbors &mdash; I&rsquo;m doing custom Heavy-Duty Tote Systems this month. They hold 1,000+ lbs and are built to your exact wall dimensions. Design your own and get instant pricing: ${data.slug ? portfolioUrl : "[Your Link]"}&rdquo;
      </p>
    </div>

    ${eyebrow("Where to post")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Facebook Marketplace &mdash; "Home Services" category.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Nextdoor &mdash; your neighborhood group.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Local Facebook groups (HOA, buy/sell, garage life).</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Craigslist &mdash; "Services Offered."</td></tr>
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Dashboard to Copy Link")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Copy + paste this to get your first lead",
    html,
  });
}

/**
 * Email 4 — Day 7
 * Subject: Don't let your free jobs go to waste.
 * Angle: Remind them of the 3-Job Trial scarcity.
 */
export async function sendOnboardingEmail4_Scarcity(
  email: string,
  data: { name: string; jobsCompleted?: number }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const jobsLeft = Math.max(0, 3 - (data.jobsCompleted || 0));

  const html = masterEmailLayout(
    "Don't Let Your Free Jobs Expire",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Quick reminder: your first three completed installs are <strong style="color:#facc15;">platform-fee-free</strong>. That&rsquo;s the Custom 3D Designer, Automated Cut Lists, Auto-Routed Leads, and Instant Stripe Payouts &mdash; all on us.
    </p>

    ${eyebrow("Trial Status")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:48px;font-weight:900;line-height:1;">${jobsLeft}</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">${jobsLeft === 1 ? "Free Job Remaining" : "Free Jobs Remaining"}</p>
    </div>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Got a quote sitting in drafts? Send the link today &mdash; even one Pre-Sold Job inside the trial pays for the next year of platform usage.
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: `${jobsLeft} free job${jobsLeft === 1 ? "" : "s"} remaining — don't let them expire`,
    html,
  });
}

export async function sendInstallerWelcome(
  name: string,
  email: string
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const html = masterEmailLayout(
    "You're Live",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your installer account is <strong style="color:#facc15;">active</strong>. Stripe is connected, the dashboard is wired, and Auto-Routed Leads are queued to fire the moment one matches your service area.
    </p>

    ${eyebrow("How it works from here")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Pre-Sold Jobs (deposit cleared) land in your dashboard automatically.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Every Job Ticket includes the Automated Cut List &mdash; zero math required.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Collect the balance on-site with one tap &mdash; Instant Stripe Payout to your bank.</td></tr>
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:13px;text-align:center;">
      Questions? Reply to this email anytime.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: name,
    subject: "You're live on the Storage Network — let's get you booked",
    html,
  });
}

export async function sendProWelcomeEmail(
  email: string,
  data: {
    name: string;
    slug: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const partnerLinkUrl = `${getAppUrl()}/p/${data.slug}`;

  const html = masterEmailLayout(
    "Pro Tools Activated",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Welcome to Pro, ${data.name}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You&rsquo;ve unlocked the operating system built specifically for what you build. No more DM hunting, no more paper sketches, no more lost out-of-area leads. Everything below is live right now.
    </p>

    ${eyebrow("What's now active")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;vertical-align:top;">
          <p style="margin:0;color:#facc15;font-weight:700;">Custom 3D Designer</p>
          <p style="margin:4px 0 0;color:#a3a3a3;">Customers build their own Heavy-Duty Tote System, see real pricing, hit checkout. You get a Pre-Sold Job in your inbox.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;vertical-align:top;">
          <p style="margin:0;color:#facc15;font-weight:700;">Branded Partner Link</p>
          <p style="margin:4px 0 0;color:#a3a3a3;">One URL for socials, texts, business cards. Customers land on your branded page &mdash; not a generic platform shell.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;vertical-align:top;">
          <p style="margin:0;color:#facc15;font-weight:700;">Secure Deposit Collection</p>
          <p style="margin:4px 0 0;color:#a3a3a3;">Stripe takes the 15% deposit before you ever drive out. Goodbye no-shows.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;vertical-align:top;">
          <p style="margin:0;color:#facc15;font-weight:700;">Network Referral Income</p>
          <p style="margin:4px 0 0;color:#a3a3a3;">Out-of-area leads pay you a 30% referral cut. Passive income from jobs you can&rsquo;t drive to.</p>
        </td>
      </tr>
    </table>

    ${eyebrow("Your Partner Link")}
    <p style="margin:0 0 28px;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;border-bottom:1px solid #222;padding-bottom:18px;">${partnerLinkUrl}</p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Open the Command Center</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;">Job Tickets, Cut Lists, AI Asset Forge, leaderboard &mdash; all in one place.</p>
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Post your link, text it, or stick it on the truck. Watch the inbound roll in.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Pro tools activated \u2014 let's book some jobs",
    html,
  });
}

export async function sendProRenewalReceipt(
  email: string,
  data: {
    name: string;
    slug: string;
    totalJobs: number;
    totalRevenue: number;
    totalProfit: number;
    periodStart: string;
    periodEnd: string;
    amountPaid: number;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const partnerLinkUrl = `${getAppUrl()}/p/${data.slug}`;

  const fmtMoney = (cents: number) => {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const stat = (value: string, label: string, color: string) => `
    <td style="text-align:center;padding:16px 8px;">
      <p style="margin:0;font-size:26px;font-weight:900;color:${color};">${value}</p>
      <p style="margin:4px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;">${label}</p>
    </td>`;

  void stat;

  const momentumNote =
    data.totalJobs === 0
      ? `Time to land that first Pro job. Share your branded link &mdash; the Custom 3D Designer does the selling for you.`
      : `Keep stacking. Every completed install lifts your placement in the Auto-Routed Lead queue.`;

  const html = masterEmailLayout(
    "Pro Subscription Renewed",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your Pro subscription is renewed. Here&rsquo;s your receipt and a quick snapshot of where you stand.
    </p>

    ${eyebrow("Receipt")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Plan", "Storage Network Pro", { highlight: true })}
      ${detailRow("Amount", fmtMoney(data.amountPaid), { topBorder: true })}
      ${detailRow("Period", `${fmtDate(data.periodStart)} \u2013 ${fmtDate(data.periodEnd)}`, { topBorder: true })}
    </table>

    ${eyebrow("Your Numbers")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Jobs Completed", String(data.totalJobs), { highlight: true })}
      ${detailRow("Total Revenue", fmtMoney(data.totalRevenue), { topBorder: true })}
      ${detailRow("Your Take-Home Profit", fmtMoney(data.totalProfit), { highlight: true, topBorder: true })}
    </table>

    <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.7;">${momentumNote}</p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Dashboard")}
    </div>

    ${eyebrow("Your Partner Link")}
    <p style="margin:0;color:#facc15;font-size:14px;font-weight:700;word-break:break-all;">${partnerLinkUrl}</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: `Pro receipt \u2014 ${fmtMoney(data.amountPaid)} \u00b7 ${data.totalJobs} jobs completed`,
    html,
  });
}

export async function sendWaitlistAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerZip: string;
    radiusMiles?: number;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/settings`;

  const radiusLine = data.radiusMiles
    ? `outside your current <strong style="color:#facc15;">${data.radiusMiles}-mile</strong> service radius`
    : "outside your current service area";

  const html = masterEmailLayout(
    "Waitlist Lead",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      A homeowner wants a Heavy-Duty Tote System &mdash; but their ZIP is ${radiusLine}. They&rsquo;ve opted in to your waitlist in case you expand coverage.
    </p>

    ${eyebrow("Lead Details")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("ZIP", data.customerZip, { highlight: true })}
      ${detailRow("Name", data.customerName, { topBorder: true })}
      ${detailRow("Email", `<a href="mailto:${data.customerEmail}" style="color:#facc15;text-decoration:none;">${data.customerEmail}</a>`, { topBorder: true })}
      ${data.customerPhone ? detailRow("Phone", `<a href="tel:${data.customerPhone}" style="color:#facc15;text-decoration:none;">${data.customerPhone}</a>`, { topBorder: true }) : ""}
    </table>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      If you can drive to this ZIP, reach out directly &mdash; or expand your radius in dashboard settings to claim future leads here automatically.
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(`mailto:${data.customerEmail}?subject=Storage%20Network%20%E2%80%94%20Service%20Area%20Update`, "Email Customer")}
      <span style="display:inline-block;width:8px;"></span>
      ${ghostButton(dashboardUrl, "Update Service Area")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      No charge to the customer. No action required if you don&rsquo;t service this area.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Waitlist lead in ZIP ${data.customerZip} — outside your service area`,
    html,
  });
}

export interface CustomerInquiryData {
  installerName: string;
  businessName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
  quoteTotal?: number;
  leadId?: string;
  /** Full itemized quote from the configurator */
  quoteData?: unknown[];
}

export function buildCustomerInquiryTemplate(data: CustomerInquiryData): string {
  const { installerName, businessName, customerName, customerEmail, customerPhone, message, quoteTotal, quoteData } = data;

  const phoneLine = customerPhone
    ? `<tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="tel:${customerPhone}" style="color:#2563eb;text-decoration:none;">${customerPhone}</a></td></tr>`
    : "";

  // Build itemized quote section if quote data is present
  const quoteItems = Array.isArray(quoteData) ? quoteData : [];
  const hasQuoteItems = quoteItems.length > 0;
  const computedTotal = hasQuoteItems
    ? quoteItems.reduce((sum: number, u: unknown) => {
        const item = u as Record<string, unknown>;
        return sum + (typeof item.price === "number" ? item.price : 0);
      }, 0)
    : quoteTotal || 0;

  let quoteSection = "";
  if (hasQuoteItems) {
    const itemRows = quoteItems
      .map((u: unknown, i: number) => {
        const item = u as Record<string, unknown>;
        const desc = item.desc || `${item.cols}\u00d7${item.rows} Unit`;
        const price = typeof item.price === "number" ? `$${item.price.toLocaleString()}` : "";

        // Build addons list
        const addons: string[] = [];
        if (item.hasTotes) {
          const toteType = item.toteType === "GM" ? "GM" : "HDX";
          const toteColor = item.toteColor === "clear" ? " (Clear)" : "";
          addons.push(`${toteType} Totes${toteColor}`);
        } else {
          addons.push("No Totes");
        }
        if (item.hasWheels) addons.push("Wheels");
        if (item.hasTop) addons.push("Plywood Top");
        const addonStr = addons.join(" &bull; ");

        return `
          <tr>
            <td style="padding:10px 0 2px;color:#e2e8f0;font-size:14px;font-weight:600;">Unit ${i + 1}: ${desc}</td>
            <td style="padding:10px 0 2px;color:#facc15;font-size:14px;font-weight:700;text-align:right;">${price}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 0 10px;color:#64748b;font-size:12px;border-bottom:1px solid #1e293b;">${addonStr}</td>
          </tr>`;
      })
      .join("");

    quoteSection = `
    <!-- Itemized Quote -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Quote at Time of Inquiry</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;border-collapse:collapse;">
        ${itemRows}
        <tr>
          <td style="padding:12px 0 0;color:#94a3b8;font-size:13px;font-weight:600;">Total Estimate</td>
          <td style="padding:12px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${computedTotal.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#475569;font-size:11px;font-style:italic;">
        Note: This was the customer&rsquo;s quote when they sent the message — they may be asking about something different.
      </p>
    </div>`;
  } else if (quoteTotal) {
    // Fallback: just show the total if no itemized data
    quoteSection = `
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="color:#94a3b8;">Quote Total</td><td style="font-weight:800;text-align:right;color:#facc15;">$${quoteTotal.toFixed(2)}</td></tr>
      </table>
    </div>`;
  }

  const dashboardUrl = getAppUrl() + "/dashboard";

  return masterEmailLayout(
    "New Customer Inquiry",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      A customer has reached out with a question about their storage build.
    </p>

    <!-- Customer Message -->
    <div style="background-color:#0f172a;border-left:4px solid #facc15;border-radius:0 12px 12px 0;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Message from ${customerName}</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</p>
    </div>

    <!-- Customer Details -->
    <div style="background-color:#1a2332;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="mailto:${customerEmail}" style="color:#2563eb;text-decoration:none;">${customerEmail}</a></td></tr>
        ${phoneLine}
      </table>
    </div>

    ${quoteSection}

    <!-- CTA Buttons -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="mailto:${customerEmail}?subject=Re:%20Your%20Storage%20Build%20Inquiry%20%E2%80%94%20${encodeURIComponent(businessName)}" style="display:inline-block;background-color:#facc15;color:#0f172a;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;margin-right:8px;">
        Reply to ${customerName.split(" ")[0]}
      </a>
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#1e293b;color:#facc15;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;border:2px solid #facc15;">
        View Dashboard
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      You can reply directly to this email — it will go straight to the customer.
    </p>
    `
  );
}

export async function sendReferralHandoffEmail(
  email: string,
  data: {
    referrerName: string;
    customerCity?: string | null;
    customerState?: string | null;
    customerZip?: string | null;
    localInstallerName?: string | null;
    estimatedBounty?: number | null;
  }
): Promise<SendEmailResult> {
  const location = [data.customerCity, data.customerState].filter(Boolean).join(", ")
    || (data.customerZip ? `ZIP ${data.customerZip}` : "another area");

  const bountyDisplay = data.estimatedBounty
    ? `$${data.estimatedBounty.toFixed(2)}`
    : "30% of deposit";

  const html = masterEmailLayout(
    "New Network Referral",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#422006;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128279;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your link just generated a referral! A customer in <strong>${location}</strong> used your configurator link, but the installation address is outside your service area.
    </p>

    ${data.localInstallerName ? `
    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      We've connected them with <strong>${data.localInstallerName}</strong>, a partner installer in their area.
    </p>
    ` : ""}

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Estimated Network Bounty</p>
      <p style="margin:0;color:#f59e0b;font-size:28px;font-weight:900;">${bountyDisplay}</p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">You earn 30% of the deposit when the customer books (min $15).</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; you earn 30% of the deposit on every out-of-area booking.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `Your link generated a referral in ${location}`,
    html,
  });
}

export async function sendBountyPaidEmail(
  email: string,
  data: {
    referrerName: string;
    customerCity?: string | null;
    customerState?: string | null;
    amount: number;
  }
): Promise<SendEmailResult> {
  const location = [data.customerCity, data.customerState].filter(Boolean).join(", ") || "a referred customer";

  const html = masterEmailLayout(
    "Bounty Paid!",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128176;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.referrerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Great news! A customer from <strong>${location}</strong> just booked through your referral. Your network bounty has been deposited.
    </p>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#16a34a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Deposited to Your Stripe Account</p>
      <p style="margin:0;color:#15803d;font-size:36px;font-weight:900;">$${data.amount.toFixed(2)}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${getAppUrl()}/dashboard/referrals" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View My Referrals
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; you earn 30% of the deposit on every out-of-area booking.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `$${data.amount.toFixed(2)} bounty deposited — referral from ${location}`,
    html,
  });
}

export async function sendDemoOwnerNotification(data: {
  prospectName: string;
  prospectEmail: string;
  prospectPhone: string | null;
  date: string;
  time: string;
  calendarLink: string;
  toolExperience?: string | null;
  buildsCurrently?: string | null;
}) {
  const [year, month, day] = data.date.split("-");
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [h, m] = data.time.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const formattedTime = `${hour12}:${m} ${ampm} CT`;

  const body = `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">New demo booking!</p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Name</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.prospectName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Email</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">
            <a href="mailto:${data.prospectEmail}" style="color:#facc15;text-decoration:none;">${data.prospectEmail}</a>
          </td>
        </tr>
        ${data.prospectPhone ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Phone</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">
            <a href="tel:${data.prospectPhone}" style="color:#facc15;text-decoration:none;">${data.prospectPhone}</a>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Date</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Time</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedTime}</td>
        </tr>
        ${data.toolExperience ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Tool Experience</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.toolExperience}</td>
        </tr>` : ""}
        ${data.buildsCurrently ? `<tr>
          <td style="padding:8px 0;color:#94a3b8;">Builds Currently?</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${data.buildsCurrently}</td>
        </tr>` : ""}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${data.calendarLink}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Add to Google Calendar
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      The prospect has been sent a confirmation email. Reach out before the call if possible.
    </p>
  `;

  const html = masterEmailLayout("New Demo Booking", body);

  await sendTransactionalEmail({
    to: "info@wdocustom.com",
    toName: "Storage Network",
    subject: `New demo booking — ${data.prospectName} on ${formattedDate} at ${formattedTime}`,
    html,
  });
}

export async function sendCleanoutUpsellInstallerAlert(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    serviceName: string;
    servicePrice: number;
    depositCollected: number;
    remainingBalance: number;
    scheduledDate?: string;
    leadId: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard/leads/${data.leadId}`;

  let dateHtml = "";
  if (data.scheduledDate) {
    const parsed = new Date(data.scheduledDate + (data.scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      const formatted = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      dateHtml = `<tr><td style="padding:8px 0;color:#94a3b8;">Scheduled</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formatted}</td></tr>`;
    }
  }

  const html = masterEmailLayout(
    "Add-On Service Booked!",
    `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#127881;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Great news! <strong style="color:#e2e8f0;">${data.customerName}</strong> just added a service to their upcoming appointment.
    </p>

    <!-- Service Details -->
    <div style="background-color:#052e16;border:1px solid #166534;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Add-On Service Booked</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:20px;font-weight:800;">${data.serviceName}</p>

      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Service Price</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#e2e8f0;">$${data.servicePrice.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Deposit Collected (50%)</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#16a34a;">$${data.depositCollected.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Your Payout (40%)</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#facc15;">$${Math.round(data.servicePrice * 0.40).toLocaleString()}</td></tr>
        <tr style="border-top:1px solid #166534;"><td style="padding:10px 0 0;color:#94a3b8;">Remaining at Service</td><td style="padding:10px 0 0;font-weight:800;text-align:right;font-size:18px;color:#facc15;">$${data.remainingBalance.toLocaleString()}</td></tr>
      </table>
    </div>

    <!-- Job Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Customer</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#e2e8f0;">${data.customerName}</td></tr>
        ${dateHtml}
      </table>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      This service has been added to the job ticket. The add-on remaining balance of
      <strong style="color:#facc15;">$${data.remainingBalance.toLocaleString()}</strong> has been included
      in the total balance due at service time.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Job Ticket
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      The 40% payout has been transferred to your connected Stripe account.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Add-On Booked: ${data.serviceName} — $${data.servicePrice.toLocaleString()} from ${data.customerName}`,
    html,
  });
}

export { maskEmail, maskPhone, maskName } from "@/lib/mask";

export async function sendTrialCapHotLead(
  installerEmail: string,
  data: {
    installerName: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    grandTotal: number;
    quoteData?: Array<{ desc?: string; cols?: number; rows?: number; price?: number }>;
  }
): Promise<SendEmailResult> {
  const upgradeUrl = `${getAppUrl()}/upgrade`;

  // Mask customer details — installer must subscribe to unlock
  const maskedName = maskName(data.customerName);
  const maskedEmail = maskEmail(data.customerEmail);
  const maskedPhone = data.customerPhone ? maskPhone(data.customerPhone) : null;

  const phoneLine = maskedPhone
    ? `<tr><td style="padding:8px 0;color:#94a3b8;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#64748b;">${maskedPhone}</td></tr>`
    : "";

  const hasQuote = data.quoteData && data.quoteData.length > 0;
  const quoteSummary = hasQuote
    ? data.quoteData!.map((u, i) =>
        `<tr><td style="padding:4px 0;color:#cbd5e1;font-size:13px;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td><td style="padding:4px 0;color:#e2e8f0;font-size:13px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td></tr>`
      ).join("")
    : "";

  const html = masterEmailLayout(
    "You Have a Customer Ready to Book",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;">
      A customer just designed a build and wants to hire <strong style="color:#facc15;">you</strong>.
      They entered their details and are ready to book.
    </p>

    <!-- Dollar amount callout -->
    <div style="text-align:center;margin:24px 0;padding:24px;background:linear-gradient(135deg,#422006,#78350f);border:2px solid #f59e0b;border-radius:16px;">
      <p style="margin:0 0 4px;color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Job Value</p>
      <p style="margin:0;color:#ffffff;font-size:36px;font-weight:900;">$${data.grandTotal.toLocaleString()}</p>
    </div>

    <p style="margin:0 0 24px;color:#f87171;font-size:14px;font-weight:600;text-align:center;">
      You&rsquo;ve used all 3 free trial jobs. Subscribe to Pro to unlock this customer&rsquo;s details.
    </p>

    ${hasQuote ? `
    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Build Summary</p>
      <table style="width:100%;border-collapse:collapse;">
        ${quoteSummary}
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0 0;color:#94a3b8;font-size:13px;">Total</td>
          <td style="padding:10px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${data.grandTotal.toLocaleString()}</td>
        </tr>
      </table>
    </div>
    ` : ""}

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="margin:0 0 10px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${maskedName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#64748b;">${maskedEmail}</td></tr>
        ${phoneLine}
      </table>
    </div>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:12px;text-align:center;font-style:italic;">
      Full contact details will be unlocked when you subscribe to Pro.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${upgradeUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;text-transform:uppercase;letter-spacing:0.5px;">
        Subscribe &amp; Unlock Customer
      </a>
    </div>

    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      This customer has not been charged yet. They&rsquo;re waiting to hear from you.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `$${data.grandTotal.toLocaleString()} job waiting — a customer wants to book`,
    html,
  });
}

export async function sendWaitlistedLeadsUnlocked(
  installerEmail: string,
  data: {
    installerName: string;
    leads: Array<{
      customerName: string;
      customerEmail: string | null;
      customerPhone: string | null;
      estimatedPrice: number | null;
      leadId: string;
    }>;
  }
): Promise<SendEmailResult> {
  const baseUrl = getAppUrl();

  const totalValue = data.leads.reduce(
    (sum, l) => sum + (l.estimatedPrice ?? 0),
    0
  );

  const leadsTableRows = data.leads
    .map(
      (l) => `
      <tr style="border-bottom:1px solid #334155;">
        <td style="padding:12px 8px;">
          <p style="margin:0 0 4px;color:#e2e8f0;font-size:14px;font-weight:600;">${l.customerName}</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">${l.customerEmail || "—"}</p>
          ${l.customerPhone ? `<p style="margin:0;color:#94a3b8;font-size:12px;">${l.customerPhone}</p>` : ""}
        </td>
        <td style="padding:12px 8px;text-align:right;vertical-align:top;">
          <p style="margin:0 0 6px;color:#facc15;font-size:16px;font-weight:800;">${l.estimatedPrice ? `$${l.estimatedPrice.toLocaleString()}` : "—"}</p>
          <a href="${baseUrl}/dashboard/leads/${l.leadId}" style="color:#60a5fa;font-size:12px;text-decoration:none;">View Lead &rarr;</a>
        </td>
      </tr>`
    )
    .join("");

  const html = masterEmailLayout(
    "Your Waitlisted Leads Are Unlocked",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Welcome to <strong style="color:#facc15;">Storage Network Pro</strong>! 🎉
      Your subscription is active and <strong style="color:#e2e8f0;">${data.leads.length} waitlisted lead${data.leads.length === 1 ? "" : "s"}</strong>
      ${data.leads.length === 1 ? "has" : "have"} been unlocked.
    </p>

    <!-- Total value callout -->
    <div style="text-align:center;margin:24px 0;padding:24px;background:linear-gradient(135deg,#064e3b,#065f46);border:2px solid #10b981;border-radius:16px;">
      <p style="margin:0 0 4px;color:#6ee7b7;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Pipeline Unlocked</p>
      <p style="margin:0;color:#ffffff;font-size:36px;font-weight:900;">$${totalValue.toLocaleString()}</p>
      <p style="margin:4px 0 0;color:#6ee7b7;font-size:13px;">${data.leads.length} lead${data.leads.length === 1 ? "" : "s"} ready for follow-up</p>
    </div>

    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:12px 16px;border-bottom:1px solid #334155;">
        <p style="margin:0;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Unlocked Customers</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${leadsTableRows}
      </table>
    </div>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;text-align:center;line-height:1.5;">
      These customers designed a build and are waiting to hear from you.
      Reach out to collect their deposit and confirm the job.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${baseUrl}/dashboard/leads" style="display:inline-block;background-color:#10b981;color:#ffffff;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;text-transform:uppercase;letter-spacing:0.5px;">
        View All Leads
      </a>
    </div>

    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      These customers have not been charged yet. Follow up to collect deposits and lock in the jobs.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `${data.leads.length} lead${data.leads.length === 1 ? "" : "s"} unlocked — $${totalValue.toLocaleString()} in your pipeline`,
    html,
  });
}

