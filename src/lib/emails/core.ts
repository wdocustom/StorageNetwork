import { Resend } from "resend";
import { getAppUrl } from "@/lib/url-helper";
import { masterEmailLayout } from "./components/masterEmailLayout";

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

// emailShell is now an alias for the pure-black masterEmailLayout. Kept as
// a named export so existing import sites keep working — every email in the
// system now renders with the same layout.
export const emailShell = masterEmailLayout;
