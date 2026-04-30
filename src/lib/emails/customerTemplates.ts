import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Shared style primitives.
// All customer-facing emails render on the pure-black masterEmailLayout.
// Typography, color tokens, and spacing live here so every template stays
// visually consistent. Slate gradient cards from the legacy design have been
// retired in favor of thin #222 borders and crisp #ffffff / #facc15 type.
// ═══════════════════════════════════════════════════════════════════════════

/** All-caps yellow eyebrow above a section. */
function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

/** Hairline divider — the only border style we use. */
const HR = `<div style="border-top:1px solid #222;margin:24px 0;"></div>`;

/** Primary CTA button, gold on black. */
function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

/** Ghost button — outlined, for secondary actions. */
function ghostButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #333;">${label}</a>`;
}

/** Standard label/value row used inside detail tables. */
function detailRow(label: string, value: string, opts: { highlight?: boolean; topBorder?: boolean } = {}): string {
  const valueColor = opts.highlight ? "#facc15" : "#ffffff";
  const topBorder = opts.topBorder ? "border-top:1px solid #222;" : "";
  return `<tr><td style="padding:10px 0;color:#a3a3a3;font-size:14px;${topBorder}">${label}</td><td style="padding:10px 0;color:${valueColor};font-size:14px;font-weight:700;text-align:right;${topBorder}">${value}</td></tr>`;
}

export interface BookingConfirmationUnit {
  /** Per-unit display label, e.g. "Raised Planter Box — 18\" × 42\" with 7' Post × 3 (custom $395 each)" */
  desc: string;
  /** Per-unit subtotal in dollars (already includes addons / multipliers). */
  price?: number;
  /** Optional one-liner of features/addons to show under the desc, e.g. "HDX • No Totes, No Wheels, No Top". */
  features?: string;
}

export interface BookingConfirmationData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  installerAvatarUrl?: string;
  scheduledDate: string;
  address: string;
  depositAmount: number;
  totalPrice: number;
  /**
   * One-line fallback used when `units` is not supplied. Kept for callers
   * that don't have access to the lead's structured quote_data.
   */
  jobDescription: string;
  /**
   * Per-unit breakdown matching what the installer sees in the Job Ticket
   * Unit Summary. When present, replaces the single "Job" line with an
   * itemized list (desc + features + price per unit).
   */
  units?: BookingConfirmationUnit[];
  leadId: string;
  buildSnapshotUrl?: string;
}

