"use server";

import { createHash, randomBytes } from "crypto";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import {
  describeCut,
  MAX_PERCENT_CUT,
  normalizePartnerCode,
  privateName,
  suggestPartnerCode,
  type CommissionStatus,
  type CutType,
  type PartnerDiscountType,
} from "@/lib/referral-partners";
import { sendPartnerPortalInviteEmail } from "@/lib/emails/referralPartnerTemplates";

// ═══════════════════════════════════════════════════════════════════════════
// Referral partners — installer side (migration 168).
//
// Slim by default: a name and a cut make a partner with a share link. The
// customer discount is optional (mirrored into discount_codes so checkout
// applies it unchanged). Portal access is a per-partner switch: turning it
// on creates the partner's login and emails them a one-time link to set a
// password (or a plain login link if the email already has an account).
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface PartnerCommissionView {
  id: string;
  leadId: string;
  customer: string;
  amountCents: number;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface ReferralPartnerView {
  id: string;
  name: string;
  email: string | null;
  code: string;
  link: string;
  cutType: CutType;
  cutValue: number;
  discountType: PartnerDiscountType | null;
  discountValue: number | null;
  portalEnabled: boolean;
  portalInvitedAt: string | null;
  portalJoined: boolean;
  active: boolean;
  createdAt: string;
  referred: number;
  owedCents: number;
  paidCents: number;
  heldCents: number;
  commissions: PartnerCommissionView[];
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireInstaller(): Promise<{ id: string } | null> {
  const user = await getAuthenticatedUser().catch(() => null);
  return user ? { id: user.id } : null;
}

function randomSuffix(n = 2): string {
  const bytes = randomBytes(n);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function validateTerms(input: { cutType: CutType; cutValue: number; discountType?: PartnerDiscountType | null; discountValue?: number | null }): string | null {
  if (input.cutType !== "percent" && input.cutType !== "flat") return "Pick a percent or flat cut.";
  if (!(input.cutValue >= 0)) return "The partner's cut can't be negative.";
  if (input.cutType === "percent" && input.cutValue > MAX_PERCENT_CUT) return `A percent cut can be at most ${MAX_PERCENT_CUT}%.`;
  if (input.cutType === "flat" && input.cutValue > 10_000) return "That flat cut is too large.";
  if (input.discountType) {
    if (!(Number(input.discountValue) > 0)) return "Enter a discount amount, or turn the discount off.";
    if (input.discountType === "percent" && Number(input.discountValue) > 50) return "A percent discount can be at most 50%.";
  }
  return null;
}

function cleanEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function listReferralPartners(): Promise<Result<{ partners: ReferralPartnerView[] }>> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };

  const { data: rows, error } = await db()
    .from("referral_partners")
    .select("id, name, email, code, cut_type, cut_value, discount_type, discount_value, portal_enabled, portal_invited_at, user_id, active, created_at")
    .eq("installer_id", me.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: "Referral partners aren't set up yet. Try again shortly." };

  const ids = (rows ?? []).map((r) => r.id as string);
  const [commissionsRes, leadsRes] = ids.length
    ? await Promise.all([
        db()
          .from("referral_commissions")
          .select("id, partner_id, lead_id, amount_cents, status, created_at, paid_at")
          .in("partner_id", ids)
          .order("created_at", { ascending: false })
          .limit(500),
        db().from("leads").select("id, referral_partner_id, customer_name").in("referral_partner_id", ids).limit(2000),
      ])
    : [{ data: [] }, { data: [] }];

  const leadName = new Map<string, string | null>();
  const referred = new Map<string, number>();
  for (const l of leadsRes.data ?? []) {
    leadName.set(l.id as string, l.customer_name as string | null);
    const pid = l.referral_partner_id as string;
    referred.set(pid, (referred.get(pid) ?? 0) + 1);
  }

  const appUrl = getAppUrl();
  const partners: ReferralPartnerView[] = (rows ?? []).map((r) => {
    const mine = (commissionsRes.data ?? []).filter((c) => c.partner_id === r.id);
    const sum = (statuses: CommissionStatus[]) =>
      mine.filter((c) => statuses.includes(c.status as CommissionStatus)).reduce((t, c) => t + (c.amount_cents as number), 0);
    return {
      id: r.id as string,
      name: r.name as string,
      email: r.email as string | null,
      code: r.code as string,
      link: `${appUrl}/r/${r.code}`,
      cutType: r.cut_type as CutType,
      cutValue: Number(r.cut_value),
      discountType: (r.discount_type as PartnerDiscountType | null) ?? null,
      discountValue: r.discount_value === null ? null : Number(r.discount_value),
      portalEnabled: !!r.portal_enabled,
      portalInvitedAt: r.portal_invited_at as string | null,
      portalJoined: !!r.user_id,
      active: !!r.active,
      createdAt: r.created_at as string,
      referred: referred.get(r.id as string) ?? 0,
      owedCents: sum(["owed"]),
      heldCents: sum(["held", "processing"]),
      paidCents: sum(["paid", "manual_paid"]),
      commissions: mine.slice(0, 50).map((c) => ({
        id: c.id as string,
        leadId: c.lead_id as string,
        customer: privateName(leadName.get(c.lead_id as string)),
        amountCents: c.amount_cents as number,
        status: c.status as CommissionStatus,
        createdAt: c.created_at as string,
        paidAt: c.paid_at as string | null,
      })),
    };
  });
  return { ok: true, partners };
}

// ── Create / edit ─────────────────────────────────────────────────────────

export async function createReferralPartner(input: {
  name: string;
  email?: string | null;
  cutType: CutType;
  cutValue: number;
  discountType?: PartnerDiscountType | null;
  discountValue?: number | null;
  portalEnabled?: boolean;
}): Promise<Result<{ id: string; inviteSent?: boolean; inviteError?: string }>> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };
  const name = (input.name ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Enter the partner's name." };
  const email = cleanEmail(input.email);
  if (input.email?.trim() && !email) return { ok: false, error: "That email doesn't look right." };
  const termsError = validateTerms(input);
  if (termsError) return { ok: false, error: termsError };

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = normalizePartnerCode(suggestPartnerCode(name, randomSuffix(attempt < 3 ? 2 : 4)));
    if (!code) continue;
    // The code doubles as this installer's discount code, so it can't clash with one they already have.
    const { data: clash } = await db().from("discount_codes").select("id").eq("installer_id", me.id).ilike("code", code).maybeSingle();
    if (clash) continue;

    const { data: partner, error } = await db()
      .from("referral_partners")
      .insert({
        installer_id: me.id,
        name,
        email,
        code,
        cut_type: input.cutType,
        cut_value: input.cutValue,
        discount_type: input.discountType || null,
        discount_value: input.discountType ? input.discountValue : null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // code taken by someone else's partner
      console.error("[ReferralPartners] create failed:", error.message);
      return { ok: false, error: "Couldn't add the partner. Try again." };
    }
    await syncDiscountCode(partner.id as string, me.id);

    if (input.portalEnabled) {
      const invite = await setPartnerPortal(partner.id as string, true);
      return invite.ok
        ? { ok: true, id: partner.id as string, inviteSent: true }
        : { ok: true, id: partner.id as string, inviteSent: false, inviteError: invite.error };
    }
    return { ok: true, id: partner.id as string };
  }
  return { ok: false, error: "Couldn't make a unique code for this partner. Try a slightly different name." };
}

