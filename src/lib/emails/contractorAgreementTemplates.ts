import { sendTransactionalEmail, type SendEmailResult } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";

// ═══════════════════════════════════════════════════════════════════════════
// Contractor-agreement signing invite
//
// Sent by the /api/cron/send-contractor-agreements cron when a row in
// contractor_agreements has status='pending_send' and email_sent_at IS NULL.
// The CTA links to the public signing page gated by signature_token.
// ═══════════════════════════════════════════════════════════════════════════

export interface ContractorAgreementInviteData {
  contractorName: string;
  agreementTitle: string;
  companySignerName: string;
  effectiveDate: string;   // pre-formatted (e.g., "May 15, 2026")
  signUrl: string;
}

export async function sendContractorAgreementInvite(
  email: string,
  data: ContractorAgreementInviteData
): Promise<SendEmailResult> {
  const {
    contractorName,
    agreementTitle,
    companySignerName,
    effectiveDate,
    signUrl,
  } = data;

  const html = masterEmailLayout(
    "Agreement Ready for Signature",
    `
    <p style="margin:0 0 8px;color:#facc15;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
      Agreement ready for signature
    </p>
    <p style="margin:0 0 18px;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">
      ${escapeHtml(agreementTitle)}
    </p>

    <p style="margin:0 0 16px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(contractorName)},</p>

    <p style="margin:0 0 18px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      ${escapeHtml(companySignerName)} has signed and sent you the agreement
      above for review. Click the button below to read the full terms and
      complete your signature.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:24px;margin:0 0 28px;">
      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
        Effective date
      </p>
      <p style="margin:0 0 18px;color:#ffffff;font-size:16px;font-weight:700;">
        ${escapeHtml(effectiveDate)}
      </p>

      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
        Signature on file from Storage-Network
      </p>
      <p style="margin:0 0 24px;color:#ffffff;font-size:16px;font-weight:700;">
        ${escapeHtml(companySignerName)}
      </p>

      <div style="text-align:center;">
        <a href="${signUrl}"
           style="display:inline-block;background-color:#facc15;color:#000000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Review &amp; Sign
        </a>
      </div>
    </div>

    <p style="margin:0 0 18px;color:#a3a3a3;font-size:13px;line-height:1.7;">
      The signing page asks you to type your full legal name to accept the
      terms. Your typed signature, along with the timestamp, is recorded as
      the binding acceptance of this agreement.
    </p>

    <p style="margin:0 0 28px;color:#666;font-size:12px;line-height:1.6;">
      If you weren't expecting this email, ignore it — the link is single-use
      and tied to your inbox. Questions? Reply to this message.
    </p>

    <p style="margin:0;color:#555;font-size:13px;">— Storage-Network</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: `Signature requested: ${agreementTitle}`,
    html,
  });
}

// ── Confirmation email (sent right after the contractor types + accepts) ──
export interface ContractorAgreementSignedData {
  contractorName: string;
  agreementTitle: string;
  signedAt: string; // pre-formatted (e.g., "May 15, 2026 at 8:42 PM CT")
  typedSignature: string;
}

export async function sendContractorAgreementSignedReceipt(
  email: string,
  data: ContractorAgreementSignedData
): Promise<SendEmailResult> {
  const { contractorName, agreementTitle, signedAt, typedSignature } = data;

  const html = masterEmailLayout(
    "Agreement Signed",
    `
    <p style="margin:0 0 8px;color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">
      Signature recorded
    </p>
    <p style="margin:0 0 18px;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3;">
      ${escapeHtml(agreementTitle)}
    </p>

    <p style="margin:0 0 16px;color:#ffffff;font-size:16px;">Hi ${escapeHtml(contractorName)},</p>

    <p style="margin:0 0 18px;color:#a3a3a3;font-size:15px;line-height:1.7;">
      Thanks — your signature has been recorded. Keep this email as proof
      of acceptance. The terms above are now in effect between both parties.
    </p>

    <div style="background-color:#111111;border:1px solid #222;border-radius:12px;padding:24px;margin:0 0 28px;">
      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
        Signed by
      </p>
      <p style="margin:0 0 18px;color:#ffffff;font-size:16px;font-weight:700;">
        ${escapeHtml(typedSignature)}
      </p>

      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
        Timestamp
      </p>
      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">
        ${escapeHtml(signedAt)}
      </p>
    </div>

    <p style="margin:0;color:#555;font-size:13px;">— Storage-Network</p>
    `
  );

  return sendTransactionalEmail({
    to: email,
    subject: `Signed: ${agreementTitle}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
