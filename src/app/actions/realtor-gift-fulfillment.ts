"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";
import {
  sendGiftInstallerAssignedAlert,
  sendGiftRecipientAssignedUpdate,
  sendGiftRealtorAssignedUpdate,
  sendGiftDeliveredRecipient,
  sendGiftReturnedRecipient,
} from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Gift Fulfillment — Phase A3
//
// Installer-side surface for routing, claiming, and completing tote rentals:
//   - assignFulfillmentInstaller(giftId)  → service-callable, picks the
//     best eligible installer in the recipient's delivery ZIP and stamps
//     the gift. Idempotent (won't reassign an already-assigned gift).
//   - listInstallerToteJobs()             → installer dashboard query.
//   - markGiftDelivered / markGiftReturned → installer-only milestone flips.
//   - updateToteFulfillmentSettings       → opt-in toggle + stock + capacity.
//
// Auto-assignment is triggered by scheduleGiftDelivery() (realtor-gifts.ts)
// the moment the recipient confirms their windows.
// ═══════════════════════════════════════════════════════════════════════════

// ── Eligible-installer query (shared by assign + capacity preview) ───────

interface EligibleInstaller {
  id: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  slug: string | null;
  email: string;
  tote_fulfillment_stock: number;
  tote_fulfillment_capacity: number;
  active_gifts: number;
}

async function findEligibleInstaller(
  deliveryZip: string,
  toteCount: number
): Promise<EligibleInstaller | null> {
  const db = getServiceClient();

  // 1. Pull every opted-in installer whose service_zips covers this ZIP
  //    AND has enough stock for the requested package.
  //    Priority mirrors the lead-routing convention from customer.ts:
  //      is_pro DESC, completed_jobs DESC, current_month_leads ASC.
  const { data: candidates } = await db
    .from("profiles")
    .select(
      "id, first_name, last_name, business_name, slug, email, tote_fulfillment_stock, tote_fulfillment_capacity"
    )
    .eq("tote_fulfillment_active", true)
    .gte("tote_fulfillment_stock", toteCount)
    .contains("service_zips", [deliveryZip])
    .order("is_pro", { ascending: false })
    .order("completed_jobs", { ascending: false })
    .order("current_month_leads", { ascending: true })
    .limit(20);

  if (!candidates || candidates.length === 0) return null;

  // 2. Within the candidate set, filter by concurrent-job capacity. We do
  //    this in JS (rather than a single SQL join) because the per-row
  //    "active_gifts" count is small and the candidate list is bounded.
  for (const candidate of candidates) {
    const { count } = await db
      .from("tote_rental_gifts")
      .select("id", { count: "exact", head: true })
      .eq("installer_id", candidate.id)
      .in("status", ["assigned", "delivered"]);

    const active = count ?? 0;
    if (active < (candidate.tote_fulfillment_capacity as number)) {
      return {
        id: candidate.id as string,
        first_name: (candidate.first_name as string | null) ?? null,
        last_name: (candidate.last_name as string | null) ?? null,
        business_name: (candidate.business_name as string | null) ?? null,
        slug: (candidate.slug as string | null) ?? null,
        email: candidate.email as string,
        tote_fulfillment_stock: candidate.tote_fulfillment_stock as number,
        tote_fulfillment_capacity: candidate.tote_fulfillment_capacity as number,
        active_gifts: active,
      };
    }
  }

  return null;
}

// ── Service-callable: assign an installer to a scheduled gift ────────────

