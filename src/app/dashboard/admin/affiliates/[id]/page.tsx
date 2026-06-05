"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Trash2,
  Plus,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  getApplicationDetail,
  rejectAffiliateApplication,
  proposeAffiliateAgreement,
  type AdminApplicationDetail,
} from "@/app/actions/affiliate-program";
import type {
  AgreementConfig,
  AgreementConfigTier,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/admin/affiliates/[id] — Application detail + agreement editor
//
// Admin views the full application payload, then either rejects or opens
// the agreement editor and proposes terms. The agreement editor models the
// three cut shapes (flat / percentage / tiered) from the Phase 1 schema.
// On propose the applicant gets the "approved — review your agreement"
// email; their acceptance flow lands in Phase 4.
// ═══════════════════════════════════════════════════════════════════════════

type CutType = "flat" | "percentage" | "tiered";

const DEFAULT_TERMS = `# Affiliate Agreement

Thank you for joining our affiliate program. This agreement covers:

- The cut you earn on installers you successfully recruit who become and remain Pro subscribers.
- The duration of those earnings.
- Your obligations as an affiliate: honest recruiting, no spam, no misrepresentation, and good-faith referrals only.

Either party may terminate this agreement at any time with reasonable notice. Termination ends future cuts but does not claw back already-earned amounts.

By accepting this agreement, you confirm you understand the cut structure shown above and agree to recruit installers honestly and in good faith.`;

export default function AdminAffiliateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await getApplicationDetail(applicationId);
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
    const res = await rejectAffiliateApplication({
      applicationId,
      internalNotes: rejectNotes.trim() || undefined,
    });
    setRejectInFlight(false);
    if (res.success) {
      router.push("/dashboard/admin/affiliates");
    } else {
      alert(res.error || "Could not reject.");
    }
  }

  // ── Approve / agreement editor state ────────────────────────────────
  const [cutType, setCutType] = useState<CutType>("flat");
  const [flatAmountDollars, setFlatAmountDollars] = useState<number>(35);
  const [flatBasis, setFlatBasis] = useState<"per_active_recruit_per_month" | "per_invoice">(
    "per_active_recruit_per_month"
  );
  const [percent, setPercent] = useState<number>(30);
  const [tiers, setTiers] = useState<{ maxActive: number | null; amountDollars: number }[]>([
    { maxActive: 25, amountDollars: 35 },
    { maxActive: null, amountDollars: 25 },
  ]);
  const [signupBonusDollars, setSignupBonusDollars] = useState<number>(0);
  const [durationMonths, setDurationMonths] = useState<number | null>(null); // null = lifetime
  const [termsMarkdown, setTermsMarkdown] = useState<string>(DEFAULT_TERMS);
  const [internalNotes, setInternalNotes] = useState("");

  const [proposeInFlight, setProposeInFlight] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  function buildAgreementConfig(): AgreementConfig {
    const signup = signupBonusDollars > 0
      ? { signup_bonus_cents: Math.round(signupBonusDollars * 100) }
      : {};
    if (cutType === "flat") {
      return {
        type: "flat",
        flat_amount_cents: Math.round(flatAmountDollars * 100),
        flat_basis: flatBasis,
        ...signup,
      };
    }
    if (cutType === "percentage") {
      return {
        type: "percentage",
        percent,
        ...signup,
      };
    }
    return {
      type: "tiered",
      tiers: tiers.map<AgreementConfigTier>((t) => ({
        max_active: t.maxActive,
        amount_cents: Math.round(t.amountDollars * 100),
      })),
      basis: "per_active_recruit_per_month",
      ...signup,
    };
  }

  async function handlePropose() {
    setProposeError(null);
    setProposeInFlight(true);
    try {
      const res = await proposeAffiliateAgreement({
        applicationId,
        agreementConfig: buildAgreementConfig(),
        durationMonths,
        termsMarkdown,
        internalNotes: internalNotes.trim() || undefined,
      });
      if (res.success) {
        router.push("/dashboard/admin/affiliates");
      } else {
        setProposeError(res.error || "Could not propose the agreement.");
      }
    } catch (err) {
      console.error("[AdminAffiliateDetail]", err);
      setProposeError("Something went wrong. Try again.");
    } finally {
      setProposeInFlight(false);
    }
  }

  // ── Tier editor helpers ─────────────────────────────────────────────
  function addTier() {
    // New tier inserted before the last (open-ended) tier.
    setTiers((prev) => {
      const newTier = { maxActive: 50, amountDollars: 30 };
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), newTier, last];
    });
  }
  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateTier(i: number, patch: Partial<{ maxActive: number | null; amountDollars: number }>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
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
  const why = String((detail.application_data as { why?: unknown })?.why ?? "");
  const howToRecruit = String(
    (detail.application_data as { how_to_recruit?: unknown })?.how_to_recruit ?? ""
  );
  const audience = String(
    (detail.application_data as { audience_size?: unknown })?.audience_size ?? "—"
  );

  const canAct = detail.status === "pending";

  return (
    <Shell>
      {/* Applicant header */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
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
              {detail.applicant.completed_jobs != null && (
                <span>{detail.applicant.completed_jobs} completed jobs</span>
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
              Terminate it before approving a new application.
            </p>
          </div>
        </div>
      )}

      {/* Application payload */}
      <Section title="Why">
        <Paragraph value={why} />
      </Section>
      <Section title="How they plan to recruit">
        <Paragraph value={howToRecruit} />
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
          {/* Agreement Editor */}
          <section className="rounded-2xl border border-yellow-400/30 bg-zinc-900/40 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
              Propose Agreement
            </h2>

            {/* Cut type */}
            <Field label="Cut type">
              <div className="grid grid-cols-3 gap-2">
                {(["flat", "percentage", "tiered"] as CutType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCutType(t)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                      cutType === t
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-zinc-700 bg-zinc-900 text-stone-400 hover:border-zinc-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            {/* Flat */}
            {cutType === "flat" && (
              <>
                <Field label="Amount (USD)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={flatAmountDollars}
                    onChange={(e) => setFlatAmountDollars(parseFloat(e.target.value) || 0)}
                    className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                  />
                </Field>
                <Field label="Basis">
                  <select
                    value={flatBasis}
                    onChange={(e) =>
                      setFlatBasis(e.target.value as "per_active_recruit_per_month" | "per_invoice")
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="per_active_recruit_per_month">
                      Per active recruit, per month
                    </option>
                    <option value="per_invoice">Per recruit invoice paid</option>
                  </select>
                </Field>
              </>
            )}

            {/* Percentage */}
            {cutType === "percentage" && (
              <Field label="Percent of subscription invoice">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={percent}
                    onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                    className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                  />
                  <span className="text-sm text-stone-400">%</span>
                </div>
              </Field>
            )}

            {/* Tiered */}
            {cutType === "tiered" && (
              <Field label="Tiers (ascending; last tier must be open-ended)">
                <div className="space-y-2">
                  {tiers.map((t, i) => {
                    const isLast = i === tiers.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[11px] text-stone-500">
                          Tier {i + 1}
                        </span>
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                          <span className="text-[11px] text-stone-500">Up to</span>
                          {isLast ? (
                            <span className="text-sm font-bold text-yellow-400">unlimited</span>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              value={t.maxActive ?? 0}
                              onChange={(e) =>
                                updateTier(i, { maxActive: parseInt(e.target.value) || 1 })
                              }
                              className="w-20 bg-transparent text-sm text-white focus:outline-none"
                            />
                          )}
                          <span className="text-[11px] text-stone-500">@</span>
                          <span className="text-stone-500">$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={t.amountDollars}
                            onChange={(e) =>
                              updateTier(i, { amountDollars: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 bg-transparent text-sm text-white focus:outline-none"
                          />
                          <span className="text-[11px] text-stone-500">/mo</span>
                        </div>
                        {!isLast && tiers.length > 2 && (
                          <button
                            onClick={() => removeTier(i)}
                            className="rounded-lg p-1.5 text-stone-500 hover:bg-zinc-800 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={addTier}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs text-stone-400 hover:border-yellow-400 hover:text-yellow-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add tier
                  </button>
                </div>
              </Field>
            )}

            {/* Optional signup bonus */}
            <Field label="Optional one-time signup bonus (paid on first recruit invoice)">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={signupBonusDollars}
                  onChange={(e) => setSignupBonusDollars(parseFloat(e.target.value) || 0)}
                  className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </Field>

            {/* Duration */}
            <Field label="Duration">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDurationMonths(null)}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    durationMonths === null
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                      : "border-zinc-700 bg-zinc-900 text-stone-400 hover:border-zinc-600"
                  }`}
                >
                  Lifetime
                </button>
                <span className="text-xs text-stone-500">or</span>
                <input
                  type="number"
                  min={1}
                  value={durationMonths ?? ""}
                  placeholder="N"
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setDurationMonths(Number.isFinite(v) && v > 0 ? v : null);
                  }}
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
                <span className="text-xs text-stone-400">months</span>
              </div>
            </Field>

            {/* Terms markdown */}
            <Field label="Agreement body (shown to applicant on acceptance page)">
              <textarea
                value={termsMarkdown}
                onChange={(e) => setTermsMarkdown(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-white focus:border-yellow-400 focus:outline-none"
              />
            </Field>

            {/* Internal notes */}
            <Field label="Internal notes (admin-only, never shown to applicant)">
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                placeholder="Optional context for future you."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-yellow-400 focus:outline-none"
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
          <section className="rounded-2xl border border-red-900/40 bg-zinc-900/40 p-5">
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-yellow-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRejectOpen(false)}
                    disabled={rejectInFlight}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-stone-400 hover:bg-zinc-800"
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
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-stone-400">
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a
            href="/dashboard/admin/affiliates"
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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
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

function StatusBadge({ status }: { status: AdminApplicationDetail["status"] }) {
  const map = {
    pending: { bg: "bg-yellow-400/15", fg: "text-yellow-400" },
    approved: { bg: "bg-emerald-500/15", fg: "text-emerald-400" },
    rejected: { bg: "bg-red-500/15", fg: "text-red-400" },
    withdrawn: { bg: "bg-zinc-700/40", fg: "text-stone-400" },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${s.bg} ${s.fg}`}>
      {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
      <span className="uppercase tracking-wider">{status}</span>
    </span>
  );
}
