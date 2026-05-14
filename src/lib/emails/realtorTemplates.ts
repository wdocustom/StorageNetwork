import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor email templates.
//
// Audience-specific tone:
//   - Welcome / receipts → realtor (credibility, closing-gift framing)
//   - Recipient invite + magic code → buyer or seller (warm, branded with
//     the realtor's name + brokerage; storage network is the courier, not
//     the headliner)
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

function detailRow(label: string, value: string): string {
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #222;color:#a3a3a3;font-size:13px;width:50%;">${label}</td><td style="padding:12px 0;border-bottom:1px solid #222;color:#ffffff;font-size:13px;text-align:right;font-weight:600;">${value}</td></tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Welcome (existing — Phase A1) ─────────────────────────────────────────

export async function sendRealtorWelcomeEmail(
  email: string,
  data: { name: string; brokerage: string }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/realtors/dashboard`;

  const html = masterEmailLayout(
    "Welcome to Storage Network",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Welcome, ${escapeHtml(data.name)}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You just unlocked the smartest closing gift on the market &mdash;
      reusable moving totes, delivered to your buyer or seller, picked up
      after they're settled. No cardboard. No mess. And every tote arrives
      with <strong style="color:#ffffff;">your name on the box</strong>.
    </p>

    ${eyebrow("How it works")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">1.</span>Pick a tote package &mdash; 20, 30, 40, or 50 totes &mdash; for the size of the move.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">2.</span>Send the gift link to your buyer or seller. Your name, your brokerage, your message.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">3.</span>A local pro delivers and picks up. You look like a hero. Done.</td></tr>
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">${escapeHtml(data.brokerage)}</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">Your dashboard is live. Set up your branding, then send your first gift &mdash; takes about 90 seconds.</p>
      ${ctaButton(dashboardUrl, "Open Realtor Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to Storage Network — your closing-gift toolkit is live",
    html,
  });
}

// ── Recipient invite — the moment the gift goes live ─────────────────────

export async function sendGiftRecipientInvite(
  email: string,
  data: {
    recipientName: string;
    realtorName: string;
    brokerage: string;
    packageName: string;
    toteCount: number;
    durationDays: number;
    personalMessage: string | null;
    giftUrl: string;
  }
): Promise<SendEmailResult> {
  const giverLine = data.brokerage
    ? `${escapeHtml(data.realtorName)} &middot; ${escapeHtml(data.brokerage)}`
    : escapeHtml(data.realtorName);

  const messageBlock = data.personalMessage
    ? `
      <div style="border-left:3px solid #facc15;background-color:#111111;padding:18px 22px;margin:0 0 28px;border-radius:0 8px 8px 0;">
        ${eyebrow("A note from " + escapeHtml(data.realtorName))}
        <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.7;font-style:italic;">&ldquo;${escapeHtml(data.personalMessage)}&rdquo;</p>
      </div>
    `
    : "";

  const html = masterEmailLayout(
    "You've been gifted a move",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${giverLine}</strong> just sent you a closing gift &mdash; a full set of reusable moving totes, delivered to your door and picked up after you've settled in. No cardboard, no mess.
    </p>

    ${messageBlock}

    ${eyebrow("Your gift")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Package", escapeHtml(data.packageName))}
      ${detailRow("Totes included", `${data.toteCount} totes`)}
      ${detailRow("Rental window", `${data.durationDays} days`)}
      ${detailRow("Delivery & pickup", "Included")}
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Schedule your delivery</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">
        Click through to verify your email, confirm your address, and pick
        delivery + pickup windows. Takes about a minute.
      </p>
      ${ctaButton(data.giftUrl, "Open Your Gift")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `${data.realtorName} sent you reusable moving totes for your move`,
    html,
  });
}

// ── Magic-link OTP ────────────────────────────────────────────────────────

export async function sendGiftMagicCodeEmail(
  email: string,
  data: { recipientName: string; code: string; expiresInMinutes: number }
): Promise<SendEmailResult> {
  const html = masterEmailLayout(
    "Your verification code",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Use this code to verify your email and pick up your closing gift.
      It expires in ${data.expiresInMinutes} minutes.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:36px;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:42px;font-weight:900;letter-spacing:12px;font-family:monospace;">${escapeHtml(data.code)}</p>
    </div>

    <p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;line-height:1.6;">
      Didn't request this? You can safely ignore this email &mdash; your gift will sit waiting until you do.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `${data.code} is your Storage Network verification code`,
    html,
  });
}

// ── Realtor purchase receipt ──────────────────────────────────────────────

export async function sendRealtorGiftReceipt(
  email: string,
  data: {
    realtorName: string;
    recipientName: string;
    packageName: string;
    toteCount: number;
    durationDays: number;
    amountCents: number;
    giftUrl: string;
  }
): Promise<SendEmailResult> {
  const amount = `$${(data.amountCents / 100).toFixed(2)}`;

  const html = masterEmailLayout(
    "Gift sent",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.realtorName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your closing gift for <strong style="color:#ffffff;">${escapeHtml(data.recipientName)}</strong>
      is on its way. We just emailed them the gift link &mdash; they'll
      pick a delivery window from there.
    </p>

    ${eyebrow("Receipt")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Package", escapeHtml(data.packageName))}
      ${detailRow("Totes", `${data.toteCount} totes`)}
      ${detailRow("Rental window", `${data.durationDays} days`)}
      ${detailRow("Total charged", amount)}
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 12px;color:#a3a3a3;font-size:13px;line-height:1.6;">
        You can preview the gift link your recipient receives below &mdash; copy it into a text or DM if you'd like to follow up personally.
      </p>
      <p style="margin:0;color:#facc15;font-size:13px;word-break:break-all;font-family:monospace;">${escapeHtml(data.giftUrl)}</p>
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Track this gift any time at <a href="${getAppUrl()}/realtors/dashboard/gifts" style="color:#facc15;text-decoration:none;">your dashboard</a>.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.realtorName,
    subject: `Receipt: ${data.packageName} for ${data.recipientName}`,
    html,
  });
}

// ── Fulfillment milestone emails (Phase A3) ──────────────────────────────

function formatWindow(start: string, end: string): string {
  if (!start || !end) return "TBD";
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.valueOf())) return "TBD";
  const date = s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = `${s.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })} – ${e.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}`;
  return `${date}, ${time}`;
}

/**
 * Installer-side alert. They've been auto-assigned a new tote-rental job.
 * Includes everything they need to dispatch without clicking through.
 */
export async function sendGiftInstallerAssignedAlert(
  email: string,
  data: {
    installerName: string;
    recipientName: string;
    deliveryAddress: string;
    deliveryWindowStart: string;
    deliveryWindowEnd: string;
    pickupWindowStart: string;
    pickupWindowEnd: string;
    toteCount: number;
    durationDays: number;
    packageName: string;
    jobsDashboardUrl: string;
  }
): Promise<SendEmailResult> {
  const jobsUrl = data.jobsDashboardUrl.startsWith("http")
    ? data.jobsDashboardUrl
    : `${getAppUrl()}${data.jobsDashboardUrl}`;

  const html = masterEmailLayout(
    "New Tote Rental Assigned",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${escapeHtml(data.installerName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      A realtor closing-gift job just routed to you. Recipient is signed
      off on the schedule below &mdash; you can dispatch as-is or use the
      dashboard to coordinate.
    </p>

    ${eyebrow("Job details")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Recipient", escapeHtml(data.recipientName))}
      ${detailRow("Package", `${escapeHtml(data.packageName)} (${data.toteCount} totes, ${data.durationDays}-day rental)`)}
      ${detailRow("Drop-off", escapeHtml(data.deliveryAddress || "TBD"))}
      ${detailRow("Delivery window", formatWindow(data.deliveryWindowStart, data.deliveryWindowEnd))}
      ${detailRow("Pickup window", formatWindow(data.pickupWindowStart, data.pickupWindowEnd))}
    </table>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Open in your dashboard</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">Mark the job delivered after drop-off and returned after pickup &mdash; that triggers the recipient and realtor updates automatically.</p>
      ${ctaButton(jobsUrl, "View Tote Rentals")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.installerName,
    subject: `New tote rental — ${data.recipientName} (${data.toteCount} totes)`,
    html,
  });
}

/**
 * Installer alert — recipient has signaled they're ready for pickup before
 * the scheduled pickup window. The installer can coordinate an earlier
 * pickup directly via phone/email or stick with the existing window.
 */
export async function sendGiftEarlyPickupRequestAlert(
  email: string,
  data: {
    installerName: string;
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string | null;
    deliveryAddress: string;
    toteCount: number;
    pickupWindowStart: string;
    pickupWindowEnd: string;
    note: string | null;
    jobDetailUrl: string;
  }
): Promise<SendEmailResult> {
  const jobUrl = data.jobDetailUrl.startsWith("http")
    ? data.jobDetailUrl
    : `${getAppUrl()}${data.jobDetailUrl}`;

  const phoneRow = data.recipientPhone
    ? detailRow(
        "Phone",
        `<a href="tel:${escapeHtml(data.recipientPhone)}" style="color:#facc15;text-decoration:none;">${escapeHtml(data.recipientPhone)}</a>`
      )
    : "";

  const noteBlock = data.note
    ? `
    ${eyebrow("Recipient note")}
    <p style="margin:0 0 24px;padding:16px;background-color:#111111;border:1px solid #222;border-radius:12px;color:#e5e5e5;font-size:14px;line-height:1.6;font-style:italic;">
      &ldquo;${escapeHtml(data.note)}&rdquo;
    </p>
    `
    : "";

  const html = masterEmailLayout(
    "Recipient ready for early pickup",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hey ${escapeHtml(data.installerName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#facc15;">${escapeHtml(data.recipientName)}</strong> is done with their ${data.toteCount} totes
      ahead of schedule and is asking if you can swing by to pick them up
      before the original window.
    </p>

    ${eyebrow("Recipient")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${detailRow("Name", escapeHtml(data.recipientName))}
      ${detailRow("Email", `<a href="mailto:${escapeHtml(data.recipientEmail)}" style="color:#facc15;text-decoration:none;">${escapeHtml(data.recipientEmail)}</a>`)}
      ${phoneRow}
      ${detailRow("Address", escapeHtml(data.deliveryAddress || "TBD"))}
      ${detailRow("Original pickup window", formatWindow(data.pickupWindowStart, data.pickupWindowEnd))}
    </table>

    ${noteBlock}

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Open the job</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">
        Reach out to ${escapeHtml(data.recipientName)} directly to coordinate, or stick with the scheduled window if early pickup doesn&rsquo;t work.
      </p>
      ${ctaButton(jobUrl, "View job")}
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.installerName,
    subject: `${data.recipientName} is ready for early pickup`,
    html,
  });
}

/**
 * Recipient update — "you're confirmed, here's who's delivering".
 */
export async function sendGiftRecipientAssignedUpdate(
  email: string,
  data: {
    recipientName: string;
    installerName: string;
    installerSlug: string | null;
    giftUrl: string;
  }
): Promise<SendEmailResult> {
  const url = data.giftUrl.startsWith("http") ? data.giftUrl : `${getAppUrl()}${data.giftUrl}`;
  const installerProfileUrl = data.installerSlug ? `${getAppUrl()}/p/${data.installerSlug}` : null;

  const installerBlock = installerProfileUrl
    ? `<a href="${installerProfileUrl}" style="color:#facc15;text-decoration:none;">${escapeHtml(data.installerName)}</a>`
    : `<strong style="color:#ffffff;">${escapeHtml(data.installerName)}</strong>`;

  const html = masterEmailLayout(
    "Your installer is set",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Quick update &mdash; ${installerBlock} from the Storage Network installer
      network will be handling your delivery and pickup. You don&apos;t
      need to do anything else; the schedule you confirmed stands.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      ${ctaButton(url, "View My Gift")}
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `${data.installerName} will deliver your closing gift`,
    html,
  });
}

/**
 * Realtor update — "your gift was assigned an installer". Light touch.
 */
export async function sendGiftRealtorAssignedUpdate(
  email: string,
  data: {
    realtorName: string;
    recipientName: string;
    installerName: string;
    giftsDashboardUrl: string;
  }
): Promise<SendEmailResult> {
  const url = data.giftsDashboardUrl.startsWith("http")
    ? data.giftsDashboardUrl
    : `${getAppUrl()}${data.giftsDashboardUrl}`;

  const html = masterEmailLayout(
    "Your gift is on its way",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.realtorName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      The closing gift you sent to <strong style="color:#ffffff;">${escapeHtml(data.recipientName)}</strong>
      was just assigned to <strong style="color:#ffffff;">${escapeHtml(data.installerName)}</strong>.
      They&apos;ll handle delivery and pickup &mdash; you&apos;ll get a ping at each milestone.
    </p>
    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
      ${ctaButton(url, "Track all gifts")}
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.realtorName,
    subject: `${data.installerName} is delivering your closing gift`,
    html,
  });
}

/**
 * Recipient — "your totes were just delivered". Sets up the cross-sell
 * lightly without pushing yet (people just got their boxes; they want to
 * pack, not shop).
 */
export async function sendGiftDeliveredRecipient(
  email: string,
  data: {
    recipientName: string;
    installerName: string;
    installerSlug: string | null;
    giftUrl: string;
  }
): Promise<SendEmailResult> {
  const url = data.giftUrl.startsWith("http") ? data.giftUrl : `${getAppUrl()}${data.giftUrl}`;
  const designUrl = data.installerSlug
    ? `${getAppUrl()}/design?installer=${data.installerSlug}`
    : `${getAppUrl()}/design`;

  const html = masterEmailLayout(
    "Your totes are here",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${escapeHtml(data.installerName)}</strong>
      just dropped off your reusable totes. Pack on your own schedule
      &mdash; pickup is already booked, no follow-up needed.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
      ${ctaButton(url, "View Gift Details")}
    </div>

    <p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;line-height:1.6;">
      Once you&apos;re settled, ${escapeHtml(data.installerName)} also builds
      <a href="${designUrl}" style="color:#facc15;text-decoration:none;">custom heavy-duty storage racks</a>
      using the same totes &mdash; if you want to make this storage permanent, it's a click away.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `${data.installerName} just delivered your totes`,
    html,
  });
}

/**
 * Recipient — "your totes were picked up". This is where the cross-sell
 * lands hardest because the recipient is settled in their new place and
 * about to dispose of their last bit of packing infrastructure.
 */
export async function sendGiftReturnedRecipient(
  email: string,
  data: {
    recipientName: string;
    installerName: string;
    installerSlug: string | null;
    giftUrl: string;
  }
): Promise<SendEmailResult> {
  const url = data.giftUrl.startsWith("http") ? data.giftUrl : `${getAppUrl()}${data.giftUrl}`;
  const designUrl = data.installerSlug
    ? `${getAppUrl()}/design?installer=${data.installerSlug}`
    : `${getAppUrl()}/design`;
  const installerProfileUrl = data.installerSlug ? `${getAppUrl()}/p/${data.installerSlug}` : null;

  const html = masterEmailLayout(
    "Move complete",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your totes are back with <strong style="color:#ffffff;">${escapeHtml(data.installerName)}</strong> &mdash;
      your move is officially complete. Hope the new place is starting to feel like home.
    </p>

    <div style="border-left:3px solid #facc15;background-color:#111111;padding:24px;margin:0 0 28px;border-radius:0 8px 8px 0;">
      ${eyebrow("Love the totes? Keep them.")}
      <p style="margin:0 0 16px;color:#ffffff;font-size:15px;line-height:1.6;">
        ${escapeHtml(data.installerName)} builds custom heavy-duty storage racks designed for
        the same totes you just used. Garage, basement, pantry &mdash; the
        clutter never comes back.
      </p>
      ${ctaButton(designUrl, "Design your rack")}
      ${installerProfileUrl ? `<p style="margin:14px 0 0;font-size:12px;"><a href="${installerProfileUrl}" style="color:#a3a3a3;text-decoration:underline;">See ${escapeHtml(data.installerName)}'s portfolio &rarr;</a></p>` : ""}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Want to see this gift one more time? <a href="${url}" style="color:#facc15;text-decoration:none;">Open your gift page</a>.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `Move complete — ${data.installerName} picked up the totes`,
    html,
  });
}

