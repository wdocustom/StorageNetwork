import { sendTransactionalEmail, emailShell, type SendEmailResult } from "./core";
import { getAppUrl } from "@/lib/url-helper";
import { maskEmail, maskPhone, maskName } from "@/lib/mask";


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
  }
): Promise<SendEmailResult> {
  console.log("[Email] sendNewBookingAlert triggered for:", installerEmail, "| Lead:", leadDetails.leadId);
  const jobUrl = `${getAppUrl()}/dashboard/leads/${leadDetails.leadId}`;
  const profitEstimate = Math.round(leadDetails.totalPrice * 0.85);

  const html = emailShell(
    "New Booking Alert!",
    `
    <!-- Action Required Banner -->
    <div style="background-color:#450a0a;border:1px solid #991b1b;border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#dc2626;font-size:14px;font-weight:700;">
        Action Required: Contact customer within 24 hours
      </p>
    </div>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">New Job &mdash; ${city}</p>
      <p style="margin:0;color:#e2e8f0;font-size:28px;font-weight:800;">$${profitEstimate.toLocaleString()}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">estimated profit</p>
    </div>
    <table style="width:100%;margin-bottom:24px;font-size:14px;color:#cbd5e1;">
      <tr><td style="padding:8px 0;color:#94a3b8;width:120px;">Customer</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.customerName}</td></tr>
      ${leadDetails.customerEmail ? `<tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.customerEmail}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#94a3b8;">Address</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.address || city}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;">Units</td><td style="padding:8px 0;font-weight:600;color:#cbd5e1;">${leadDetails.unitCount} shelving unit${leadDetails.unitCount !== 1 ? "s" : ""}</td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${jobUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        View Job Details
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This lead has a paid deposit. Open your dashboard to view the full cut list.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    subject: `NEW BOOKING: ${leadDetails.customerName} in ${city} — $${profitEstimate.toLocaleString()}`,
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

  const html = emailShell(
    "Payment Received",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Great news! <strong>${data.customerName}</strong> just paid the remaining balance for their installation.
    </p>

    <div style="background-color:#052e16;border:1px solid #166534;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;color:#16a34a;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Payment Received</p>
      <p style="margin:0;color:#16a34a;font-size:36px;font-weight:900;">$${data.amountReceived.toLocaleString()}</p>
    </div>

    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Customer</td><td style="padding:6px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerName}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Job Total</td><td style="padding:6px 0;font-weight:600;text-align:right;">$${data.jobTotal.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        View Job Ticket
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Funds will transfer to your connected bank account per your Stripe payout schedule.
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

  const html = emailShell(
    "Let&rsquo;s Get Your First Job Booked",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Welcome to Storage Network, ${data.name}.</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      You now have a custom 3D configurator that makes you look like a top-tier professional.
      Your first 3 jobs are completely free to process.
    </p>

    <!-- Money Hook -->
    <div style="background-color:#052e16;border:1px solid #166534;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#16a34a;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">To Get Paid</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.7;">
        To actually receive the <strong style="color:#facc15;">15% upfront deposits</strong> from your customers,
        you must connect your bank account. Once connected, you can start sending quotes.
      </p>
    </div>

    <!-- What You Get -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">3D configurator that closes sales for you</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">Auto-generated cut lists &amp; material lists</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:18px;">&#10003;</td>
          <td style="padding:8px 0;">Automated deposit routing straight to your bank</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#facc15;font-size:18px;font-weight:700;">$0</td>
          <td style="padding:8px 0;"><strong style="color:#facc15;">First 3 jobs — zero platform fees</strong></td>
        </tr>
      </table>
    </div>

    <!-- CTA: Connect Stripe -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${profileUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Connect Stripe &amp; Activate Profile
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email &mdash; we&rsquo;re here to help.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Welcome to the Network. Let's get your first job booked.",
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

  const html = emailShell(
    "Your Custom QR Code is Ready",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Your public portfolio page is live. Homeowners can now design their own units and book you directly.
    </p>

    ${data.slug ? `
    <!-- Live Link Preview -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your Public Portfolio</p>
      <p style="margin:0;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;">${portfolioUrl}</p>
    </div>
    ` : ""}

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Go to your dashboard and download your custom QR code.
    </p>

    <!-- Pro Tip -->
    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:14px;font-weight:700;">Pro Tip</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.7;">
        Put this QR code on your <strong>truck</strong>, your <strong>business cards</strong>,
        and the bottom of your <strong>invoices</strong>. Every scan is a potential booking.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        View Your Public Link
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Your custom QR code is ready.",
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

  const html = emailShell(
    "Your First Sale Playbook",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      The fastest way to get your first booking is Facebook Marketplace or Nextdoor.
      Copy this exact text and post it in your local community groups:
    </p>

    <!-- Copy-Paste Template -->
    <div style="background-color:#0f172a;border-left:4px solid #facc15;border-radius:0 12px 12px 0;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Copy &amp; Paste This</p>
      <p style="margin:0;color:#e2e8f0;font-size:15px;line-height:1.8;font-style:italic;">
        &ldquo;Hey neighbors, I&rsquo;m doing custom heavy-duty garage storage builds this month.
        They hold 1,000+ lbs and are built to fit your exact space.
        You can design your own unit and get instant pricing here: ${data.slug ? portfolioUrl : "[Your Link]"}&rdquo;
      </p>
    </div>

    <!-- Where to Post -->
    <div style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 16px;color:#facc15;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Where to Post</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Facebook Marketplace &mdash; &ldquo;Home Services&rdquo;</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Nextdoor &mdash; your neighborhood group</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Local Facebook groups (HOA, buy/sell, neighborhood)</td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;color:#16a34a;font-size:16px;">&#10003;</td>
          <td style="padding:8px 0;">Craigslist &mdash; &ldquo;Services Offered&rdquo;</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Go to Dashboard to Copy Link
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Copy & paste this to get your first custom storage lead.",
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

  const html = emailShell(
    "Don&rsquo;t Let Your Free Jobs Go to Waste",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Just a reminder: your first 3 jobs on Storage Network are on us. You get the 3D tool,
      the automated cut lists, and the deposit routing with zero monthly fees.
    </p>

    <!-- Trial Status -->
    <div style="background:linear-gradient(135deg,#422006,#451a03);border:1px solid #92400e;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#facc15;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Trial Status</p>
      <p style="margin:0;color:#e2e8f0;font-size:36px;font-weight:900;">${jobsLeft}</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">free ${jobsLeft === 1 ? "job" : "jobs"} remaining</p>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Have a quote you&rsquo;ve been working on? Build it in the dashboard and text the link
      to your customer today to lock it in.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;">
        Open Dashboard
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Questions? Just reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Don't let your free jobs go to waste.",
    html,
  });
}

export async function sendInstallerWelcome(
  name: string,
  email: string
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const html = emailShell(
    "Welcome to the Partner Network",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;">
      Your installer account is now <strong style="color:#16a34a;">active</strong>.
      Your bank is connected and you&rsquo;re ready to receive automated leads and payouts.
    </p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      Here&rsquo;s what happens next:
    </p>
    <ul style="margin:0 0 28px;padding-left:20px;color:#94a3b8;font-size:14px;">
      <li style="margin-bottom:8px;">Leads with <strong>paid deposits</strong> land in your dashboard automatically.</li>
      <li style="margin-bottom:8px;">Each job includes a <strong>cut list</strong>, material list, and assembly guide.</li>
      <li style="margin-bottom:8px;">Collect the balance on-site with one tap &mdash; funds go straight to your bank.</li>
    </ul>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open Dashboard
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
      Questions? Reply to this email anytime.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: name,
    subject: "Welcome to the Storage Network Partner Program — You're Live!",
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

  const html = emailShell(
    "Let's Get to Work!",
    `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#facc15,#f59e0b);border-radius:50%;width:72px;height:72px;line-height:72px;font-size:32px;">
        &#128170;
      </div>
    </div>

    <p style="margin:0 0 16px;color:#e2e8f0;font-size:18px;font-weight:800;text-align:center;">
      Let&rsquo;s get to work, ${data.name}!
    </p>
    <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;text-align:center;line-height:1.7;">
      You&rsquo;ve unlocked the <strong style="color:#facc15;">ONLY platform</strong> specifically designed for you
      and what you build. No more chasing leads through DMs, sketching layouts on paper,
      or losing out-of-area customers. Everything you need to book more jobs, collect deposits,
      and grow your business is right here.
    </p>

    <div style="background:linear-gradient(135deg,#0f172a,#1a2744);border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;color:#facc15;font-size:22px;font-weight:900;">
        Let&rsquo;s make this your best year.
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;">
        Every tool below is live and ready for you right now.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:12px;background:#0f172a;border-radius:10px;border:1px solid #334155;">
          <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">&#9889; 3D Configurator</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">Customers build their own unit, see real pricing, and book instantly.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px;background:#0f172a;border-radius:10px;border:1px solid #334155;">
          <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">&#128279; Your Partner Link</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">One link to share everywhere &mdash; social, texts, cards. Customers land on YOUR branded page.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px;background:#0f172a;border-radius:10px;border:1px solid #334155;">
          <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">&#128176; Deposit Collection</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">Secure deposits before you even show up. No more no-shows or price hagglers.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:12px;background:#0f172a;border-radius:10px;border:1px solid #334155;">
          <p style="margin:0 0 4px;color:#facc15;font-size:13px;font-weight:800;">&#127758; Network Referrals</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">Out-of-area leads pay YOU a 30% referral cut. Passive income from jobs you can&rsquo;t drive to.</p>
        </td>
      </tr>
    </table>

    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your Partner Link</p>
      <p style="margin:0;color:#facc15;font-size:16px;font-weight:700;word-break:break-all;">${partnerLinkUrl}</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;">
        Open Your Dashboard &rarr;
      </a>
    </div>

    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      Post your link on Facebook, TikTok, or text it to customers &mdash; and watch the bookings roll in.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Let's get to work \u2014 Your Pro tools are live!",
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

  const html = emailShell(
    "Pro Subscription Receipt",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.name},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">
      Your Pro subscription has been renewed. Here&rsquo;s your receipt and a snapshot of your progress.
    </p>

    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#cbd5e1;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Plan</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#facc15;">Storage Network Pro</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Amount</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;">${fmtMoney(data.amountPaid)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Period</td>
          <td style="padding:8px 0;text-align:right;">${fmtDate(data.periodStart)} &mdash; ${fmtDate(data.periodEnd)}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 12px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
      Your Stats So Far
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;margin:0 0 24px;">
      <tr>
        ${stat(String(data.totalJobs), "Jobs Completed", "#34d399")}
        ${stat(fmtMoney(data.totalRevenue), "Total Revenue", "#60a5fa")}
        ${stat(fmtMoney(data.totalProfit), "Your Profit", "#facc15")}
      </tr>
    </table>

    ${data.totalJobs === 0
      ? `<div style="background:#facc150d;border:1px solid #facc1533;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
          <p style="margin:0 0 4px;color:#facc15;font-size:14px;font-weight:700;">Time to land your first Pro job!</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">Share your partner link on social media &mdash; the configurator does the selling for you.</p>
        </div>`
      : `<div style="background:#16a34a0d;border:1px solid #16a34a33;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
          <p style="margin:0 0 4px;color:#34d399;font-size:14px;font-weight:700;">Keep the momentum going!</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">Every job you complete builds your reputation on the platform. Post your link, stack those bookings.</p>
        </div>`
    }

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px;">
        Open Dashboard &rarr;
      </a>
    </div>

    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:10px;padding:16px;text-align:center;">
      <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your Partner Link</p>
      <p style="margin:0;color:#facc15;font-size:14px;font-weight:700;word-break:break-all;">${partnerLinkUrl}</p>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: `Pro Receipt \u2014 ${fmtMoney(data.amountPaid)} | ${data.totalJobs} jobs completed`,
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

  const phoneLine = data.customerPhone
    ? `<tr><td style="padding:8px 0;color:#94a3b8;">Phone</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerPhone}</td></tr>`
    : "";

  const radiusLine = data.radiusMiles
    ? `outside your current <strong>${data.radiusMiles}-mile</strong> service radius`
    : `outside your current service area`;

  const html = emailShell(
    "Waitlist Request",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hey ${data.installerName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">
      A customer wants a tote rack build, but their ZIP code (<strong style="color:#facc15;">${data.customerZip}</strong>) is ${radiusLine}.
      They&rsquo;ve asked to be added to your waitlist in case you expand coverage.
    </p>

    <div style="background-color:#422006;border:1px solid #92400e;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Customer Details</p>
      <table style="width:100%;font-size:14px;color:#cbd5e1;">
        <tr><td style="padding:8px 0;color:#94a3b8;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;text-align:right;color:#cbd5e1;">${data.customerName}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;font-weight:600;text-align:right;"><a href="mailto:${data.customerEmail}" style="color:#2563eb;text-decoration:none;">${data.customerEmail}</a></td></tr>
        ${phoneLine}
        <tr><td style="padding:8px 0;color:#94a3b8;">ZIP Code</td><td style="padding:8px 0;font-weight:800;text-align:right;color:#dc2626;">${data.customerZip}</td></tr>
      </table>
    </div>

    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.7;">
      If you&rsquo;d like to take this job, you can reach out to the customer directly
      or expand your service radius in your dashboard settings.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="mailto:${data.customerEmail}?subject=Storage%20Network%20%E2%80%94%20Service%20Area%20Update" style="display:inline-block;background-color:#facc15;color:#1e293b;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;">
        Email Customer
      </a>
      <a href="${dashboardUrl}" style="display:inline-block;background-color:#1e293b;color:#facc15;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;border:2px solid #facc15;">
        Update Service Area
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      This customer was not charged. No action is required if you don&rsquo;t service this area.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: installerEmail,
    toName: data.installerName,
    subject: `Waitlist: ${data.customerName} in ZIP ${data.customerZip} — Outside Service Area`,
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

  return emailShell(
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

  const html = emailShell(
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

  const html = emailShell(
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

  const html = emailShell("New Demo Booking", body);

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

  const html = emailShell(
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

  const html = emailShell(
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

  const html = emailShell(
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