export async function updateReferralPartner(
  partnerId: string,
  patch: {
    name?: string;
    email?: string | null;
    cutType?: CutType;
    cutValue?: number;
    discountType?: PartnerDiscountType | null;
    discountValue?: number | null;
    active?: boolean;
  },
): Promise<Result> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };
  const { data: current } = await db()
    .from("referral_partners")
    .select("id, cut_type, cut_value, discount_type, discount_value, portal_enabled, user_id")
    .eq("id", partnerId)
    .eq("installer_id", me.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Partner not found." };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 120);
    if (!name) return { ok: false, error: "Enter the partner's name." };
    update.name = name;
  }
  if (patch.email !== undefined) {
    const email = cleanEmail(patch.email);
    if (patch.email?.trim() && !email) return { ok: false, error: "That email doesn't look right." };
    // Their login is tied to the email they were invited with.
    if (current.user_id && email === null) return { ok: false, error: "This partner has a login, so they need an email." };
    update.email = email;
  }
  const terms = {
    cutType: (patch.cutType ?? current.cut_type) as CutType,
    cutValue: patch.cutValue ?? Number(current.cut_value),
    discountType: patch.discountType !== undefined ? patch.discountType : (current.discount_type as PartnerDiscountType | null),
    discountValue: patch.discountValue !== undefined ? patch.discountValue : (current.discount_value as number | null),
  };
  const termsError = validateTerms(terms);
  if (termsError) return { ok: false, error: termsError };
  update.cut_type = terms.cutType;
  update.cut_value = terms.cutValue;
  update.discount_type = terms.discountType || null;
  update.discount_value = terms.discountType ? terms.discountValue : null;
  if (patch.active !== undefined) update.active = patch.active;

  const { error } = await db().from("referral_partners").update(update).eq("id", partnerId).eq("installer_id", me.id);
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  await syncDiscountCode(partnerId, me.id);
  return { ok: true };
}

