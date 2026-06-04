import { sendTransactionalEmail } from "./core";
import { masterEmailLayout } from "./components/masterEmailLayout";
import { getAppUrl } from "@/lib/url-helper";
import type { PublicPlan } from "@/lib/plans-config";

export async function sendPlanAccessEmail(
  email: string,
  plan: PublicPlan,
  accessToken: string,
): Promise<void> {
  const appUrl = getAppUrl();
  const accessUrl = `${appUrl}/plans/access?token=${accessToken}`;

  const body = `
    <div style="background:#111;border-radius:12px;padding:28px 24px;margin-bottom:20px;border:1px solid #222;">
      <p style="margin:0 0 6px;color:#facc15;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Your plans are ready</p>
      <h2 style="margin:0 0 8px;color:#fff;font-size:20px;font-weight:800;">${plan.name}</h2>
      <p style="margin:0;color:#888;font-size:13px;">${plan.tagline}</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${accessUrl}" style="display:inline-block;background:#facc15;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
        Open My Build Plans →
      </a>
      <p style="margin:12px 0 0;color:#555;font-size:11px;">Bookmark this link — it's yours permanently.</p>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">What's included</p>
      ${plan.includes.map((item) => `
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <span style="color:#facc15;font-size:12px;flex-shrink:0;margin-top:1px;">✓</span>
          <span style="color:#ccc;font-size:13px;">${item}</span>
        </div>`).join("")}
    </div>

    <div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;color:#555;font-size:12px;line-height:1.6;">
        <strong style="color:#888;">Lost this email?</strong> Visit
        <a href="${appUrl}/plans" style="color:#facc15;text-decoration:none;">${appUrl.replace(/^https?:\/\//, "")}/plans</a>
        and use &ldquo;Resend my link&rdquo; to get a new copy sent to this address.
      </p>
    </div>
  `;

  await sendTransactionalEmail({
    to: email,
    subject: `Your ${plan.name} build plans`,
    html: masterEmailLayout(`${plan.name} — Build Plans`, body),
  });
}
