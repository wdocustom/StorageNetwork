"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Customer self-scheduling — pick (or change) the install date after paying
// the deposit.
//
// Installer quotes (/pay/[leadId]) take the deposit without a date, which
// left the customer with "TBD" and no way to book. The customer now picks a
// date + morning/afternoon on /schedule/[token] from the installer's real
// availability (same rules as the booking calendar), and it's booked
// immediately. The installer is emailed and can reschedule from the Job
// Ticket as usual. The customer can change it themselves until 48 hours
// before the install.
//
// Installers with scheduling turned off (Availability → scheduling disabled)
// keep coordinating dates themselves; the page says so instead of showing a
// calendar.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { verifyScheduleToken, scheduleInstallUrl } from "@/lib/server/request-link";
import { checkSlot, canCustomerChange, effectiveLeadTime, type TimeBlock } from "@/lib/install-slots";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { isSameInstallDate } from "@/utils/installDate";
import { escapeHtml } from "@/utils/escapeHtml";
import { getAppUrl } from "@/lib/url-helper";

const db = () => getServiceClient();

const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const CLOSED_STATUSES = ["paid", "completed", "cancelled", "archived"];

interface LeadForSchedule {
  id: string;
  installer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  deposit_paid: boolean;
  scheduled_at: string | null;
  quote_data: unknown;
}

async function loadLead(leadId: string): Promise<LeadForSchedule | null> {
  const { data } = await db()
    .from("leads")
    .select("id, installer_id, customer_name, customer_email, status, deposit_paid, scheduled_at, quote_data")
    .eq("id", leadId)
    .maybeSingle();
  return (data as LeadForSchedule | null) ?? null;
}

/** A job the customer can schedule: deposit paid, not finished or cancelled. */
function isSchedulable(lead: LeadForSchedule | null): lead is LeadForSchedule & { installer_id: string } {
  return !!lead && !!lead.installer_id && lead.deposit_paid && !CLOSED_STATUSES.includes(lead.status);
}

function orderHasWheels(quoteData: unknown): boolean {
  return Array.isArray(quoteData) && quoteData.some((u) => (u as { hasWheels?: boolean })?.hasWheels === true);
}

async function loadInstallerRules(installerId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 190 * 86400000).toISOString().slice(0, 10);
  const [{ data: profile }, { data: blackouts }, { data: overrides }] = await Promise.all([
    db()
      .from("profiles")
      .select("business_name, first_name, last_name, avatar_url, email, phone, lead_time_days, working_days, scheduling_enabled")
      .eq("id", installerId)
      .maybeSingle(),
    db().from("installer_blackout_dates").select("start_date, end_date").eq("installer_id", installerId),
    db()
      .from("installer_schedule_overrides")
      .select("date, morning_available, afternoon_available")
      .eq("installer_id", installerId)
      .gte("date", today)
      .lte("date", horizon),
  ]);

  const blocks: Record<string, { morning: boolean; afternoon: boolean }> = {};
  for (const row of overrides ?? []) {
    blocks[row.date as string] = { morning: !!row.morning_available, afternoon: !!row.afternoon_available };
  }

  return {
    name:
      (profile?.business_name as string) ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "Your Installer",
    avatar: (profile?.avatar_url as string) || null,
    email: (profile?.email as string) || null,
    phone: (profile?.phone as string) || null,
    schedulingEnabled: profile?.scheduling_enabled !== false,
    leadTimeDays: typeof profile?.lead_time_days === "number" ? (profile.lead_time_days as number) : 5,
    workingDays:
      Array.isArray(profile?.working_days) && (profile.working_days as string[]).length > 0
        ? (profile.working_days as string[])
        : DEFAULT_WORKING_DAYS,
    blackouts: ((blackouts ?? []) as Array<{ start_date: string; end_date: string }>).map((b) => ({
      start_date: b.start_date,
      end_date: b.end_date,
    })),
    blocks,
  };
}

// ── Page data (PUBLIC, signed link) ──────────────────────────────────────

export interface SchedulePageData {
  installerName: string;
  installerAvatar: string | null;
  installerPhone: string | null;
  customerFirstName: string;
  schedulingEnabled: boolean;
  /** Lead time the calendar should apply (includes the wheels minimum). */
  leadTimeDays: number;
  hasWheels: boolean;
  workingDays: string[];
  blackouts: Array<{ start_date: string; end_date: string }>;
  blocks: Record<string, { morning: boolean; afternoon: boolean }>;
  currentDate: string | null;
  currentTime: TimeBlock | null;
  /** False inside 48 hours of a booked install — contact the installer. */
  canChange: boolean;
}

