"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  getPromoterApplicationDetail,
  rejectPromoterApplication,
  proposePromoterAgreement,
  type AdminPromoterApplicationDetail,
} from "@/app/actions/admin-promoter-management";
import type { PromoterApplicationStatus } from "@/types/promoter";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/admin/promoters/[id] — Application detail + agreement editor
//
// Mirrors /dashboard/admin/affiliates/[id], simplified to the single
// percentage-of-sale shape used by the promoter program. The percent here
// is the INDIVIDUALIZED split — set per-promoter based on what was
// negotiated. On propose, the applicant gets a private agreement to review
// and accept; their acceptance flips profiles.is_promoter and lights up
// their portal + referral link.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TERMS = `# Promoter Agreement

Thank you for joining the Storage Network promoter program. This agreement covers:

- The percentage you earn on every plan sale that comes through your referral link.
- How and when you're paid (directly to your connected Stripe account, automatically).
- Your obligations as a promoter: honest promotion, no spam, no misrepresentation, and good-faith referrals only.

Either party may terminate this agreement at any time with reasonable notice. Termination ends future commissions but does not claw back already-earned amounts.

By accepting this agreement, you confirm you understand the commission rate shown above and agree to promote honestly and in good faith.`;

export default function AdminPromoterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [detail, setDetail] = useState<AdminPromoterApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await getPromoterApplicationDetail(applicationId);
    if (res.error || !res.detail) {
      setLoadError(res.error || "Application not found.");
    } else {
      setDetail(res.detail);
    }
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Reject flow state ───────────────────────────────────────────────
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectInFlight, setRejectInFlight] = useState(false);

  async function handleReject() {
    setRejectInFlight(true);
    const res = await rejectPromoterApplication({
      applicationId,
      internalNotes: rejectNotes.trim() || undefined,
    });
    setRejectInFlight(false);
    if (res.success) {
      router.push("/dashboard/admin/promoters");
    } else {
      alert(res.error || "Could not reject.");
    }
  }

  // ── Propose-agreement editor state ──────────────────────────────────
  const [percent, setPercent] = useState<number>(15);
  const [termsMarkdown, setTermsMarkdown] = useState<string>(DEFAULT_TERMS);
  const [internalNotes, setInternalNotes] = useState("");

  const [proposeInFlight, setProposeInFlight] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  async function handlePropose() {
    setProposeError(null);
    setProposeInFlight(true);
    try {
      const res = await proposePromoterAgreement({
        applicationId,
        percent,
        termsMarkdown,
        internalNotes: internalNotes.trim() || undefined,
      });
      if (res.success) {
        router.push("/dashboard/admin/promoters");
      } else {
        setProposeError(res.error || "Could not propose the agreement.");
      }
    } catch (err) {
      console.error("[AdminPromoterDetail]", err);
      setProposeError("Something went wrong. Try again.");
    } finally {
      setProposeInFlight(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          {loadError || "Application not found."}
        </div>
      </Shell>
    );
  }

  const applicantName =
    detail.applicant.business_name ||
    [detail.applicant.first_name, detail.applicant.last_name].filter(Boolean).join(" ") ||
    "Unnamed installer";
  const howToPromote = String(
    (detail.application_data as { how_to_promote?: unknown })?.how_to_promote ?? ""
  );
  const audience = String(
    (detail.application_data as { audience_size?: unknown })?.audience_size ?? "—"
  );

  const canAct = detail.status === "pending";

  return (
    <Shell>
      {/* Applicant header */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-500">Applicant</p>
            <p className="text-lg font-bold text-white">{applicantName}</p>
            <p className="text-xs text-stone-400">{detail.applicant.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
              <StatusBadge status={detail.status} />
              {detail.applicant.is_pro && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">
                  PRO
                </span>
              )}
              <span>Submitted {new Date(detail.submitted_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Already-has-agreement banner */}
      {detail.existing_agreement && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 text-xs text-yellow-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Applicant already has a <strong>{detail.existing_agreement.status}</strong> agreement.
              Terminate it before proposing a new one.
            </p>
          </div>
        </div>
      )}

      {/* Application payload */}
      <Section title="How they plan to promote">
        <Paragraph value={howToPromote} />
      </Section>
      <Section title="Audience size">
        <p className="text-sm font-bold capitalize text-yellow-400">{audience}</p>
      </Section>

      {detail.reviewed_at && detail.review_notes && (
        <Section title="Internal review notes">
          <Paragraph value={detail.review_notes} muted />
        </Section>
      )}

      {/* Approve / reject actions — only when pending and no existing agreement */}
      {canAct && !detail.existing_agreement && (
        <>
          <section className="rounded-2xl border border-yellow-400/30 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
              Propose Agreement
            </h2>

            <Field label="Commission — percent of each referred sale (individualized)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={100}
                  step="0.5"
                  value={percent}
                  onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                  className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
                <span className="text-sm text-stone-400">%</span>
              </div>
              <p className="mt-1.5 text-[11px] text-stone-500">
                Set this per the terms you negotiated with this person — every promoter can
                have a different rate.
              </p>
            </Field>

            <Field label="Agreement body (shown to applicant on acceptance page)">
              <textarea
                value={termsMarkdown}
                onChange={(e) => setTermsMarkdown(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white focus:border-yellow-400 focus:outline-none"
              />
            </Field>

            <Field label="Internal notes (admin-only, never shown to applicant)">
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                placeholder="Optional context for future you."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
              />
            </Field>

            {proposeError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {proposeError}
              </div>
            )}

            <button
              onClick={handlePropose}
              disabled={proposeInFlight}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300 disabled:opacity-50"
            >
              {proposeInFlight ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Approve &amp; Send Agreement
            </button>
          </section>

          {/* Reject panel — separate destructive action */}
          <section className="rounded-2xl border border-red-900/40 bg-slate-900/40 p-5">
            {!rejectOpen ? (
              <button
                onClick={() => setRejectOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/50 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4" />
                Reject Application
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">Reject this application?</p>
                <p className="text-xs text-stone-400">
                  The applicant gets a courteous &ldquo;not at this time&rdquo; email. Your internal
                  notes stay private.
                </p>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes (private)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRejectOpen(false)}
                    disabled={rejectInFlight}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-stone-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectInFlight}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {rejectInFlight ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    Confirm Reject
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Already-acted note */}
      {!canAct && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-xs text-stone-400">
          This application is <strong className="text-white">{detail.status}</strong>. No further
          action available.
        </div>
      )}
    </Shell>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a
            href="/dashboard/admin/promoters"
            className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Queue
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">{children}</main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">{title}</p>
      {children}
    </section>
  );
}

function Paragraph({ value, muted = false }: { value: string; muted?: boolean }) {
  return (
    <p
      className={`whitespace-pre-wrap text-sm leading-relaxed ${
        muted ? "text-stone-400" : "text-white"
      }`}
    >
      {value || <span className="italic text-stone-500">—</span>}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: PromoterApplicationStatus }) {
  const map: Record<PromoterApplicationStatus, { bg: string; fg: string }> = {
    pending: { bg: "bg-yellow-400/15", fg: "text-yellow-400" },
    approved: { bg: "bg-emerald-500/15", fg: "text-emerald-400" },
    rejected: { bg: "bg-red-500/15", fg: "text-red-400" },
    withdrawn: { bg: "bg-slate-700/40", fg: "text-stone-400" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${s.bg} ${s.fg}`}>
      {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
      <span className="uppercase tracking-wider">{status}</span>
    </span>
  );
}
