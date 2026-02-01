"use server";

import { sendTransactionalEmail } from "@/lib/email";

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
  console.log("[Debug] sendTestEmail called for:", toEmail);

  try {
    const result = await sendTransactionalEmail({
      to: toEmail,
      subject: "Storage Network — Email Credentials Working",
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h1 style="color:#facc15;">It works!</h1>
          <p>Resend API key is valid and emails are sending correctly.</p>
          <p style="color:#94a3b8;font-size:12px;">Sent at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log("[Debug] Test email result:", JSON.stringify(result));
    return result;
  } catch (err: any) {
    console.error("[Debug] Test email failed:", err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}