export async function getSchedulePage(
  token: string
): Promise<{ data?: SchedulePageData; closed?: boolean; depositPending?: boolean; error?: string }> {
  const leadId = verifyScheduleToken(token);
  if (!leadId) return { error: "This link isn't valid." };

  const lead = await loadLead(leadId);
  if (!lead || !lead.installer_id) return { error: "This link isn't valid." };
  if (!isSchedulable(lead)) {
    return lead.deposit_paid
      ? { closed: true, error: "This job is already complete." }
      : {
          depositPending: lead.status === "pending_payment",
          error: "Your deposit hasn't been paid yet. Once it is, you can pick your install date here.",
        };
  }

  const installer = await loadInstallerRules(lead.installer_id);
  const hasWheels = orderHasWheels(lead.quote_data);

  // time_preference may not exist on older databases — read it separately.
  const { data: pref } = await db().from("leads").select("time_preference").eq("id", leadId).maybeSingle();
  const currentTime =
    pref?.time_preference === "morning" || pref?.time_preference === "afternoon"
      ? (pref.time_preference as TimeBlock)
      : null;

  return {
    data: {
      installerName: installer.name,
      installerAvatar: installer.avatar,
      installerPhone: installer.phone,
      customerFirstName: (lead.customer_name || "").split(" ")[0],
      schedulingEnabled: installer.schedulingEnabled,
      leadTimeDays: effectiveLeadTime({ leadTimeDays: installer.leadTimeDays, hasWheels }),
      hasWheels,
      workingDays: installer.workingDays,
      blackouts: installer.blackouts,
      blocks: installer.blocks,
      currentDate: lead.scheduled_at ? lead.scheduled_at.slice(0, 10) : null,
      currentTime,
      canChange: canCustomerChange(lead.scheduled_at, new Date()),
    },
  };
}

// ── Book / change the date (PUBLIC, signed link) ─────────────────────────

