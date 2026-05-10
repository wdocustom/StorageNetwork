import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Program — Email Templates
//
// Used by Phase 2's applyToBeAffiliate flow. Two templates:
//   1. Applicant confirmation — "we got your application, review in 3 days"
//   2. Admin alert            — "new affiliate application from {name}"
//
// Phase 3+ will add: approval email (with agreement link), rejection email,
// agreement-accepted notification to admin.
// ═══════════════════════════════════════════════════════════════════════════

function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function ctaButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${label}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── 1. Applicant Confirmation ──────────────────────────────────────────────
// Sent immediately on application submit. Sets expectations on review
// turnaround. Reassures that admin reviews every application personally —
// matches the "no automatic approvals" rule.

export async function sendAffiliateApplicationReceivedEmail(
  email: string,
  data: { name: string }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeName = escapeHtml(data.name);

  const html = masterEmailLayout(
    "Application Received",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Thanks, ${safeName}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Your affiliate application is in. We review every application personally &mdash;
      no auto-approvals, no form-letter rejections.
    </p>

    ${eyebrow("What happens next")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">1.</span>
        We&rsquo;ll review your application within <strong>3 business days</strong>.
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">2.</span>
        If approved, we&rsquo;ll send you a custom agreement to review and accept.
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">3.</span>
        Once accepted, your partner portal lights up with your recruiting tools.
      </td></tr>
    </table>

    <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      In the meantime, keep doing what you&rsquo;re doing &mdash; finish jobs, earn reviews,
      build your reputation. Those are the same things that make a great recruiter.
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Back to Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email &mdash; we read every one.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Affiliate Application Received — we'll be in touch within 3 business days",
    html,
  });
}

// ── 2. Admin Alert ─────────────────────────────────────────────────────────
// Sent to every active admin (profiles.is_admin = true) the moment a new
// application lands. Contains a summary of the form payload so admin can
// triage from the inbox before opening the full review queue.

export async function sendAffiliateApplicationAdminAlert(
  adminEmail: string,
  data: {
    applicantName: string;
    applicantEmail: string;
    applicationId: string;
    applicationData: Record<string, unknown>;
  }
): Promise<SendEmailResult> {
  // Admin review queue lands here (Phase 3 builds it; the URL is stable).
  const reviewUrl = `${getAppUrl()}/dashboard/admin/affiliates`;
  const safeName = escapeHtml(data.applicantName);
  const safeEmail = escapeHtml(data.applicantEmail);

  const why = String((data.applicationData as { why?: unknown })?.why ?? "");
  const howToRecruit = String(
    (data.applicationData as { how_to_recruit?: unknown })?.how_to_recruit ?? ""
  );
  const audienceSize = String(
    (data.applicationData as { audience_size?: unknown })?.audience_size ?? "—"
  );

  const html = masterEmailLayout(
    "New Affiliate Application",
    `
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${safeName}</strong>
      (<a href="mailto:${safeEmail}" style="color:#facc15;">${safeEmail}</a>)
      just applied to join the affiliate program.
    </p>

    ${eyebrow("Why")}
    <div style="border:1px solid #222;border-radius:8px;padding:16px;margin:0 0 20px;color:#ffffff;font-size:14px;line-height:1.7;white-space:pre-wrap;">
      ${escapeHtml(why)}
    </div>

    ${eyebrow("How they plan to recruit")}
    <div style="border:1px solid #222;border-radius:8px;padding:16px;margin:0 0 20px;color:#ffffff;font-size:14px;line-height:1.7;white-space:pre-wrap;">
      ${escapeHtml(howToRecruit)}
    </div>

    ${eyebrow("Audience size")}
    <p style="margin:0 0 28px;color:#facc15;font-size:14px;font-weight:700;text-transform:capitalize;">
      ${escapeHtml(audienceSize)}
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(reviewUrl, "Open Review Queue")}
    </div>

    <p style="margin:0;color:#555;font-size:11px;text-align:center;">
      Application ID: ${escapeHtml(data.applicationId)}
    </p>
    `
  );

  return sendTransactionalEmail({
    to: adminEmail,
    subject: `New Affiliate Application — ${data.applicantName}`,
    html,
  });
}

