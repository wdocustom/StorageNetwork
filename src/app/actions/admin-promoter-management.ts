"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import type {
  PromoterApplicationStatus,
  PromoterAgreementConfig,
} from "@/types/promoter";

// ═══════════════════════════════════════════════════════════════════════════
// Promoter Program — Admin Actions
//
// Mirrors the affiliate program's admin queue (affiliate-program.ts Phase 3):
// review applications, propose an INDIVIDUALIZED percentage-of-sale
// agreement, manage the roster. All admin actions verify is_admin = true
// before touching anything; RLS is the defense-in-depth backstop.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: profile } = await db()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { ok: false, error: "Admin only." };
  return { ok: true, userId: user.id };
}

// ── A. listPromoterApplications ────────────────────────────────────────────

export interface AdminPromoterApplicationRow {
  id: string;
  applicant_id: string;
  status: PromoterApplicationStatus;
  application_data: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  applicant: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    is_pro: boolean;
  };
}

export async function listPromoterApplications(
  filter: { status?: PromoterApplicationStatus | "all" } = {}
): Promise<{ rows: AdminPromoterApplicationRow[]; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { rows: [], error: auth.error };

  const statusFilter = filter.status ?? "pending";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db()
    .from("promoter_applications")
    .select(`
      id, applicant_id, status, application_data,
      submitted_at, reviewed_at, review_notes,
      profiles:applicant_id (
        id, email, first_name, last_name, business_name, is_pro
      )
    `)
    .order("submitted_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Promoter.admin] list failed:", error);
    return { rows: [], error: "Could not load applications." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: AdminPromoterApplicationRow[] = (data || []).map((r: any) => ({
    id: r.id,
    applicant_id: r.applicant_id,
    status: r.status,
    application_data: r.application_data || {},
    submitted_at: r.submitted_at,
    reviewed_at: r.reviewed_at,
    review_notes: r.review_notes,
    applicant: {
      id: r.profiles?.id ?? r.applicant_id,
      email: r.profiles?.email ?? null,
      first_name: r.profiles?.first_name ?? null,
      last_name: r.profiles?.last_name ?? null,
      business_name: r.profiles?.business_name ?? null,
      is_pro: r.profiles?.is_pro === true,
    },
  }));

  return { rows };
}

// ── B. getPromoterApplicationDetail ────────────────────────────────────────

export interface AdminPromoterApplicationDetail extends AdminPromoterApplicationRow {
  existing_agreement: {
    id: string;
    status: string;
    accepted_at: string | null;
  } | null;
}

export async function getPromoterApplicationDetail(
  applicationId: string
): Promise<{ detail: AdminPromoterApplicationDetail | null; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { detail: null, error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db()
    .from("promoter_applications")
    .select(`
      id, applicant_id, status, application_data,
      submitted_at, reviewed_at, review_notes,
      profiles:applicant_id (
        id, email, first_name, last_name, business_name, is_pro
      )
    `)
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !data) {
    return { detail: null, error: "Application not found." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = data;

  const { data: existingAgreement } = await db()
    .from("promoter_agreements")
    .select("id, status, accepted_at")
    .eq("promoter_id", r.applicant_id)
    .in("status", ["active", "proposed"])
    .maybeSingle();

  return {
    detail: {
      id: r.id,
      applicant_id: r.applicant_id,
      status: r.status,
      application_data: r.application_data || {},
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      review_notes: r.review_notes,
      applicant: {
        id: r.profiles?.id ?? r.applicant_id,
        email: r.profiles?.email ?? null,
        first_name: r.profiles?.first_name ?? null,
        last_name: r.profiles?.last_name ?? null,
        business_name: r.profiles?.business_name ?? null,
        is_pro: r.profiles?.is_pro === true,
      },
      existing_agreement: existingAgreement
        ? {
            id: existingAgreement.id as string,
            status: existingAgreement.status as string,
            accepted_at: (existingAgreement.accepted_at as string | null) ?? null,
          }
        : null,
    },
  };
}

// ── C. rejectPromoterApplication ───────────────────────────────────────────

export async function rejectPromoterApplication(input: {
  applicationId: string;
  internalNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const { data, error } = await db()
    .from("promoter_applications")
    .update({
      status: "rejected" as PromoterApplicationStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      review_notes: input.internalNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Promoter.admin] reject failed:", error);
    return { success: false, error: "Could not reject application." };
  }
  if (!data) return { success: false, error: "Application not pending — already acted on." };

  return { success: true };
}

// ── D. proposePromoterAgreement ─────────────────────────────────────────────
// The approve path. The percent here is the INDIVIDUALIZED split — admin
// sets it per-promoter based on whatever was negotiated.

export interface ProposePromoterAgreementInput {
  applicationId: string;
  /** Whole-number percent of each referred sale (e.g. 20 = 20%). */
  percent: number;
  termsMarkdown: string;
  internalNotes?: string;
}

function validatePercent(percent: number): string | null {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "Percent must be a number.";
  }
  if (percent <= 0 || percent > 100) {
    return "Percent must be between 0 and 100 (exclusive of 0).";
  }
  return null;
}

export async function proposePromoterAgreement(
  input: ProposePromoterAgreementInput
): Promise<{ success: boolean; agreementId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!input.applicationId) return { success: false, error: "Missing application id." };
  const percentError = validatePercent(input.percent);
  if (percentError) return { success: false, error: percentError };
  if (!input.termsMarkdown.trim()) {
    return { success: false, error: "Agreement body is required." };
  }

  const { data: app } = await db()
    .from("promoter_applications")
    .select("id, applicant_id, status")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (!app) return { success: false, error: "Application not found." };
  if (app.status !== "pending") {
    return { success: false, error: "Application is no longer pending." };
  }

  const applicantId = app.applicant_id as string;

  const { data: existing } = await db()
    .from("promoter_agreements")
    .select("id, status")
    .eq("promoter_id", applicantId)
    .in("status", ["proposed", "active"])
    .maybeSingle();
  if (existing) {
    return {
      success: false,
      error: `Applicant already has a ${existing.status} agreement. Terminate it first.`,
    };
  }

  const agreementConfig: PromoterAgreementConfig = {
    type: "percentage",
    percent: input.percent,
  };

  const { data: agreement, error: agreementErr } = await db()
    .from("promoter_agreements")
    .insert({
      promoter_id: applicantId,
      application_id: input.applicationId,
      status: "proposed",
      agreement_config: agreementConfig,
      terms_markdown: input.termsMarkdown,
      created_by: auth.userId,
    })
    .select("id")
    .single();
  if (agreementErr || !agreement) {
    console.error("[Promoter.admin] agreement insert failed:", agreementErr);
    return { success: false, error: "Could not create the agreement." };
  }

  await db()
    .from("promoter_applications")
    .update({
      status: "approved" as PromoterApplicationStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      review_notes: input.internalNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId);

  return { success: true, agreementId: agreement.id as string };
}

// ── E. listPromoters ────────────────────────────────────────────────────────
// Roster view: every active/paused/terminated promoter with their
// individualized cut + lifetime totals from the payouts ledger.

export interface AdminPromoterRosterRow {
  promoterId: string;
  email: string | null;
  name: string | null;
  isSuspended: boolean;
  agreementId: string;
  agreementStatus: string;
  percent: number | null;
  shareCode: string | null;
  conversionCount: number;
  lifetimeCommissionCents: number;
  paidCommissionCents: number;
}

export async function listPromoters(): Promise<{
  rows: AdminPromoterRosterRow[];
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { rows: [], error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreements, error } = await db()
    .from("promoter_agreements")
    .select(`
      id, promoter_id, status, agreement_config,
      profiles:promoter_id (
        id, email, first_name, last_name, business_name,
        is_suspended, promoter_referral_code
      )
    `)
    .in("status", ["active", "paused", "terminated"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Promoter.admin] roster load failed:", error);
    return { rows: [], error: "Could not load promoter roster." };
  }

  const rows: AdminPromoterRosterRow[] = [];
  for (const a of agreements || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = a;
    const config = (r.agreement_config || {}) as PromoterAgreementConfig;

    const { data: payouts } = await db()
      .from("promoter_payouts")
      .select("commission_cents, status")
      .eq("agreement_id", r.id);

    const conversionCount = payouts?.length ?? 0;
    const lifetimeCommissionCents =
      payouts?.reduce((sum, p) => sum + (p.commission_cents ?? 0), 0) ?? 0;
    const paidCommissionCents =
      payouts
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + (p.commission_cents ?? 0), 0) ?? 0;

    rows.push({
      promoterId: r.promoter_id,
      email: r.profiles?.email ?? null,
      name:
        (r.profiles?.business_name as string | null) ||
        [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") ||
        null,
      isSuspended: r.profiles?.is_suspended === true,
      agreementId: r.id,
      agreementStatus: r.status,
      percent: config.type === "percentage" ? config.percent : null,
      shareCode: r.profiles?.promoter_referral_code ?? null,
      conversionCount,
      lifetimeCommissionCents,
      paidCommissionCents,
    });
  }

  return { rows };
}

// ── F. setPromoterSuspended ─────────────────────────────────────────────────

export async function setPromoterSuspended(
  promoterId: string,
  suspended: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const { data: target } = await db()
    .from("profiles")
    .select("id, is_promoter")
    .eq("id", promoterId)
    .maybeSingle();
  if (!target?.is_promoter) {
    return { success: false, error: "Target is not a promoter." };
  }

  const { error } = await db()
    .from("profiles")
    .update({
      is_suspended: suspended,
      suspension_reason: suspended ? reason || "manual" : null,
    })
    .eq("id", promoterId);

  if (error) {
    console.error("[Promoter.admin] suspend toggle failed:", error);
    return { success: false, error: "Could not update suspension status." };
  }
  return { success: true };
}
