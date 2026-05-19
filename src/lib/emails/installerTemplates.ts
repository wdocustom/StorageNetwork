import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import { maskEmail, maskPhone, maskName } from "@/lib/mask";
import { getDepositLabel } from "@/app/actions/fee-engine";

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
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">Connect your Stripe account so we can route the <strong style="color:#ffffff;">deposit</strong> on every quote directly into your bank. You can set your deposit rate in your profile any time.</p>
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
    /** Installer's profile id — used to look up their configured deposit
     *  rate. When omitted, copy falls back to a generic "the deposit" so
     *  we never display a wrong number. */
    installerId?: string;
  }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const partnerLinkUrl = `${getAppUrl()}/p/${data.slug}`;
  const depositLabel = data.installerId ? await getDepositLabel(data.installerId) : null;

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
          <p style="margin:4px 0 0;color:#a3a3a3;">Stripe takes ${depositLabel ? `the <strong style="color:#ffffff;">${depositLabel}</strong> deposit` : "the deposit"} before you ever drive out. Goodbye no-shows.</p>
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

  const html = masterEmailLayout(
    "Pro Subscription Renewed",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your Pro subscription is renewed. Here&rsquo;s your receipt.
    </p>

    ${eyebrow("Receipt")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Plan", "Storage Network Pro", { highlight: true })}
      ${detailRow("Amount", fmtMoney(data.amountPaid), { topBorder: true })}
      ${detailRow("Period", `${fmtDate(data.periodStart)} \u2013 ${fmtDate(data.periodEnd)}`, { topBorder: true })}
    </table>

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
    subject: `Pro receipt \u2014 ${fmtMoney(data.amountPaid)}`,
    html,
  });
}