// ── 3. Agreement Proposed (Approved) ────────────────────────────────────────
// Sent to the applicant the moment admin proposes their agreement. Link
// goes to the Phase 4 acceptance page. The actual cut terms are NOT in the
// email body — they live on the acceptance page so the applicant has to
// review the full document, not skim an email.

export async function sendAffiliateAgreementProposedEmail(
  email: string,
  data: { name: string; agreementId: string }
): Promise<SendEmailResult> {
  // Phase 4 builds the acceptance page; the URL is stable.
  const reviewUrl = `${getAppUrl()}/dashboard/affiliate/agreement/${data.agreementId}`;
  const safeName = escapeHtml(data.name);

  const html = masterEmailLayout(
    "Application Approved",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Great news, ${safeName}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You&rsquo;ve been approved to join the affiliate program. We&rsquo;ve drafted a custom
      agreement for you to review — terms tailored to your situation.
    </p>

    ${eyebrow("Your next step")}
    <div style="border:1px solid #222;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Review &amp; Accept</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">
        Read the agreement carefully. Once you accept, your partner portal lights up and
        you can start recruiting.
      </p>
      ${ctaButton(reviewUrl, "Review My Agreement")}
    </div>

    <p style="margin:0 0 12px;color:#a3a3a3;font-size:13px;line-height:1.7;">
      <strong style="color:#ffffff;">Note:</strong> your agreement&rsquo;s specifics are private —
      only you see your terms. We can&rsquo;t share another affiliate&rsquo;s rates with you,
      and we won&rsquo;t share yours with anyone else.
    </p>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions before accepting? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "You're approved — review your affiliate agreement",
    html,
  });
}

// ── 4. Application Rejected ────────────────────────────────────────────────
// Courteous "not at this time" — no reason given. Internal review_notes
// stay internal. We invite a future re-apply rather than burning the bridge.

export async function sendAffiliateApplicationRejectedEmail(
  email: string,
  data: { name: string }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeName = escapeHtml(data.name);

  const html = masterEmailLayout(
    "Affiliate Application Update",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${safeName},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Thanks for applying to be an affiliate. After reviewing, we&rsquo;re not able to
      approve your application at this time.
    </p>

    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      This isn&rsquo;t a permanent no. Affiliate decisions depend a lot on timing —
      what&rsquo;s a fit later may not be a fit today. If your situation changes (new
      audience, new channel, more completed jobs), you&rsquo;re welcome to apply again.
    </p>

    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      In the meantime, keep building. Reviews, completed jobs, and a strong reputation
      on the network are the surest path back.
    </p>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(dashboardUrl, "Back to Dashboard")}
    </div>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "Affiliate Application Update",
    html,
  });
}

// ── 5. Agreement Accepted (Admin Alert) ────────────────────────────────────
// Fires when an affiliate clicks Accept on a proposed agreement. Lets the
// admin team see the queue moving without manually checking Supabase. The
// email body includes a deep link straight to the agreement record.

export async function sendAffiliateAgreementAcceptedAdminAlert(
  adminEmail: string,
  data: { affiliateName: string; agreementId: string }
): Promise<SendEmailResult> {
  const reviewUrl = `${getAppUrl()}/dashboard/admin/affiliates`;
  const safeName = escapeHtml(data.affiliateName);

  const html = masterEmailLayout(
    "Agreement Accepted",
    `
    <p style="margin:0 0 12px;color:#ffffff;font-size:16px;">
      <strong>${safeName}</strong> just accepted their affiliate agreement.
    </p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Their partner portal is live and they can start recruiting. Phase 5 will
      begin auto-paying their cuts on each recruit&rsquo;s subscription invoice.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(reviewUrl, "Open Affiliate Queue")}
    </div>
    <p style="margin:0;color:#555;font-size:11px;text-align:center;">
      Agreement ID: ${escapeHtml(data.agreementId)}
    </p>
    `
  );

  return sendTransactionalEmail({
    to: adminEmail,
    subject: `Affiliate Agreement Accepted — ${data.affiliateName}`,
    html,
  });
}