// ── Recipient: gift cancelled by the realtor ─────────────────────────────

export async function sendGiftCancelledRecipient(
  email: string,
  data: {
    recipientName: string;
    realtorName: string;
    refundIssued: boolean;
    reason: string | null;
  }
): Promise<SendEmailResult> {
  const reasonBlock = data.reason
    ? `
      <div style="border-left:3px solid #facc15;background-color:#111111;padding:18px;margin:0 0 24px;border-radius:0 8px 8px 0;">
        ${eyebrow("Note from " + escapeHtml(data.realtorName))}
        <p style="margin:0;color:#ffffff;font-size:14px;font-style:italic;line-height:1.6;">
          &ldquo;${escapeHtml(data.reason)}&rdquo;
        </p>
      </div>`
    : "";

  const refundNote = data.refundIssued
    ? `<p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;line-height:1.6;">
         The realtor has been refunded for the gift. Nothing was charged to you.
       </p>`
    : "";

  const html = masterEmailLayout(
    "Gift cancelled",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${escapeHtml(data.realtorName)}</strong> has cancelled the
      closing-gift tote rental that was set up for you. No further action is needed on your end.
    </p>
    ${reasonBlock}
    ${refundNote}
    <p style="margin:0;color:#555;font-size:12px;">
      If you have questions, reach out to your realtor directly.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.recipientName,
    subject: `${data.realtorName} cancelled your closing gift`,
    html,
  });
}
