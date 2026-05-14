"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Admin Realtor Management
//
// Server actions powering /dashboard/admin/realtors and its detail subpage.
// Mirrors the shape of admin-user-management.ts (which is installer/affiliate
// flavored) but with realtor-specific aggregates: gift counts, revenue,
// fulfillment-stage breakdown, and a flag-based suspend toggle.
//
// Deletion is intentionally delegated to deleteUserCompletely() — the
// existing destructive sequence in admin-user-management handles Stripe,
// affiliate, and storage cleanup, and `tote_rental_gifts.realtor_id` is
// ON DELETE CASCADE so all gift rows + their OTPs (which cascade from
// gifts) disappear automatically when the profile is deleted. We just
// add a realtor-flavored PREFLIGHT here so the admin sees realtor-specific
// counts (gifts sent, revenue, paid-out installer transfers) before
// pulling the trigger.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";

// ── Admin guard helper ─────────────────────────────────────────────────────

async function assertAdmin(adminUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUserId)
    .single();
  if (!data?.is_admin) return { ok: false, error: "Not authorized." };
  return { ok: true };
}

// ── List view ──────────────────────────────────────────────────────────────

export interface RealtorAdminRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  realtor_brokerage: string | null;
  realtor_license: string | null;
  is_suspended: boolean;
  is_pro: boolean;             // dual-role indicator
  created_at: string;
  last_login_at: string | null;
  // Aggregates computed in the same query path (one round-trip per row).
  gifts_total: number;
  gifts_revenue_cents: number;
  gifts_in_flight: number;     // scheduled/assigned/delivered (in progress)
  gifts_completed: number;     // returned
  gifts_cancelled: number;
}

export interface ListRealtorsAdminInput {
  /** Free-text match against email, first/last name, brokerage. */
  search?: string;
  /** 1-indexed page. */
  page?: number;
  /** Default 25, max 100. */
  pageSize?: number;
}