export async function sendBookingConfirmation(
  data: BookingConfirmationData
): Promise<SendEmailResult> {
  console.log("[Email] sendBookingConfirmation triggered for:", data.customerEmail, "| Lead:", data.leadId);
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    installerAvatarUrl,
    scheduledDate,
    address,
    depositAmount,
    totalPrice,
    jobDescription,
    units,
    leadId,
    buildSnapshotUrl,
  } = data;

  // Safe date parse — avoid Invalid Date crash if scheduledDate is "TBD" or empty
  let formattedDate = scheduledDate || "TBD";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  const balanceDue = totalPrice - depositAmount;
  const successUrl = `${getAppUrl()}/success?jobId=${leadId}`;
  const firstName = customerName.split(" ")[0] || customerName;

  // Itemized unit list mirroring the installer's Job Ticket. Falls back to
  // the single jobDescription line when callers don't have structured units.
  const unitsHtml =
    units && units.length > 0
      ? `
      ${eyebrow("Your Custom Build")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${units
          .map((u, i) => {
            const priceCell =
              typeof u.price === "number"
                ? `<td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;vertical-align:top;">$${u.price.toLocaleString()}</td>`
                : `<td style="padding:14px 0;border-bottom:1px solid #222;"></td>`;
            const featuresHtml = u.features
              ? `<p style="margin:6px 0 0;color:#a3a3a3;font-size:12px;">${u.features}</p>`
              : "";
            return `
              <tr>
                <td style="padding:14px 12px 14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;vertical-align:top;">
                  <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc}
                  ${featuresHtml}
                </td>
                ${priceCell}
              </tr>`;
          })
          .join("")}
      </table>`
      : `
      ${eyebrow("Service")}
      <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.6;">${jobDescription}</p>`;

  const installerLine = installerPhone
    ? `${installerName} &middot; <a href="tel:${installerPhone}" style="color:#facc15;text-decoration:none;">${installerPhone}</a>`
    : installerName;

  const blueprintHtml = buildSnapshotUrl
    ? `<img src="${buildSnapshotUrl}" alt="Your Custom 3D Design" style="width:100%;border-radius:6px;border:1px solid #222;margin-bottom:28px;display:block;" />`
    : "";

  void installerAvatarUrl;

  const html = masterEmailLayout(
    "Booking Confirmed",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your installation is locked in. <strong style="color:#ffffff;">${installerName}</strong> will be in touch shortly to confirm the final details. Below is everything we have on file — built exactly to your wall&rsquo;s dimensions.
    </p>

    ${blueprintHtml}

    ${unitsHtml}

    ${eyebrow("Appointment")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Date", formattedDate, { highlight: true })}
      ${detailRow("Location", address || "Address confirmed at scheduling", { topBorder: true })}
      ${detailRow("Installer", installerLine, { topBorder: true })}
    </table>

    ${eyebrow("Payment")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
      ${detailRow("Order Total", `$${totalPrice.toLocaleString()}`)}
      ${detailRow("Secure Deposit (Paid)", `−$${depositAmount.toLocaleString()}`, { topBorder: true })}
    </table>
    <div style="border-top:1px solid #222;padding:20px 0 0;margin-bottom:28px;">
      <table style="width:100%;">
        <tr>
          <td style="color:#a3a3a3;font-size:14px;font-weight:600;vertical-align:bottom;">Balance Due at Installation</td>
          <td style="text-align:right;color:#facc15;font-size:32px;font-weight:900;line-height:1;">$${balanceDue.toLocaleString()}*</td>
        </tr>
      </table>
      <p style="margin:8px 0 0;color:#555;font-size:11px;font-style:italic;">*Plus applicable sales tax, collected by your installer on installation day.</p>
    </div>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:32px 0;">
      <p style="margin:0 0 8px;color:#facc15;font-size:18px;font-weight:800;">Track Your Order</p>
      <p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;">View order status, message your installer, and access your receipt.</p>
      ${ctaButton(successUrl, "Open My Order")}
    </div>

    <div style="border-top:1px solid #222;padding-top:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:700;">Need to reschedule?</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;line-height:1.6;">Reach out to your installer at least 48 hours before your appointment. Just reply to this email and we&rsquo;ll route it.</p>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Booking Confirmed — ${installerName} on ${formattedDate}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// sendInstallScheduledNotice — Sent to the customer when their installer
// picks (or updates) the install date for their job.
// ═══════════════════════════════════════════════════════════════════════════

export async function sendInstallScheduledNotice(
  customerEmail: string,
  data: {
    customerName: string;
    installerName?: string;
    scheduledDate: string; // YYYY-MM-DD
    replyTo?: string;
    /** When true, the copy + subject reflect a reschedule rather than first scheduling. */
    isReschedule?: boolean;
  }
): Promise<SendEmailResult> {
  const firstName = (data.customerName || "").split(" ")[0] || "there";

  const dateObj = new Date(`${data.scheduledDate}T12:00:00`);
  const formattedDate = isNaN(dateObj.getTime())
    ? data.scheduledDate
    : dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  const installerLine = data.installerName
    ? `<strong style="color:#ffffff;">${data.installerName}</strong>`
    : "Your installer";

  const heroTitle = data.isReschedule ? "Installation Rescheduled" : "Installation Scheduled";
  const heroIntro = data.isReschedule
    ? `${installerLine} has updated your install date. Your build is locked in for the new appointment below — same crew, same Custom 3D Design, fresh time on the calendar.`
    : `${installerLine} has locked in your install date. Mark your calendar &mdash; we&rsquo;ll be there built and ready.`;
  const dateEyebrow = data.isReschedule ? "New Installation Date" : "Installation Date";
  const subject = data.isReschedule
    ? `Installation rescheduled to ${formattedDate}`
    : `Installation scheduled for ${formattedDate}`;

  const html = masterEmailLayout(
    heroTitle,
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${heroIntro}
    </p>

    ${eyebrow(dateEyebrow)}
    <div style="border-top:1px solid #222;border-bottom:1px solid #222;padding:24px 0;text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:28px;font-weight:900;line-height:1.2;">${formattedDate}</p>
    </div>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      A few hours before the appointment, please clear the wall and floor where your Heavy-Duty Tote System will be installed. Your installer will reach out directly with arrival timing.
    </p>

    <p style="margin:0;color:#a3a3a3;font-size:13px;text-align:center;">
      Need to make another change? Just reply to this email &mdash; we route directly to your installer.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject,
    html,
    replyTo: data.replyTo,
  });
}

/**
 * Convert a lead's raw `quote_data` array into the per-unit shape consumed
 * by the booking-confirmation email. Mirrors the Job Ticket Unit Summary
 * (desc, feature line, price). Defensive against missing fields.
 *
 * Returns [] if the input isn't a non-empty array — callers can pass the
 * result straight through; the email template only renders a unit list
 * when it's non-empty.
 */
export function quoteDataToBookingUnits(quoteData: unknown): BookingConfirmationUnit[] {
  if (!Array.isArray(quoteData) || quoteData.length === 0) return [];

  return quoteData.map((raw): BookingConfirmationUnit => {
    const u = (raw ?? {}) as Record<string, unknown>;

    const desc =
      typeof u.desc === "string" && u.desc.trim()
        ? u.desc
        : typeof u.cols === "number" && typeof u.rows === "number"
        ? `${u.cols}x${u.rows}`
        : "Custom unit";

    const features: string[] = [
      u.hasTotes ? "Totes" : "No Totes",
      u.hasWheels ? "Wheels" : "No Wheels",
      u.hasTop ? "Top" : "No Top",
    ];

    const addons = Array.isArray(u.addons) ? (u.addons as Array<Record<string, unknown>>) : [];
    const cols = typeof u.cols === "number" ? u.cols : 1;

    const doorCount = addons
      .filter((a) => a.type === "plywood_door")
      .reduce((n, a) => n + (a.target === "doors_on" ? cols : 1), 0);
    const panelCount = addons.filter((a) => a.type === "side_panel").length;
    const railRemovedCount = addons.filter((a) => a.type === "rail_removed").length;
    const shelfCount = addons.filter((a) => a.type === "shelf").length;

    if (doorCount > 0) features.push(`${doorCount} Door${doorCount > 1 ? "s" : ""}`);
    if (panelCount > 0) features.push(`${panelCount} Panel${panelCount > 1 ? "s" : ""}`);
    if (railRemovedCount > 0)
      features.push(`${railRemovedCount} Rail${railRemovedCount > 1 ? "s" : ""} Removed`);
    if (shelfCount > 0) features.push(`${shelfCount} Shelf Insert${shelfCount > 1 ? "s" : ""}`);

    const paintParts: string[] = [];
    if (typeof u.paintFrameColor === "string" && u.paintFrameColor) paintParts.push(`Frame: ${u.paintFrameColor}`);
    if (typeof u.paintDoorColor === "string" && u.paintDoorColor) paintParts.push(`Doors: ${u.paintDoorColor}`);
    if (typeof u.paintSidePanelColor === "string" && u.paintSidePanelColor) paintParts.push(`Panels: ${u.paintSidePanelColor}`);
    if (paintParts.length > 0) features.push(`Paint (${paintParts.join(", ")})`);

    const toteType = typeof u.toteType === "string" && u.toteType ? u.toteType : "HDX";
    const featureLine = `${toteType} • ${features.join(", ")}`;

    return {
      desc,
      price: typeof u.price === "number" ? u.price : undefined,
      features: featureLine,
    };
  });
}

export async function sendJobReceipt(
  customerEmail: string,
  data: {
    customerName: string;
    installerName: string;
    totalAmount: number;
    depositPaid: number;
    balanceCollected: number;
    jobDescription: string;
    /**
     * Per-unit breakdown matching the booking confirmation. When present,
     * replaces the single "Service" line with an itemized "Your Build" card.
     */
    units?: BookingConfirmationUnit[];
    completedDate: string;
    reviewUrl?: string;
  }
): Promise<SendEmailResult> {
  const formattedDate = new Date(data.completedDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstName = data.customerName.split(" ")[0] || data.customerName;

  const units = data.units;

  const unitsHtml =
    units && units.length > 0
      ? `
      ${eyebrow("Installed")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${units
          .map((u, i) => {
            const priceCell =
              typeof u.price === "number"
                ? `<td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;vertical-align:top;">$${u.price.toLocaleString()}</td>`
                : `<td style="padding:14px 0;border-bottom:1px solid #222;"></td>`;
            const featuresHtml = u.features
              ? `<p style="margin:6px 0 0;color:#a3a3a3;font-size:12px;">${u.features}</p>`
              : "";
            return `
              <tr>
                <td style="padding:14px 12px 14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;vertical-align:top;">
                  <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc}
                  ${featuresHtml}
                </td>
                ${priceCell}
              </tr>`;
          })
          .join("")}
      </table>`
      : `
      ${eyebrow("Service Performed")}
      <p style="margin:0 0 28px;color:#ffffff;font-size:14px;line-height:1.6;">${data.jobDescription}</p>`;

  const html = masterEmailLayout(
    "Receipt",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your installation is complete and your 30-day warranty is now active. Below is your itemized receipt for your records.
    </p>

    ${unitsHtml}

    ${eyebrow("Receipt")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
      ${detailRow("Installer", data.installerName)}
      ${detailRow("Completed", formattedDate, { topBorder: true })}
    </table>
    <div style="border-top:1px solid #222;padding:20px 0 0;margin-bottom:28px;">
      <table style="width:100%;">
        <tr>
          <td style="color:#a3a3a3;font-size:14px;font-weight:600;vertical-align:bottom;">Order Total</td>
          <td style="text-align:right;color:#facc15;font-size:32px;font-weight:900;line-height:1;">$${data.totalAmount.toLocaleString()}</td>
        </tr>
      </table>
      <table style="width:100%;margin-top:8px;">
        <tr><td style="color:#a3a3a3;font-size:13px;padding:4px 0;">Secure Deposit</td><td style="text-align:right;color:#a3a3a3;font-size:13px;padding:4px 0;">−$${data.depositPaid.toLocaleString()}</td></tr>
        <tr><td style="color:#a3a3a3;font-size:13px;padding:4px 0;">Balance Collected at Installation</td><td style="text-align:right;color:#a3a3a3;font-size:13px;padding:4px 0;">$${data.balanceCollected.toLocaleString()}</td></tr>
      </table>
    </div>

    ${HR}

    <div style="text-align:center;margin:0 0 28px;">
      <p style="margin:0;color:#facc15;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">&#10003; 30-Day Workmanship Warranty Active</p>
    </div>

    ${data.reviewUrl ? `
    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Rate Your Installer</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">A 30-second review helps other homeowners find quality installers — and helps your installer grow their business.</p>
      ${ctaButton(data.reviewUrl, "Leave a Review")}
    </div>
    ` : ""}

    <p style="margin:0;color:#a3a3a3;font-size:13px;text-align:center;">
      Questions about your install? Just reply to this email — we route directly to your installer.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject: `Receipt — Installation by ${data.installerName} on ${formattedDate}`,
    html,
  });
}

export async function sendWaitlistCustomerConfirmation(
  customerEmail: string,
  data: {
    customerName: string;
    installerBusinessName: string;
    zip: string;
    quoteData?: Array<{ desc?: string; cols?: number; rows?: number; price?: number }>;
  }
): Promise<SendEmailResult> {
  const firstName = (data.customerName || "").split(" ")[0] || "there";
  const hasQuote = data.quoteData && data.quoteData.length > 0;
  const totalPrice = hasQuote
    ? data.quoteData!.reduce((sum, u) => sum + (typeof u.price === "number" ? u.price : 0), 0)
    : 0;

  const buildSummaryHtml = hasQuote
    ? `
      ${eyebrow("Your Saved Build")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${data.quoteData!.map((u, i) => `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;">
              <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc || `${u.cols}\u00d7${u.rows} Unit`}
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
          </tr>
        `).join("")}
        ${totalPrice > 0 ? `
          <tr>
            <td style="padding:16px 0 0;color:#a3a3a3;font-size:13px;">Total Estimate</td>
            <td style="padding:16px 0 0;text-align:right;color:#facc15;font-size:22px;font-weight:900;">$${totalPrice.toLocaleString()}</td>
          </tr>
        ` : ""}
      </table>
    `
    : "";

  const html = masterEmailLayout(
    "On the Waitlist",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 16px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${data.installerBusinessName}</strong> put together a Custom 3D Design for you, but our network doesn&rsquo;t have a vetted installer in <strong style="color:#facc15;">ZIP ${data.zip}</strong> right now.
    </p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You&rsquo;re on the waitlist. The moment we onboard an installer in your area, we&rsquo;ll email you and ${hasQuote ? "your saved build will be one click away from confirmation." : "you can pick up where you left off &mdash; no extra steps."}
    </p>

    ${buildSummaryHtml}

    ${eyebrow("What happens next")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr>
        <td style="padding:14px 16px 14px 0;border-bottom:1px solid #222;color:#facc15;font-size:14px;font-weight:900;width:24px;vertical-align:top;">1</td>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">We&rsquo;re actively recruiting and vetting installers in your area.</td>
      </tr>
      <tr>
        <td style="padding:14px 16px 14px 0;border-bottom:1px solid #222;color:#facc15;font-size:14px;font-weight:900;vertical-align:top;">2</td>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">The moment one onboards, you get an email.</td>
      </tr>
      <tr>
        <td style="padding:14px 16px 14px 0;border-bottom:1px solid #222;color:#facc15;font-size:14px;font-weight:900;vertical-align:top;">3</td>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">${hasQuote ? "Confirm your saved build and lock in your installation date." : "Finalize your design and book an installation."}</td>
      </tr>
    </table>

    <p style="margin:0 0 6px;color:#ffffff;font-size:13px;text-align:center;font-weight:600;">
      No payment has been charged. You&rsquo;re under no obligation.
    </p>
    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      You&rsquo;re receiving this because ${data.installerBusinessName} submitted a quote on your behalf at storage-network.app.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject: `${firstName}, you're on the waitlist`,
    html,
  });
}

