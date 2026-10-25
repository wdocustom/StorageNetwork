"use client";

// ═══════════════════════════════════════════════════════════════════════════
// LADDER JIG PLANS — retail offer + gated guide
//
//   /plans/jig                  offer at the regular price
//   /plans/jig?owner=<token>    offer at the plan-owner price ($5) — the
//                               server verifies the tote plan token
//   /plans/jig?session_id=…     back from Stripe: verify, record, email
//   /plans/jig?token=<token>    the purchased guide (permanent link)
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Check, Home, Loader2, Mail, Wrench } from "lucide-react";
import {
  createLadderJigCheckout,
  getLadderJigOffer,
  openLadderJig,
  type LadderJigOffer,
  type OpenLadderJigResult,
} from "@/app/actions/ladder-jig-retail";
import LadderJigGuide, { JigDiagram } from "@/components/plans/LadderJigGuide";
import { LADDER_JIG_NAME, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";
import { formatPlanPrice } from "@/lib/tote-plans";
import { railTopMarks2x4 } from "@/components/visualizer/assemblySteps";
import { CONTACT_EMAIL } from "@/lib/plan-library";

function Header({ homeToken }: { homeToken?: string | null }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <a href="/plans">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
        </a>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-white">{LADDER_JIG_NAME}</h1>
          <p className="text-[10px] text-stone-500">Plans · for 2×4-rail builds</p>
        </div>
        {homeToken && (
          <Link
            href={`/plans/library?token=${homeToken}`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:border-yellow-400/50 hover:text-yellow-300"
          >
            <Home className="h-3.5 w-3.5" />
            My Builds
          </Link>
        )}
      </div>
    </header>
  );
}

const PREVIEW_MARKS = railTopMarks2x4(6);

function Offer({ ownerToken }: { ownerToken: string | null }) {
  const [offer, setOffer] = useState<LadderJigOffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    getLadderJigOffer(ownerToken).then(setOffer);
  }, [ownerToken]);

  const buy = async () => {
    setLoading(true);
    setError("");
    const result = await createLadderJigCheckout(ownerToken);
    if (result.success && result.url) window.location.href = result.url;
    else {
      setError(result.error ?? "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {cancelled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Checkout was cancelled. You can try again below.
        </div>
      )}
      <div className="rounded-2xl border border-yellow-400/30 bg-slate-900 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-yellow-400" />
          <h2 className="text-lg font-black text-white">Build a ladder jig first</h2>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-stone-400">
          {LADDER_JIG_TAGLINE} Lay two uprights in the jig, set each 2×4 rail on its line, screw — no measuring, no
          holding, no drift. Every ladder frame comes out identical, so your whole unit goes together square.
        </p>
        <ul className="mb-5 space-y-1.5">
          {[
            "Cut list and materials for a 37\" × 96\" OSB jig — one sheet of OSB and three 2×4s",
            "Rail lines marked for the 2×4-rail plans — 15-3/4\" apart",
            "Step-by-step build, plus how to use it on every ladder",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 text-xs text-stone-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mb-5 rounded-xl bg-slate-950 p-3 opacity-80">
          <JigDiagram marks={PREVIEW_MARKS} showLabels={false} />
        </div>

        {!offer ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
          </div>
        ) : offer.ownedJigToken ? (
          <Link
            href={`/plans/jig?token=${offer.ownedJigToken}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300"
          >
            You own these — open my jig plans
          </Link>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{formatPlanPrice(offer.price)}</span>
              {offer.ownerDiscount && (
                <>
                  <span className="text-sm text-stone-500 line-through">{formatPlanPrice(offer.regularPrice)}</span>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Plan owner price
                  </span>
                </>
              )}
            </div>
            {error && <p className="mb-2 text-xs font-medium text-red-400">{error}</p>}
            <button
              onClick={buy}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Redirecting…" : `Get the Jig Plans — ${formatPlanPrice(offer.price)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-stone-600">
              One-time purchase · permanent link by email
              {!offer.ownerDiscount && " · $5 when you own a tote organizer plan"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function JigInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const sessionId = searchParams.get("session_id");
  const owner = searchParams.get("owner");
  const [result, setResult] = useState<OpenLadderJigResult | null>(null);
  const started = useRef(false);
  const wantsGuide = !!(token || sessionId);

  useEffect(() => {
    if (!wantsGuide || started.current) return;
    started.current = true;
    openLadderJig(token ? { token } : { sessionId: sessionId! }).then((res) => {
      setResult(res);
      if (res.ok && sessionId) router.replace(`/plans/jig?token=${res.token}`);
    });
  }, [wantsGuide, token, sessionId, router]);

  const homeToken = result?.ok ? result.token : owner;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header homeToken={homeToken} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {!wantsGuide ? (
          <Offer ownerToken={owner} />
        ) : !result ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        ) : !result.ok ? (
          <div className="rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="mb-4 text-sm text-stone-400">{result.error}</p>
            <Link href="/plans" className="text-sm font-bold text-yellow-400">
              Back to Plans
            </Link>
          </div>
        ) : (
          <>
            {result.emailSentTo && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300">
                <strong>Check your email</strong> — we sent your permanent link to {result.emailSentTo}.
              </div>
            )}
            <LadderJigGuide content={result.content} />
          </>
        )}
        <p className="pt-2 text-center text-[11px] text-stone-600">
          Questions?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 text-stone-400 underline hover:text-stone-200">
            <Mail className="h-3 w-3" />
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}

export default function LadderJigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      }
    >
      <JigInner />
    </Suspense>
  );
}
