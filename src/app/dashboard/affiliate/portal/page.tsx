"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  DollarSign,
  Handshake,
  Link2,
  Loader2,
  Mail,
  Send,
  Sparkles,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import {
  getMyAffiliatePortalData,
  type AffiliatePortalData,
} from "@/app/actions/affiliate-program";
import {
  sendAffiliateInvite,
  getMyAffiliateInvites,
} from "@/app/actions/affiliate-invites";
import {
  formatAgreementConfig,
  formatAgreementDuration,
  type AffiliateEmailInvite,
  type AffiliateInviteStatus,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/affiliate/portal — Private Partner Portal
//
// The privacy-isolation moment from the original brief: every affiliate
// sees ONLY their own terms, recruits, and earnings. The data fetcher
// (getMyAffiliatePortalData) scopes everything to auth.uid(). RLS is the
// defense-in-depth backstop.
//
// Sections rendered:
//   • Hero with one-line cut summary + duration
//   • Earnings (paid + pending) — empty zeroes until Phase 5 wires payouts
//   • Recruits list — empty until Phase 6 wires signup attribution
//   • Refer-an-installer placeholder card — Phase 6 fills this in
//   • Link back to the full agreement document
// ═══════════════════════════════════════════════════════════════════════════

export default function AffiliatePortalPage() {
  const params = useSearchParams();
  const justAccepted = params.get("accepted") === "1";

  const [data, setData] = useState<AffiliatePortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invites (Phase 6) — separate fetch so the form can refresh just this
  // panel after a successful send without re-fetching the whole portal.
  const [invites, setInvites] = useState<AffiliateEmailInvite[]>([]);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Phase 6.6: copy-link button feedback
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleCopyReferralLink(link: string) {
    try {
      if (navigator.share) {
        // On mobile, prefer the native share sheet — opens SMS / Messenger /
        // Facebook / Instagram bio with one tap.
        await navigator.share({
          title: "Storage Network",
          text: "Thought you'd be a fit at Storage Network — install jobs come pre-paid via this link.",
          url: link,
        });
        return;
      }
    } catch {
      // User dismissed the share sheet — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.warn("[AffiliatePortal] copy failed:", err);
    }
  }

  async function refreshInvites() {
    const res = await getMyAffiliateInvites();
    if (!res.error) setInvites(res.invites);
  }

  async function handleSendInvite() {
    setInviteError(null);
    setInviteSuccess(false);
    if (!inviteEmail.trim()) {
      setInviteError("Enter a prospect's email.");
      return;
    }
    setInviteSending(true);
    try {
      const res = await sendAffiliateInvite({
        prospectEmail: inviteEmail.trim(),
        prospectName: inviteName.trim() || undefined,
      });
      if (res.success) {
        setInviteSuccess(true);
        setInviteName("");
        setInviteEmail("");
        await refreshInvites();
        // Auto-collapse the form after a brief success state
        setTimeout(() => { setShowInviteForm(false); setInviteSuccess(false); }, 2000);
      } else {
        setInviteError(res.error || "Could not send the invite.");
      }
    } catch (err) {
      console.error("[AffiliatePortal] invite send failed:", err);
      setInviteError("Something went wrong. Try again.");
    } finally {
      setInviteSending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [portalRes, invitesRes] = await Promise.all([
        getMyAffiliatePortalData(),
        getMyAffiliateInvites(),
      ]);
      if (cancelled) return;
      if (portalRes.error || !portalRes.data) {
        setError(portalRes.error || "Could not load your portal.");
      } else {
        setData(portalRes.data);
      }
      if (!invitesRes.error) setInvites(invitesRes.invites);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          {error}
        </div>
      </Shell>
    );
  }

  // No agreement at all — this user shouldn't be on the portal yet.
  // Send them to apply.
  if (!data?.agreement) {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h1 className="mb-2 text-lg font-bold text-white">Not an affiliate yet</h1>
          <p className="mb-4 text-sm text-stone-400">
            You don&rsquo;t have an affiliate agreement on file. Apply to join the program.
          </p>
          <a
            href="/dashboard/affiliate/apply"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            <Handshake className="h-4 w-4" /> Apply to Be an Affiliate
          </a>
        </div>
      </Shell>
    );
  }

  const agreement = data.agreement;

  // Proposed but not yet accepted — bounce them to the acceptance page.
  if (agreement.status === "proposed") {
    return (
      <Shell>
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">Your agreement is ready</h1>
          </div>
          <p className="mb-4 text-sm text-stone-300">
            We&rsquo;ve drafted a custom agreement. Review and accept to unlock your portal.
          </p>
          <a
            href={`/dashboard/affiliate/agreement/${agreement.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            Review &amp; Accept
          </a>
        </div>
      </Shell>
    );
  }

  // Active — the live portal.
  const summary = formatAgreementConfig(agreement.agreement_config);
  const duration = formatAgreementDuration(agreement.duration_months);
  const acceptedDate = agreement.accepted_at
    ? new Date(agreement.accepted_at).toLocaleDateString()
    : null;
  const activeRecruits = data.recruits.filter((r) => r.is_pro).length;

  return (
    <Shell>
      {justAccepted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-bold text-white">Welcome aboard.</p>
          </div>
          <p className="mt-1 text-xs text-stone-300">
            Your agreement is active. Recruit installers using the tools below — we handle
            the payouts.
          </p>
        </div>
      )}

      {/* Hero — agreement summary */}
      <section className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 to-zinc-900 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Handshake className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Affiliate Portal
          </span>
        </div>
        <p className="text-base font-bold text-white leading-snug">{summary}</p>
        <p className="mt-2 text-[11px] text-stone-400">
          Term: <span className="text-stone-200">{duration}</span>
          {acceptedDate && (
            <> &middot; Accepted {acceptedDate}</>
          )}
        </p>
        <a
          href={`/dashboard/affiliate/agreement/${agreement.id}`}
          className="mt-3 inline-block text-[11px] text-yellow-400 underline-offset-2 hover:underline"
        >
          View full agreement →
        </a>
      </section>

      {/* Earnings */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Earnings
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Paid" value={`$${(data.earnings.total_paid_cents / 100).toFixed(2)}`} />
          <Stat
            label="Pending"
            value={`$${(data.earnings.total_pending_cents / 100).toFixed(2)}`}
            secondary={`${data.earnings.payout_count} payout${data.earnings.payout_count === 1 ? "" : "s"}`}
          />
        </div>
        {data.earnings.payout_count === 0 && (
          <p className="mt-3 text-[11px] text-stone-500">
            Payouts hit your connected Stripe account automatically each time a recruit&rsquo;s
            subscription invoice clears. Nothing to collect manually.
          </p>
        )}
      </section>

      {/* Recruits */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Your Recruits
          </h2>
          <span className="ml-auto text-[11px] text-stone-500">
            {activeRecruits} active &middot; {data.recruits.length} total
          </span>
        </div>
        {data.recruits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-sm text-stone-400">No recruits yet.</p>
            <p className="mt-1 text-[11px] text-stone-500">
              Once an installer signs up through your link or invite, they&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recruits.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{r.name}</p>
                  <p className="text-[11px] text-stone-500">
                    Joined {new Date(r.joined_at).toLocaleDateString()}
                    {r.completed_jobs != null && r.completed_jobs > 0 && (
                      <> &middot; {r.completed_jobs} completed jobs</>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    r.is_pro
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-stone-700/40 text-stone-400"
                  }`}
                >
                  {r.is_pro ? "PRO" : "TRIAL"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phase 6.6 — Public referral link.
          Renders only when the affiliate has a slug. The acceptance flow
          generates one if missing, so this should be present for any
          actively-accepted agreement. The empty state handles the rare
          case (e.g., agreement accepted before Phase 6.6 shipped). */}
      <section className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-zinc-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-yellow-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Your Referral Link
          </h2>
        </div>

        {data.referralLink ? (
          <>
            <p className="mb-3 text-xs text-stone-400">
              Share this anywhere — social, business cards, SMS. Anyone who signs up
              through it attributes back to you for the full agreement term.
            </p>
            <button
              onClick={() => handleCopyReferralLink(data.referralLink!)}
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-left transition-colors hover:border-yellow-400 hover:bg-zinc-800"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-yellow-400">
                {data.referralLink}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 group-hover:text-yellow-400">
                {linkCopied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Share
                  </>
                )}
              </span>
            </button>
            <p className="mt-2 text-[10px] text-stone-500">
              On mobile this opens the share sheet (SMS / Messenger / Facebook). On
              desktop it copies to clipboard.
            </p>
          </>
        ) : (
          <p className="text-sm text-stone-400">
            Your link is being prepared. Refresh in a moment, or accept your agreement if
            you haven&rsquo;t yet.
          </p>
        )}
      </section>

      {/* Refer-an-installer — Phase 6 working invite form + sent list */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-stone-300" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Refer an Installer
          </h2>
          <span className="ml-auto text-[11px] text-stone-500">
            {invites.length} invite{invites.length === 1 ? "" : "s"} sent
          </span>
        </div>

        {!showInviteForm ? (
          <>
            <p className="text-sm text-stone-400">
              Send a personalized invite to an installer you think would be a fit. We email
              them on your behalf with a tracked link &mdash; any signup attributes back to
              you for the full agreement term.
            </p>
            <button
              onClick={() => { setShowInviteForm(true); setInviteSuccess(false); setInviteError(null); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
            >
              <UserPlus className="h-4 w-4" />
              Invite an Installer
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-400">
              The email goes out from <strong className="text-stone-300">your name via Storage Network</strong>.
              Replies route directly back to you.
            </p>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Prospect&rsquo;s name (optional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="First name helps personalize the email"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-yellow-400 focus:outline-none"
                disabled={inviteSending}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Prospect&rsquo;s email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendInvite(); }}
                placeholder="installer@theirbusiness.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-yellow-400 focus:outline-none"
                disabled={inviteSending}
                autoFocus
              />
            </div>

            {inviteError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Invite sent.
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowInviteForm(false); setInviteError(null); }}
                disabled={inviteSending}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-stone-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvite}
                disabled={inviteSending || !inviteEmail.trim()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300 disabled:opacity-50"
              >
                {inviteSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send Invite
              </button>
            </div>

            <p className="text-center text-[10px] text-stone-500">
              Honest recruiting only. The platform&rsquo;s reputation rides on the people you bring in.
            </p>
          </div>
        )}

        {/* Sent invites list */}
        {invites.length > 0 && (
          <div className="mt-5 border-t border-zinc-800 pt-4 space-y-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Sent
            </p>
            {invites.map((inv) => (
              <InviteRow key={inv.id} invite={inv} />
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

// ── Invite row ─────────────────────────────────────────────────────────────

function InviteRow({ invite }: { invite: AffiliateEmailInvite }) {
  const display = invite.prospect_name
    ? `${invite.prospect_name} (${invite.prospect_email})`
    : invite.prospect_email;
  const when = invite.sent_at
    ? new Date(invite.sent_at).toLocaleDateString()
    : new Date(invite.created_at).toLocaleDateString();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white">{display}</p>
        <p className="text-[10px] text-stone-500">Sent {when}</p>
      </div>
      <InvitePill status={invite.status} />
    </div>
  );
}

function InvitePill({ status }: { status: AffiliateInviteStatus }) {
  const map: Record<
    AffiliateInviteStatus,
    { bg: string; fg: string; label: string; icon?: React.ComponentType<{ className?: string }> }
  > = {
    sent:         { bg: "bg-zinc-700/40",   fg: "text-stone-400",   label: "SENT" },
    opened:       { bg: "bg-blue-500/15",    fg: "text-blue-300",    label: "OPENED" },
    clicked:      { bg: "bg-yellow-400/15",  fg: "text-yellow-300",  label: "CLICKED" },
    signed_up:    { bg: "bg-emerald-500/15", fg: "text-emerald-300", label: "JOINED", icon: CheckCircle2 },
    unsubscribed: { bg: "bg-red-500/15",     fg: "text-red-300",     label: "UNSUBSCRIBED", icon: XCircle },
    bounced:      { bg: "bg-red-500/15",     fg: "text-red-300",     label: "BOUNCED", icon: XCircle },
  };
  const s = map[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${s.bg} ${s.fg}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">{children}</main>
    </div>
  );
}

function Stat({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {secondary && <p className="mt-0.5 text-[11px] text-stone-500">{secondary}</p>}
    </div>
  );
}