export interface QuoteEmailData {
  customerName: string;
  businessName: string;
  installerFirstName?: string;
  installerPhone?: string;
  quoteItems: Array<{ description: string; price: number }>;
  totalPrice: number;
  depositAmount: number;
  checkoutUrl: string;
  cleanoutServices?: Array<{ id: string; name: string; description: string; price: number }>;
  estimatedTax?: { amount: number; rate: number; stateCode: string } | null;
  deliveryFee?: number;
  buildSnapshotUrl?: string;
}

export function buildQuoteEmailTemplate(data: QuoteEmailData): string {
  const { customerName, businessName, installerFirstName, installerPhone, quoteItems, totalPrice, depositAmount, checkoutUrl, cleanoutServices, estimatedTax, deliveryFee, buildSnapshotUrl } = data;
  const taxAmount = estimatedTax?.amount && estimatedTax.amount > 0 ? estimatedTax.amount : 0;
  const deliveryAmount = deliveryFee && deliveryFee > 0 ? deliveryFee : 0;
  const grandTotalWithTax = totalPrice + deliveryAmount + taxAmount;
  const balanceDue = grandTotalWithTax - depositAmount;

  const firstName = customerName.split(" ")[0] || customerName;
  const sigName = installerFirstName || businessName;
  const phoneLine = installerPhone ? `<br/>${installerPhone}` : "";

  const blueprintHtml = buildSnapshotUrl
    ? `<img src="${buildSnapshotUrl}" alt="Your Custom Build" style="width:100%;border-radius:6px;border:1px solid #222;margin-bottom:28px;display:block;" />`
    : "";

  const itemsHtml = quoteItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;font-weight:500;">
          <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${item.description}
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;font-weight:700;color:#ffffff;font-size:14px;white-space:nowrap;">$${item.price.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return masterEmailLayout(
    `Your Quote from ${businessName}`,
    `
    <!-- Greeting -->
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">Here&rsquo;s the custom quote for your storage system. Everything below is built to your exact wall dimensions.</p>

    <!-- Blueprint Image (dynamic — only rendered when URL is provided) -->
    ${blueprintHtml}

    <!-- Itemized Build -->
    <p style="margin:0 0 14px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Your Build</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      ${itemsHtml}
    </table>

    <!-- Pricing Breakdown -->
    <table style="width:100%;margin-bottom:8px;">
      <tr>
        <td style="color:#a3a3a3;font-size:14px;padding:6px 0;">Subtotal</td>
        <td style="text-align:right;color:#ffffff;font-size:14px;font-weight:600;padding:6px 0;">$${totalPrice.toFixed(2)}</td>
      </tr>
      ${deliveryAmount > 0 ? `<tr>
        <td style="color:#a3a3a3;font-size:14px;padding:6px 0;">Delivery Fee</td>
        <td style="text-align:right;color:#ffffff;font-size:14px;font-weight:600;padding:6px 0;">$${deliveryAmount.toFixed(2)}</td>
      </tr>` : ""}
      ${taxAmount > 0 ? `<tr>
        <td style="color:#a3a3a3;font-size:14px;padding:6px 0;">Est. Sales Tax (${estimatedTax!.stateCode}, ${(estimatedTax!.rate * 100).toFixed(2)}%)</td>
        <td style="text-align:right;color:#ffffff;font-size:14px;font-weight:600;padding:6px 0;">$${taxAmount.toFixed(2)}</td>
      </tr>` : ""}
    </table>

    <!-- Total Estimate -->
    <div style="border-top:1px solid #222;padding:20px 0 4px;">
      <table style="width:100%;">
        <tr>
          <td style="color:#a3a3a3;font-size:14px;font-weight:600;vertical-align:bottom;">Total Estimate</td>
          <td style="text-align:right;color:#facc15;font-size:32px;font-weight:900;line-height:1;">$${grandTotalWithTax.toFixed(2)}</td>
        </tr>
      </table>
      ${taxAmount > 0 ? `<p style="margin:8px 0 0;color:#555;font-size:11px;font-style:italic;">Final tax confirmed at checkout based on your billing address.</p>` : ""}
    </div>

    <!-- Deposit -->
    <div style="border-top:1px solid #222;padding:20px 0 24px;text-align:center;">
      <p style="margin:0 0 4px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Deposit to Reserve</p>
      <p style="margin:0 0 4px;color:#ffffff;font-size:36px;font-weight:900;">$${depositAmount.toFixed(2)}</p>
      <p style="margin:0;color:#a3a3a3;font-size:13px;">Remaining <strong style="color:#ffffff;">$${balanceDue.toFixed(2)}</strong> paid after installation</p>
    </div>

    <!-- Checkout Box — the only card -->
    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin-top:40px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:18px;font-weight:800;">Ready to Order?</p>
      <p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;">Lock in your custom build and reserve your installation spot.</p>
      <a href="${checkoutUrl}" style="display:inline-block;background-color:#facc15;color:#000000;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;margin-top:16px;">
        Review Quote &amp; Secure Installation
      </a>
      <div style="margin-top:20px;">
        <table style="width:100%;font-size:11px;color:#555;">
          <tr>
            <td style="text-align:center;padding:4px;">&#128274; Secure Checkout</td>
            <td style="text-align:center;padding:4px;">&#128176; Deposit Only</td>
            <td style="text-align:center;padding:4px;">&#9989; Custom Built</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Explanation -->
    <p style="margin:32px 0 28px;color:#a3a3a3;font-size:14px;line-height:1.7;">To officially get your project on my schedule, click the button above to review your order and place the initial deposit. Once locked in, I&rsquo;ll reserve your spot, prep materials, and we&rsquo;ll be ready for installation day.</p>

    ${cleanoutServices && cleanoutServices.length > 0 ? `
    <!-- Cleanout Upsell -->
    <div style="border-top:1px solid #222;padding-top:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">&#10024; Add-On Service</p>
      <p style="margin:0 0 12px;color:#ffffff;font-size:16px;font-weight:700;">Want us to clean out your space first?</p>
      <p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;">Get the most out of your new storage &mdash; we&rsquo;ll sort, organize, and haul away the clutter before installation.</p>
      ${cleanoutServices.map((svc) => `
      <div style="border-bottom:1px solid #222;padding:12px 0;">
        <table style="width:100%;"><tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;color:#ffffff;font-size:14px;font-weight:600;">${svc.name}</p>
            <p style="margin:0;color:#a3a3a3;font-size:12px;">${svc.description}</p>
          </td>
          <td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:16px;">
            <span style="color:#facc15;font-size:16px;font-weight:700;">$${svc.price}</span>
          </td>
        </tr></table>
      </div>`).join("")}
      <p style="margin:12px 0 0;color:#555;font-size:11px;text-align:center;">Add cleanout service during checkout. 50% deposit, remainder at service.</p>
    </div>
    ` : ""}

    <!-- Sign-off -->
    <p style="margin:0 0 24px;color:#ffffff;font-size:15px;">Looking forward to getting your space organized!</p>
    <p style="margin:0 0 28px;color:#ffffff;font-size:15px;">
      Best,<br/>${sigName}<br/>${businessName}${phoneLine}
    </p>

    <!-- Questions -->
    <div style="border-top:1px solid #222;padding-top:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:13px;font-weight:700;">Have Questions?</p>
      <p style="margin:0 0 16px;color:#a3a3a3;font-size:13px;">Reach out directly &mdash; we&rsquo;re happy to help.</p>
      <div style="display:inline-block;">
        <a href="mailto:?subject=Re:%20My%20Storage%20Quote%20from%20${encodeURIComponent(businessName)}" style="display:inline-block;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #333;margin:0 4px;">
          &#9993; Reply to This Email
        </a>
        ${installerPhone ? `<a href="tel:${installerPhone}" style="display:inline-block;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #333;margin:0 4px;">
          &#9742; Call ${installerPhone}
        </a>` : ""}
      </div>
    </div>

    <!-- Disclaimer -->
    <p style="margin:0 0 20px;color:#555;font-size:12px;text-align:center;font-style:italic;">
      ${taxAmount > 0
        ? "*Sales tax shown is an estimate based on your delivery ZIP. The final amount is confirmed at checkout from your billing address and collected by your installer at installation."
        : "*Sales tax (if applicable) will be collected by your installer at the time of installation."}
    </p>
    `
  );
}

