// ═══════════════════════════════════════════════════════════════════════════
// Install tracking — manual steps + day-before reminder (migration 141)
//
// Installers already text customers "loaded up and on the way" by hand. The
// Job Ticket now has manual steps (built → loaded → on the way); each emails
// the customer and updates their tracking page (/track/[token]). A daily
// job emails a reminder the day before the install with the same link.
//
// Not a "use server" module: processInstallReminders is cron-only and the
// email senders must not be callable from a browser.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { trackInstallUrl } from "@/lib/server/request-link";
import { computeBalanceDue } from "@/lib/lead-money";
import { escapeHtml } from "@/utils/escapeHtml";

export type InstallStage = "built" | "loaded" | "on_the_way";

export const INSTALL_STAGES: Array<{ id: InstallStage; label: string; button: string }> = [
  { id: "built", label: "Built", button: "Mark Built" },
  { id: "loaded", label: "Loaded up", button: "Mark Loaded" },
  { id: "on_the_way", label: "On the way", button: "On the Way" },
];

export function isInstallStage(v: unknown): v is InstallStage {
  return v === "built" || v === "loaded" || v === "on_the_way";
}

/** Jobs that are done — no more steps or reminders. */
export const CLOSED_STATUSES = ["paid", "completed", "cancelled", "archived"];

export function prettyInstallDate(date: string, time?: string | null): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return time === "morning" || time === "afternoon" ? `${d} (${time})` : d;
}

interface InstallerInfo {
  name: string;
  phone: string | null;
  replyTo: string | undefined;
}