export async function sendSubscriptionPaymentFailed(
  email: string,
  data: {
    name: string;
    amountDue: number;
    invoiceNumber: string | null;
    attemptCount: number;
    nextAttemptAt: string | null;
    hostedInvoiceUrl: string | null;
    portalUrl: string;
  }
): Promise<SendEmailResult> {
  const fmtMoney = (cents: number) => {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const retryLine = data.nextAttemptAt
    ? `Stripe will automatically retry on ${fmtDate(data.nextAttemptAt)}. If you'd rather not wait, pay now or update your card and we'll re-charge immediately.`
    : `This was the final automatic retry. Please pay the invoice or update your card to keep your Pro account active.`;

  const primaryCta = data.hostedInvoiceUrl
    ? `${ctaButton(data.hostedInvoiceUrl, "Pay Invoice")}<span style="display:inline-block;width:8px;"></span>${ghostButton(data.portalUrl, "Update Card")}`
    : ctaButton(data.portalUrl, "Update Payment Method");

  const html = masterEmailLayout(
    "Renewal Payment Failed",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your Pro subscription renewal for <strong style="color:#facc15;">${fmtMoney(data.amountDue)}</strong> didn&rsquo;t go through. This usually means the saved card was declined, blocked by your bank, or has expired (single-use virtual cards do this when they&rsquo;re deactivated).
    </p>

    ${eyebrow("Invoice")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Amount Due", fmtMoney(data.amountDue), { highlight: true })}
      ${data.invoiceNumber ? detailRow("Invoice", data.invoiceNumber, { topBorder: true }) : ""}
      ${detailRow("Attempt", String(data.attemptCount), { topBorder: true })}
    </table>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      ${retryLine}
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${primaryCta}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      If repeated retries fail, your Pro account will be paused until payment is resolved.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: `Action required \u2014 your Pro renewal didn't go through`,
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
        const desc = item.desc || `${item.cols}×${item.rows} Unit`;
        const price = typeof item.price === "number" ? `$${item.price.toLocaleString()}` : "";

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
        const addonStr = addons.join(" • ");

        return `
          <tr>
            <td style="padding:14px 0 4px;color:#ffffff;font-size:14px;font-weight:600;line-height:1.5;">
              <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${desc}
            </td>
            <td style="padding:14px 0 4px;color:#ffffff;font-size:14px;font-weight:700;text-align:right;white-space:nowrap;">${price}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 0 14px;color:#a3a3a3;font-size:12px;border-bottom:1px solid #222;">${addonStr}</td>
          </tr>`;
      })
      .join("");

    quoteSection = `
      ${eyebrow("Quote at Time of Inquiry")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
        ${itemRows}
        <tr>
          <td style="padding:18px 0 0;color:#a3a3a3;font-size:13px;font-weight:600;vertical-align:bottom;">Total Estimate</td>
          <td style="padding:18px 0 0;color:#facc15;font-size:22px;font-weight:900;text-align:right;">$${computedTotal.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:0 0 28px;color:#555;font-size:11px;font-style:italic;">Note: this was the customer’s quote when they sent the message — they may be asking about something different.</p>`;
  } else if (quoteTotal) {
    quoteSection = `
      ${eyebrow("Quote at Time of Inquiry")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${detailRow("Quote Total", `$${quoteTotal.toFixed(2)}`, { highlight: true })}
      </table>`;
  }

  const dashboardUrl = getAppUrl() + "/dashboard";
  const replySubject = `Re:%20Your%20Storage%20Build%20Inquiry%20%E2%80%94%20${encodeURIComponent(businessName)}`;

  return masterEmailLayout(
    "Customer Inquiry",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      A homeowner has a question about their build. Reply directly to this email and it goes straight to them — no copy/paste.
    </p>

    ${eyebrow(`Message from ${customerName}`)}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:20px 0;margin:0 0 28px;">
      <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</p>
    </div>

    ${eyebrow("Contact")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Name", customerName)}
      ${detailRow("Email", `<a href="mailto:${customerEmail}" style="color:#facc15;text-decoration:none;">${customerEmail}</a>`, { topBorder: true })}
      ${customerPhone ? detailRow("Phone", `<a href="tel:${customerPhone}" style="color:#facc15;text-decoration:none;">${customerPhone}</a>`, { topBorder: true }) : ""}
    </table>

    ${quoteSection}

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(`mailto:${customerEmail}?subject=${replySubject}`, `Reply to ${customerName.split(" ")[0]}`)}
      <span style="display:inline-block;width:8px;"></span>
      ${ghostButton(dashboardUrl, "Open Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Reply to this email and your response goes straight to the customer.
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
    "Network Referral",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.referrerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your branded link just generated an out-of-area lead in <strong style="color:#ffffff;">${location}</strong>${data.localInstallerName ? `. We&rsquo;ve handed them off to <strong style="color:#ffffff;">${data.localInstallerName}</strong>` : ""}. You&rsquo;re owed a referral cut.
    </p>

    ${eyebrow("Your Cut")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:36px;font-weight:900;line-height:1;">${bountyDisplay}</p>
      <p style="margin:8px 0 0;color:#a3a3a3;font-size:13px;">30% of the deposit, minimum $15. Paid out to your Stripe once the customer books.</p>
    </div>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(`${getAppUrl()}/dashboard/referrals`, "View My Referrals")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; every out-of-area booking pays you again.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `Network referral in ${location} — ${bountyDisplay} owed`,
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
    "Bounty Paid",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.referrerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      A customer from <strong style="color:#ffffff;">${location}</strong> booked through your branded link. Your network bounty just hit your Stripe account.
    </p>

    ${eyebrow("Instant Stripe Payout")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$${data.amount.toFixed(2)}</p>
    </div>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(`${getAppUrl()}/dashboard/referrals`, "View My Referrals")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Keep sharing your link &mdash; every out-of-area booking pays you 30% of the deposit.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.referrerName,
    subject: `$${data.amount.toFixed(2)} bounty paid — referral from ${location}`,
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
    ${eyebrow("New Demo Booking")}

    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Name", data.prospectName)}
      ${detailRow("Email", `<a href="mailto:${data.prospectEmail}" style="color:#facc15;text-decoration:none;">${data.prospectEmail}</a>`, { topBorder: true })}
      ${data.prospectPhone ? detailRow("Phone", `<a href="tel:${data.prospectPhone}" style="color:#facc15;text-decoration:none;">${data.prospectPhone}</a>`, { topBorder: true }) : ""}
      ${detailRow("Date", formattedDate, { topBorder: true })}
      ${detailRow("Time", formattedTime, { highlight: true, topBorder: true })}
      ${data.toolExperience ? detailRow("Tool Experience", data.toolExperience, { topBorder: true }) : ""}
      ${data.buildsCurrently ? detailRow("Builds Currently?", data.buildsCurrently, { topBorder: true }) : ""}
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(data.calendarLink, "Add to Calendar")}
    </div>

    <p style="margin:0;color:#a3a3a3;font-size:13px;text-align:center;">
      The prospect has been sent a confirmation. Reach out before the call if possible.
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

  let scheduledRow = "";
  if (data.scheduledDate) {
    const parsed = new Date(data.scheduledDate + (data.scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      const formatted = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      scheduledRow = detailRow("Install Date", formatted, { highlight: true, topBorder: true });
    }
  }

  const installerPayout = Math.round(data.servicePrice * 0.4);

  const html = masterEmailLayout(
    "Add-On Booked",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${data.customerName}</strong> just stacked an add-on onto their upcoming install. Your 35% payout is already on its way to your Stripe account.
    </p>

    ${eyebrow(data.serviceName)}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Service Price", `$${data.servicePrice.toLocaleString()}`)}
      ${detailRow("Deposit Collected (50%)", `$${data.depositCollected.toLocaleString()}`, { topBorder: true })}
      ${detailRow("Your Payout (35%)", `$${installerPayout.toLocaleString()}`, { highlight: true, topBorder: true })}
      ${detailRow("Balance at Service", `$${data.remainingBalance.toLocaleString()}`, { highlight: true, topBorder: true })}
    </table>

    ${eyebrow("Job")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Customer", data.customerName)}
      ${scheduledRow}
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Open Job Ticket")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      The add-on balance of <strong style="color:#ffffff;">$${data.remainingBalance.toLocaleString()}</strong> is rolled into the customer&rsquo;s service-day total automatically.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Add-on booked: ${data.serviceName} — $${installerPayout.toLocaleString()} payout`,
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

  const maskedName = maskName(data.customerName);
  const maskedEmail = maskEmail(data.customerEmail);
  const maskedPhone = data.customerPhone ? maskPhone(data.customerPhone) : null;

  const hasQuote = data.quoteData && data.quoteData.length > 0;
  const buildRows = hasQuote
    ? data.quoteData!.map((u, i) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;">
            <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc || `${u.cols}×${u.rows} Unit`}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
        </tr>`).join("")
    : "";

  const html = masterEmailLayout(
    "Hot Lead — Locked",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      A homeowner just designed a build, entered their details, and asked for <strong style="color:#ffffff;">you</strong> by name. You've hit the free-trial cap — activate Pro to unlock this Pre-Sold Job.
    </p>

    ${eyebrow("Job Value")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$${data.grandTotal.toLocaleString()}</p>
    </div>

    ${hasQuote ? `
      ${eyebrow("Build")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${buildRows}
      </table>
    ` : ""}

    ${eyebrow("Customer (locked)")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Name", `<span style="color:#555;">${maskedName}</span>`)}
      ${detailRow("Email", `<span style="color:#555;">${maskedEmail}</span>`, { topBorder: true })}
      ${maskedPhone ? detailRow("Phone", `<span style="color:#555;">${maskedPhone}</span>`, { topBorder: true }) : ""}
    </table>
    <p style="margin:0 0 28px;color:#555;font-size:11px;font-style:italic;text-align:center;">Full contact details unlock the moment you activate Pro.</p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Activate Pro &amp; Unlock</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">One Pre-Sold Job pays for the next year of platform usage. The customer hasn't been charged — they're waiting on you.</p>
      ${ctaButton(upgradeUrl, "Activate Pro")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      This lead expires after 7 days if it stays locked.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `$${data.grandTotal.toLocaleString()} job locked — activate Pro to unlock`,
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
  const totalValue = data.leads.reduce((sum, l) => sum + (l.estimatedPrice ?? 0), 0);
  const leadCount = data.leads.length;

  const leadsRows = data.leads
    .map((l) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;vertical-align:top;">
          <p style="margin:0 0 4px;font-weight:700;">${l.customerName}</p>
          <p style="margin:0;color:#a3a3a3;font-size:12px;">${l.customerEmail || "—"}${l.customerPhone ? ` &middot; ${l.customerPhone}` : ""}</p>
          <p style="margin:6px 0 0;"><a href="${baseUrl}/dashboard/leads/${l.leadId}" style="color:#facc15;font-size:12px;text-decoration:none;font-weight:700;">Open Job Ticket →</a></p>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;vertical-align:top;color:#facc15;font-size:16px;font-weight:800;white-space:nowrap;">${l.estimatedPrice ? `$${l.estimatedPrice.toLocaleString()}` : "—"}</td>
      </tr>`)
    .join("");

  const html = masterEmailLayout(
    "Waitlist Unlocked",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Welcome to Pro. <strong style="color:#ffffff;">${leadCount} waitlisted ${leadCount === 1 ? "lead" : "leads"}</strong> just unlocked &mdash; the homeowners already designed their builds and are waiting on you.
    </p>

    ${eyebrow("Pipeline Unlocked")}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:36px;font-weight:900;line-height:1;">$${totalValue.toLocaleString()}</p>
      <p style="margin:8px 0 0;color:#a3a3a3;font-size:13px;">${leadCount} ${leadCount === 1 ? "lead" : "leads"} ready for follow-up.</p>
    </div>

    ${eyebrow("Your Unlocked Leads")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${leadsRows}
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(`${baseUrl}/dashboard/leads`, "Open Lead Inbox")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Customers haven't been charged yet. Reach out to collect the Secure Deposit and lock in each job.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `${leadCount} ${leadCount === 1 ? "lead" : "leads"} unlocked — $${totalValue.toLocaleString()} in pipeline`,
    html,
  });
}