export async function sendAbandonedCartEmail(
  email: string,
  data: {
    customerName: string;
    totalPrice: number;
    depositAmount: number;
    resumeUrl: string;
    installerName?: string | null;
  }
): Promise<SendEmailResult> {
  const firstName = (data.customerName || "").split(" ")[0] || "there";
  const installerLine = data.installerName
    ? `with <strong style="color:#ffffff;">${data.installerName}</strong>`
    : "for your Heavy-Duty Tote System";
  const balanceDue = data.totalPrice - data.depositAmount;

  const html = masterEmailLayout(
    "Your Build Is Saved",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your Custom 3D Design ${installerLine} is saved and ready to go &mdash; built exactly to your wall&rsquo;s dimensions. Lock in the install spot whenever you&rsquo;re ready.
    </p>

    ${eyebrow("Your Order")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
      ${detailRow("Order Total", `$${data.totalPrice.toFixed(2)}`)}
      ${detailRow("Secure Deposit (15%)", `$${data.depositAmount.toFixed(2)}`, { highlight: true, topBorder: true })}
      ${detailRow("Balance Due at Installation", `$${balanceDue.toFixed(2)}`, { topBorder: true })}
    </table>
    <p style="margin:0 0 28px;color:#555;font-size:11px;font-style:italic;">*Sales tax (if applicable) is collected by your installer on installation day.</p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 28px;">
      <p style="margin:0 0 6px;color:#facc15;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Heads Up</p>
      <p style="margin:0 0 20px;color:#ffffff;font-size:14px;line-height:1.6;">Your saved build expires in <strong>7 days</strong>. Complete your deposit to claim your spot on the install schedule.</p>
      ${ctaButton(data.resumeUrl, "Complete My Order")}
    </div>

    ${HR}

    <table style="width:100%;font-size:11px;color:#555;margin:0 0 24px;">
      <tr>
        <td style="text-align:center;padding:6px 8px;">&#128274; Secure Checkout</td>
        <td style="text-align:center;padding:6px 8px;">&#128176; 15% Deposit</td>
        <td style="text-align:center;padding:6px 8px;">&#9989; Built to Spec</td>
      </tr>
    </table>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Changed your mind? Just ignore this email &mdash; your hold expires automatically.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.customerName,
    subject: `${firstName}, your saved build is ready to confirm`,
    html,
  });
}

