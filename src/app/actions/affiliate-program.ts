"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  sendAffiliateApplicationReceivedEmail,
  sendAffiliateApplicationAdminAlert,
} from "@/lib/email";
import type {
  AffiliateApplication,
  AffiliateApplicationStatus,
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
