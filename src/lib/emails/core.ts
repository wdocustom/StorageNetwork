import { Resend } from "resend";
import { getAppUrl } from "@/lib/url-helper";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  senderName?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || "orders@storage-network.app";
const SENDER_NAME = process.env.RESEND_SENDER_NAME || "Storage Network";

export async function sendTransactionalEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, subject, html, senderName, replyTo } = params;

  console.log("[Email] Attempting to send email to:", to, "| Subject:", subject);

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[Email DEV] Would send:", { to, subject, replyTo });
    return { success: true, messageId: "dev-" + Date.now() };
  }

  const resend = getResend();
  if (!resend) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${senderName || SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
      ...(replyTo && { reply_to: replyTo }),
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Email] Send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

export function emailShell(title: string, body: string): string {
  const logoUrl = `${getAppUrl()}/landing_page_logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0f172a;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
      <!-- Header with Logo -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);padding:36px 32px;text-align:center;border-bottom:1px solid #334155;">
        <img src="${logoUrl}" alt="Storage Network" style="max-width:120px;max-height:120px;width:auto;height:auto;margin-bottom:16px;" />
        <h1 style="margin:0;color:#facc15;font-size:24px;font-weight:800;letter-spacing:-0.3px;">${title}</h1>
        <div style="margin:12px auto 0;width:60px;height:2px;background:linear-gradient(to right,#facc15,#f59e0b);border-radius:1px;"></div>
      </div>
      <!-- Body -->
      <div style="padding:32px;">
        ${body}
      </div>
      <!-- Footer bar -->
      <div style="border-top:1px solid #334155;padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#475569;font-size:11px;">
          Sent by <a href="${getAppUrl()}" style="color:#94a3b8;text-decoration:none;font-weight:600;">Storage Network</a> &bull; storage-network.app
        </p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
}
