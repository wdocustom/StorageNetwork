"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  Lock,
  Send,
  Sparkles,
} from "lucide-react";
import {
  getMyAgreement,
  acceptMyAgreement,
} from "@/app/actions/affiliate-program";
import {
  formatAgreementConfig,
  formatAgreementDuration,
  type AffiliateAgreement,
} from "@/types/affiliate";

// ═══════════════════════════════════════════════════════════════════════════
// /dashboard/affiliate/agreement/[id] — Review & Accept
//
// The applicant lands here from the "review your agreement" email. We show:
//   • A plain-English summary of the cut (formatted from agreement_config)
//   • Duration (lifetime or N months)
//   • Optional one-time signup bonus (rendered inline by formatAgreementConfig)
//   • The full terms_markdown body
//   • An acceptance checkbox + accept button
//
// Privacy: getMyAgreement() returns null if the agreement doesn't belong to
// the calling user. Page renders a generic "not found" — no hint about
// whether it exists for someone else.
// ═══════════════════════════════════════════════════════════════════════════

export default function AcceptAgreementPage() {
  const params = useParams();
  const router = useRouter();
  const agreementId = params.id as string;

  const [agreement, setAgreement] = useState<AffiliateAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [confirmed, setConfirmed] = useState(false);
  const [acceptInFlight, setAcceptInFlight] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyAgreement(agreementId);
      if (cancelled) return;
      if (res.error || !res.agreement) {
        setLoadError(res.error || "Agreement not found.");
      } else {
        setAgreement(res.agreement);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [agreementId]);

  async function handleAccept() {
    if (!agreement) return;
    setAcceptError(null);
    setAcceptInFlight(true);
    try {
      const res = await acceptMyAgreement(agreement.id);
      if (res.success) {
        // Send them straight to their freshly-lit-up portal.
        router.push("/dashboard/affiliate/portal?accepted=1");
      } else {
        setAcceptError(res.error || "Could not accept the agreement. Try again.");
      }
    } catch (err) {
      console.error("[AcceptAgreement]", err);
      setAcceptError("Something went wrong. Try again.");
    } finally {
      setAcceptInFlight(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (loadError || !agreement) {
    return (
      <Shell>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          {loadError || "Agreement not found."}
        </div>
      </Shell>
    );
  }

  // ── Status branches ────────────────────────────────────────────────
  if (agreement.status === "active") {
    return (
      <Shell>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold text-white">Already accepted</h1>
          </div>
          <p className="mb-4 text-sm text-stone-300">
            Your agreement is active. Open your partner portal to manage your recruits.
          </p>
          <a
            href="/dashboard/affiliate/portal"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300"
          >
            <Handshake className="h-4 w-4" /> Open Partner Portal
          </a>
        </div>
      </Shell>
    );
  }

  if (agreement.status === "terminated" || agreement.status === "paused") {
    return (
      <Shell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-stone-400" />
            <h1 className="text-lg font-bold text-white">
              Agreement {agreement.status === "terminated" ? "terminated" : "paused"}
            </h1>
          </div>
          <p className="text-sm text-stone-400">
            This agreement is no longer accepting changes. Reach out to support if you have
            questions.
          </p>
        </div>
      </Shell>
    );
  }

  // ── status === 'proposed' — the review/accept UI ──────────────────────
  const summary = formatAgreementConfig(agreement.agreement_config);
  const duration = formatAgreementDuration(agreement.duration_months);

  return (
    <Shell>
      {/* Hero */}
      <section className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/5 to-zinc-900 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Affiliate Agreement
          </span>
        </div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          Your custom terms
        </h1>
        <p className="mt-1 text-xs text-stone-400">
          Read carefully. Accept once you&rsquo;re comfortable. These terms are private to you —
          no other affiliate sees them.
        </p>
      </section>

      {/* Cut summary card */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          Your cut
        </p>
        <p className="mt-1 text-base font-bold text-white leading-snug">{summary}</p>
      </section>

      {/* Duration card */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-stone-400" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Term
          </p>
        </div>
        <p className="mt-1 text-base font-bold text-white">{duration}</p>
        {agreement.duration_months !== null && (
          <p className="mt-1 text-[11px] text-stone-500">
            Earnings on each recruit run for the agreement&rsquo;s term, measured from the day
            you accept.
          </p>
        )}
      </section>

      {/* Terms body */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Full agreement
        </p>
        <div className="prose-affiliate">
          <SimpleMarkdown source={agreement.terms_markdown || ""} />
        </div>
      </section>

      {/* Acceptance */}
      <section className="rounded-2xl border border-yellow-400/30 bg-zinc-900/40 p-5 space-y-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-yellow-400"
          />
          <span className="text-xs leading-relaxed text-stone-200">
            I&rsquo;ve read this agreement and I accept the cut structure, term, and obligations
            as written. I&rsquo;ll recruit honestly &mdash; no spam, no misrepresentation,
            good-faith referrals only.
          </span>
        </label>

        {acceptError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {acceptError}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={!confirmed || acceptInFlight}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {acceptInFlight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Accept Agreement
        </button>

        <p className="text-center text-[11px] text-stone-500">
          You can revoke or renegotiate any time by reaching out to support.
        </p>
      </section>
    </Shell>
  );
}

// ── Layout shell ───────────────────────────────────────────────────────────

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
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">{children}</main>
    </div>
  );
}

// ── Tiny markdown renderer ─────────────────────────────────────────────────
// Handles the subset used by the boilerplate agreement template:
//   - # / ## / ### headings
//   - blank-line-separated paragraphs
//   - `- item` bullet lists
//   - **bold** inline emphasis
//
// Avoids pulling in a runtime markdown library for a few hundred bytes
// of contract text. Escapes raw HTML defensively.

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(s: string): string {
  const escaped = escapeHtmlText(s);
  // **bold**
  return escaped.replace(
    /\*\*([^*]+?)\*\*/g,
    '<strong style="color:#ffffff;font-weight:700;">$1</strong>'
  );
}

function SimpleMarkdown({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm italic text-stone-500">(No additional terms.)</p>;
  }

  const lines = source.split(/\r?\n/);
  const out: { kind: string; html: string; level?: number }[] = [];
  let buffer: string[] = [];
  let bulletBuffer: string[] = [];

  function flushParagraph() {
    if (buffer.length) {
      out.push({ kind: "p", html: buffer.map(renderInline).join(" ") });
      buffer = [];
    }
  }
  function flushBullets() {
    if (bulletBuffer.length) {
      const items = bulletBuffer.map((b) => `<li>${renderInline(b)}</li>`).join("");
      out.push({ kind: "ul", html: `<ul>${items}</ul>` });
      bulletBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
      continue;
    }
    if (/^### /.test(line)) {
      flushParagraph(); flushBullets();
      out.push({ kind: "h", level: 3, html: renderInline(line.replace(/^### /, "")) });
      continue;
    }
    if (/^## /.test(line)) {
      flushParagraph(); flushBullets();
      out.push({ kind: "h", level: 2, html: renderInline(line.replace(/^## /, "")) });
      continue;
    }
    if (/^# /.test(line)) {
      flushParagraph(); flushBullets();
      out.push({ kind: "h", level: 1, html: renderInline(line.replace(/^# /, "")) });
      continue;
    }
    if (/^[-*] /.test(line)) {
      flushParagraph();
      bulletBuffer.push(line.replace(/^[-*] /, ""));
      continue;
    }
    flushBullets();
    buffer.push(line);
  }
  flushParagraph();
  flushBullets();

  return (
    <>
      {out.map((block, i) => {
        if (block.kind === "h") {
          const sizeClass =
            block.level === 1
              ? "text-lg font-bold text-white mt-4 mb-2"
              : block.level === 2
                ? "text-base font-bold text-white mt-3 mb-1.5"
                : "text-sm font-bold text-white mt-3 mb-1";
          return (
            <p
              key={i}
              className={sizeClass}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.kind === "ul") {
          return (
            <ul
              key={i}
              className="ml-5 my-2 list-disc text-sm text-stone-300 space-y-1"
              dangerouslySetInnerHTML={{ __html: block.html.replace(/^<ul>|<\/ul>$/g, "") }}
            />
          );
        }
        return (
          <p
            key={i}
            className="my-2 text-sm text-stone-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );
      })}
    </>
  );
}