/** Mirror the partner's discount into discount_codes (create, update, or switch off). */
async function syncDiscountCode(partnerId: string, installerId: string): Promise<void> {
  const { data: p } = await db()
    .from("referral_partners")
    .select("code, discount_type, discount_value, discount_code_id, active")
    .eq("id", partnerId)
    .maybeSingle();
  if (!p) return;
  const wantActive = !!p.active && !!p.discount_type && Number(p.discount_value) > 0;
  if (p.discount_code_id) {
    await db()
      .from("discount_codes")
      .update({
        active: wantActive,
        ...(p.discount_type && { discount_type: p.discount_type, discount_value: p.discount_value }),
      })
      .eq("id", p.discount_code_id)
      .eq("installer_id", installerId);
    return;
  }
  if (!wantActive) return;
  const { data: code, error } = await db()
    .from("discount_codes")
    .insert({ installer_id: installerId, code: p.code, discount_type: p.discount_type, discount_value: p.discount_value })
    .select("id")
    .single();
  if (error) {
    console.warn("[ReferralPartners] discount code create failed:", error.message);
    return;
  }
  await db().from("referral_partners").update({ discount_code_id: code.id }).eq("id", partnerId);
}

// ── Portal access ─────────────────────────────────────────────────────────

/**
 * Turn the partner's portal on (creates their login if needed and emails
 * them) or off (they lose the dashboard; link and history are kept).
 */
export async function setPartnerPortal(partnerId: string, enabled: boolean): Promise<Result> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };
  const { data: partner } = await db()
    .from("referral_partners")
    .select("id, name, email, user_id, cut_type, cut_value, portal_enabled")
    .eq("id", partnerId)
    .eq("installer_id", me.id)
    .maybeSingle();
  if (!partner) return { ok: false, error: "Partner not found." };

  if (!enabled) {
    const { count } = await db()
      .from("referral_commissions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .in("status", ["held", "processing"]);
    if ((count ?? 0) > 0) {
      return { ok: false, error: "This partner has payouts waiting on their Stripe. Leave the portal on until they're paid." };
    }
    await db().from("referral_partners").update({ portal_enabled: false, updated_at: new Date().toISOString() }).eq("id", partnerId);
    return { ok: true };
  }

  const email = cleanEmail(partner.email as string | null);
  if (!email) return { ok: false, error: "Add the partner's email first. That's where their login invite goes." };

  const account = await findOrCreatePartnerLogin(email);
  if ("error" in account) return { ok: false, error: account.error };
  if (account.userId === me.id) return { ok: false, error: "That's your own login. Use the partner's email." };

  const { error: linkErr } = await db()
    .from("referral_partners")
    .update({ user_id: account.userId, portal_enabled: true, portal_invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (linkErr) return { ok: false, error: "Couldn't turn on the portal. Try again." };

  const sent = await sendPortalInvite({
    userId: account.userId,
    email,
    partnerName: partner.name as string,
    installerId: me.id,
    cutText: describeCut(partner.cut_type as CutType, Number(partner.cut_value)),
  });
  return sent ? { ok: true } : { ok: false, error: "Portal is on, but the invite email didn't send. Try Resend invite." };
}

export async function resendPartnerInvite(partnerId: string): Promise<Result> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };
  const { data: partner } = await db()
    .from("referral_partners")
    .select("name, email, user_id, cut_type, cut_value, portal_enabled")
    .eq("id", partnerId)
    .eq("installer_id", me.id)
    .maybeSingle();
  if (!partner?.portal_enabled || !partner.user_id || !partner.email) return { ok: false, error: "Turn on portal access first." };
  const sent = await sendPortalInvite({
    userId: partner.user_id as string,
    email: partner.email as string,
    partnerName: partner.name as string,
    installerId: me.id,
    cutText: describeCut(partner.cut_type as CutType, Number(partner.cut_value)),
  });
  if (!sent) return { ok: false, error: "The invite didn't send. Try again." };
  await db().from("referral_partners").update({ portal_invited_at: new Date().toISOString() }).eq("id", partnerId);
  return { ok: true };
}

