"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  sendAffiliateApplicationReceivedEmail,
  sendAffiliateApplicationAdminAlert,
  sendAffiliateAgreementProposedEmail,
  sendAffiliateApplicationRejectedEmail,
  sendAffiliateAgreementAcceptedAdminAlert,
} from "@/lib/email";
import type {
  AffiliateApplication,
  AffiliateApplicationStatus,
  AgreementConfig,
  AffiliateAgreement,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Program — Server Actions (Phase 2: Application Flow)
//
// Three actions: apply, fetch-my-status, withdraw. All gated by the
// caller's auth session. The RLS policies in migration 105 are the
// defense-in-depth layer; primary access control happens here.
//
// Phase 3 will add admin-side approveApplication / rejectApplication
// and the agreement-creation flow. This file stays applicant-facing.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Validation ──────────────────────────────────────────────────────────────

const AUDIENCE_SIZES = ["none", "small", "medium", "large"] as const;
type AudienceSize = (typeof AUDIENCE_SIZES)[number];

export interface ApplyToBeAffiliateInput {
  /** Free-form: why they want to be an affiliate (2-1000 chars). */
  why: string;
  /** Free-form: how they plan to recruit installers (2-1000 chars). */
  howToRecruit: string;
  /** Bucketed audience size — gives admin context without asking for numbers. */
  audienceSize: AudienceSize;
  /** Must be true. We record the timestamp server-side as the actual proof. */
  termsAccepted: boolean;
}

export interface ApplyToBeAffiliateResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

function validateInput(input: ApplyToBeAffiliateInput): string | null {
  const why = (input.why || "").trim();
  const how = (input.howToRecruit || "").trim();
  if (why.length < 2) return "Tell us a little about why you want to be an affiliate.";
  if (why.length > 1000) return "Keep your 'why' under 1000 characters.";
  if (how.length < 2) return "Tell us a little about how you plan to recruit.";
  if (how.length > 1000) return "Keep your recruiting plan under 1000 characters.";
  if (!AUDIENCE_SIZES.includes(input.audienceSize)) return "Pick an audience size.";
  if (!input.termsAccepted) return "You must accept the affiliate terms to apply.";
  return null;
}

// ── 1. applyToBeAffiliate ──────────────────────────────────────────────────
// Auth-gated. Inserts into affiliate_applications with status='pending'.
// Idempotency: the partial unique index on (applicant_id) WHERE status='pending'
// guarantees we never end up with two pending rows for the same installer
// even under race. We return a friendly error in that case.

export async function applyToBeAffiliate(
  input: ApplyToBeAffiliateInput
): Promise<ApplyToBeAffiliateResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  // Block applying if the installer already has an active or proposed
  // agreement — they're already in the program.
  const { data: existingAgreement } = await db()
    .from("affiliate_agreements")
    .select("id, status")
    .eq("affiliate_id", user.id)
    .in("status", ["active", "proposed"])
    .maybeSingle();
  if (existingAgreement) {
    return {
      success: false,
      error: "You already have an active or proposed affiliate agreement — no need to apply.",
    };
  }

  // Block legacy partners (Joe Long et al.) from re-applying — they're
  // already in the program through the old partners table.
  const { data: profile } = await db()
    .from("profiles")
    .select("id, email, first_name, last_name, business_name, is_partner")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profile not found." };
  if (profile.is_partner) {
    return {
      success: false,
      error: "You're already an affiliate partner. Open the Partner Portal to manage your account.",
    };
  }

  const applicationData = {
    why: input.why.trim(),
    how_to_recruit: input.howToRecruit.trim(),
    audience_size: input.audienceSize,
    terms_accepted_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await db()
    .from("affiliate_applications")
    .insert({
      applicant_id: user.id,
      status: "pending",
      application_data: applicationData,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // Postgres unique-violation code is 23505. Hits when a pending app
    // already exists for this applicant.
    const isDuplicate =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (insertErr as any)?.code === "23505";
    if (isDuplicate) {
      return {
        success: false,
        error: "You already have an application under review. We'll respond within 3 business days.",
      };
    }
    console.error("[Affiliate] application insert failed:", insertErr);
    return { success: false, error: "Could not submit your application. Please try again." };
  }

  // ── Notifications — fire-and-forget so a slow email server doesn't
  //    leave the applicant staring at a spinner. The application is
  //    persisted; the worst case is the admin doesn't get a courtesy
  //    nudge (they'll still see the row in the queue).
  const applicantName =
    (profile.business_name as string | null) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "An installer";
  const applicantEmail = (profile.email as string | null) || user.email || null;

  // Applicant confirmation.
  if (applicantEmail) {
    void sendAffiliateApplicationReceivedEmail(applicantEmail, {
      name: applicantName,
    }).catch((err) => console.warn("[Affiliate] applicant email failed:", err));
  }

  // Admin alerts — every active admin gets a notification.
  void notifyAdmins({
    applicantName,
    applicantEmail: applicantEmail || "(no email on file)",
    applicationId: inserted.id as string,
    applicationData,
  });

  return { success: true, applicationId: inserted.id as string };
}

async function notifyAdmins(payload: {
  applicantName: string;
  applicantEmail: string;
  applicationId: string;
  applicationData: Record<string, unknown>;
}) {
  try {
    const { data: admins } = await db()
      .from("profiles")
      .select("email")
      .eq("is_admin", true);
    if (!admins) return;
    for (const a of admins) {
      const email = a.email as string | null;
      if (!email) continue;
      void sendAffiliateApplicationAdminAlert(email, payload).catch((err) =>
        console.warn("[Affiliate] admin email failed:", err)
      );
    }
  } catch (err) {
    console.warn("[Affiliate] notifyAdmins lookup failed:", err);
  }
}

// ── 2. getMyAffiliateStatus ────────────────────────────────────────────────
// Returns the current user's most-recent application (if any). Used by the
// profile page CTA to decide what to render: Apply button, pending status,
// approved / rejected message, etc.

export interface MyAffiliateStatusResult {
  /** Latest application row by submitted_at desc, regardless of status. */
  application: AffiliateApplication | null;
  /** Whether the user is already an affiliate partner (legacy or new). */
  isPartner: boolean;
  /** Whether an active or proposed agreement exists in the new system. */
  hasAgreement: boolean;
}

export async function getMyAffiliateStatus(): Promise<MyAffiliateStatusResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { application: null, isPartner: false, hasAgreement: false };

  const { data: profile } = await db()
    .from("profiles")
    .select("is_partner")
    .eq("id", user.id)
    .maybeSingle();

  const { data: app } = await db()
    .from("affiliate_applications")
    .select("*")
    .eq("applicant_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: agreement } = await db()
    .from("affiliate_agreements")
    .select("id")
    .eq("affiliate_id", user.id)
    .in("status", ["active", "proposed"])
    .maybeSingle();

  return {
    application: (app as AffiliateApplication | null) ?? null,
    isPartner: profile?.is_partner === true,
    hasAgreement: !!agreement,
  };
}

// ── 3. withdrawMyApplication ───────────────────────────────────────────────
// Applicant withdraws their own PENDING application. Once admin has acted
// (approved/rejected), it can't be withdrawn — they'd need a new entry.

export async function withdrawMyApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data, error } = await db()
    .from("affiliate_applications")
    .update({
      status: "withdrawn" as AffiliateApplicationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("applicant_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Affiliate] withdraw failed:", error);
    return { success: false, error: "Could not withdraw your application." };
  }
  if (!data) {
    return { success: false, error: "No pending application to withdraw." };
  }
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin-Only Actions (Phase 3)
//
// All admin actions verify is_admin = true on the caller's profile before
// touching anything. The DB-level RLS policies are the second line of
// defense; this is the first.
//
// Privacy note: even though admins see every applicant's full payload,
// each affiliate's *terms* still surface only inside their own portal in
// Phase 4. Admins viewing an agreement here see what they wrote; they
// don't expose other affiliates' rates to each other.
// ═══════════════════════════════════════════════════════════════════════════

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

// ── A. listAffiliateApplications ──────────────────────────────────────────
// Returns applications joined with applicant info for the admin queue.
// Default filter is pending (the active triage view); admin can flip to
// see history.

export interface AdminApplicationRow {
  id: string;
  applicant_id: string;
  status: AffiliateApplicationStatus;
  application_data: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  /** Joined applicant info — denormalized for the list view. */
  applicant: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    is_pro: boolean;
    completed_jobs: number | null;
  };
}

export async function listAffiliateApplications(
  filter: { status?: AffiliateApplicationStatus | "all" } = {}
): Promise<{ rows: AdminApplicationRow[]; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { rows: [], error: auth.error };

  const statusFilter = filter.status ?? "pending";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db()
    .from("affiliate_applications")
    .select(`
      id, applicant_id, status, application_data,
      submitted_at, reviewed_at, review_notes,
      profiles:applicant_id (
        id, email, first_name, last_name, business_name, is_pro, completed_jobs
      )
    `)
    .order("submitted_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Affiliate.admin] list failed:", error);
    return { rows: [], error: "Could not load applications." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: AdminApplicationRow[] = (data || []).map((r: any) => ({
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
      completed_jobs: r.profiles?.completed_jobs ?? null,
    },
  }));

  return { rows };
}

// ── B. getApplicationDetail ───────────────────────────────────────────────
// Full record for one application, including any existing agreement in
// either 'proposed' or 'active' state for context.

export interface AdminApplicationDetail extends AdminApplicationRow {
  existing_agreement: {
    id: string;
    status: string;
    accepted_at: string | null;
  } | null;
}

export async function getApplicationDetail(
  applicationId: string
): Promise<{ detail: AdminApplicationDetail | null; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { detail: null, error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db()
    .from("affiliate_applications")
    .select(`
      id, applicant_id, status, application_data,
      submitted_at, reviewed_at, review_notes,
      profiles:applicant_id (
        id, email, first_name, last_name, business_name, is_pro, completed_jobs
      )
    `)
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !data) {
    return { detail: null, error: "Application not found." };
  }

  const { data: existingAgreement } = await db()
    .from("affiliate_agreements")
    .select("id, status, accepted_at")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("affiliate_id", (data as any).applicant_id)
    .in("status", ["active", "proposed"])
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = data;
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
        completed_jobs: r.profiles?.completed_jobs ?? null,
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

// ── C. rejectAffiliateApplication ─────────────────────────────────────────
// Sets status='rejected' on the application and sends a courteous email.
// review_notes is INTERNAL — never surfaced to the applicant.

export async function rejectAffiliateApplication(input: {
  applicationId: string;
  internalNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await db()
    .from("affiliate_applications")
    .update({
      status: "rejected" as AffiliateApplicationStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      review_notes: input.internalNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId)
    .eq("status", "pending")
    .select(`
      id, applicant_id,
      profiles:applicant_id (email, first_name, last_name, business_name)
    `)
    .maybeSingle();

  if (error) {
    console.error("[Affiliate.admin] reject failed:", error);
    return { success: false, error: "Could not reject application." };
  }
  if (!data) return { success: false, error: "Application not pending — already acted on." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (data as any).profiles;
  const email = profile?.email as string | null;
  const name =
    (profile?.business_name as string | null) ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "There";
  if (email) {
    void sendAffiliateApplicationRejectedEmail(email, { name }).catch((err) =>
      console.warn("[Affiliate.admin] reject email failed:", err)
    );
  }

  return { success: true };
}

// ── D. proposeAffiliateAgreement ──────────────────────────────────────────
// The approve path. Atomically:
//   1. Marks the application 'approved'
//   2. Creates an agreement row in 'proposed' state (partial-unique-index
//      enforced — one proposed per affiliate)
//   3. Emails the applicant a link to review and accept
//
// The agreement_config is validated structurally here so admins can't
// save a malformed shape.

export interface ProposeAffiliateAgreementInput {
  applicationId: string;
  agreementConfig: AgreementConfig;
  /** null = lifetime; otherwise number of months from acceptance. */
  durationMonths: number | null;
  /** Markdown body the affiliate sees on the acceptance page. */
  termsMarkdown: string;
  /** Optional internal note that stays on the application row. */
  internalNotes?: string;
}

function validateAgreementConfig(c: AgreementConfig): string | null {
  if (c.type === "flat") {
    if (!Number.isInteger(c.flat_amount_cents) || c.flat_amount_cents <= 0) {
      return "Flat amount must be a positive whole-cents integer.";
    }
    if (!["per_active_recruit_per_month", "per_invoice"].includes(c.flat_basis)) {
      return "Flat basis must be per_active_recruit_per_month or per_invoice.";
    }
  } else if (c.type === "percentage") {
    if (typeof c.percent !== "number" || c.percent <= 0 || c.percent > 100) {
      return "Percent must be between 0 and 100 (exclusive of 0).";
    }
  } else if (c.type === "tiered") {
    if (!Array.isArray(c.tiers) || c.tiers.length === 0) {
      return "Tiered agreements need at least one tier.";
    }
    for (let i = 0; i < c.tiers.length; i++) {
      const t = c.tiers[i];
      if (!Number.isInteger(t.amount_cents) || t.amount_cents <= 0) {
        return `Tier ${i + 1} amount must be a positive whole-cents integer.`;
      }
      if (t.max_active !== null && (!Number.isInteger(t.max_active) || t.max_active <= 0)) {
        return `Tier ${i + 1} max_active must be a positive integer or null (last tier only).`;
      }
    }
    if (c.tiers[c.tiers.length - 1].max_active !== null) {
      return "Last tier must have max_active = null (open-ended).";
    }
    if (c.basis !== "per_active_recruit_per_month") {
      return "Tiered basis must be per_active_recruit_per_month.";
    }
  } else {
    return "Unknown agreement type.";
  }
  if (c.signup_bonus_cents !== undefined) {
    if (!Number.isInteger(c.signup_bonus_cents) || c.signup_bonus_cents < 0) {
      return "Signup bonus must be a non-negative whole-cents integer.";
    }
  }
  return null;
}

export async function proposeAffiliateAgreement(
  input: ProposeAffiliateAgreementInput
): Promise<{ success: boolean; agreementId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  // Validate shape.
  if (!input.applicationId) return { success: false, error: "Missing application id." };
  const configError = validateAgreementConfig(input.agreementConfig);
  if (configError) return { success: false, error: configError };
  if (
    input.durationMonths !== null &&
    (!Number.isInteger(input.durationMonths) || input.durationMonths <= 0)
  ) {
    return { success: false, error: "Duration must be null (lifetime) or a positive integer." };
  }
  if (!input.termsMarkdown.trim()) {
    return { success: false, error: "Agreement body is required." };
  }

  // Load the application — must be pending to act on.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: app } = await db()
    .from("affiliate_applications")
    .select(`
      id, applicant_id, status,
      profiles:applicant_id (email, first_name, last_name, business_name)
    `)
    .eq("id", input.applicationId)
    .maybeSingle();
  if (!app) return { success: false, error: "Application not found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((app as any).status !== "pending") {
    return { success: false, error: "Application is no longer pending." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applicantId = (app as any).applicant_id as string;

  // Reject if the applicant somehow already has a proposed or active
  // agreement (partial unique indexes would catch this too).
  const { data: existing } = await db()
    .from("affiliate_agreements")
    .select("id, status")
    .eq("affiliate_id", applicantId)
    .in("status", ["proposed", "active"])
    .maybeSingle();
  if (existing) {
    return {
      success: false,
      error: `Applicant already has a ${existing.status} agreement. Terminate it first.`,
    };
  }

  // ── Insert agreement first (so we have an id if email fails). ─────────
  const { data: agreement, error: agreementErr } = await db()
    .from("affiliate_agreements")
    .insert({
      affiliate_id: applicantId,
      application_id: input.applicationId,
      status: "proposed",
      agreement_config: input.agreementConfig,
      duration_months: input.durationMonths,
      terms_markdown: input.termsMarkdown,
      created_by: auth.userId,
    })
    .select("id")
    .single();
  if (agreementErr || !agreement) {
    console.error("[Affiliate.admin] agreement insert failed:", agreementErr);
    return { success: false, error: "Could not create the agreement." };
  }

  // ── Then mark the application approved. ───────────────────────────────
  await db()
    .from("affiliate_applications")
    .update({
      status: "approved" as AffiliateApplicationStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
      review_notes: input.internalNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.applicationId);

  // ── Notify the applicant. Fire-and-forget. ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (app as any).profiles;
  const email = profile?.email as string | null;
  const name =
    (profile?.business_name as string | null) ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Partner";
  if (email) {
    void sendAffiliateAgreementProposedEmail(email, {
      name,
      agreementId: agreement.id as string,
    }).catch((err) => console.warn("[Affiliate.admin] propose email failed:", err));
  }

  return { success: true, agreementId: agreement.id as string };
}

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate-Side Actions (Phase 4)
//
// Self-serve: read your own proposed/active agreement, accept it, fetch
// the data your partner portal renders. RLS scopes everything to
// auth.uid() — even if a buggy client passed a stranger's id, the SELECT
// would return nothing.
//
// "Privacy isolation" invariant: each helper here returns ONLY the caller's
// own affiliate record. Phase 5 will add a Stripe-payout-aware variant of
// the portal-data fetcher; the auth shape is identical.
// ═══════════════════════════════════════════════════════════════════════════

// ── E. getMyAgreement ─────────────────────────────────────────────────────
// Used by /dashboard/affiliate/agreement/[id] (review/accept) AND by the
// partner portal. Returns the agreement only if it belongs to the caller.
// Returns null silently for not-found / wrong-owner — the page renders a
// generic "agreement not found" without leaking which case it was.

export async function getMyAgreement(
  agreementId: string
): Promise<{ agreement: AffiliateAgreement | null; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { agreement: null, error: "Not signed in." };
  if (!agreementId) return { agreement: null, error: "Missing agreement id." };

  const { data, error } = await db()
    .from("affiliate_agreements")
    .select("*")
    .eq("id", agreementId)
    .eq("affiliate_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Affiliate] getMyAgreement failed:", error);
    return { agreement: null, error: "Could not load agreement." };
  }
  return { agreement: (data as AffiliateAgreement | null) ?? null };
}

// ── F. acceptMyAgreement ──────────────────────────────────────────────────
// Flips a 'proposed' agreement to 'active' for the calling affiliate.
// Sets accepted_at, start_date, end_date (computed from duration_months).
// Idempotent on second call (returns success: true without re-stamping).
// Notifies admins so the queue stays in sync.

const TERMS_VERSION = "v1.0"; // bump when default boilerplate changes structurally

export async function acceptMyAgreement(
  agreementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };
  if (!agreementId) return { success: false, error: "Missing agreement id." };

  // Fetch first so we can check status + compute end_date.
  const { data: existing, error: fetchErr } = await db()
    .from("affiliate_agreements")
    .select("id, affiliate_id, status, duration_months, accepted_at")
    .eq("id", agreementId)
    .eq("affiliate_id", user.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: "Agreement not found." };
  }
  if (existing.status === "active") {
    // Idempotent: already accepted. Still success.
    return { success: true };
  }
  if (existing.status !== "proposed") {
    return {
      success: false,
      error: `This agreement is ${existing.status} and can no longer be accepted.`,
    };
  }

  const now = new Date();
  const startDate = now.toISOString();
  const months = existing.duration_months as number | null;
  const endDate =
    months === null
      ? null
      : new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

  // Atomic update — guard against the partial unique index by
  // double-checking status='proposed' in the WHERE clause.
  const { data: updated, error: updErr } = await db()
    .from("affiliate_agreements")
    .update({
      status: "active",
      accepted_at: startDate,
      accepted_terms_version: TERMS_VERSION,
      start_date: startDate,
      end_date: endDate,
      updated_at: startDate,
    })
    .eq("id", agreementId)
    .eq("affiliate_id", user.id)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error("[Affiliate] acceptMyAgreement failed:", updErr);
    return { success: false, error: "Could not accept the agreement. Please try again." };
  }
  if (!updated) {
    // Lost the race — someone (admin?) changed status mid-call.
    return { success: false, error: "Agreement state changed while you were reviewing it. Refresh." };
  }

  // ── Notify admins so the queue stays in sync. Fire-and-forget. ────────
  void notifyAdminsOfAccept({
    affiliateId: user.id,
    agreementId,
  });

  return { success: true };
}

async function notifyAdminsOfAccept(payload: {
  affiliateId: string;
  agreementId: string;
}) {
  try {
    const [{ data: profile }, { data: admins }] = await Promise.all([
      db()
        .from("profiles")
        .select("first_name, last_name, business_name, email")
        .eq("id", payload.affiliateId)
        .maybeSingle(),
      db().from("profiles").select("email").eq("is_admin", true),
    ]);

    const affiliateName =
      (profile?.business_name as string | null) ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "An affiliate";

    if (!admins) return;
    for (const a of admins) {
      const adminEmail = a.email as string | null;
      if (!adminEmail) continue;
      void sendAffiliateAgreementAcceptedAdminAlert(adminEmail, {
        affiliateName,
        agreementId: payload.agreementId,
      }).catch((err) =>
        console.warn("[Affiliate] accept admin email failed:", err)
      );
    }
  } catch (err) {
    console.warn("[Affiliate] notifyAdminsOfAccept failed:", err);
  }
}

// ── G. getMyAffiliatePortalData ───────────────────────────────────────────
// One-shot data fetch for the private partner portal. Returns the
// caller's agreement + recruits + earnings summary. All scoped to
// auth.uid() — the privacy invariant the user explicitly required.

export interface AffiliatePortalData {
  agreement: AffiliateAgreement | null;
  /** Installers whose profiles.referred_by_installer_id = me.
   *  Phase 6 wires the column on signup; until then this is empty
   *  for new affiliates. (Joe Long's legacy referrals migrate
   *  in Phase 5.) */
  recruits: Array<{
    id: string;
    name: string;
    is_pro: boolean;
    completed_jobs: number | null;
    joined_at: string;
  }>;
  earnings: {
    total_paid_cents: number;
    total_pending_cents: number;
    payout_count: number;
  };
}

export async function getMyAffiliatePortalData(): Promise<{
  data: AffiliatePortalData | null;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { data: null, error: "Not signed in." };

  // 1. Active or proposed agreement (most relevant first; portal
  //    surfaces a "review your agreement" CTA for proposed).
  const { data: agreement } = await db()
    .from("affiliate_agreements")
    .select("*")
    .eq("affiliate_id", user.id)
    .in("status", ["active", "proposed", "paused"])
    .order("status", { ascending: true })  // active < paused < proposed alphabetically; not stable
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Recruits — installers attributed to this affiliate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recruitProfiles } = await db()
    .from("profiles")
    .select("id, first_name, last_name, business_name, is_pro, completed_jobs, created_at")
    .eq("referred_by_installer_id", user.id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recruits = (recruitProfiles || []).map((p: any) => ({
    id: p.id as string,
    name:
      (p.business_name as string | null) ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      "Recruited installer",
    is_pro: p.is_pro === true,
    completed_jobs: (p.completed_jobs as number | null) ?? null,
    joined_at: p.created_at as string,
  }));

  // 3. Earnings summary — Phase 5 inserts rows into affiliate_payouts.
  //    Until then this returns zeroes for non-Joe-Long affiliates,
  //    which is correct.
  const { data: payouts } = await db()
    .from("affiliate_payouts")
    .select("amount_cents, status")
    .eq("affiliate_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPaidCents = (payouts || [])
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (p.amount_cents as number), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPendingCents = (payouts || [])
    .filter((p: any) => p.status === "pending" || p.status === "processing")
    .reduce((sum: number, p: any) => sum + (p.amount_cents as number), 0);

  return {
    data: {
      agreement: (agreement as AffiliateAgreement | null) ?? null,
      recruits,
      earnings: {
        total_paid_cents: totalPaidCents,
        total_pending_cents: totalPendingCents,
        payout_count: payouts?.length ?? 0,
      },
    },
  };
}

// ── H. terminateAgreement (admin) ──────────────────────────────────────────
// Ends an active or proposed agreement. After termination:
//   • The affiliate's portal stops showing it as active.
//   • No new payouts will fire from invoice.payment_succeeded — the webhook
//     looks for an *active* agreement and skips otherwise.
//   • Already-issued payouts are not clawed back.
//
// Used when an affiliate quits, when terms need to be renegotiated (admin
// terminates the old agreement, then proposes a new one), or for rare
// cases like fraud / TOS violations.

export async function terminateAgreement(input: {
  agreementId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!input.agreementId) return { success: false, error: "Missing agreement id." };

  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("affiliate_agreements")
    .update({
      status: "terminated",
      terminated_at: now,
      terminated_reason: input.reason?.trim() || null,
      updated_at: now,
    })
    .eq("id", input.agreementId)
    .in("status", ["active", "proposed", "paused"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Affiliate.admin] terminate failed:", error);
    return { success: false, error: "Could not terminate agreement." };
  }
  if (!data) return { success: false, error: "Agreement is not active." };
  return { success: true };
}