export interface ListRealtorsAdminResult {
  ok: boolean;
  error?: string;
  rows: RealtorAdminRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listRealtorsAdmin(
  adminUserId: string,
  input: ListRealtorsAdminInput = {}
): Promise<ListRealtorsAdminResult> {
  const guard = await assertAdmin(adminUserId);
  if (!guard.ok) {
    return { ok: false, error: guard.error, rows: [], total: 0, page: 1, pageSize: 25 };
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const supabase = getServiceClient();

  // Base query for realtors with optional search.
  let query = supabase
    .from("profiles")
    .select(
      "id, email, first_name, last_name, realtor_brokerage, realtor_license, is_suspended, is_pro, created_at, last_login_at",
      { count: "exact" }
    )
    .eq("is_realtor", true)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (input.search) {
    const q = input.search.trim().toLowerCase();
    if (q) {
      // ILIKE against the four most useful columns. Each %q% gets wrapped
      // by PostgREST's `.or()`.
      query = query.or(
        `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,realtor_brokerage.ilike.%${q}%`
      );
    }
  }

  const { data: profiles, count, error } = await query;
  if (error) {
    console.error("[Admin] listRealtorsAdmin profiles query failed:", error);
    return { ok: false, error: error.message, rows: [], total: 0, page, pageSize };
  }
  if (!profiles || profiles.length === 0) {
    return { ok: true, rows: [], total: count ?? 0, page, pageSize };
  }

  // Pull every gift belonging to the page's realtors in one round-trip
  // and aggregate in JS. For pageSize=25 this is fine; if pages get
  // significantly larger, move to a SQL view.
  const realtorIds = profiles.map((p) => p.id as string);
  const { data: gifts } = await supabase
    .from("tote_rental_gifts")
    .select("realtor_id, status, amount_cents")
    .in("realtor_id", realtorIds);

  // Pre-bucket so per-row aggregation is O(1).
  const byRealtor = new Map<string, RealtorAdminRow["gifts_total"] extends number ? {
    total: number;
    revenue: number;
    inFlight: number;
    completed: number;
    cancelled: number;
  } : never>();

  for (const g of gifts ?? []) {
    const id = g.realtor_id as string;
    const bucket = byRealtor.get(id) ?? {
      total: 0,
      revenue: 0,
      inFlight: 0,
      completed: 0,
      cancelled: 0,
    };
    bucket.total += 1;
    // `paid` and beyond count toward revenue (pending_payment doesn't).
    const status = g.status as string;
    if (status !== "pending_payment" && status !== "cancelled") {
      bucket.revenue += (g.amount_cents as number) || 0;
    }
    if (status === "scheduled" || status === "assigned" || status === "delivered") {
      bucket.inFlight += 1;
    } else if (status === "returned") {
      bucket.completed += 1;
    } else if (status === "cancelled") {
      bucket.cancelled += 1;
    }
    byRealtor.set(id, bucket);
  }

  const rows: RealtorAdminRow[] = profiles.map((p) => {
    const id = p.id as string;
    const agg = byRealtor.get(id) ?? { total: 0, revenue: 0, inFlight: 0, completed: 0, cancelled: 0 };
    return {
      id,
      email: (p.email as string) ?? "",
      first_name: (p.first_name as string | null) ?? null,
      last_name: (p.last_name as string | null) ?? null,
      realtor_brokerage: (p.realtor_brokerage as string | null) ?? null,
      realtor_license: (p.realtor_license as string | null) ?? null,
      is_suspended: !!p.is_suspended,
      is_pro: !!p.is_pro,
      created_at: p.created_at as string,
      last_login_at: (p.last_login_at as string | null) ?? null,
      gifts_total: agg.total,
      gifts_revenue_cents: agg.revenue,
      gifts_in_flight: agg.inFlight,
      gifts_completed: agg.completed,
      gifts_cancelled: agg.cancelled,
    };
  });

  return { ok: true, rows, total: count ?? rows.length, page, pageSize };
}

// ── Detail view ────────────────────────────────────────────────────────────

export interface RealtorAdminDetail {
  profile: RealtorAdminRow;
  gifts: Array<{
    id: string;
    status: string;
    package_name: string | null;
    tote_count: number;
    duration_days: number;
    amount_cents: number;
    recipient_name: string;
    recipient_email: string;
    created_at: string;
    paid_at: string | null;
    redeemed_at: string | null;
    scheduled_at: string | null;
    installer_assigned_at: string | null;
    delivered_at: string | null;
    returned_at: string | null;
    installer_id: string | null;
    installer_label: string | null; // "Business Name (email)" for the admin's eyes
    gift_token: string | null;
  }>;
}

export async function getRealtorAdminDetail(
  adminUserId: string,
  realtorId: string
): Promise<{ ok: boolean; error?: string; detail?: RealtorAdminDetail }> {
  const guard = await assertAdmin(adminUserId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const supabase = getServiceClient();

  const { data: p } = await supabase
    .from("profiles")
    .select(
      "id, email, first_name, last_name, realtor_brokerage, realtor_license, is_suspended, is_pro, is_realtor, created_at, last_login_at"
    )
    .eq("id", realtorId)
    .maybeSingle();

  if (!p) return { ok: false, error: "Realtor not found." };
  if (!p.is_realtor) return { ok: false, error: "User is not flagged as a realtor." };

  const { data: gifts } = await supabase
    .from("tote_rental_gifts")
    .select(
      `id, status, tote_count, duration_days, amount_cents,
       recipient_name, recipient_email, gift_token,
       created_at, paid_at, redeemed_at, scheduled_at, installer_assigned_at, delivered_at, returned_at,
       installer_id,
       tote_rental_packages ( name ),
       profiles!tote_rental_gifts_installer_id_fkey ( email, business_name, first_name, last_name )`
    )
    .eq("realtor_id", realtorId)
    .order("created_at", { ascending: false });

  // Re-compute aggregates so the profile card matches the gift table exactly.
  let total = 0;
  let revenue = 0;
  let inFlight = 0;
  let completed = 0;
  let cancelled = 0;
  const giftRows: RealtorAdminDetail["gifts"] = [];

  for (const g of gifts ?? []) {
    total += 1;
    const status = g.status as string;
    if (status !== "pending_payment" && status !== "cancelled") {
      revenue += (g.amount_cents as number) || 0;
    }
    if (status === "scheduled" || status === "assigned" || status === "delivered") inFlight += 1;
    else if (status === "returned") completed += 1;
    else if (status === "cancelled") cancelled += 1;

    const installer = g.profiles as unknown as
      | { email: string; business_name: string | null; first_name: string | null; last_name: string | null }
      | null;
    const installerLabel = installer
      ? `${installer.business_name || [installer.first_name, installer.last_name].filter(Boolean).join(" ") || "Installer"} (${installer.email})`
      : null;

    giftRows.push({
      id: g.id as string,
      status,
      package_name:
        (g.tote_rental_packages as unknown as { name: string } | null)?.name ?? null,
      tote_count: g.tote_count as number,
      duration_days: g.duration_days as number,
      amount_cents: (g.amount_cents as number) ?? 0,
      recipient_name: g.recipient_name as string,
      recipient_email: g.recipient_email as string,
      created_at: g.created_at as string,
      paid_at: (g.paid_at as string | null) ?? null,
      redeemed_at: (g.redeemed_at as string | null) ?? null,
      scheduled_at: (g.scheduled_at as string | null) ?? null,
      installer_assigned_at: (g.installer_assigned_at as string | null) ?? null,
      delivered_at: (g.delivered_at as string | null) ?? null,
      returned_at: (g.returned_at as string | null) ?? null,
      installer_id: (g.installer_id as string | null) ?? null,
      installer_label: installerLabel,
      gift_token: (g.gift_token as string | null) ?? null,
    });
  }

  return {
    ok: true,
    detail: {
      profile: {
        id: p.id as string,
        email: (p.email as string) ?? "",
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
        realtor_brokerage: (p.realtor_brokerage as string | null) ?? null,
        realtor_license: (p.realtor_license as string | null) ?? null,
        is_suspended: !!p.is_suspended,
        is_pro: !!p.is_pro,
        created_at: p.created_at as string,
        last_login_at: (p.last_login_at as string | null) ?? null,
        gifts_total: total,
        gifts_revenue_cents: revenue,
        gifts_in_flight: inFlight,
        gifts_completed: completed,
        gifts_cancelled: cancelled,
      },
      gifts: giftRows,
    },
  };
}

// ── Lock / unlock toggle ───────────────────────────────────────────────────
//
// Reuses the platform-wide profiles.is_suspended column. Middleware already
// enforces it (src/middleware.ts:79-83). Setting it true blocks the realtor
// from the (authed) routes immediately on next request.

export async function setRealtorSuspended(
  adminUserId: string,
  realtorId: string,
  suspended: boolean,
  reason: string | null = null
): Promise<{ ok: boolean; error?: string }> {
  const guard = await assertAdmin(adminUserId);
  if (!guard.ok) return guard;

  if (adminUserId === realtorId) {
    return { ok: false, error: "You cannot suspend your own account." };
  }

  const supabase = getServiceClient();

  // Verify the target is a realtor (defense — the URL is /admin/realtors/[id]
  // but a malicious actor could pass any UUID).
  const { data: target } = await supabase
    .from("profiles")
    .select("id, is_realtor, is_admin")
    .eq("id", realtorId)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };
  if (target.is_admin) {
    return { ok: false, error: "Cannot suspend an admin account from this tool." };
  }
  if (!target.is_realtor) {
    return { ok: false, error: "Target is not a realtor." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: suspended,
      // `suspension_reason` is used by the pro-subscription payment path;
      // for manual locks we tag it "manual" so the existing logic can
      // distinguish recovery flows from admin actions.
      suspension_reason: suspended ? (reason ?? "manual") : null,
    })
    .eq("id", realtorId);

  if (error) {
    console.error("[Admin] setRealtorSuspended update failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── Deletion preflight (realtor-flavored) ──────────────────────────────────
//
// Distinct from getUserDeletionPreflight (which surfaces installer/affiliate
// counts). The actual destructive call still goes through
// deleteUserCompletely — that function's existing sequence handles Stripe +
// affiliate + storage, and tote_rental_gifts.realtor_id has ON DELETE
// CASCADE so realtor data wipes automatically when the auth.users row is
// removed.
//
// What we surface here is the realtor-side blast radius so the operator
// knows exactly what's about to disappear.

export interface RealtorDeletionPreflight {
  ok: boolean;
  error?: string;
  blockers: string[];
  warnings: string[];
  counts: {
    gifts_total: number;
    gifts_pending_payment: number;
    gifts_in_flight: number;      // scheduled/assigned/delivered
    gifts_completed: number;      // returned
    gifts_cancelled: number;
    gifts_revenue_cents: number;
    /** Dollars that have already been transferred to installers across
     *  this realtor's gifts. We never reverse Stripe transfers — those
     *  records live in Stripe's dashboard regardless of what happens
     *  here. Surfaced as a warning so the admin knows the audit trail
     *  for real-money movement remains. */
    installer_payouts_cents: number;
  };
}

export async function getRealtorDeletionPreflight(
  adminUserId: string,
  realtorId: string
): Promise<RealtorDeletionPreflight> {
  const empty: RealtorDeletionPreflight = {
    ok: false,
    blockers: [],
    warnings: [],
    counts: {
      gifts_total: 0,
      gifts_pending_payment: 0,
      gifts_in_flight: 0,
      gifts_completed: 0,
      gifts_cancelled: 0,
      gifts_revenue_cents: 0,
      installer_payouts_cents: 0,
    },
  };

  const guard = await assertAdmin(adminUserId);
  if (!guard.ok) return { ...empty, error: guard.error };

  const supabase = getServiceClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, is_realtor, is_admin, is_pro")
    .eq("id", realtorId)
    .maybeSingle();

  if (!target) return { ...empty, error: "User not found." };

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (target.id === adminUserId) blockers.push("You cannot delete your own account.");
  if (target.is_admin) {
    blockers.push("Target is an admin. Remove the is_admin flag in the DB first.");
  }
  if (!target.is_realtor) {
    blockers.push("Target is not flagged as a realtor.");
  }
  if (target.is_pro) {
    warnings.push(
      "This user is ALSO an installer (is_pro=true). Deletion will wipe the installer side too. Use with caution."
    );
  }

  // Pull all gifts so we can compute counts + check for in-flight obligations.
  // tote_rental_gifts may not have installer_paid_at / installer_*_fee_cents
  // columns yet if migration 110 hasn't run; the select tolerates either.
  const { data: gifts } = await supabase
    .from("tote_rental_gifts")
    .select("id, status, amount_cents")
    .eq("realtor_id", realtorId);

  const counts = { ...empty.counts };
  for (const g of gifts ?? []) {
    counts.gifts_total += 1;
    const status = g.status as string;
    const amt = (g.amount_cents as number) ?? 0;
    if (status !== "pending_payment" && status !== "cancelled") counts.gifts_revenue_cents += amt;
    if (status === "pending_payment") counts.gifts_pending_payment += 1;
    else if (status === "scheduled" || status === "assigned" || status === "delivered") counts.gifts_in_flight += 1;
    else if (status === "returned") counts.gifts_completed += 1;
    else if (status === "cancelled") counts.gifts_cancelled += 1;
  }

  // Try to read installer payout totals — schema may not have the columns
  // yet pre-migration-110, so the query is best-effort.
  try {
    const { data: payouts } = await supabase
      .from("tote_rental_gifts")
      .select("installer_delivery_fee_cents, installer_pickup_fee_cents, installer_paid_at")
      .eq("realtor_id", realtorId);
    for (const r of payouts ?? []) {
      if (r.installer_paid_at) {
        counts.installer_payouts_cents +=
          ((r.installer_delivery_fee_cents as number | null) ?? 0) +
          ((r.installer_pickup_fee_cents as number | null) ?? 0);
      }
    }
  } catch {
    // Columns don't exist yet — pre-110 schema. Leave the count at 0.
  }

  if (counts.gifts_in_flight > 0) {
    warnings.push(
      `${counts.gifts_in_flight} gift(s) are in flight (scheduled/assigned/delivered). The recipient(s) may be waiting on delivery or pickup. Consider resolving those before deleting.`
    );
  }
  if (counts.installer_payouts_cents > 0) {
    const dollars = (counts.installer_payouts_cents / 100).toFixed(2);
    warnings.push(
      `$${dollars} has been paid to installers across this realtor's gifts. Those transfers stay in your Stripe dashboard regardless of this deletion — the audit trail survives. Gift rows will be removed.`
    );
  }

  return { ok: blockers.length === 0, blockers, warnings, counts };
}
