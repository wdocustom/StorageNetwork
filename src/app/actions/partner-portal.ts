"use server";

import { createHash, randomBytes } from "crypto";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getAppUrl } from "@/lib/url-helper";
import {
  describeCut,
  describeDiscount,
  privateName,
  type CommissionStatus,
  type CutType,
  type PartnerDiscountType,
} from "@/lib/referral-partners";
import { partnerStripe, refreshPartnerAccount, releaseHeldCommissions } from "@/lib/server/referral-partners";
import { sendClientReferralEmail, sendPartnerPortalInviteEmail } from "@/lib/emails/referralPartnerTemplates";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
// Partner portal — the referral partner's side (migration 168).
// A partner only exists here once an installer turned their portal on, which
// created (or linked) their login. Every read is scoped to partner rows whose
// user_id is the caller AND whose portal is still enabled.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const RESET_TTL_MS = 60 * 60 * 1000;
const CLIENT_EMAILS_PER_DAY = 25;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ── First-time password + resets ──────────────────────────────────────────

async function accountForToken(token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await db()
    .from("referral_partner_accounts")
    .select("user_id, email, created_by_invite, password_token_expires_at")
    .eq("password_token_hash", hashToken(token))
    .maybeSingle();
  if (!data || !data.created_by_invite) return null;
  if (!data.password_token_expires_at || new Date(data.password_token_expires_at as string) < new Date()) return null;
  return data as { user_id: string; email: string };
}

export async function checkPartnerPasswordToken(token: string): Promise<{ valid: boolean; email?: string }> {
  const account = await accountForToken(token);
  return account ? { valid: true, email: account.email } : { valid: false };
}