export async function installerInfo(installerId: string): Promise<InstallerInfo> {
  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("business_name, first_name, last_name, phone, email")
    .eq("id", installerId)
    .maybeSingle();
  let replyTo = (data?.email as string) || undefined;
  if (!replyTo) {
    const { data: auth } = await db.auth.admin.getUserById(installerId);
    replyTo = auth?.user?.email || undefined;
  }
  return {
    name:
      (data?.business_name as string) ||
      [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
      "Your installer",
    phone: (data?.phone as string) || null,
    replyTo,
  };
}

const STAGE_COPY: Record<InstallStage, { title: string; subject: (i: string) => string; body: (i: string, when: string | null) => string }> = {
  built: {
    title: "Your Rack Is Built",
    subject: (i) => `Your storage rack is built — ${i}`,
    body: (i, when) =>
      `<strong style="color:#facc15;">${i}</strong> has finished building your rack${when ? ` and it&rsquo;s ready for your install on <strong style="color:#ffffff;">${when}</strong>` : ""}.`,
  },
  loaded: {
    title: "Loaded Up",
    subject: (i) => `Loaded up for your install — ${i}`,
    body: (i) => `Your rack is loaded up and <strong style="color:#facc15;">${i}</strong> is getting ready to head your way.`,
  },
  on_the_way: {
    title: "On the Way!",
    subject: (i) => `${i} is on the way!`,
    body: (i) =>
      `<strong style="color:#facc15;">${i}</strong> is on the way to you now. Please make sure the install area is clear and easy to get to.`,
  },
};

function trackButton(url: string | undefined): string {
  if (!url) return "";
  return `
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${url}" style="display:inline-block;background:#facc15;color:#0f172a;padding:14px 40px;border-radius:12px;font-weight:900;text-decoration:none;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Track Your Install &rarr;
      </a>
    </div>`;
}

/** Email the customer that the installer marked a step. */
export async function sendStageEmail(p: {
  leadId: string;
  stage: InstallStage;
  customerEmail: string;
  customerName: string | null;
  scheduledAt: string | null;
  timePreference: string | null;
  installer: InstallerInfo;
}) {
  const copy = STAGE_COPY[p.stage];
  const firstName = escapeHtml((p.customerName || "").split(" ")[0] || "there");
  const installerName = escapeHtml(p.installer.name);
  const when = p.scheduledAt ? prettyInstallDate(p.scheduledAt, p.timePreference) : null;

  const { sendTransactionalEmail, emailShell } = await import("@/lib/email");
  const html = emailShell(
    copy.title,
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">${copy.body(installerName, when)}</p>
    ${trackButton(trackInstallUrl(p.leadId))}
    ${p.installer.phone ? `<p style="margin:0;color:#64748b;font-size:12px;text-align:center;">Questions? Call or text ${escapeHtml(p.installer.phone)}, or reply to this email.</p>` : ""}
    `
  );
  return sendTransactionalEmail({
    to: p.customerEmail,
    toName: p.customerName || undefined,
    subject: copy.subject(p.installer.name),
    html,
    senderName: p.installer.name,
    replyTo: p.installer.replyTo,
  });
}

// ── Day-before reminder (cron) ────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Email every customer whose install is tomorrow. "Tomorrow" is relative to
 * the US calendar date when the cron runs (scheduled mid-morning US time,
 * when the UTC and US dates agree). Each job is reminded once per install
 * date (install_reminder_for), so a reschedule gets a fresh reminder.
 */
export async function processInstallReminders(now: Date = new Date()): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const db = getServiceClient();
  const tomorrow = addDays(now.toISOString().slice(0, 10), 1);
  const errors: string[] = [];
  let sent = 0;

  const { data: leads, error } = await db
    .from("leads")
    .select(
      "id, installer_id, customer_name, customer_email, scheduled_at, time_preference, status, deposit_paid, install_reminder_for, address, delivery_address_line1, delivery_address_city, delivery_address_state, estimated_price, deposit_amount, discount_amount, sales_tax_amount"
    )
    .eq("deposit_paid", true)
    .gte("scheduled_at", tomorrow)
    .lt("scheduled_at", addDays(tomorrow, 1))
    .not("customer_email", "is", null);

  if (error) return { processed: 0, sent: 0, errors: [error.message] };

  const due = (leads ?? []).filter(
    (l) =>
      !CLOSED_STATUSES.includes(l.status as string) &&
      l.installer_id &&
      (l.install_reminder_for as string | null)?.slice(0, 10) !== tomorrow
  );

  for (const lead of due) {
    try {
      // Claim first (conditional on the value we read) so overlapping runs
      // can't both send.
      const claim = db.from("leads").update({ install_reminder_for: tomorrow }).eq("id", lead.id);
      const { data: claimed } = await (lead.install_reminder_for === null
        ? claim.is("install_reminder_for", null)
        : claim.eq("install_reminder_for", lead.install_reminder_for)
      )
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const installer = await installerInfo(lead.installer_id as string);
      await sendReminderEmail({ lead, installer });
      sent++;
    } catch (err) {
      errors.push(`${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed: due.length, sent, errors };
}

async function sendReminderEmail({
  lead,
  installer,
}: {
  lead: Record<string, unknown>;
  installer: InstallerInfo;
}) {
  const firstName = escapeHtml(((lead.customer_name as string) || "").split(" ")[0] || "there");
  const installerName = escapeHtml(installer.name);
  const when = prettyInstallDate(lead.scheduled_at as string, lead.time_preference as string | null);
  const address =
    [lead.delivery_address_line1, lead.delivery_address_city, lead.delivery_address_state].filter(Boolean).join(", ") ||
    (lead.address as string) ||
    "";
  const balance = computeBalanceDue({
    estimated_price: lead.estimated_price as number,
    deposit_amount: lead.deposit_amount as number,
    deposit_paid: true,
    discount_amount: lead.discount_amount as number,
    sales_tax_amount: lead.sales_tax_amount as number,
  });

  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">${k}</td><td style="padding:8px 0;color:#ffffff;font-size:13px;text-align:right;font-weight:600;">${v}</td></tr>`;

  const { sendTransactionalEmail, emailShell } = await import("@/lib/email");
  const html = emailShell(
    "Your Install Is Tomorrow",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.7;">
      Just a reminder: <strong style="color:#facc15;">${installerName}</strong> will be out to install your storage rack tomorrow.
    </p>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;text-align:center;margin:0 0 20px;">
      <p style="margin:0;color:#facc15;font-size:20px;font-weight:900;">${escapeHtml(when)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      ${address ? row("Where", escapeHtml(address)) : ""}
      ${balance > 0 ? row("Balance due at install", `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : ""}
    </table>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Please clear the wall and floor where your rack is going. You can follow along as your installer gets ready:
    </p>
    ${trackButton(trackInstallUrl(lead.id as string))}
    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      Need to change something? ${installer.phone ? `Call or text ${escapeHtml(installer.phone)}, or reply` : "Reply"} to this email.
    </p>
    `
  );
  await sendTransactionalEmail({
    to: lead.customer_email as string,
    toName: (lead.customer_name as string) || undefined,
    subject: `Reminder: your install with ${installer.name} is tomorrow`,
    html,
    senderName: installer.name,
    replyTo: installer.replyTo,
  });
}
