"use server";

import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import {
  sendPromoterApplicationReceivedEmail,
  sendPromoterApplicationAdminAlert,
  sendPromoterAgreementAcceptedAdminAlert,
} from "@/lib/email";
import type {
  PromoterApplication,
  PromoterApplicationStatus,
  PromoterAgreement,
  PromoterPayout,
} from "@/types/promoter";

// ═══════════════════════════════════════════════════════════════════════════
// Promoter Program — Server Actions
//
// An installer applies → an admin reviews and proposes an individualized
// percentage-of-sale agreement → the installer accepts → is_promoter flips
// true and they get a share link. Converted plan sales pay out via Stripe
// Connect transfer (computed + logged in the webhook; this module owns the
// application/agreement lifecycle, the referral-code lifecycle, and the
// portal's read-only stats).
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

// ── Slug generator (8 chars, base32-ish, no ambiguous glyphs) ────────────
// Mirrors realtor-referrals.ts — 0/O and 1/I/L removed for readability.
const SLUG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateSlug(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

function buildShareUrl(code: string): string {
  return `${getAppUrl()}/promo/${code}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Application flow
// ═══════════════════════════════════════════════════════════════════════════

const AUDIENCE_SIZES = ["none", "small", "medium", "large"] as const;
type AudienceSize = (typeof AUDIENCE_SIZES)[number];

export interface ApplyToBePromoterInput {
  /** Free-form: how/where they plan to promote the plans (2-1000 chars). */
  howToPromote: string;
  /** Bucketed audience size — gives admin context without asking for numbers. */
  audienceSize: AudienceSize;
  /** Must be true. We record the timestamp server-side as the actual proof. */
  termsAccepted: boolean;
}

export interface ApplyToBePromoterResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

function validateApplicationInput(input: ApplyToBePromoterInput): string | null {
  const how = (input.howToPromote || "").trim();
  if (how.length < 2) return "Tell us a little about how you plan to promote the plans.";
  if (how.length > 1000) return "Keep your promotion plan under 1000 characters.";
  if (!AUDIENCE_SIZES.includes(input.audienceSize)) return "Pick an audience size.";
  if (!input.termsAccepted) return "You must accept the promoter terms to apply.";
  return null;
}

export async function applyToBePromoter(
  input: ApplyToBePromoterInput
): Promise<ApplyToBePromoterResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const validationError = validateApplicationInput(input);
  if (validationError) return { success: false, error: validationError };

  const { data: existingAgreement } = await db()
    .from("promoter_agreements")
    .select("id, status")
    .eq("promoter_id", user.id)
    .in("status", ["active", "proposed"])
    .maybeSingle();
  if (existingAgreement) {
    return {
      success: false,
      error: "You already have an active or proposed promoter agreement — no need to apply.",
    };
  }

  const { data: profile, error: profileErr } = await db()
    .from("profiles")
    .select("id, email, first_name, last_name, business_name, is_promoter")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) {
    console.error("[Promoter] profile lookup failed:", profileErr);
    return { success: false, error: "Could not load your profile. Please try again in a moment." };
  }
  if (!profile) return { success: false, error: "Profile not found." };
  if (profile.is_promoter) {
    return {
      success: false,
      error: "You're already a promoter. Open the Promoter Portal to manage your account.",
    };
  }

  const applicationData = {
    how_to_promote: input.howToPromote.trim(),
    audience_size: input.audienceSize,
    terms_accepted_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await db()
    .from("promoter_applications")
    .insert({
      applicant_id: user.id,
      status: "pending",
      application_data: applicationData,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // Postgres unique-violation = a pending application already exists.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDuplicate = (insertErr as any)?.code === "23505";
    if (isDuplicate) {
      return {
        success: false,
        error: "You already have an application under review. We'll respond within 3 business days.",
      };
    }
    console.error("[Promoter] application insert failed:", insertErr);
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

  if (applicantEmail) {
    void sendPromoterApplicationReceivedEmail(applicantEmail, {
      name: applicantName,
    }).catch((err) => console.warn("[Promoter] applicant email failed:", err));
  }

  void notifyAdminsOfApplication({
    applicantName,
    applicantEmail: applicantEmail || "(no email on file)",
    applicationId: inserted.id as string,
    applicationData,
  });

  return { success: true, applicationId: inserted.id as string };
}

async function notifyAdminsOfApplication(payload: {
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
      void sendPromoterApplicationAdminAlert(email, payload).catch((err) =>
        console.warn("[Promoter] admin email failed:", err)
      );
    }
  } catch (err) {
    console.warn("[Promoter] notifyAdminsOfApplication lookup failed:", err);
  }
}

async function notifyAdminsOfAcceptance(payload: { promoterName: string; agreementId: string }) {
  try {
    const { data: admins } = await db()
      .from("profiles")
      .select("email")
      .eq("is_admin", true);
    if (!admins) return;
    for (const a of admins) {
      const email = a.email as string | null;
      if (!email) continue;
      void sendPromoterAgreementAcceptedAdminAlert(email, payload).catch((err) =>
        console.warn("[Promoter] acceptance admin email failed:", err)
      );
    }
  } catch (err) {
    console.warn("[Promoter] notifyAdminsOfAcceptance lookup failed:", err);
  }
}

export interface MyPromoterStatusResult {
  application: PromoterApplication | null;
  isPromoter: boolean;
  hasAgreement: boolean;
}

export async function getMyPromoterStatus(): Promise<MyPromoterStatusResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { application: null, isPromoter: false, hasAgreement: false };

  const { data: profile, error: profileErr } = await db()
    .from("profiles")
    .select("is_promoter")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) {
    console.error("[Promoter] status profile lookup failed:", profileErr);
  }

  const { data: app } = await db()
    .from("promoter_applications")
    .select("*")
    .eq("applicant_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: agreement } = await db()
    .from("promoter_agreements")
    .select("id")
    .eq("promoter_id", user.id)
    .in("status", ["active", "proposed"])
    .maybeSingle();

  return {
    application: (app as PromoterApplication | null) ?? null,
    isPromoter: profile?.is_promoter === true,
    hasAgreement: !!agreement,
  };
}

export async function withdrawMyPromoterApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data, error } = await db()
    .from("promoter_applications")
    .update({
      status: "withdrawn" as PromoterApplicationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("applicant_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Promoter] withdraw failed:", error);
    return { success: false, error: "Could not withdraw your application." };
  }
  if (!data) {
    return { success: false, error: "No pending application to withdraw." };
  }
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Agreement acceptance (promoter-side)
// ═══════════════════════════════════════════════════════════════════════════

export async function getMyPromoterAgreement(
  agreementId: string
): Promise<{ agreement: PromoterAgreement | null; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { agreement: null, error: "Not signed in." };
  if (!agreementId) return { agreement: null, error: "Missing agreement id." };

  const { data, error } = await db()
    .from("promoter_agreements")
    .select("*")
    .eq("id", agreementId)
    .eq("promoter_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Promoter] getMyPromoterAgreement failed:", error);
    return { agreement: null, error: "Could not load agreement." };
  }
  return { agreement: (data as PromoterAgreement | null) ?? null };
}

const TERMS_VERSION = "v1.0";

export async function acceptMyPromoterAgreement(
  agreementId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };
  if (!agreementId) return { success: false, error: "Missing agreement id." };

  const { data: existing, error: fetchErr } = await db()
    .from("promoter_agreements")
    .select("id, promoter_id, status")
    .eq("id", agreementId)
    .eq("promoter_id", user.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: "Agreement not found." };
  }
  if (existing.status === "active") {
    return { success: true }; // idempotent
  }
  if (existing.status !== "proposed") {
    return {
      success: false,
      error: `This agreement is ${existing.status} and can no longer be accepted.`,
    };
  }

  const { data: updated, error: updErr } = await db()
    .from("promoter_agreements")
    .update({
      status: "active",
      accepted_at: new Date().toISOString(),
      accepted_terms_version: TERMS_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agreementId)
    .eq("promoter_id", user.id)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    return { success: false, error: "Could not accept the agreement. Try again." };
  }

  const { data: profile } = await db()
    .from("profiles")
    .update({ is_promoter: true })
    .eq("id", user.id)
    .select("first_name, last_name, business_name")
    .maybeSingle();

  const promoterName =
    (profile?.business_name as string | null) ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "A promoter";
  void notifyAdminsOfAcceptance({ promoterName, agreementId });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Referral code lifecycle + attribution resolution
// ═══════════════════════════════════════════════════════════════════════════

export interface PromoterReferralLink {
  code: string;
  shareUrl: string;
}

export async function ensurePromoterReferralCode(): Promise<{
  success: boolean;
  link?: PromoterReferralLink;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: profile, error: readErr } = await db()
    .from("profiles")
    .select("is_promoter, promoter_referral_code")
    .eq("id", user.id)
    .single();

  if (readErr || !profile) {
    if (readErr) console.error("[Promoter] referral code profile lookup failed:", readErr);
    return { success: false, error: "Profile not found." };
  }
  if (!profile.is_promoter) {
    return { success: false, error: "Referral codes are promoter-only." };
  }

  if (profile.promoter_referral_code) {
    return {
      success: true,
      link: {
        code: profile.promoter_referral_code,
        shareUrl: buildShareUrl(profile.promoter_referral_code),
      },
    };
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = generateSlug();
    const { error: writeErr } = await db()
      .from("profiles")
      .update({ promoter_referral_code: slug })
      .eq("id", user.id)
      .is("promoter_referral_code", null);

    if (!writeErr) {
      const { data: confirmed } = await db()
        .from("profiles")
        .select("promoter_referral_code")
        .eq("id", user.id)
        .single();
      const code = confirmed?.promoter_referral_code;
      if (code) {
        return { success: true, link: { code, shareUrl: buildShareUrl(code) } };
      }
    }
    // Unique-violation = slug collision; loop and try again.
  }

  return { success: false, error: "Could not allocate a referral code." };
}

export async function resolvePromoterReferralCode(
  code: string
): Promise<{ promoterId: string } | null> {
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 4 || trimmed.length > 32) return null;

  const { data } = await db()
    .from("profiles")
    .select("id, is_promoter, is_suspended")
    .eq("promoter_referral_code", trimmed)
    .maybeSingle();

  if (!data) return null;
  if (!data.is_promoter) return null;
  if (data.is_suspended === true) return null;

  return { promoterId: data.id as string };
}

const ATTRIBUTION_COOKIE = "sn_promoter_ref";

// ─────────────────────────────────────────────────────────────────────────
// resolvePromoterAttributionForCheckout
//
// Reads the `sn_promoter_ref` cookie dropped by /promo/<code> (server
// actions can read request cookies via next/headers — same access pattern
// as the affiliate-slug cookies in onboard-installer.ts) and resolves it
// to a promoter id. Called at Stripe checkout-session-creation time so the
// session metadata can carry attribution through to the webhook. Returns
// null silently for missing/invalid/self-referral cases — checkout should
// never fail because of a stale or junk referral cookie.
// ─────────────────────────────────────────────────────────────────────────
export async function resolvePromoterAttributionForCheckout(
  buyerUserId?: string | null
): Promise<{ promoterId: string; code: string } | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ATTRIBUTION_COOKIE)?.value;
    if (!raw) return null;

    const normalized = raw.trim().toUpperCase();
    const resolved = await resolvePromoterReferralCode(normalized);
    if (!resolved) return null;

    // Skip self-referral — a promoter buying through their own link.
    if (buyerUserId && resolved.promoterId === buyerUserId) return null;

    return { promoterId: resolved.promoterId, code: normalized };
  } catch (err) {
    console.warn("[Promoter] attribution lookup failed (non-fatal):", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Portal data — share link, individualized cut, lifetime earnings, payouts
// ═══════════════════════════════════════════════════════════════════════════

export interface PromoterPortalData {
  shareUrl: string;
  code: string;
  agreement: PromoterAgreement | null;
  conversionCount: number;
  lifetimeSaleCents: number;
  lifetimeCommissionCents: number;
  paidCommissionCents: number;
  pendingCommissionCents: number;
  payouts: PromoterPayout[];
  stripeConnected: boolean;
}

export async function getMyPromoterPortalData(): Promise<{
  success: boolean;
  data?: PromoterPortalData;
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const linkResult = await ensurePromoterReferralCode();
  if (!linkResult.success || !linkResult.link) {
    return { success: false, error: linkResult.error || "No code." };
  }
  const { code, shareUrl } = linkResult.link;

  const { data: profile } = await db()
    .from("profiles")
    .select("stripe_account_id, stripe_details_submitted")
    .eq("id", user.id)
    .maybeSingle();

  const { data: agreement } = await db()
    .from("promoter_agreements")
    .select("*")
    .eq("promoter_id", user.id)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: payoutRows, error: payoutsErr } = await db()
    .from("promoter_payouts")
    .select("*")
    .eq("promoter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (payoutsErr) {
    return { success: false, error: "Could not load payout history." };
  }

  const payouts = (payoutRows ?? []) as PromoterPayout[];
  const conversionCount = payouts.length;
  const lifetimeSaleCents = payouts.reduce((sum, p) => sum + (p.sale_amount_cents ?? 0), 0);
  const lifetimeCommissionCents = payouts.reduce((sum, p) => sum + (p.commission_cents ?? 0), 0);
  const paidCommissionCents = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.commission_cents ?? 0), 0);
  const pendingCommissionCents = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + (p.commission_cents ?? 0), 0);

  return {
    success: true,
    data: {
      shareUrl,
      code,
      agreement: (agreement as PromoterAgreement | null) ?? null,
      conversionCount,
      lifetimeSaleCents,
      lifetimeCommissionCents,
      paidCommissionCents,
      pendingCommissionCents,
      payouts,
      stripeConnected:
        !!profile?.stripe_account_id && profile?.stripe_details_submitted === true,
    },
  };
}