/**
 * The partner's login. Reuses an existing one for this email (a partner of
 * another installer, or someone who is also an installer) — those keep their
 * own password. Otherwise creates one with no password; the invite email
 * carries the one-time link to set it.
 */
async function findOrCreatePartnerLogin(email: string): Promise<{ userId: string } | { error: string }> {
  // Emails are stored lower-cased, so an exact match is right (ilike would treat _ and % as wildcards).
  const { data: existing } = await db().from("referral_partner_accounts").select("user_id").eq("email", email).maybeSingle();
  if (existing) return { userId: existing.user_id as string };

  const { data: created, error } = await db().auth.admin.createUser({ email, email_confirm: true, user_metadata: { referral_partner: true } });
  if (created?.user) {
    const { error: accErr } = await db()
      .from("referral_partner_accounts")
      .insert({ user_id: created.user.id, email, created_by_invite: true });
    if (accErr) {
      await db().auth.admin.deleteUser(created.user.id).catch(() => {});
      return { error: "Couldn't create the partner's login. Try again." };
    }
    return { userId: created.user.id };
  }
  if (error && /already|registered|exists/i.test(error.message)) {
    // An existing Storage Network login (an installer). Link it; they keep their password.
    const { data: profile } = await db().from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    if (!profile) return { error: "That email already has a Storage Network login we can't link. Contact support." };
    await db().from("referral_partner_accounts").upsert({ user_id: profile.id, email, created_by_invite: false }, { onConflict: "user_id" });
    return { userId: profile.id as string };
  }
  return { error: "Couldn't create the partner's login. Try again." };
}

/** Email the invite: a one-time set-password link for a new login, a login link otherwise. */
async function sendPortalInvite(params: { userId: string; email: string; partnerName: string; installerId: string; cutText: string }): Promise<boolean> {
  const { data: account } = await db()
    .from("referral_partner_accounts")
    .select("created_by_invite, password_set_at")
    .eq("user_id", params.userId)
    .maybeSingle();
  let setPasswordUrl: string | null = null;
  if (account?.created_by_invite && !account.password_set_at) {
    const token = randomBytes(32).toString("base64url");
    await db()
      .from("referral_partner_accounts")
      .update({
        password_token_hash: createHash("sha256").update(token).digest("hex"),
        password_token_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.userId);
    setPasswordUrl = `${getAppUrl()}/partners/welcome?token=${token}`;
  }
  const { data: installer } = await db().from("profiles").select("business_name, first_name").eq("id", params.installerId).maybeSingle();
  const res = await sendPartnerPortalInviteEmail(params.email, {
    partnerName: params.partnerName,
    installerName: (installer?.business_name as string) || (installer?.first_name as string) || "Your installer",
    cutText: params.cutText,
    setPasswordUrl,
  });
  return res.success;
}

// ── Payouts the installer makes directly ─────────────────────────────────

export async function markCommissionPaid(commissionId: string): Promise<Result> {
  const me = await requireInstaller();
  if (!me) return { ok: false, error: "Please sign in." };
  const { data, error } = await db()
    .from("referral_commissions")
    .update({ status: "manual_paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", commissionId)
    .eq("installer_id", me.id)
    .eq("status", "owed")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't mark it paid. Refresh and try again." };
  return { ok: true };
}