export async function sendDemoConfirmationEmail(data: {
  name: string;
  email: string;
  date: string;
  time: string;
  calendarLink: string;
}) {
  const [year, month, day] = data.date.split("-");
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Convert 24h to 12h
  const [h, m] = data.time.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const formattedTime = `${hour12}:${m} ${ampm} CT`;

  const firstName = data.name.split(" ")[0] || data.name;

  const body = `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your demo is locked in. We&rsquo;ll walk you through how Storage Network turns inbound demand into pre-sold jobs &mdash; and exactly how the platform puts money in your pocket from day one.
    </p>

    ${eyebrow("Your Demo")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${detailRow("Date", formattedDate)}
      ${detailRow("Time", formattedTime, { highlight: true, topBorder: true })}
      ${detailRow("Duration", "~30 minutes", { topBorder: true })}
      ${detailRow("Format", "Video or Phone Call", { topBorder: true })}
    </table>

    <div style="text-align:center;margin:0 0 28px;">
      ${ctaButton(data.calendarLink, "Add to Google Calendar")}
    </div>

    ${eyebrow("What we'll cover")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Auto-routed leads, pre-sold and ready to install.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>The Custom 3D Designer that closes the sale before you arrive.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Automated Cut Lists &mdash; zero math required.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Instant Stripe Payouts on every job.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Marketing tools, AI Asset Forge, and the installer community.</td></tr>
    </table>

    <p style="margin:0;color:#a3a3a3;font-size:13px;text-align:center;">
      We&rsquo;ll reach out at the scheduled time. Need to reschedule? Just reply to this email.
    </p>
  `;

  const html = masterEmailLayout("Demo Call Confirmed", body);

  await sendTransactionalEmail({
    to: data.email,
    toName: data.name,
    subject: `Demo confirmed — ${formattedDate} at ${formattedTime}`,
    html,
  });
}