export async function assignFulfillmentInstaller(
  giftId: string
): Promise<{ ok: boolean; installerId?: string; error?: string }> {
  const db = getServiceClient();

  // Pull gift + the realtor's display name (used in the installer email).
  const { data: gift } = await db
    .from("tote_rental_gifts")
    .select(
      `id, status, installer_id, delivery_zip, tote_count, duration_days,
       recipient_name, recipient_email, delivery_address,
       delivery_window_start, delivery_window_end,
       pickup_window_start, pickup_window_end,
       gift_token, realtor_id,
       tote_rental_packages ( name ),
       profiles!tote_rental_gifts_realtor_id_fkey ( first_name, last_name, realtor_brokerage, email )`
    )
    .eq("id", giftId)
    .single();

  if (!gift) return { ok: false, error: "Gift not found." };
  if (gift.installer_id) {
    return { ok: true, installerId: gift.installer_id as string };
  }
  if (gift.status !== "scheduled") {
    return { ok: false, error: "Gift must be scheduled before assigning an installer." };
  }
  if (!gift.delivery_zip) {
    return { ok: false, error: "Delivery ZIP missing — cannot route." };
  }

  const installer = await findEligibleInstaller(
    gift.delivery_zip as string,
    gift.tote_count as number
  );

  if (!installer) {
    // No coverage. Leave installer_id null + status='scheduled' so the
    // realtor dashboard surfaces a "Sourcing installer" state. Ops can
    // run a manual sweep later or we can fall back to a default partner.
    console.warn(
      `[Fulfillment] No eligible installer for gift ${giftId} (zip=${gift.delivery_zip}, totes=${gift.tote_count})`
    );
    return { ok: false, error: "No installer available in that area yet." };
  }

  // Atomic claim: only the first concurrent caller flips the row. Second
  // caller's UPDATE returns 0 rows and we no-op.
  const { data: claimed, error: claimErr } = await db
    .from("tote_rental_gifts")
    .update({
      installer_id: installer.id,
      installer_assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .eq("id", giftId)
    .eq("status", "scheduled")
    .is("installer_id", null)
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed) {
    console.error("[Fulfillment] Atomic claim failed for gift", giftId, claimErr);
    return { ok: false, error: "Race condition — please retry." };
  }

  // Fire-and-forget notifications. Failure here MUST NOT roll back the
  // assignment; ops can resend if Resend hiccups.
  const pkg = gift.tote_rental_packages as unknown as { name: string } | null;
  const realtorProfile = gift.profiles as unknown as
    | { first_name: string | null; last_name: string | null; realtor_brokerage: string | null; email: string }
    | null;
  const realtorName =
    [realtorProfile?.first_name, realtorProfile?.last_name].filter(Boolean).join(" ") || "the realtor";
  const installerName =
    installer.business_name ||
    [installer.first_name, installer.last_name].filter(Boolean).join(" ") ||
    "Your installer";

  const installerJobsUrl = `/dashboard/tote-rentals`;
  const recipientGiftUrl = `/gift/${gift.gift_token}`;
  const realtorGiftsUrl = `/realtors/dashboard/gifts`;

  // 1. Installer — "you have a new job"
  sendGiftInstallerAssignedAlert(installer.email, {
    installerName: installer.first_name || installerName,
    recipientName: gift.recipient_name as string,
    deliveryAddress: (gift.delivery_address as string) || "",
    deliveryWindowStart: (gift.delivery_window_start as string) || "",
    deliveryWindowEnd: (gift.delivery_window_end as string) || "",
    pickupWindowStart: (gift.pickup_window_start as string) || "",
    pickupWindowEnd: (gift.pickup_window_end as string) || "",
    toteCount: gift.tote_count as number,
    durationDays: gift.duration_days as number,
    packageName: pkg?.name || "Closing Gift",
    jobsDashboardUrl: installerJobsUrl,
  }).catch((err) => console.warn("[Fulfillment] installer alert failed:", err));

  // 2. Recipient — "your installer is X"
  sendGiftRecipientAssignedUpdate(gift.recipient_email as string, {
    recipientName: gift.recipient_name as string,
    installerName,
    installerSlug: installer.slug,
    giftUrl: recipientGiftUrl,
  }).catch((err) => console.warn("[Fulfillment] recipient update failed:", err));

  // 3. Realtor — "your gift was assigned"
  if (realtorProfile?.email) {
    sendGiftRealtorAssignedUpdate(realtorProfile.email, {
      realtorName,
      recipientName: gift.recipient_name as string,
      installerName,
      giftsDashboardUrl: realtorGiftsUrl,
    }).catch((err) => console.warn("[Fulfillment] realtor update failed:", err));
  }

  return { ok: true, installerId: installer.id };
}

// ── Installer dashboard: list my jobs ────────────────────────────────────

export interface InstallerToteJob {
  id: string;
  gift_token: string | null;
  recipient_name: string;
  recipient_email: string;
  tote_count: number;
  duration_days: number;
  package_name: string;
  delivery_address: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  status: string;
  assigned_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
}

export async function listInstallerToteJobs(): Promise<InstallerToteJob[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];

  const db = getServiceClient();
  const { data, error } = await db
    .from("tote_rental_gifts")
    .select(
      `id, gift_token, recipient_name, recipient_email, tote_count, duration_days,
       delivery_address, delivery_window_start, delivery_window_end,
       pickup_window_start, pickup_window_end, status,
       installer_assigned_at, delivered_at, returned_at,
       tote_rental_packages ( name )`
    )
    .eq("installer_id", user.id)
    .in("status", ["assigned", "delivered", "returned"])
    .order("delivery_window_start", { ascending: true });

  if (error) {
    console.error("[Fulfillment] listInstallerToteJobs failed:", error);
    return [];
  }

  return (data || []).map((row): InstallerToteJob => ({
    id: row.id as string,
    gift_token: (row.gift_token as string | null) ?? null,
    recipient_name: row.recipient_name as string,
    recipient_email: row.recipient_email as string,
    tote_count: row.tote_count as number,
    duration_days: row.duration_days as number,
    package_name:
      (row.tote_rental_packages as unknown as { name: string } | null)?.name || "Gift Package",
    delivery_address: (row.delivery_address as string | null) ?? null,
    delivery_window_start: (row.delivery_window_start as string | null) ?? null,
    delivery_window_end: (row.delivery_window_end as string | null) ?? null,
    pickup_window_start: (row.pickup_window_start as string | null) ?? null,
    pickup_window_end: (row.pickup_window_end as string | null) ?? null,
    status: row.status as string,
    assigned_at: (row.installer_assigned_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    returned_at: (row.returned_at as string | null) ?? null,
  }));
}

// ── Milestone flips ──────────────────────────────────────────────────────

async function flipMilestone(
  giftId: string,
  fromStatus: "assigned" | "delivered",
  toStatus: "delivered" | "returned",
  timestampColumn: "delivered_at" | "returned_at"
): Promise<{ ok: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  try {
    await enforceActionRateLimit({
      action: `gift-milestone-${toStatus}`,
      limit: 30,
      window: "5 m",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const db = getServiceClient();

  // Guarded UPDATE: only the assigned installer can flip the milestone,
  // and only on the correct from-status. Prevents an installer from
  // marking someone else's job delivered, or marking returned before
  // delivered.
  const { data: updated, error } = await db
    .from("tote_rental_gifts")
    .update({
      status: toStatus,
      [timestampColumn]: new Date().toISOString(),
    })
    .eq("id", giftId)
    .eq("installer_id", user.id)
    .eq("status", fromStatus)
    .select(
      `id, gift_token, recipient_name, recipient_email,
       installer_id,
       profiles!tote_rental_gifts_installer_id_fkey ( first_name, last_name, business_name, slug )`
    )
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, error: "Could not update job. Refresh and try again." };
  }

  // Cross-sell email at delivery and at pickup. Different copy + different
  // CTAs (delivery → "you're set", pickup → "love your installer?").
  const installer = updated.profiles as unknown as
    | { first_name: string | null; last_name: string | null; business_name: string | null; slug: string | null }
    | null;
  const installerName =
    installer?.business_name ||
    [installer?.first_name, installer?.last_name].filter(Boolean).join(" ") ||
    "Your installer";
  const installerSlug = installer?.slug ?? null;

  if (toStatus === "delivered") {
    sendGiftDeliveredRecipient(updated.recipient_email as string, {
      recipientName: updated.recipient_name as string,
      installerName,
      installerSlug,
      giftUrl: `/gift/${updated.gift_token}`,
    }).catch((err) => console.warn("[Fulfillment] delivered email failed:", err));
  } else if (toStatus === "returned") {
    sendGiftReturnedRecipient(updated.recipient_email as string, {
      recipientName: updated.recipient_name as string,
      installerName,
      installerSlug,
      giftUrl: `/gift/${updated.gift_token}`,
    }).catch((err) => console.warn("[Fulfillment] returned email failed:", err));
  }

  return { ok: true };
}

export async function markGiftDelivered(giftId: string) {
  return flipMilestone(giftId, "assigned", "delivered", "delivered_at");
}

export async function markGiftReturned(giftId: string) {
  return flipMilestone(giftId, "delivered", "returned", "returned_at");
}

// ── Installer opt-in settings ────────────────────────────────────────────

export interface ToteFulfillmentSettings {
  active: boolean;
  stock: number;
  capacity: number;
}

export async function getToteFulfillmentSettings(): Promise<
  ToteFulfillmentSettings | null
> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("tote_fulfillment_active, tote_fulfillment_stock, tote_fulfillment_capacity")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  return {
    active: !!data.tote_fulfillment_active,
    stock: (data.tote_fulfillment_stock as number) ?? 0,
    capacity: (data.tote_fulfillment_capacity as number) ?? 0,
  };
}

export async function updateToteFulfillmentSettings(
  input: Partial<ToteFulfillmentSettings>
): Promise<{ ok: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // Clamp numeric inputs so nothing pathological reaches the DB. The CHECK
  // constraints on the columns are the last line of defense.
  const patch: Record<string, unknown> = {};
  if (typeof input.active === "boolean") patch.tote_fulfillment_active = input.active;
  if (typeof input.stock === "number" && input.stock >= 0)
    patch.tote_fulfillment_stock = Math.min(Math.floor(input.stock), 10_000);
  if (typeof input.capacity === "number" && input.capacity >= 0)
    patch.tote_fulfillment_capacity = Math.min(Math.floor(input.capacity), 100);

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const db = getServiceClient();
  const { error } = await db.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    console.error("[Fulfillment] updateToteFulfillmentSettings failed:", error);
    return { ok: false, error: "Could not save settings." };
  }
  return { ok: true };
}