// ── 6. Affiliate Cold Invite (sent on behalf of the referring installer) ──
// Phase 6's "highly converting, salesman-style" outreach. Format decisions
// match the architecture brief:
//   • From: "{ReferrerName} via Storage Network <orders@storage-network.app>"
//     — display-name trick keeps deliverability on our infrastructure while
//     framing the message as a personal nudge from the referrer.
//   • Reply-To: referring installer's real email — replies go straight to
//     them, not to the storage-network inbox.
//   • One clear CTA. Three short value bullets. No multi-step nurture.
//   • CAN-SPAM compliant footer: physical address + unsubscribe link.
//
// The body is intentionally short. B2B cold email peaks in conversion
// around ~100–150 words of body. Anything longer reads like a sales deck.

export async function sendAffiliateColdInviteEmail(input: {
  prospectEmail: string;
  prospectName: string | null;
  referrerName: string;
  referrerCompany: string | null;
  referrerEmail: string;
  inviteToken: string;
}): Promise<SendEmailResult> {
  const inviteUrl = `${getAppUrl()}/join/i/${input.inviteToken}`;
  const unsubUrl = `${getAppUrl()}/api/unsubscribe-affiliate-invite?token=${input.inviteToken}`;

  const safeProspectFirstName =
    input.prospectName?.trim().split(/\s+/)[0] || "there";
  const safeReferrerName = escapeHtml(input.referrerName);
  const safeReferrerLine = input.referrerCompany
    ? `${escapeHtml(input.referrerName)} at ${escapeHtml(input.referrerCompany)}`
    : escapeHtml(input.referrerName);

  const html = masterEmailLayout(
    "An installer you might know thinks you'd be a fit",
    `
    <p style="margin:0 0 16px;color:#ffffff;font-size:16px;">
      Hey ${escapeHtml(safeProspectFirstName)},
    </p>
    <p style="margin:0 0 16px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      My name&rsquo;s ${safeReferrerLine}. I install custom storage on a platform
      called Storage Network and figured you should at least know it exists.
    </p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      It&rsquo;s done well for me &mdash; the platform brings in customers who already
      know what they want and have paid a deposit. Less time chasing leads, more
      time installing. If you want to see how it works, here&rsquo;s a link:
    </p>

    ${eyebrow("Why I'm telling you about it")}
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>
        Customers design their build in 3D, pay a deposit before you swing a hammer.
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>
        Auto-generated cut lists. No math. Quote-to-install in days, not weeks.
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">&#10003;</span>
        Stripe payouts. Auto-routed leads. First 3 jobs have zero platform fees.
      </td></tr>
    </table>

    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(inviteUrl, "See How It Works")}
    </div>

    <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Reply to this email if you have questions &mdash; it comes straight to me.
      Worst case it takes 2 minutes and you decide it&rsquo;s not for you.
    </p>

    <p style="margin:0 0 4px;color:#a3a3a3;font-size:14px;">${safeReferrerName}</p>
    <p style="margin:0;color:#555;font-size:11px;">
      Forwarded by Storage Network on ${safeReferrerName}&rsquo;s behalf.
    </p>

    <!-- Compliance footer (CAN-SPAM) -->
    <div style="border-top:1px solid #222;margin-top:32px;padding-top:18px;text-align:center;">
      <p style="margin:0 0 4px;color:#555;font-size:11px;">
        You&rsquo;re receiving this because ${safeReferrerName} thought you might be a fit
        for Storage Network. <a href="${unsubUrl}" style="color:#facc15;text-decoration:underline;">Don&rsquo;t want these?</a>
      </p>
      <p style="margin:0;color:#555;font-size:11px;">
        Storage Network &middot; 1100 Williams Way, Westerville, OH 43082
      </p>
    </div>
    `
  );

  return sendTransactionalEmail({
    to: input.prospectEmail,
    toName: input.prospectName || undefined,
    senderName: `${input.referrerName} via Storage Network`,
    replyTo: input.referrerEmail,
    subject: `${input.referrerName} thinks you should see this`,
    html,
  });
}