export interface CleanoutUpsellEmailData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  installerAvatarUrl?: string;
  scheduledDate: string;
  address?: string;
  leadId: string;
  services: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
  }>;
}

export async function sendCleanoutUpsellEmail(
  data: CleanoutUpsellEmailData
): Promise<SendEmailResult> {
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    installerAvatarUrl,
    scheduledDate,
    address,
    leadId,
    services,
  } = data;

  const firstName = customerName.split(" ")[0] || "there";

  // Format date
  let formattedDate = scheduledDate || "TBD";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  }

  const avatarHtml = installerAvatarUrl
    ? `<img src="${installerAvatarUrl}" alt="${installerName}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #facc15;" />`
    : `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  void avatarHtml;

  // Add-on service tiles. Each is a thin-bordered black card matching the
  // master template aesthetic.
  const serviceButtonsHtml = services
    .map((s) => {
      const depositAmount = Math.round(s.price * 0.5);
      const upsellUrl = `${getAppUrl()}/upsell/${leadId}?service=${s.id}`;
      return `
      <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:12px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 4px;color:#ffffff;font-size:16px;font-weight:700;">${s.name}</p>
              <p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;line-height:1.5;">${s.description}</p>
              <p style="margin:0;color:#555;font-size:12px;">50% deposit today: <strong style="color:#ffffff;">$${depositAmount}</strong> &middot; balance at service</p>
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:16px;">
              <p style="margin:0;color:#facc15;font-size:22px;font-weight:900;">$${s.price}</p>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin-top:16px;">
          ${ctaButton(upsellUrl, "Add to My Appointment")}
        </div>
      </div>`;
    })
    .join("");

  const installerLine = installerPhone
    ? `${installerName} &middot; <a href="tel:${installerPhone}" style="color:#facc15;text-decoration:none;">${installerPhone}</a>`
    : installerName;

  const html = masterEmailLayout(
    "Prepare for Installation",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your installation with <strong style="color:#ffffff;">${installerName}</strong> is coming up on <strong style="color:#facc15;">${formattedDate}</strong>. A few minutes of prep makes a big difference on install day.
    </p>

    ${eyebrow("Getting ready")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Clear the wall and floor where your Heavy-Duty Tote System will be installed.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Make sure your installer has clean access to the space.</td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Have totes nearby if you want to load them in right away.</td></tr>
      ${address ? `<tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;"><span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>Confirm your address: <strong>${address}</strong></td></tr>` : ""}
    </table>

    ${eyebrow("Your installer")}
    <p style="margin:0 0 28px;color:#ffffff;font-size:15px;font-weight:600;">${installerLine}</p>

    ${HR}

    ${eyebrow("Optional add-ons")}
    <p style="margin:0 0 16px;color:#a3a3a3;font-size:14px;line-height:1.6;">
      ${installerName} can take care of the prep work too &mdash; sorting, organizing, and hauling away clutter. Add a service while they&rsquo;re already on site.
    </p>

    ${serviceButtonsHtml}

    <p style="margin:24px 0 0;color:#555;font-size:12px;text-align:center;line-height:1.6;">
      No obligation &mdash; your install is already confirmed for ${formattedDate}. Skip this section if you&rsquo;d rather not add anything.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `${firstName}, your installation is in 3 days`,
    html,
    senderName: installerName,
  });
}

