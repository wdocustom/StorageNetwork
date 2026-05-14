"use server";

import Stripe from "stripe";
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
//   - payoutToteFulfillment(giftId)       → Stripe Connect transfer fired
//     when a gift reaches `returned` status. See migration 110.
//
// Auto-assignment is triggered by scheduleGiftDelivery() (realtor-gifts.ts)
// the moment the recipient confirms their windows.
// ═══════════════════════════════════════════════════════════════════════════

// Installer-payout math lives in src/lib/realtor-fulfillment-payout.ts so
// the constants + calc function can be unit-tested without dragging
// `server-only` through the import graph.
//
// IMPORTANT: do NOT re-export `calcInstallerLegFeeCents` from this file.
// Next.js 14's "use server" rule forbids non-async exports from a server
// action module, so re-exporting a sync function breaks the production
// build (Vercel deploys fail with "Only async functions are allowed to be
// exported in a 'use server' file"). Callers that need the helper should
// import it directly from "@/lib/realtor-fulfillment-payout".
import { calcInstallerLegFeeCents } from "@/lib/realtor-fulfillment-payout";

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
  //
  //    Also filter to installers with stripe_account_id set — we cannot
  //    pay them without one. An installer without Stripe Connect onboarded
  //    will not appear in the routing pool; they'll see prompting on
  //    /dashboard/tote-rentals to complete onboarding (TODO: surface that).
  const { data: candidates } = await db
    .from("profiles")
    .select(
      "id, first_name, last_name, business_name, slug, email, tote_fulfillment_stock, tote_fulfillment_capacity"
    )
    .eq("tote_fulfillment_active", true)
    .gte("tote_fulfillment_stock", toteCount)
    .contains("service_zips", [deliveryZip])
    .not("stripe_account_id", "is", null)
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

  // Snapshot the installer's earnings for this gift at assignment time.
  // Stored on the gift row so that subsequent rate changes don't rewrite
  // history. The delivery + pickup legs are charged at the same rate but
  // recorded separately so the dashboard / accounting can break them out.
  const legFee = calcInstallerLegFeeCents(gift.tote_count as number);

  // Atomic claim: only the first concurrent caller flips the row. Second
  // caller's UPDATE returns 0 rows and we no-op.
  const { data: claimed, error: claimErr } = await db
    .from("tote_rental_gifts")
    .update({
      installer_id: installer.id,
      installer_assigned_at: new Date().toISOString(),
      installer_delivery_fee_cents: legFee,
      installer_pickup_fee_cents: legFee,
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
  /** Total installer earnings for this job (delivery + pickup), in cents.
   *  Snapshotted at assignment so the value is stable across rate changes. */
  payout_cents: number;
  /** Set once the Stripe transfer for this gift has been created.
   *  Null = pending (status not yet returned, or transfer not yet fired). */
  paid_at: string | null;
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
       installer_delivery_fee_cents, installer_pickup_fee_cents, installer_paid_at,
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
    payout_cents:
      ((row.installer_delivery_fee_cents as number | null) ?? 0) +
      ((row.installer_pickup_fee_cents as number | null) ?? 0),
    paid_at: (row.installer_paid_at as string | null) ?? null,
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

    // Fire the installer payout when the rental completes. Fire-and-forget
    // so a Stripe outage doesn't roll back the milestone — the gift is
    // already marked returned in our DB, and payoutToteFulfillment is
    // idempotent (the installer_paid_at column + Stripe idempotency key
    // guarantee we won't double-pay on retry).
    payoutToteFulfillment(giftId).catch((err) =>
      console.error("[Fulfillment] payout failed:", err)
    );
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

// ── Installer payout (Stripe Connect transfer on `returned`) ─────────────
//
// Idempotency model:
//   - tote_rental_gifts.installer_paid_at is a single timestamp that
//     transitions NULL → set-once. The DB check at the top of this
//     function refuses to re-pay an already-paid gift.
//   - The Stripe transfer is created with an idempotency key derived
//     from the gift id. Even if two concurrent callers slip past the DB
//     check (unlikely; the markGiftReturned flipMilestone is also
//     guarded), Stripe will return the existing transfer instead of
//     creating a second one.
//
// Failure semantics: if the Stripe call fails, installer_paid_at stays
// NULL. The `idx_tote_rental_gifts_unpaid_completed` index makes it cheap
// to query "returned but unpaid" for retry/ops sweeps.

let _stripeForPayouts: Stripe | null = null;
function getStripeForPayouts(): Stripe {
  if (_stripeForPayouts) return _stripeForPayouts;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing — cannot transfer installer payouts.");
  _stripeForPayouts = new Stripe(key);
  return _stripeForPayouts;
}

export async function payoutToteFulfillment(
  giftId: string
): Promise<{ ok: boolean; transferId?: string; amountCents?: number; error?: string }> {
  const db = getServiceClient();

  // Pull the gift + installer's Stripe account in one round-trip.
  const { data: gift, error: giftErr } = await db
    .from("tote_rental_gifts")
    .select(
      `id, status, installer_id, installer_paid_at, installer_payout_id,
       installer_delivery_fee_cents, installer_pickup_fee_cents,
       recipient_name,
       profiles!tote_rental_gifts_installer_id_fkey ( stripe_account_id, email )`
    )
    .eq("id", giftId)
    .single();

  if (giftErr || !gift) {
    return { ok: false, error: "Gift not found." };
  }

  if (gift.status !== "returned") {
    return { ok: false, error: `Gift status is ${gift.status}, not returned — no payout due.` };
  }

  if (gift.installer_paid_at) {
    // Already paid — idempotent no-op. Return the existing transfer id
    // so callers logging this don't think it's a fresh disbursement.
    return {
      ok: true,
      transferId: (gift.installer_payout_id as string | null) ?? undefined,
      amountCents: 0,
    };
  }

  if (!gift.installer_id) {
    return { ok: false, error: "No installer assigned to this gift — nothing to pay." };
  }

  const installerProfile = gift.profiles as unknown as
    | { stripe_account_id: string | null; email: string }
    | null;
  const stripeAccountId = installerProfile?.stripe_account_id;
  if (!stripeAccountId) {
    // Installer disconnected Stripe between assignment and completion.
    // Don't lose the obligation — leave installer_paid_at NULL so ops
    // can sweep + manually disburse later.
    console.warn(
      `[Fulfillment] Gift ${giftId} installer ${gift.installer_id} has no stripe_account_id at payout time.`
    );
    return { ok: false, error: "Installer has no connected Stripe account." };
  }

  const delivery = (gift.installer_delivery_fee_cents as number | null) ?? 0;
  const pickup = (gift.installer_pickup_fee_cents as number | null) ?? 0;
  const totalCents = delivery + pickup;
  if (totalCents <= 0) {
    // Legacy gift seeded before migration 110, or zeroed by mistake.
    // Mark paid so ops queries don't keep retrying, but log it.
    console.warn(`[Fulfillment] Gift ${giftId} has zero payout (${totalCents}c). Marking paid as no-op.`);
    await db
      .from("tote_rental_gifts")
      .update({ installer_paid_at: new Date().toISOString() })
      .eq("id", giftId)
      .is("installer_paid_at", null);
    return { ok: true, amountCents: 0 };
  }

  // Issue the Stripe transfer. Idempotency key ties retries to this gift.
  let transfer: Stripe.Transfer;
  try {
    transfer = await getStripeForPayouts().transfers.create(
      {
        amount: totalCents,
        currency: "usd",
        destination: stripeAccountId,
        description: `Tote rental fulfillment — gift ${giftId.slice(0, 8)} (${gift.recipient_name})`,
        metadata: {
          type: "tote_rental_fulfillment",
          gift_id: giftId,
          installer_id: gift.installer_id as string,
          delivery_fee_cents: String(delivery),
          pickup_fee_cents: String(pickup),
        },
      },
      { idempotencyKey: `tote-rental-gift-${giftId}-payout` }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Fulfillment] Stripe transfer failed for gift ${giftId}:`, msg);
    return { ok: false, error: `Stripe transfer failed: ${msg}` };
  }

  // Stamp the gift. Guarded on installer_paid_at IS NULL so concurrent
  // calls converge on the first successful one.
  const { error: stampErr } = await db
    .from("tote_rental_gifts")
    .update({
      installer_paid_at: new Date().toISOString(),
      installer_payout_id: transfer.id,
    })
    .eq("id", giftId)
    .is("installer_paid_at", null);

  if (stampErr) {
    console.error(
      `[Fulfillment] Transfer ${transfer.id} succeeded but DB stamp failed for gift ${giftId}:`,
      stampErr
    );
    // Don't return an error — the money already moved. Ops can reconcile
    // via Stripe dashboard if the DB stamp lost a race.
  }

  return { ok: true, transferId: transfer.id, amountCents: totalCents };
}
