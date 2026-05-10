"use server";

import { randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendAffiliateColdInviteEmail } from "@/lib/email";
import type {
  AffiliateEmailInvite,
  AffiliateInviteStatus,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// Affiliate Cold-Email Invites (Phase 6)
//
// Self-serve outreach from an active affiliate to a prospect. The platform
// sends the email on the affiliate's behalf (display-name "X via Storage
// Network", Reply-To: affiliate). Tracking is via the invite_token in the
// /join/i/<token> URL.
//
// Hard rules baked in here:
//   • One email per (referrer, prospect) pair. No nurture sequences in
//     Phase 6 — that's deferred to 6.5.
//   • Daily cap of MAX_INVITES_PER_DAY per affiliate.
//   • Suppression list short-circuits before any send.
//   • Already-an-installer check — never re-pitch someone who's already on
//     the network.
//   • Only affiliates with an active agreement may send invites.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getServiceClient();

const MAX_INVITES_PER_DAY = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── A. sendAffiliateInvite ──────────────────────────────────────────────────
// Auth-gated to affiliates with an active agreement. Validates, dedups,
// inserts the invite row, fires the cold-email template, returns success.

export interface SendAffiliateInviteResult {
  success: boolean;
  inviteId?: string;
  error?: string;
}

export async function sendAffiliateInvite(input: {
  prospectEmail: string;
  prospectName?: string;
}): Promise<SendAffiliateInviteResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not signed in." };

  const email = (input.prospectEmail || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { success: false, error: "That doesn't look like a valid email address." };
  }
  const name = (input.prospectName || "").trim().slice(0, 200) || null;

  // 1. Caller must have an active agreement.
  const { data: agreement } = await db()
    .from("affiliate_agreements")
    .select("id")
    .eq("affiliate_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!agreement) {
    return {
      success: false,
      error: "Your affiliate agreement isn't active yet. Accept your agreement first.",
    };
  }

  // 2. Caller's display details for the From line + Reply-To.
  const { data: referrerProfile } = await db()
    .from("profiles")
    .select("first_name, last_name, business_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const referrerName =
    (referrerProfile?.business_name as string | null) ||
    [referrerProfile?.first_name, referrerProfile?.last_name].filter(Boolean).join(" ") ||
    "An installer";
  const referrerCompany = (referrerProfile?.business_name as string | null) ?? null;
  const referrerEmail =
    (referrerProfile?.email as string | null) || user.email || null;
  if (!referrerEmail) {
    return {
      success: false,
      error: "Your account has no email on file — Reply-To would fail. Update your profile first.",
    };
  }

  // 3. Suppression check — once a prospect lands on cold_email_suppressions
  //    (via unsubscribe, bounce, spam complaint, or admin block), nobody can
  //    re-email them. Suppression details are admin-only — we never tell
  //    the affiliate which case it was.
  const { data: suppression } = await db()
    .from("cold_email_suppressions")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (suppression) {
    return {
      success: false,
      error: "That email address can't be contacted through invites. Try a different prospect.",
    };
  }

  // 4. Already on the network — never re-pitch an existing installer.
  const { data: existingInstaller } = await db()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingInstaller) {
    return {
      success: false,
      error: "That email is already on Storage Network. No invite needed.",
    };
  }

  // 5. One invite per (referrer, prospect) — enforced in code; the table
  //    doesn't have a partial unique index for this because we MAY want
  //    Phase 6.5 reminders. The architecture brief specified a hard cap of
  //    1 initial email + at most 1 reminder.
  const { data: priorInvite } = await db()
    .from("affiliate_email_invites")
    .select("id, status, sent_at")
    .eq("referring_installer_id", user.id)
    .eq("prospect_email", email)
    .maybeSingle();
  if (priorInvite) {
    return {
      success: false,
      error: "You've already invited this prospect. Give them some time to respond.",
    };
  }

  // 6. Daily cap — count invites this affiliate has sent in the last 24h.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await db()
    .from("affiliate_email_invites")
    .select("id", { count: "exact", head: true })
    .eq("referring_installer_id", user.id)
    .gte("created_at", oneDayAgo);
  if ((recentCount ?? 0) >= MAX_INVITES_PER_DAY) {
    return {
      success: false,
      error: `Daily limit reached (${MAX_INVITES_PER_DAY} invites per day). Try again tomorrow.`,
    };
  }

  // 7. Generate token + insert the invite row.
  const inviteToken = randomBytes(24).toString("base64url");
  const { data: inserted, error: insertErr } = await db()
    .from("affiliate_email_invites")
    .insert({
      referring_installer_id: user.id,
      prospect_email: email,
      prospect_name: name,
      invite_token: inviteToken,
      status: "sent" as AffiliateInviteStatus,
      sent_at: new Date().toISOString(),
    })
    .select("id, invite_token")
    .single();
  if (insertErr || !inserted) {
    console.error("[Affiliate.invite] insert failed:", insertErr);
    return { success: false, error: "Could not create the invite. Please try again." };
  }

  // 8. Fire the email — fire-and-forget so the form returns fast.
  void sendAffiliateColdInviteEmail({
    prospectEmail: email,
    prospectName: name,
    referrerName,
    referrerCompany,
    referrerEmail,
    inviteToken: inserted.invite_token as string,
  }).catch((err) => console.warn("[Affiliate.invite] send failed:", err));

  return { success: true, inviteId: inserted.id as string };
}