export interface CleanoutUpsellConfirmationData {
  customerName: string;
  customerEmail: string;
  installerName: string;
  installerPhone?: string;
  scheduledDate?: string;
  address?: string;
  existingServices: Array<{ name: string; price: number }>;
  upsellService: {
    name: string;
    price: number;
    depositPaid: number;
    remaining: number;
  };
  totalPrice: number;
  totalDeposit: number;
  totalBalance: number;
  leadId: string;
}

export async function sendCleanoutUpsellConfirmation(
  data: CleanoutUpsellConfirmationData
): Promise<SendEmailResult> {
  const {
    customerName,
    customerEmail,
    installerName,
    installerPhone,
    scheduledDate,
    address,
    existingServices,
    upsellService,
    totalPrice,
    totalDeposit,
    totalBalance,
    leadId,
  } = data;

  const firstName = customerName.split(" ")[0] || "there";
  const orderUrl = `${getAppUrl()}/success?jobId=${leadId}`;

  // Format date only if available
  let dateSection = "";
  if (scheduledDate && scheduledDate !== "TBD") {
    const parsed = new Date(scheduledDate + (scheduledDate.includes("T") ? "" : "T12:00:00"));
    if (!isNaN(parsed.getTime())) {
      const formattedDate = parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      dateSection = `
        <tr><td style="padding:8px 0;color:#94a3b8;">Appointment Date</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedDate}</td></tr>
      `;
    }
  }

  const existingServicesHtml = existingServices
    .map(
      (s) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;">${s.name}</td>
        <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">$${s.price.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  const installerLine = installerPhone
    ? `${installerName} &middot; <a href="tel:${installerPhone}" style="color:#facc15;text-decoration:none;">${installerPhone}</a>`
    : installerName;

  // Reformat the original dateSection HTML into our new bordered table row.
  const dateRowNew = dateSection
    ? `<tr><td style="padding:14px 0;border-top:1px solid #222;color:#a3a3a3;font-size:14px;">Appointment Date</td><td style="padding:14px 0;border-top:1px solid #222;text-align:right;color:#facc15;font-size:14px;font-weight:700;">${(dateSection.match(/>([A-Za-z]+, [A-Za-z]+ \d+, \d{4})</) || [, ""])[1] || "TBD"}</td></tr>`
    : "";

  const addressRowNew = address
    ? `<tr><td style="padding:14px 0;border-top:1px solid #222;color:#a3a3a3;font-size:14px;">Location</td><td style="padding:14px 0;border-top:1px solid #222;text-align:right;color:#ffffff;font-size:14px;font-weight:700;">${address}</td></tr>`
    : "";

  const html = masterEmailLayout(
    "Order Updated",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your add-on is locked in. Here&rsquo;s the full breakdown of everything <strong style="color:#ffffff;">${installerName}</strong> will handle on installation day.
    </p>

    ${eyebrow("Services performed")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      ${existingServicesHtml}
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #222;color:#facc15;font-size:14px;font-weight:700;"><span style="margin-right:6px;">&#43;</span>${upsellService.name} <span style="color:#a3a3a3;font-weight:400;font-size:12px;">(just added)</span></td>
        <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#facc15;font-size:14px;font-weight:700;white-space:nowrap;">$${upsellService.price.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:18px 0 0;color:#a3a3a3;font-size:14px;font-weight:600;vertical-align:bottom;">Grand Total</td>
        <td style="padding:18px 0 0;text-align:right;color:#facc15;font-size:32px;font-weight:900;line-height:1;">$${totalPrice.toLocaleString()}</td>
      </tr>
    </table>

    ${eyebrow("Payment")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
      ${detailRow("Deposits Paid", `$${totalDeposit.toLocaleString()}`, { highlight: true })}
      ${detailRow(`Add-on Deposit (${upsellService.name})`, `$${upsellService.depositPaid.toLocaleString()}`, { highlight: true, topBorder: true })}
      ${detailRow("Balance Due at Installation", `$${totalBalance.toLocaleString()}*`, { highlight: true, topBorder: true })}
    </table>
    <p style="margin:0 0 28px;color:#555;font-size:11px;font-style:italic;">*Plus applicable sales tax, collected by your installer on service day.</p>

    ${eyebrow("Appointment")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;color:#a3a3a3;font-size:14px;">Installer</td><td style="padding:14px 0;text-align:right;color:#ffffff;font-size:14px;font-weight:700;">${installerLine}</td></tr>
      ${dateRowNew}
      ${addressRowNew}
    </table>

    <div style="text-align:center;margin:0 0 28px;">
      ${ctaButton(orderUrl, "View Full Order")}
    </div>

    <p style="margin:0;color:#a3a3a3;font-size:13px;text-align:center;">
      Questions? Reply directly to this email &mdash; we route to your installer.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Order Updated — ${upsellService.name} added`,
    html,
  });
}

export async function sendTrialCapCustomerConfirmation(
  customerEmail: string,
  data: {
    customerName: string;
    installerBusinessName: string;
    grandTotal: number;
    quoteData?: Array<{ desc?: string; cols?: number; rows?: number; price?: number }>;
  }
): Promise<SendEmailResult> {
  const firstName = (data.customerName || "").split(" ")[0] || "there";
  const hasQuote = data.quoteData && data.quoteData.length > 0;

  const buildSummaryHtml = hasQuote
    ? `
      ${eyebrow("Your Saved Build")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${data.quoteData!.map((u, i) => `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;">
              <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc || `${u.cols}\u00d7${u.rows} Unit`}
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
          </tr>
        `).join("")}
        ${data.grandTotal > 0 ? `
          <tr>
            <td style="padding:16px 0 0;color:#a3a3a3;font-size:13px;">Total Estimate</td>
            <td style="padding:16px 0 0;text-align:right;color:#facc15;font-size:22px;font-weight:900;">$${data.grandTotal.toLocaleString()}</td>
          </tr>
        ` : ""}
      </table>
    `
    : "";

  const html = masterEmailLayout(
    "On the List",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${data.installerBusinessName}</strong> is currently at capacity, but your Custom 3D Design is saved and they&rsquo;ve been notified. Expect them to reach out shortly to confirm your booking.
    </p>

    ${buildSummaryHtml}

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      No payment has been charged. Your installer will contact you directly.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    subject: `Your build with ${data.installerBusinessName} is saved`,
    html,
  });
}

export async function sendWaitlistedLeadPaymentReady(
  customerEmail: string,
  data: {
    customerName: string;
    installerBusinessName: string;
    estimatedPrice: number;
    depositAmount: number;
    leadId: string;
    quoteData?: Array<{ desc?: string; cols?: number; rows?: number; price?: number }>;
  }
): Promise<SendEmailResult> {
  const baseUrl = getAppUrl();
  const payUrl = `${baseUrl}/pay/${data.leadId}`;
  const firstName = (data.customerName || "").split(" ")[0] || "there";

  const hasQuote = data.quoteData && data.quoteData.length > 0;
  const balanceDue = data.estimatedPrice - data.depositAmount;
  const buildSummaryHtml = hasQuote
    ? `
      ${eyebrow("Your Custom Build")}
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
        ${data.quoteData!.map((u, i) => `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.5;">
              <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${u.desc || `${u.cols}\u00d7${u.rows} Unit`}
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #222;text-align:right;color:#ffffff;font-weight:700;font-size:14px;white-space:nowrap;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
          </tr>
        `).join("")}
        <tr>
          <td style="padding:16px 0 0;color:#a3a3a3;font-size:13px;">Total Estimate</td>
          <td style="padding:16px 0 0;text-align:right;color:#facc15;font-size:22px;font-weight:900;">$${data.estimatedPrice.toLocaleString()}</td>
        </tr>
      </table>
    `
    : "";

  const html = masterEmailLayout(
    "Installer Ready",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 16px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${data.installerBusinessName}</strong> is open for new bookings, and your build is first in line.
    </p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Pay your Secure Deposit to lock in the job &mdash; your installer will reach out to confirm the install date as soon as it&rsquo;s received.
    </p>

    ${buildSummaryHtml}

    ${eyebrow("Payment")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
      ${detailRow("Secure Deposit (today)", `$${data.depositAmount.toLocaleString()}`, { highlight: true })}
      ${detailRow("Balance Due at Installation", `$${balanceDue.toLocaleString()}`, { topBorder: true })}
    </table>
    <p style="margin:0 0 28px;color:#555;font-size:11px;font-style:italic;">*Plus applicable sales tax, collected by your installer on installation day.</p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:0 0 28px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:18px;font-weight:800;">Lock in Your Spot</p>
      ${ctaButton(payUrl, "Pay Deposit & Book")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      No obligation until you pay. Your installer reaches out once the deposit is received.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    subject: `${data.installerBusinessName} is ready — pay your deposit to book`,
    html,
  });
}

