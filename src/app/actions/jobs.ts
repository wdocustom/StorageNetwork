"use server";

import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function rescheduleJob(
  leadId: string,
  newDate: string,
  customerEmail: string,
  customerName: string
) {
  // 1. Update DB
  await supabase
    .from("leads")
    .update({ scheduled_at: newDate, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  // 2. Send reschedule email (non-blocking, but awaited for error logging)
  if (customerEmail) {
    try {
      const formattedDate = new Date(newDate + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      );
      await sendTransactionalEmail({
        to: customerEmail,
        toName: customerName,
        subject: `Your installation has been rescheduled to ${formattedDate}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;margin-bottom:8px;">Installation Rescheduled</h2>
          <p style="color:#666;font-size:14px;">Hi ${customerName},</p>
          <p style="color:#666;font-size:14px;">Your installation has been rescheduled to:</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
            <p style="color:#1a1a1a;font-size:20px;font-weight:700;margin:0;">${formattedDate}</p>
          </div>
          <p style="color:#aaa;font-size:11px;text-align:center;margin-top:16px;">Questions? Reply to this email.</p>
        </div>`,
      });
      console.log("[Reschedule] Email sent to:", customerEmail);
    } catch (err) {
      console.error("[Reschedule] Email failed:", err);
    }
  }

  return { success: true };
}