/** Set the password from a one-time link. Only for logins a partner invite created. */
export async function setPartnerPassword(token: string, password: string): Promise<Result<{ email: string }>> {
  if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters." };
  const account = await accountForToken(token);
  if (!account) return { ok: false, error: "This link has expired or was already used. Ask for a new one below." };
  const { error } = await db().auth.admin.updateUserById(account.user_id, { password });
  if (error) return { ok: false, error: "Couldn't set your password. Try again." };
  await db()
    .from("referral_partner_accounts")
    .update({ password_token_hash: null, password_token_expires_at: null, password_set_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", account.user_id);
  return { ok: true, email: account.email };
}

/**
 * "Forgot password" for partner logins created by an invite. Always answers
 * the same way, so it can't be used to find out who is a partner. Existing
 * Storage Network logins reset through the normal login page.
 */
export async function requestPartnerPasswordLink(rawEmail: string): Promise<Result> {
  try {
    await enforceActionRateLimit({ action: "partner-password-link", limit: 5, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const email = (rawEmail ?? "").trim().toLowerCase();
  const { data: account } = await db()
    .from("referral_partner_accounts")
    .select("user_id, created_by_invite")
    .eq("email", email)
    .maybeSingle();
  if (account?.created_by_invite) {
    const { data: partner } = await db()
      .from("referral_partners")
      .select("name, cut_type, cut_value, installer_id")
      .eq("user_id", account.user_id)
      .eq("portal_enabled", true)
      .limit(1)
      .maybeSingle();
    if (partner) {
      const token = randomBytes(32).toString("base64url");
      await db()
        .from("referral_partner_accounts")
        .update({ password_token_hash: hashToken(token), password_token_expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString() })
        .eq("user_id", account.user_id);
      const { data: inst } = await db().from("profiles").select("business_name, first_name").eq("id", partner.installer_id).maybeSingle();
      await sendPartnerPortalInviteEmail(email, {
        partnerName: partner.name as string,
        installerName: (inst?.business_name as string) || (inst?.first_name as string) || "Your installer",
        cutText: describeCut(partner.cut_type as CutType, Number(partner.cut_value)),
        setPasswordUrl: `${getAppUrl()}/partners/welcome?token=${token}`,
      });
    }
  }
  return { ok: true };
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export interface PartnerReferral {
  leadId: string;
  customer: string;
  createdAt: string;
  depositPaid: boolean;
  cutCents: number;
  commissionStatus: CommissionStatus | null;
  paidAt: string | null;
}

export interface PartnerProgram {
  partnerId: string;
  installerName: string;
  link: string;
  code: string;
  cutText: string;
  discountText: string | null;
  earnedCents: number;
  paidCents: number;
  pendingCents: number;
  referrals: PartnerReferral[];
  recentEmails: { email: string; name: string | null; sentAt: string }[];
}

export interface PartnerPortalData {
  name: string;
  email: string;
  stripe: { connected: boolean; ready: boolean };
  programs: PartnerProgram[];
}

async function requirePartner(): Promise<{ userId: string; email: string } | null> {
  const user = await getAuthenticatedUser().catch(() => null);
  if (!user) return null;
  const { data: account } = await db().from("referral_partner_accounts").select("email").eq("user_id", user.id).maybeSingle();
  if (!account) return null;
  const { count } = await db()
    .from("referral_partners")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("portal_enabled", true);
  return (count ?? 0) > 0 ? { userId: user.id, email: account.email as string } : null;
}

export async function getPartnerPortal(): Promise<Result<{ data: PartnerPortalData }> | { ok: false; error: "signed_out" | "no_access" }> {
  const user = await getAuthenticatedUser().catch(() => null);
  if (!user) return { ok: false, error: "signed_out" };
  const me = await requirePartner();
  if (!me) return { ok: false, error: "no_access" };

  // Stripe first: a partner coming back from onboarding gets their held payouts now.
  const stripe = await refreshPartnerAccount(me.userId);
  if (stripe.ready) await releaseHeldCommissions(me.userId);

  const { data: partners } = await db()
    .from("referral_partners")
    .select("id, name, code, cut_type, cut_value, discount_type, discount_value, installer_id, active")
    .eq("user_id", me.userId)
    .eq("portal_enabled", true)
    .order("created_at", { ascending: true });
  const rows = partners ?? [];
  const ids = rows.map((p) => p.id as string);
  const installerIds = [...new Set(rows.map((p) => p.installer_id as string))];

  const [leadsRes, commissionsRes, installersRes, emailsRes] = await Promise.all([
    db()
      .from("leads")
      .select("id, referral_partner_id, customer_name, created_at, deposit_paid, partner_cut_cents")
      .in("referral_partner_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
    db().from("referral_commissions").select("lead_id, partner_id, amount_cents, status, paid_at").in("partner_id", ids),
    db().from("profiles").select("id, business_name, first_name").in("id", installerIds),
    db()
      .from("referral_partner_emails")
      .select("partner_id, recipient_email, recipient_name, created_at")
      .in("partner_id", ids)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const commissionByLead = new Map((commissionsRes.data ?? []).map((c) => [c.lead_id as string, c]));
  const installerName = new Map(
    (installersRes.data ?? []).map((p) => [p.id as string, (p.business_name as string) || (p.first_name as string) || "Your installer"]),
  );
  const appUrl = getAppUrl();

  const programs: PartnerProgram[] = rows.map((p) => {
    const referrals: PartnerReferral[] = (leadsRes.data ?? [])
      .filter((l) => l.referral_partner_id === p.id)
      .map((l) => {
        const c = commissionByLead.get(l.id as string);
        return {
          leadId: l.id as string,
          customer: privateName(l.customer_name as string | null),
          createdAt: l.created_at as string,
          depositPaid: !!l.deposit_paid,
          cutCents: (c?.amount_cents as number | undefined) ?? (Number(l.partner_cut_cents) || 0),
          commissionStatus: (c?.status as CommissionStatus | undefined) ?? null,
          paidAt: (c?.paid_at as string | undefined) ?? null,
        };
      });
    const mine = (commissionsRes.data ?? []).filter((c) => c.partner_id === p.id && c.status !== "void");
    const total = (statuses: string[]) => mine.filter((c) => statuses.includes(c.status as string)).reduce((t, c) => t + (c.amount_cents as number), 0);
    return {
      partnerId: p.id as string,
      installerName: installerName.get(p.installer_id as string) ?? "Your installer",
      link: `${appUrl}/r/${p.code}`,
      code: p.code as string,
      cutText: describeCut(p.cut_type as CutType, Number(p.cut_value)),
      discountText: describeDiscount(p.discount_type as PartnerDiscountType | null, p.discount_value === null ? null : Number(p.discount_value)),
      earnedCents: total(["owed", "held", "processing", "paid", "manual_paid"]),
      paidCents: total(["paid", "manual_paid"]),
      pendingCents: total(["owed", "held", "processing"]),
      referrals,
      recentEmails: (emailsRes.data ?? [])
        .filter((e) => e.partner_id === p.id)
        .slice(0, 20)
        .map((e) => ({ email: e.recipient_email as string, name: e.recipient_name as string | null, sentAt: e.created_at as string })),
    };
  });

  return {
    ok: true,
    data: { name: (rows[0]?.name as string) ?? "Partner", email: me.email, stripe, programs },
  };
}

// ── Stripe payouts ────────────────────────────────────────────────────────

export async function connectPartnerStripe(): Promise<Result<{ url: string }>> {
  const me = await requirePartner();
  if (!me) return { ok: false, error: "Please sign in." };
  const stripe = partnerStripe();
  if (!stripe) return { ok: false, error: "Payouts aren't available right now. Try again later." };
  try {
    const { data: account } = await db().from("referral_partner_accounts").select("stripe_account_id").eq("user_id", me.userId).maybeSingle();
    let accountId = account?.stripe_account_id as string | null;
    if (!accountId) {
      // US only: platform transfers can't cross borders to Standard accounts (see lib/stripe/cross-border).
      const created = await stripe.accounts.create({ type: "standard", country: "US", email: me.email, metadata: { referral_partner_user_id: me.userId } });
      accountId = created.id;
      await db().from("referral_partner_accounts").update({ stripe_account_id: accountId, updated_at: new Date().toISOString() }).eq("user_id", me.userId);
    }
    const base = getAppUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/partners?stripe=refresh`,
      return_url: `${base}/partners?stripe=return`,
      type: "account_onboarding",
    });
    return { ok: true, url: link.url };
  } catch (err) {
    console.error("[PartnerPortal] Stripe connect failed:", err);
    return { ok: false, error: "Couldn't open Stripe. Try again." };
  }
}

// ── Email a potential client ──────────────────────────────────────────────

export async function sendClientReferral(input: { partnerId: string; email: string; name?: string; note?: string }): Promise<Result> {
  const me = await requirePartner();
  if (!me) return { ok: false, error: "Please sign in." };
  const to = (input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: "Enter a valid email address." };
  if (to === me.email.toLowerCase()) return { ok: false, error: "That's your own email." };

  const { data: partner } = await db()
    .from("referral_partners")
    .select("id, name, code, installer_id, discount_type, discount_value, active")
    .eq("id", input.partnerId)
    .eq("user_id", me.userId)
    .eq("portal_enabled", true)
    .maybeSingle();
  if (!partner) return { ok: false, error: "Partner program not found." };
  if (!partner.active) return { ok: false, error: "This referral link is switched off right now." };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: today }, { count: dup }] = await Promise.all([
    db().from("referral_partner_emails").select("id", { count: "exact", head: true }).eq("partner_id", partner.id).gte("created_at", dayAgo),
    db()
      .from("referral_partner_emails")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partner.id)
      .eq("recipient_email", to)
      .gte("created_at", monthAgo),
  ]);
  if ((today ?? 0) >= CLIENT_EMAILS_PER_DAY) return { ok: false, error: `You can send ${CLIENT_EMAILS_PER_DAY} a day. Try again tomorrow.` };
  if ((dup ?? 0) > 0) return { ok: false, error: "You already sent this person your link in the last 30 days." };

  const { data: inst } = await db().from("profiles").select("business_name, first_name").eq("id", partner.installer_id).maybeSingle();
  const name = input.name?.trim().slice(0, 80) || null;
  const note = input.note?.trim().slice(0, 600) || null;
  const res = await sendClientReferralEmail(to, {
    clientName: name,
    partnerName: partner.name as string,
    partnerEmail: me.email,
    installerName: (inst?.business_name as string) || (inst?.first_name as string) || "a local installer",
    discountText: describeDiscount(partner.discount_type as PartnerDiscountType | null, partner.discount_value === null ? null : Number(partner.discount_value)),
    linkUrl: `${getAppUrl()}/r/${partner.code}`,
    note,
  });
  if (!res.success) return { ok: false, error: "The email didn't send. Try again." };
  await db().from("referral_partner_emails").insert({ partner_id: partner.id, recipient_email: to, recipient_name: name });
  return { ok: true };
}
