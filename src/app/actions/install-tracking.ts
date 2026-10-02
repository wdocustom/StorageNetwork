"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Install tracking — installer marks manual steps; customer follows along
//
// Installer (AUTH): setInstallStage / getInstallTracking (Job Ticket)
// Customer (PUBLIC, signed link): getTrackingPage (/track/[token])
// See @/lib/server/install-tracking for the stages, emails and the
// day-before reminder.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { verifyTrackToken, trackInstallUrl, scheduleInstallUrl } from "@/lib/server/request-link";
import {
  CLOSED_STATUSES,
  installerInfo,
  isInstallStage,
  sendBuiltEmail,
  stageEmails,
  type InstallStage,
} from "@/lib/server/install-tracking";
import { canCustomerChange } from "@/lib/install-slots";
import { computeBalanceDue } from "@/lib/lead-money";

const db = () => getServiceClient();

const STEP_TIME_COLUMN: Record<InstallStage, string> = {
  built: "install_built_at",
  loaded: "install_loaded_at",
  on_the_way: "install_on_the_way_at",
};

export interface StepTimes {
  built: string | null;
  loaded: string | null;
  on_the_way: string | null;
  installed: string | null;
}

/**
 * When each step was marked (migration 142). Read separately so a database
 * without those columns still loads everything else — times just show blank.
 */
async function readStepTimes(leadId: string): Promise<Omit<StepTimes, "installed">> {
  const { data, error } = await db()
    .from("leads")
    .select("install_built_at, install_loaded_at, install_on_the_way_at")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) return { built: null, loaded: null, on_the_way: null };
  return {
    built: (data.install_built_at as string | null) ?? null,
    loaded: (data.install_loaded_at as string | null) ?? null,
    on_the_way: (data.install_on_the_way_at as string | null) ?? null,
  };
}

// ── Installer: mark a step (AUTH) ────────────────────────────────────────
// `stage` null clears the progress (undo) without emailing anyone.

export async function setInstallStage(
  leadId: string,
  stage: InstallStage | null
): Promise<{ success: boolean; emailed?: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  if (stage !== null && !isInstallStage(stage)) return { success: false, error: "Unknown step." };

  const { data: lead } = await db()
    .from("leads")
    .select("id, installer_id, status, deposit_paid, customer_name, customer_email, scheduled_at, install_stage")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || lead.installer_id !== user.id) return { success: false, error: "Job not found." };
  if (CLOSED_STATUSES.includes(lead.status as string)) return { success: false, error: "This job is already complete." };
  if (!lead.deposit_paid) return { success: false, error: "Steps start once the deposit is paid." };

  const { error } = await db()
    .from("leads")
    .update({ install_stage: stage, install_stage_at: stage ? new Date().toISOString() : null })
    .eq("id", leadId);
  if (error) {
    console.error("[InstallStage] update failed:", error);
    return { success: false, error: "Couldn't save the step. Please try again." };
  }

  // Per-step time: stamped the first time a step is marked (a repeat tap
  // keeps the original time); Reset clears them all. Best-effort — the step
  // itself is already saved.
  const stepTimes: Record<string, string | null> =
    stage === null
      ? { install_built_at: null, install_loaded_at: null, install_on_the_way_at: null }
      : stage !== lead.install_stage
        ? { [STEP_TIME_COLUMN[stage]]: new Date().toISOString() }
        : {};
  if (Object.keys(stepTimes).length > 0) {
    const { error: timeErr } = await db().from("leads").update(stepTimes).eq("id", leadId);
    if (timeErr) console.warn("[InstallStage] step time not saved:", timeErr.message);
  }

  // Only "built" emails (it tells the customer to keep the tracking page
  // open on install day); "loaded" and "on the way" just update the page.
  // Never on undo or a repeat tap.
  if (!stage || !stageEmails(stage) || stage === lead.install_stage || !lead.customer_email) {
    return { success: true, emailed: false };
  }

  const { data: pref } = await db().from("leads").select("time_preference").eq("id", leadId).maybeSingle();
  try {
    const result = await sendBuiltEmail({
      leadId,
      customerEmail: lead.customer_email as string,
      customerName: lead.customer_name as string | null,
      scheduledAt: lead.scheduled_at as string | null,
      timePreference: (pref?.time_preference as string | null) ?? null,
      installer: await installerInfo(user.id),
    });
    return { success: true, emailed: !!result.success };
  } catch (err) {
    console.error("[InstallStage] email failed:", err);
    return { success: true, emailed: false };
  }
}

