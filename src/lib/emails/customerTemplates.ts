import { sendTransactionalEmail, emailShell, type SendEmailResult } from "./core";
import { getAppUrl } from "@/lib/url-helper";

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
  jobDescription: string;
  leadId: string;
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
    leadId,
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

  const avatarHtml = installerAvatarUrl
    ? `<img src="${installerAvatarUrl}" alt="${installerName}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #facc15;" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#facc15,#f59e0b);display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#1e293b;">${installerName.charAt(0).toUpperCase()}</div>`;

  const phoneHtml = installerPhone
    ? `<a href="tel:${installerPhone}" style="display:inline-block;margin-top:8px;background-color:#facc15;color:#1e293b;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Call ${installerPhone}</a>`
    : "";

  const html = emailShell(
    "Your Installation is Confirmed",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${customerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Thanks for your order! We&rsquo;ve received your deposit of <strong style="color:#16a34a;">$${depositAmount.toLocaleString()}</strong>.
      Your installer will be in touch shortly to confirm your date: <strong style="color:#facc15;">${formattedDate}</strong>.
    </p>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:12px;">${avatarHtml}</div>
      <p style="margin:0 0 4px;color:#facc15;font-size:18px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Date</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Location</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${address || "Address provided on arrival"}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Job</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${jobDescription}</td></tr>
        <tr style="border-top:1px solid #334155;"><td style="padding:12px 0 8px;color:#94a3b8;">Deposit Paid</td><td style="padding:12px 0 8px;font-weight:700;text-align:right;color:#16a34a;">$${depositAmount.toLocaleString()}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Balance Due at Install</td><td style="padding:8px 0;font-weight:800;text-align:right;font-size:18px;color:#facc15;">$${balanceDue.toLocaleString()}*</td></tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
        *Plus applicable sales tax, collected by your installer at installation.
      </p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${successUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Order
      </a>
    </div>

    <!-- Cancellation Policy -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:12px;line-height:1.6;">
        <strong>Need to reschedule?</strong> Please contact your installer at least 48 hours before your appointment to avoid fees.
      </p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Your installer will reach out to confirm. Questions? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Order Confirmed: Tote Storage Installation — ${formattedDate}`,
    html,
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
    completedDate: string;
    reviewUrl?: string;
  }
): Promise<SendEmailResult> {
  const formattedDate = new Date(data.completedDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = emailShell(
    "Receipt for Service",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.customerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Your installation is complete. Here is your receipt:
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Service</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.jobDescription}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Installer</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.installerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Completed</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${formattedDate}</td></tr>
        <tr style="border-top:2px solid #334155;">
          <td style="padding:12px 0 8px;color:#94a3b8;">Total</td>
          <td style="padding:12px 0 8px;font-weight:800;text-align:right;font-size:20px;color:#facc15;">$${data.totalAmount.toLocaleString()}</td>
        </tr>
        <tr><td style="padding:4px 0;color:#94a3b8;font-size:13px;">Deposit</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#94a3b8;">-$${data.depositPaid.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:#94a3b8;font-size:13px;">Balance Collected</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#94a3b8;">$${data.balanceCollected.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#16a34a;font-size:14px;font-weight:700;">
        &#10003; Installation Complete &mdash; 30-Day Warranty Active
      </p>
    </div>

    ${data.reviewUrl ? `
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:20px;">&#11088;</p>
      <p style="margin:0 0 8px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
        Rate Your Experience
      </p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">
        Help other homeowners find great installers. It takes 30 seconds.
      </p>
      <a href="${data.reviewUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
        Leave a Review
      </a>
    </div>
    ` : ""}

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Thank you for choosing Storage Network! Questions? Reply to this email.
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
      <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Saved Build</p>
        <table style="width:100%;border-collapse:collapse;">
          ${data.quoteData!.map((u, i) => `
            <tr>
              <td style="padding:6px 0;color:#cbd5e1;font-size:14px;font-weight:600;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
            </tr>
          `).join("")}
          ${totalPrice > 0 ? `
            <tr style="border-top:1px solid #92400e;">
              <td style="padding:10px 0 0;color:#94a3b8;font-size:13px;">Total Estimate</td>
              <td style="padding:10px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${totalPrice.toLocaleString()}</td>
            </tr>
          ` : ""}
        </table>
      </div>
    `
    : "";

  const html = emailShell(
    "You\u2019re on the Waitlist",
    `
    <!-- Clock Icon -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">
        &#128337;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.7;">
      <strong style="color:#e2e8f0;">${data.installerBusinessName}</strong> put together a custom storage quote for you, but we don&rsquo;t have a verified installer in your area (ZIP <strong style="color:#facc15;">${data.zip}</strong>) just yet.
    </p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      <strong style="color:#e2e8f0;">You&rsquo;ve been added to our waitlist.</strong>
      As soon as a professional installer becomes available near you, we&rsquo;ll email you right away so you can pick up exactly where you left off &mdash; ${hasQuote ? "your build is saved and ready to go." : "no extra steps needed."}
    </p>

    ${buildSummaryHtml}

    <!-- What happens next -->
    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">What Happens Next</p>
      <table style="width:100%;font-size:14px;color:#94a3b8;">
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;width:24px;">1.</td>
          <td style="padding:8px 0;">We&rsquo;re actively recruiting installers in your area</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">2.</td>
          <td style="padding:8px 0;">The moment one is available, you&rsquo;ll get an email</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#facc15;font-weight:700;">3.</td>
          <td style="padding:8px 0;">${hasQuote ? "Click through and your saved build will be ready to confirm" : "Design your system and book an installation"}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;text-align:center;">
      No payment has been charged. You&rsquo;re under no obligation.
    </p>
    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      You&rsquo;re receiving this because ${data.installerBusinessName} submitted a quote on your behalf at storage-network.app.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: data.customerName,
    subject: `${firstName}, you're on the waitlist — we'll notify you when an installer is available`,
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

  const snapshotHtml = buildSnapshotUrl
    ? `
    <div style="margin-bottom:24px;text-align:center;">
      <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:4px;display:inline-block;">
        <img src="${buildSnapshotUrl}" alt="Your Custom Build" style="max-width:100%;border-radius:10px;display:block;" />
      </div>
      <p style="margin:8px 0 0;color:#64748b;font-size:11px;font-style:italic;">Your custom 3D design</p>
    </div>
    `
    : "";

  const itemsHtml = quoteItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px;">
          <span style="color:#facc15;font-weight:700;margin-right:8px;">${i + 1}.</span>${item.description}
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #1e293b;text-align:right;font-weight:700;color:#e2e8f0;font-size:14px;white-space:nowrap;">$${item.price.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return emailShell(
    `Your Quote from ${businessName}`,
    `
    <p style="margin:0 0 8px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">Here&rsquo;s the custom quote for your storage system. Everything below is built to your exact wall dimensions.</p>

    ${snapshotHtml}

    <!-- Itemized Build -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 16px;border-bottom:1px solid #334155;">
        <p style="margin:0;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Build</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${itemsHtml}
      </table>
    </div>

    <!-- Pricing Breakdown -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;">
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:6px 0;">Subtotal</td>
          <td style="text-align:right;color:#e2e8f0;font-size:14px;font-weight:600;padding:6px 0;">$${totalPrice.toFixed(2)}</td>
        </tr>
        ${deliveryAmount > 0 ? `<tr>
          <td style="color:#94a3b8;font-size:14px;padding:6px 0;">Delivery Fee</td>
          <td style="text-align:right;color:#e2e8f0;font-size:14px;font-weight:600;padding:6px 0;">$${deliveryAmount.toFixed(2)}</td>
        </tr>` : ""}
        ${taxAmount > 0 ? `<tr>
          <td style="color:#94a3b8;font-size:14px;padding:6px 0;">Est. Sales Tax (${estimatedTax!.stateCode}, ${(estimatedTax!.rate * 100).toFixed(2)}%)</td>
          <td style="text-align:right;color:#e2e8f0;font-size:14px;font-weight:600;padding:6px 0;">$${taxAmount.toFixed(2)}</td>
        </tr>` : ""}
        <tr>
          <td colspan="2" style="padding:12px 0 0;">
            <div style="border-top:1px dashed #475569;"></div>
          </td>
        </tr>
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:12px 0 4px;font-weight:600;">Total Estimate</td>
          <td style="text-align:right;color:#facc15;font-size:28px;font-weight:900;padding:12px 0 4px;">$${grandTotalWithTax.toFixed(2)}</td>
        </tr>
      </table>
      ${taxAmount > 0 ? `<p style="margin:8px 0 0;color:#64748b;font-size:11px;font-style:italic;">Final tax confirmed at checkout based on your billing address.</p>` : ""}
    </div>

    <!-- Deposit Callout -->
    <div style="background:linear-gradient(135deg,#422006,#451a03);border:2px solid #f59e0b;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Deposit to Reserve</p>
      <p style="margin:0 0 4px;color:#ffffff;font-size:32px;font-weight:900;">$${depositAmount.toFixed(2)}</p>
      <p style="margin:0;color:#fbbf24;font-size:13px;">Remaining <strong>$${balanceDue.toFixed(2)}</strong> paid after installation</p>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">To officially get your project on my schedule, please click the secure link below to review your order details and place the initial deposit. Once that is locked in, I will reserve your spot on the calendar, prep your materials, and we will be ready for installation day!</p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${checkoutUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(250,204,21,0.25);">
        Review Quote &amp; Secure Installation
      </a>
    </div>

    <!-- Trust Signals -->
    <div style="margin-bottom:28px;">
      <table style="width:100%;font-size:11px;color:#64748b;">
        <tr>
          <td style="text-align:center;padding:4px;">&#128274; Secure Checkout</td>
          <td style="text-align:center;padding:4px;">&#128176; Deposit Only</td>
          <td style="text-align:center;padding:4px;">&#9989; Custom Built for You</td>
        </tr>
      </table>
    </div>

    ${cleanoutServices && cleanoutServices.length > 0 ? `
    <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #22c55e40;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#22c55e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">&#10024; Add-On Service</p>
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;font-weight:700;">Want us to clean out your space first?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Get the most out of your new storage &mdash; we&rsquo;ll sort, organize, and haul away the clutter before your installation. Available as an add-on at checkout.</p>
      ${cleanoutServices.map((svc) => `
      <div style="background-color:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <table style="width:100%;"><tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;color:#e2e8f0;font-size:14px;font-weight:600;">${svc.name}</p>
            <p style="margin:0;color:#94a3b8;font-size:12px;">${svc.description}</p>
          </td>
          <td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:16px;">
            <span style="color:#facc15;font-size:16px;font-weight:700;">$${svc.price}</span>
          </td>
        </tr></table>
      </div>`).join("")}
      <p style="margin:12px 0 0;color:#64748b;font-size:11px;text-align:center;">You can add cleanout service during checkout. 50% deposit, remainder at service.</p>
    </div>
    ` : ""}

    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">Looking forward to getting your space organized!</p>
    <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;">
      Best,<br/>${sigName}<br/>${businessName}${phoneLine}
    </p>

    <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:13px;font-weight:700;">Have Questions?</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Reach out directly &mdash; we&rsquo;re happy to help.</p>
      <div style="display:inline-block;">
        <a href="mailto:?subject=Re:%20My%20Storage%20Quote%20from%20${encodeURIComponent(businessName)}" style="display:inline-block;background-color:#1e293b;color:#e2e8f0;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #475569;margin:0 4px;">
          &#9993; Reply to This Email
        </a>
        ${installerPhone ? `<a href="tel:${installerPhone}" style="display:inline-block;background-color:#1e293b;color:#e2e8f0;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #475569;margin:0 4px;">
          &#9742; Call ${installerPhone}
        </a>` : ""}
      </div>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;font-style:italic;">
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
  const installerLine = data.installerName
    ? `with <strong>${data.installerName}</strong>`
    : "for your custom storage system";

  const html = emailShell(
    "Complete Your Order",
    `
    <!-- Attention Grabber -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#422006;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#128722;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.customerName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Looks like you didn&rsquo;t finish your order ${installerLine}.
      No worries &mdash; your custom configuration is saved and ready to go!
    </p>

    <!-- Order Summary Card -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Order Summary</p>
      <table style="width:100%;">
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:8px 0;">Total Estimate</td>
          <td style="text-align:right;color:#facc15;font-size:20px;font-weight:800;">$${data.totalPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="color:#94a3b8;font-size:14px;padding:8px 0;border-top:1px dashed #475569;">Deposit to Reserve (15%)</td>
          <td style="text-align:right;color:#f59e0b;font-size:18px;font-weight:700;padding-top:8px;border-top:1px dashed #475569;">$${data.depositAmount.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
      *Sales tax (if applicable) will be collected by your installer at the time of installation.
    </p>

    <!-- Urgency Note -->
    <div style="background-color:#422006;border:1px solid #b45309;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
        <strong>&#9888; Heads up:</strong> Your order will expire in 7 days. Complete your purchase to lock in your spot on the schedule.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${data.resumeUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(250,204,21,0.3);">
        Complete My Order
      </a>
    </div>

    <!-- Trust Signals -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:12px;color:#94a3b8;">
        <tr>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#128274; Secure Checkout</td>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#128176; 15% Deposit Only</td>
          <td style="padding:6px 8px;text-align:center;width:33%;">&#9989; Satisfaction Guaranteed</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Changed your mind? No problem &mdash; just ignore this email. Your order will automatically expire.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.customerName,
    subject: "Don't forget your storage system! Complete your order",
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

  const body = `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${data.name.split(" ")[0]},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Your demo call is confirmed! We&rsquo;ll walk you through how the platform works
      and how it puts money in your pocket.
    </p>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Date</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Time</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;color:#facc15;">${formattedTime}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Duration</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">~30 minutes</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Format</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">Video / Phone Call</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${data.calendarLink}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Add to Google Calendar
      </a>
    </div>

    <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">What We&rsquo;ll Cover</p>
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; How pre-sold leads flow directly to you</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; The 3D configurator that closes sales for you</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; Auto-generated cut lists &amp; material planning</p>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:13px;">&#10003; Payment processing &amp; instant payouts</p>
      <p style="margin:0;color:#e2e8f0;font-size:13px;">&#10003; Marketing tools &amp; community access</p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      We&rsquo;ll reach out at the scheduled time. If you need to reschedule, just reply to this email.
    </p>
  `;

  const html = emailShell("Demo Call Confirmed", body);

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

  // Build service buttons
  const serviceButtonsHtml = services
    .map((s) => {
      const depositAmount = Math.round(s.price * 0.50);
      const upsellUrl = `${getAppUrl()}/upsell/${leadId}?service=${s.id}`;
      return `
      <div style="background:linear-gradient(135deg,#0f172a,#1a2332);border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="margin:0 0 4px;color:#e2e8f0;font-size:16px;font-weight:700;">${s.name}</p>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">${s.description}</p>
            <p style="margin:0;color:#64748b;font-size:12px;">50% deposit today: <strong style="color:#16a34a;">$${depositAmount}</strong> &bull; Remaining at service</p>
          </div>
          <div style="text-align:right;white-space:nowrap;margin-left:16px;">
            <p style="margin:0 0 8px;color:#facc15;font-size:22px;font-weight:900;">$${s.price}</p>
          </div>
        </div>
        <div style="text-align:center;margin-top:16px;">
          <a href="${upsellUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
            Add to My Service &rarr;
          </a>
        </div>
      </div>`;
    })
    .join("");

  const phoneHtml = installerPhone
    ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${installerPhone}</p>`
    : "";

  const html = emailShell(
    "Prepare for Your Installation",
    `
    <!-- Warm Greeting -->
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your installation with <strong style="color:#e2e8f0;">${installerName}</strong> is coming up on
      <strong style="color:#facc15;">${formattedDate}</strong>! Here are a few tips to get the most out of your appointment:
    </p>

    <!-- Preparation Tips -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Getting Ready</p>
      <table style="width:100%;font-size:14px;color:#94a3b8;">
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Clear the area where your new unit will be installed</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Ensure your installer has access to the space</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Have your totes or bins nearby if you plan to load them right away</td>
        </tr>
        ${address ? `<tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Confirm your install address: <strong style="color:#e2e8f0;">${address}</strong></td>
        </tr>` : ""}
      </table>
    </div>

    <!-- Installer Card -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="margin-bottom:8px;">${avatarHtml}</div>
      <p style="margin:0 0 2px;color:#facc15;font-size:16px;font-weight:800;">${installerName}</p>
      <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Installer</p>
      ${phoneHtml}
    </div>

    <!-- Upsell Section -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#facc15;font-size:16px;font-weight:800;">Want to Maximize Your Space?</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">
        ${installerName} also offers professional organizing and cleanout services.
        Add one to your appointment and let them handle the heavy lifting &mdash; just pick a service below!
      </p>
    </div>

    <!-- Service Buttons -->
    ${serviceButtonsHtml}

    <p style="margin:16px 0 0;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
      No obligation &mdash; if you&rsquo;d rather skip the add-on, your install is already confirmed and on the calendar.
      Simply ignore this section and we&rsquo;ll see you on ${formattedDate}!
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `${firstName}, your installation is in 3 days — get the most out of your appointment`,
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

  // Build services list
  const existingServicesHtml = existingServices
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 0;color:#cbd5e1;font-size:14px;">${s.name}</td>
        <td style="padding:6px 0;font-weight:600;text-align:right;color:#e2e8f0;">$${s.price.toLocaleString()}</td>
      </tr>`
    )
    .join("");

  const phoneHtml = installerPhone
    ? `<a href="tel:${installerPhone}" style="display:inline-block;margin-top:8px;background-color:#1e293b;color:#facc15;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #facc15;">Call ${installerPhone}</a>`
    : "";

  const addressRow = address
    ? `<tr><td style="padding:8px 0;color:#94a3b8;">Location</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${address}</td></tr>`
    : "";

  const html = emailShell(
    "Your Updated Order Confirmation",
    `
    <!-- Success Badge -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#052e16;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">
        &#10003;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your add-on service has been confirmed! Here&rsquo;s a complete summary of everything
      that will be taken care of during your appointment with <strong style="color:#e2e8f0;">${installerName}</strong>.
    </p>

    <!-- All Services -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Services to Be Performed</p>
      <table style="width:100%;border-collapse:collapse;">
        ${existingServicesHtml}
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0 6px;color:#16a34a;font-size:14px;font-weight:700;">&#10003; ${upsellService.name} <span style="color:#94a3b8;font-weight:400;font-size:12px;">(just added)</span></td>
          <td style="padding:10px 0 6px;font-weight:700;text-align:right;color:#16a34a;">$${upsellService.price.toLocaleString()}</td>
        </tr>
        <tr style="border-top:2px solid #334155;">
          <td style="padding:12px 0 0;color:#94a3b8;font-size:14px;font-weight:700;">Grand Total</td>
          <td style="padding:12px 0 0;font-weight:900;text-align:right;font-size:22px;color:#facc15;">$${totalPrice.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Summary -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Payment Summary</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Deposits Paid</td><td style="padding:6px 0;font-weight:700;text-align:right;color:#16a34a;">$${totalDeposit.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Add-on deposit (${upsellService.name})</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#16a34a;">$${upsellService.depositPaid.toLocaleString()}</td></tr>
        <tr style="border-top:1px solid #334155;">
          <td style="padding:10px 0 0;color:#94a3b8;font-weight:700;">Remaining Balance</td>
          <td style="padding:10px 0 0;font-weight:800;text-align:right;font-size:20px;color:#facc15;">$${totalBalance.toLocaleString()}*</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;text-align:center;font-style:italic;">
        *Plus applicable sales tax, collected by your installer at service time.
      </p>
    </div>

    <!-- Appointment Details -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Appointment Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Installer</td><td style="padding:8px 0;font-weight:700;text-align:right;color:#e2e8f0;">${installerName}</td></tr>
        ${dateSection}
        ${addressRow}
      </table>
      ${phoneHtml ? `<div style="text-align:center;margin-top:12px;">${phoneHtml}</div>` : ""}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${orderUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Full Order
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Reply to this email or contact your installer directly. We&rsquo;re here to help!
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `Order Updated — ${upsellService.name} added to your appointment with ${installerName}`,
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
      <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Saved Build</p>
        <table style="width:100%;border-collapse:collapse;">
          ${data.quoteData!.map((u, i) => `
            <tr>
              <td style="padding:6px 0;color:#cbd5e1;font-size:14px;font-weight:600;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
            </tr>
          `).join("")}
          ${data.grandTotal > 0 ? `
            <tr style="border-top:1px solid #334155;">
              <td style="padding:10px 0 0;color:#94a3b8;font-size:13px;">Total Estimate</td>
              <td style="padding:10px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${data.grandTotal.toLocaleString()}</td>
            </tr>
          ` : ""}
        </table>
      </div>
    `
    : "";

  const html = emailShell(
    "You\u2019re on the List",
    `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">
        &#9989;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
      <strong style="color:#facc15;">${data.installerBusinessName}</strong> is currently at full capacity,
      but your build has been saved and they&rsquo;ve been notified. They&rsquo;ll reach out
      to you shortly to confirm your booking.
    </p>

    ${buildSummaryHtml}

    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
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
  const buildSummaryHtml = hasQuote
    ? `
      <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your Build</p>
        <table style="width:100%;border-collapse:collapse;">
          ${data.quoteData!.map((u, i) => `
            <tr>
              <td style="padding:6px 0;color:#cbd5e1;font-size:14px;font-weight:600;">${i + 1}. ${u.desc || `${u.cols}\u00d7${u.rows} Unit`}</td>
              <td style="padding:6px 0;color:#e2e8f0;font-size:14px;font-weight:700;text-align:right;">${u.price ? `$${Number(u.price).toLocaleString()}` : ""}</td>
            </tr>
          `).join("")}
          <tr style="border-top:1px solid #334155;">
            <td style="padding:10px 0 0;color:#94a3b8;font-size:13px;">Total</td>
            <td style="padding:10px 0 0;color:#facc15;font-size:18px;font-weight:800;text-align:right;">$${data.estimatedPrice.toLocaleString()}</td>
          </tr>
        </table>
      </div>
    `
    : "";

  const html = emailShell(
    "Your Installer Is Ready — Book Now",
    `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">
        &#9989;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>

    <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Great news! <strong style="color:#facc15;">${data.installerBusinessName}</strong> is now
      accepting new bookings, and your build is first in line.
    </p>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
      Pay your deposit to lock in the job and your installer will reach out
      to confirm the details.
    </p>

    ${buildSummaryHtml}

    <!-- Deposit callout -->
    <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Deposit to Book</td>
          <td style="padding:8px 0;font-weight:800;text-align:right;color:#10b981;font-size:18px;">$${data.depositAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Balance Due at Install</td>
          <td style="padding:8px 0;font-weight:600;text-align:right;color:#e2e8f0;">$${(data.estimatedPrice - data.depositAmount).toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${payUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;text-transform:uppercase;letter-spacing:0.5px;">
        Pay Deposit &amp; Book
      </a>
    </div>

    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      No obligation until you pay. Your installer will contact you after your deposit is received.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: customerEmail,
    subject: `${data.installerBusinessName} is ready — pay your deposit to book`,
    html,
  });
}