export async function setInstallDateFromCustomer(input: {
  token: string;
  date: string;
  time?: TimeBlock | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await enforceActionRateLimit({ action: "customerSchedule", limit: 10, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const leadId = verifyScheduleToken(input.token);
  if (!leadId) return { success: false, error: "This link isn't valid." };

  const lead = await loadLead(leadId);
  if (!isSchedulable(lead)) return { success: false, error: "This job can't be scheduled online." };

  const installer = await loadInstallerRules(lead.installer_id);
  if (!installer.schedulingEnabled) {
    return { success: false, error: `${installer.name} schedules installs directly. They'll reach out to you.` };
  }
  if (!canCustomerChange(lead.scheduled_at, new Date())) {
    return {
      success: false,
      error: `Your install is less than 48 hours away. Please contact ${installer.name} to change it.`,
    };
  }

  const time: TimeBlock | null = input.time === "morning" || input.time === "afternoon" ? input.time : null;

  // One day of slack on "today": the server runs in UTC, customers are
  // behind it, and the calendar they picked from used their local date.
  const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const slot = checkSlot(
    input.date,
    time,
    {
      leadTimeDays: installer.leadTimeDays,
      workingDays: installer.workingDays,
      blackouts: installer.blackouts,
      blocks: installer.blocks,
      hasWheels: orderHasWheels(lead.quote_data),
    },
    today
  );
  if (!slot.ok) return { success: false, error: slot.error };

  const isChange = !!lead.scheduled_at;
  if (isChange && isSameInstallDate(lead.scheduled_at, input.date)) {
    await saveTimePreference(leadId, time);
    return { success: true };
  }

  // Compare-and-swap on the value we read, same as the installer's
  // Schedule / Reschedule (jobs.ts writeInstallDate): a concurrent change
  // from the installer wins instead of being silently overwritten.
  const target = db()
    .from("leads")
    .update({ scheduled_at: input.date, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  const { data: updated, error } = await (lead.scheduled_at === null
    ? target.is("scheduled_at", null)
    : target.eq("scheduled_at", lead.scheduled_at)
  )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[CustomerSchedule] DB error:", error);
    return { success: false, error: "Couldn't save your date. Please try again." };
  }
  if (!updated) {
    return { success: false, error: "Your install date was just changed. Please refresh the page." };
  }
  await saveTimePreference(leadId, time);

  const email = await import("@/lib/email");
  await Promise.all([
    notifyCustomer(email, lead, installer, input.date, isChange),
    notifyInstaller(email, lead, installer, input.date, time, isChange),
  ]).catch((err) => console.error("[CustomerSchedule] email failed:", err));

  console.log(`[CustomerSchedule] Lead ${leadId} ${isChange ? "rescheduled" : "scheduled"} by customer for ${input.date} ${time ?? ""}`);
  return { success: true };
}

async function saveTimePreference(leadId: string, time: TimeBlock | null) {
  // Separate write: time_preference is optional on older databases.
  const { error } = await db().from("leads").update({ time_preference: time }).eq("id", leadId);
  if (error) console.warn("[CustomerSchedule] time_preference not saved:", error.message);
}

type EmailModule = typeof import("@/lib/email");

async function notifyCustomer(
  email: EmailModule,
  lead: LeadForSchedule,
  installer: Awaited<ReturnType<typeof loadInstallerRules>>,
  date: string,
  isChange: boolean
) {
  if (!lead.customer_email) return;
  let replyTo = installer.email || undefined;
  if (!replyTo && lead.installer_id) {
    const { data } = await db().auth.admin.getUserById(lead.installer_id);
    replyTo = data?.user?.email || undefined;
  }
  await email.sendInstallScheduledNotice(lead.customer_email, {
    customerName: lead.customer_name || "there",
    installerName: installer.name,
    scheduledDate: date,
    replyTo,
    isReschedule: isChange,
    bookedByCustomer: true,
    changeUrl: scheduleInstallUrl(lead.id),
  });
}

async function notifyInstaller(
  email: EmailModule,
  lead: LeadForSchedule,
  installer: Awaited<ReturnType<typeof loadInstallerRules>>,
  date: string,
  time: TimeBlock | null,
  isChange: boolean
) {
  let to = installer.email;
  if (!to && lead.installer_id) {
    const { data } = await db().auth.admin.getUserById(lead.installer_id);
    to = data?.user?.email || null;
  }
  if (!to) return;

  const name = lead.customer_name || "Your customer";
  const pretty = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const when = `${pretty}${time ? ` (${time})` : ""}`;
  const ticketUrl = `${getAppUrl()}/dashboard/leads/${lead.id}`;

  const html = email.emailShell(
    isChange ? "Install Date Changed" : "Install Date Booked",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">
      <strong style="color:#facc15;">${escapeHtml(name)}</strong> ${isChange ? "moved" : "picked"} their install date:
    </p>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;text-align:center;margin:0 0 24px;">
      <p style="margin:0;color:#facc15;font-size:22px;font-weight:900;">${escapeHtml(when)}</p>
    </div>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      It's on your schedule. If that doesn't work, reschedule from the Job Ticket and they'll be notified.
    </p>
    <div style="text-align:center;">
      <a href="${ticketUrl}" style="display:inline-block;background:#facc15;color:#0f172a;padding:14px 40px;border-radius:12px;font-weight:900;text-decoration:none;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Open Job Ticket &rarr;
      </a>
    </div>
    `
  );
  await email.sendTransactionalEmail({
    to,
    toName: installer.name,
    subject: `${name} ${isChange ? "moved their install to" : "booked their install for"} ${when}`,
    html,
  });
}

// ── Link lookup for pages the customer already reaches by job id ─────────
// /pay/[leadId] (after the deposit) and /payment/success?job=… already
// identify the job by its id, the same trust level as the pay link itself.

export async function getScheduleLinkForLead(
  leadId: string
): Promise<{ url?: string; scheduledDate?: string | null }> {
  if (!leadId) return {};
  const lead = await loadLead(leadId);
  if (!lead?.installer_id || CLOSED_STATUSES.includes(lead.status)) return {};
  // Right after an inline deposit the webhook may not have landed yet, so a
  // still-pending lead gets the link too; the schedule page waits for the
  // deposit to register.
  if (!lead.deposit_paid && lead.status !== "pending_payment") return {};
  return {
    url: scheduleInstallUrl(leadId),
    scheduledDate: lead.scheduled_at ? lead.scheduled_at.slice(0, 10) : null,
  };
}
