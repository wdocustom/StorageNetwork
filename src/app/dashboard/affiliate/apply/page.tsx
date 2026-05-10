"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Handshake,
  Loader2,
  Send,
} from "lucide-react";
import {
  applyToBeAffiliate,
  getMyAffiliateStatus,
} from "@/app/actions/affiliate-program";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/affiliate/apply — Affiliate Application Form
//
// Phase 2. Free-form fields + audience-size bucket + terms checkbox.
// Submit hits applyToBeAffiliate; on success we flip to a confirmation
// state. If the user already has an in-flight application (pending), they
// see that state instead of the form.
// ═══════════════════════════════════════════════════════════════════════════

const AUDIENCE_OPTIONS = [
  { value: "none", label: "Just me", subtitle: "No existing audience yet" },
  { value: "small", label: "Small", subtitle: "Word-of-mouth, a few local installers I know" },
  { value: "medium", label: "Medium", subtitle: "Trade group, social following, or industry list" },
  { value: "large", label: "Large", subtitle: "Several hundred+ installers within reach" },
] as const;

type AudienceSize = (typeof AUDIENCE_OPTIONS)[number]["value"];

export default function AffiliateApplyPage() {
  const router = useRouter();

  // ── Existing-status check ─────────────────────────────────────────────
  // Avoid rendering the form to someone who already has an open
  // application or is already a partner.
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyAffiliateStatus();
      if (cancelled) return;
      if (res.isPartner) {
        setBlockReason(
          "You're already an affiliate partner. Open the Partner Portal to manage your account."
        );
      } else if (res.hasAgreement) {
        setBlockReason("You already have an affiliate agreement on file — no need to apply.");
      } else if (res.application && res.application.status === "pending") {
        setBlockReason(
          "Your application is already in review. We'll respond within 3 business days."
        );
      }
      setLoadingStatus(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Form state ────────────────────────────────────────────────────────
  const [why, setWhy] = useState("");
  const [howToRecruit, setHowToRecruit] = useState("");
  const [audienceSize, setAudienceSize] = useState<AudienceSize | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitError(null);
    if (!why.trim() || !howToRecruit.trim() || !audienceSize || !termsAccepted) {
      setSubmitError("All fields are required, including the agreement checkbox.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await applyToBeAffiliate({
        why,
        howToRecruit,
        audienceSize,
        termsAccepted,
      });
      if (res.success) {
        setSubmitted(true);
      } else {
        setSubmitError(res.error || "Could not submit your application. Try again.");
      }
    } catch (err) {
      console.error("[AffiliateApply]", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-8 backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-7 w-7 text-emerald-400" strokeWidth={3} />
          </div>
          <h1 className="mb-2 text-center text-2xl font-black uppercase tracking-tight text-white">
            Application Received
          </h1>
          <p className="mb-6 text-center text-sm text-stone-400">
            Thanks for applying. We review every application personally — expect a response
            within 3 business days. We&rsquo;ll email you the moment we&rsquo;ve decided.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            Back to Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Blocked-by-status state ───────────────────────────────────────────
  if (blockReason) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-yellow-400/30 bg-slate-900/60 p-8 backdrop-blur-sm">
          <h1 className="mb-2 text-xl font-bold text-white">You&rsquo;re all set</h1>
          <p className="mb-6 text-sm text-stone-400">{blockReason}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            Back to Dashboard
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Default: the form ─────────────────────────────────────────────────
  return (
    <PageShell>
      <div className="space-y-5">
        {/* Intro */}
        <section className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Handshake className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
              Affiliate Application
            </span>
          </div>
          <h1 className="mb-2 text-xl font-bold text-white sm:text-2xl">
            Earn a cut of every installer you recruit
          </h1>
          <p className="text-sm leading-relaxed text-stone-400">
            We approve affiliates personally — no auto-approvals. Tell us a bit about
            you and your reach. If we&rsquo;re a fit, you&rsquo;ll get a custom agreement to
            review and accept. <span className="text-stone-300">Your specific terms stay between you and us.</span>
          </p>
        </section>

        {/* Why */}
        <FormField
          label="Why do you want to be an affiliate?"
          hint="2-3 sentences is plenty. What's drawing you to this?"
        >
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="e.g. I know a bunch of cabinet guys looking for a side stream..."
            maxLength={1000}
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
          />
          <CharCount value={why} max={1000} />
        </FormField>

        {/* How */}
        <FormField
          label="How do you plan to recruit installers?"
          hint="The more specific, the better. Trade groups? Personal network? Social?"
        >
          <textarea
            value={howToRecruit}
            onChange={(e) => setHowToRecruit(e.target.value)}
            placeholder="e.g. I host a monthly meet-up for local trades and have ~30 regulars..."
            maxLength={1000}
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
          />
          <CharCount value={howToRecruit} max={1000} />
        </FormField>

        {/* Audience size */}
        <FormField
          label="Roughly, what's your reach?"
          hint="Doesn't need to be exact. Helps us understand context."
        >
          <div className="space-y-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudienceSize(opt.value)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                  audienceSize === opt.value
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    audienceSize === opt.value
                      ? "border-yellow-400 bg-yellow-400"
                      : "border-slate-500"
                  }`}
                >
                  {audienceSize === opt.value && (
                    <Check className="h-3 w-3 text-slate-900" strokeWidth={3} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{opt.label}</p>
                  <p className="text-xs text-stone-400">{opt.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </FormField>

        {/* Terms */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-slate-600">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-yellow-400"
          />
          <span className="text-xs leading-relaxed text-stone-300">
            I understand each affiliate&rsquo;s agreement is negotiated individually, that approval
            is at the platform&rsquo;s discretion, and that I&rsquo;ll review and accept my specific
            terms in writing before any cuts are earned. I agree to recruit honestly &mdash; no
            spamming, no misrepresentation, no deceptive marketing.
          </span>
        </label>

        {submitError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Application
        </button>

        <p className="text-center text-[11px] text-stone-500">
          We respond personally within 3 business days. No form letters.
        </p>
      </div>
    </PageShell>
  );
}

// ── Layout shell + small UI helpers ─────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="mx-auto max-w-lg">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-400">
        {label}
      </label>
      {hint && <p className="mb-2 text-[11px] text-stone-500">{hint}</p>}
      {children}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="mt-1 text-right text-[10px] text-stone-500">
      {value.length} / {max}
    </p>
  );
}