// ── Installer: current progress for the Job Ticket (AUTH) ────────────────

export interface InstallTrackingState {
  stage: InstallStage | null;
  stageAt: string | null;
  reminderFor: string | null;
  viewedAt: string | null;
  trackUrl: string | null;
  stepTimes: Omit<StepTimes, "installed">;
}

export async function getInstallTracking(
  leadId: string
): Promise<{ success: boolean; tracking?: InstallTrackingState; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const { data: lead, error } = await db()
    .from("leads")
    .select("installer_id, install_stage, install_stage_at, install_reminder_for, tracking_viewed_at")
    .eq("id", leadId)
    .maybeSingle();
  // Columns missing (migration 141 not applied) → feature just stays hidden.
  if (error || !lead) return { success: false, error: error?.message || "Job not found." };
  if (lead.installer_id !== user.id) return { success: false, error: "Job not found." };
  return {
    success: true,
    tracking: {
      stage: isInstallStage(lead.install_stage) ? lead.install_stage : null,
      stageAt: (lead.install_stage_at as string | null) ?? null,
      reminderFor: (lead.install_reminder_for as string | null) ?? null,
      viewedAt: (lead.tracking_viewed_at as string | null) ?? null,
      trackUrl: trackInstallUrl(leadId) ?? null,
      stepTimes: await readStepTimes(leadId),
    },
  };
}

// ── Customer: tracking page (PUBLIC, signed link) ────────────────────────

export interface TrackingPageData {
  installerName: string;
  installerPhone: string | null;
  customerFirstName: string;
  scheduledDate: string | null;
  timePreference: string | null;
  stage: InstallStage | null;
  stageAt: string | null;
  installed: boolean;
  address: string;
  balanceDue: number;
  /** Pick / change the date (only while the customer still can). */
  scheduleUrl: string | null;
  /** When each step happened (null = not reached, or skipped). */
  stepTimes: StepTimes;
}

export async function getTrackingPage(token: string): Promise<{ data?: TrackingPageData; error?: string }> {
  const leadId = verifyTrackToken(token);
  if (!leadId) return { error: "This link isn't valid." };

  const { data: lead } = await db()
    .from("leads")
    .select(
      "id, installer_id, status, deposit_paid, customer_name, scheduled_at, install_stage, install_stage_at, completed_at, paid_at, address, delivery_address_line1, delivery_address_city, delivery_address_state, estimated_price, deposit_amount, discount_amount, sales_tax_amount"
    )
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.installer_id || !lead.deposit_paid) return { error: "This link isn't valid." };

  const { data: pref } = await db().from("leads").select("time_preference").eq("id", leadId).maybeSingle();
  const installer = await installerInfo(lead.installer_id as string);
  const installed = ["paid", "completed"].includes(lead.status as string) || !!lead.completed_at;
  const closed = CLOSED_STATUSES.includes(lead.status as string);

  // Let the installer see the customer opened it (best-effort; awaited so a
  // serverless function can't drop it).
  const { error: viewErr } = await db()
    .from("leads")
    .update({ tracking_viewed_at: new Date().toISOString() })
    .eq("id", leadId);
  if (viewErr) console.warn("[Tracking] view not recorded:", viewErr.message);

  return {
    data: {
      installerName: installer.name,
      installerPhone: installer.phone,
      customerFirstName: ((lead.customer_name as string) || "").split(" ")[0],
      scheduledDate: lead.scheduled_at ? (lead.scheduled_at as string).slice(0, 10) : null,
      timePreference: (pref?.time_preference as string | null) ?? null,
      stage: isInstallStage(lead.install_stage) ? lead.install_stage : null,
      stageAt: (lead.install_stage_at as string | null) ?? null,
      installed,
      address:
        [lead.delivery_address_line1, lead.delivery_address_city, lead.delivery_address_state].filter(Boolean).join(", ") ||
        (lead.address as string) ||
        "",
      balanceDue: installed
        ? 0
        : computeBalanceDue({
            estimated_price: lead.estimated_price as number,
            deposit_amount: lead.deposit_amount as number,
            deposit_paid: true,
            discount_amount: lead.discount_amount as number,
            sales_tax_amount: lead.sales_tax_amount as number,
          }),
      stepTimes: {
        ...(await readStepTimes(leadId)),
        installed: installed ? ((lead.completed_at || lead.paid_at) as string | null) ?? null : null,
      },
      scheduleUrl:
        !closed && canCustomerChange(lead.scheduled_at as string | null, new Date())
          ? scheduleInstallUrl(leadId) ?? null
          : null,
    },
  };
}
