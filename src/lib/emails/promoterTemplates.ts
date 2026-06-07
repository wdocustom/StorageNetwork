import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";

// ═══════════════════════════════════════════════════════════════════════════
// Promoter Program — Email Templates
//
// Mirrors affiliateTemplates.ts. Five templates covering the same
// application → individualized agreement → acceptance lifecycle, scoped to
// the build-plans promoter program instead of the installer-recruitment
// affiliate program.
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

export async function sendPromoterApplicationReceivedEmail(
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
      Your promoter application is in. We review every application personally &mdash;
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
        If approved, we&rsquo;ll send you a custom agreement with your commission rate to review and accept.
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #222;color:#ffffff;font-size:14px;line-height:1.6;">
        <span style="color:#facc15;font-weight:700;margin-right:8px;">3.</span>
        Once accepted, your promoter portal lights up with your share link and stats.
      </td></tr>
    </table>

    <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      In the meantime, keep doing what you&rsquo;re doing &mdash; the same audience and
      reputation that make a great promoter make a great installer.
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
    subject: "Promoter Application Received — we'll be in touch within 3 business days",
    html,
  });
}

// ── 2. Admin Alert ─────────────────────────────────────────────────────────

export async function sendPromoterApplicationAdminAlert(
  adminEmail: string,
  data: {
    applicantName: string;
    applicantEmail: string;
    applicationId: string;
    applicationData: Record<string, unknown>;
  }
): Promise<SendEmailResult> {
  const reviewUrl = `${getAppUrl()}/dashboard/admin/promoters`;
  const safeName = escapeHtml(data.applicantName);
  const safeEmail = escapeHtml(data.applicantEmail);

  const howToPromote = String(
    (data.applicationData as { how_to_promote?: unknown })?.how_to_promote ?? ""
  );
  const audienceSize = String(
    (data.applicationData as { audience_size?: unknown })?.audience_size ?? "—"
  );

  const html = masterEmailLayout(
    "New Promoter Application",
    `
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      <strong style="color:#ffffff;">${safeName}</strong>
      (<a href="mailto:${safeEmail}" style="color:#facc15;">${safeEmail}</a>)
      just applied to join the promoter program.
    </p>

    ${eyebrow("How they plan to promote")}
    <div style="border:1px solid #222;border-radius:8px;padding:16px;margin:0 0 20px;color:#ffffff;font-size:14px;line-height:1.7;white-space:pre-wrap;">
      ${escapeHtml(howToPromote)}
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
    subject: `New Promoter Application — ${data.applicantName}`,
    html,
  });
}

// ── 3. Agreement Proposed (Approved) ────────────────────────────────────────

export async function sendPromoterAgreementProposedEmail(
  email: string,
  data: { name: string; agreementId: string }
): Promise<SendEmailResult> {
  const reviewUrl = `${getAppUrl()}/dashboard/promoter/agreement/${data.agreementId}`;
  const safeName = escapeHtml(data.name);

  const html = masterEmailLayout(
    "Application Approved",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Great news, ${safeName}.</p>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      You&rsquo;ve been approved to join the promoter program. We&rsquo;ve drafted a custom
      agreement for you to review — including the commission rate we negotiated.
    </p>

    ${eyebrow("Your next step")}
    <div style="border:1px solid #222;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center;">
      <p style="margin:0 0 6px;color:#facc15;font-size:18px;font-weight:800;">Review &amp; Accept</p>
      <p style="margin:0 0 20px;color:#a3a3a3;font-size:13px;line-height:1.6;">
        Read the agreement carefully. Once you accept, your promoter portal lights up with
        your share link and you start earning on every sale you refer.
      </p>
      ${ctaButton(reviewUrl, "Review My Agreement")}
    </div>

    <p style="margin:0 0 12px;color:#a3a3a3;font-size:13px;line-height:1.7;">
      <strong style="color:#ffffff;">Note:</strong> your commission rate is individualized and
      private — only you see your terms.
    </p>

    <p style="margin:0;color:#555;font-size:12px;text-align:center;">
      Questions before accepting? Reply to this email.
    </p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    toName: data.name,
    subject: "You're approved — review your promoter agreement",
    html,
  });
}

// ── 4. Application Rejected ────────────────────────────────────────────────

export async function sendPromoterApplicationRejectedEmail(
  email: string,
  data: { name: string }
): Promise<SendEmailResult> {
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeName = escapeHtml(data.name);

  const html = masterEmailLayout(
    "Promoter Application Update",
    `
    <p style="margin:0 0 8px;color:#ffffff;font-size:16px;">Hi ${safeName},</p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Thanks for applying to the promoter program. After reviewing, we&rsquo;re not able
      to approve your application at this time.
    </p>

    <p style="margin:0 0 24px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      This isn&rsquo;t a permanent no — promoter decisions depend a lot on timing and fit
      for the plans we&rsquo;re promoting right now. If your situation changes (new
      audience, new channel), you&rsquo;re welcome to apply again.
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
    subject: "Promoter Application Update",
    html,
  });
}

// ── 5. Agreement Accepted (Admin Alert) ────────────────────────────────────

export async function sendPromoterAgreementAcceptedAdminAlert(
  adminEmail: string,
  data: { promoterName: string; agreementId: string }
): Promise<SendEmailResult> {
  const reviewUrl = `${getAppUrl()}/dashboard/admin/promoters`;
  const safeName = escapeHtml(data.promoterName);

  const html = masterEmailLayout(
    "Agreement Accepted",
    `
    <p style="margin:0 0 12px;color:#ffffff;font-size:16px;">
      <strong>${safeName}</strong> just accepted their promoter agreement.
    </p>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:14px;line-height:1.7;">
      Their portal is live and their referral link is active. Sales they drive will
      auto-pay their commission to their connected Stripe account.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      ${ctaButton(reviewUrl, "Open Promoter Roster")}
    </div>
    <p style="margin:0;color:#555;font-size:11px;text-align:center;">
      Agreement ID: ${escapeHtml(data.agreementId)}
    </p>
    `
  );

  return sendTransactionalEmail({
    to: adminEmail,
    subject: `Promoter Agreement Accepted — ${data.promoterName}`,
    html,
  });
}