// ── B. getMyAffiliateInvites ────────────────────────────────────────────────
// Lists the caller's own invites for the portal "sent invites" panel.
// Most-recent first.

export async function getMyAffiliateInvites(): Promise<{
  invites: AffiliateEmailInvite[];
  error?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) return { invites: [], error: "Not signed in." };

  const { data, error } = await db()
    .from("affiliate_email_invites")
    .select("*")
    .eq("referring_installer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Affiliate.invite] list failed:", error);
    return { invites: [], error: "Could not load your invites." };
  }
  return { invites: (data || []) as AffiliateEmailInvite[] };
}

// ── C. recordInviteClick ────────────────────────────────────────────────────
// Called from the /join/i/[token] route handler. Records click + sets a
// cookie elsewhere. Idempotent: a second click on an already-clicked invite
// just updates the timestamp without regressing status.

export async function recordInviteClick(token: string): Promise<{
  invite: { id: string; referring_installer_id: string; prospect_email: string; status: AffiliateInviteStatus } | null;
}> {
  if (!token) return { invite: null };

  // Fetch + update in one round-trip via PostgREST chained syntax.
  const { data: existing } = await db()
    .from("affiliate_email_invites")
    .select("id, referring_installer_id, prospect_email, status, clicked_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (!existing) return { invite: null };

  // Only advance status if it hasn't already moved beyond 'clicked'.
  const shouldAdvance = ["sent", "opened"].includes(existing.status as string);
  const patch: Record<string, unknown> = { clicked_at: new Date().toISOString() };
  if (shouldAdvance) patch.status = "clicked";

  await db()
    .from("affiliate_email_invites")
    .update(patch)
    .eq("invite_token", token);

  return {
    invite: {
      id: existing.id as string,
      referring_installer_id: existing.referring_installer_id as string,
      prospect_email: existing.prospect_email as string,
      status: (existing.status as AffiliateInviteStatus),
    },
  };
}

// ── D. unsubscribeFromAffiliateInvites ─────────────────────────────────────
// Called from the unsubscribe handler. Adds the prospect to
// cold_email_suppressions and flips any active invite rows for that email
// to 'unsubscribed'. Idempotent — second click is a no-op.

export async function unsubscribeFromAffiliateInvites(
  token: string
): Promise<{ success: boolean; prospectEmail?: string; error?: string }> {
  if (!token) return { success: false, error: "Missing token." };

  const { data: invite } = await db()
    .from("affiliate_email_invites")
    .select("id, prospect_email")
    .eq("invite_token", token)
    .maybeSingle();
  if (!invite) return { success: false, error: "Invite not found." };

  const email = (invite.prospect_email as string).toLowerCase();

  // 1. Add to suppressions (ON CONFLICT does nothing).
  const { error: supErr } = await db()
    .from("cold_email_suppressions")
    .upsert(
      {
        email,
        reason: "user_unsubscribe",
        source_invite_id: invite.id as string,
      },
      { onConflict: "email", ignoreDuplicates: true }
    );
  if (supErr) {
    console.error("[Affiliate.invite] suppression insert failed:", supErr);
    // Non-fatal — we still try to flip invite status below.
  }

  // 2. Flip any non-terminal invite rows for this email to 'unsubscribed'.
  await db()
    .from("affiliate_email_invites")
    .update({ status: "unsubscribed" })
    .eq("prospect_email", email)
    .not("status", "in", "(signed_up,unsubscribed,bounced)");

  return { success: true, prospectEmail: email };
}
