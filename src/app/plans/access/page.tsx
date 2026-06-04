"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyAndCreatePlanAccess, validatePlanToken } from "@/app/actions/public-plans";
import { getPlanById } from "@/lib/plans-config";
import { Loader2, CheckCircle, AlertCircle, Maximize2, BookOpen } from "lucide-react";
import Image from "next/image";

function PlansAccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [token, setToken] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const tokenParam = searchParams.get("token");
    const sessionId = searchParams.get("session_id");
    const planIdParam = searchParams.get("plan_id");

    async function init() {
      if (tokenParam) {
        // Return visit via email link
        const result = await validatePlanToken(tokenParam);
        if (result.valid && result.planId) {
          setToken(tokenParam);
          setPlanId(result.planId);
          setState("ready");
        } else {
          setErrorMsg("This link is invalid or has expired.");
          setState("error");
        }
      } else if (sessionId && planIdParam) {
        // Post-purchase redirect from Stripe
        const result = await verifyAndCreatePlanAccess(sessionId, planIdParam);
        if (result.success && result.token) {
          setToken(result.token);
          setPlanId(planIdParam);
          setBuyerEmail(result.email ?? null);
          setState("ready");
          // Replace URL with permanent token link (removes session_id from history)
          router.replace(`/plans/access?token=${result.token}`);
        } else {
          setErrorMsg(result.error ?? "Could not verify payment.");
          setState("error");
        }
      } else {
        router.replace("/plans");
      }
    }

    init();
  }, [searchParams, router]);

  const plan = planId ? getPlanById(planId) : null;
  const viewUrl = token && planId ? `/api/plans/view?token=${token}&plan_id=${encodeURIComponent(planId)}` : null;

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-yellow-400" />
          <p className="text-sm text-stone-500">Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <h2 className="mb-2 text-base font-bold text-white">Access denied</h2>
          <p className="mb-5 text-sm text-stone-500">{errorMsg}</p>
          <a
            href="/plans"
            className="block rounded-xl bg-yellow-400 py-3 text-sm font-bold text-gray-950 transition hover:bg-yellow-300"
          >
            Back to Plans
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 ${fullscreen ? "p-0" : "p-0"}`}>
      {/* ── Header ───────────────────────────────────────────────── */}
      {!fullscreen && (
        <header className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <a href="/plans">
              <Image
                src="/landing_page_logo.png"
                alt="Storage Network"
                width={36}
                height={36}
                className="rounded"
              />
            </a>
            <div className="flex-1 min-w-0">
              {plan && (
                <div>
                  <p className="text-xs font-bold text-white truncate">{plan.name}</p>
                  <p className="text-[10px] text-stone-500">Build Plans</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {buyerEmail && (
                <div className="hidden items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 sm:flex">
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-400">
                    Sent to {buyerEmail}
                  </span>
                </div>
              )}
              <button
                onClick={() => setFullscreen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:bg-slate-700 hover:text-white"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Full Screen</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Email confirmation banner (first-time purchase) ──────── */}
      {!fullscreen && buyerEmail && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs text-emerald-300">
              <strong>Check your email</strong> — we sent your permanent access link to{" "}
              <span className="font-semibold">{buyerEmail}</span>.{" "}
              Bookmark this page or save the email to return anytime.
            </p>
          </div>
        </div>
      )}

      {/* ── Plans iframe ─────────────────────────────────────────── */}
      {viewUrl && (
        <div className={fullscreen ? "fixed inset-0 z-50 bg-white" : "relative"}>
          {fullscreen && (
            <button
              onClick={() => setFullscreen(false)}
              className="absolute right-4 top-4 z-10 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800"
            >
              ✕ Exit Full Screen
            </button>
          )}
          <iframe
            ref={iframeRef}
            src={viewUrl}
            className={fullscreen ? "h-screen w-full border-0" : "w-full border-0"}
            style={fullscreen ? undefined : { height: "calc(100vh - 120px)", minHeight: 600 }}
            title={plan?.name ?? "Build Plans"}
          />
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      {!fullscreen && (
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] text-stone-600">
              <BookOpen className="h-3 w-3" />
              <span>Your plans are available any time via your email link.</span>
            </div>
            <a
              href="/plans"
              className="text-[10px] font-semibold text-stone-500 transition hover:text-stone-300"
            >
              Browse more plans →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlansAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      }
    >
      <PlansAccessContent />
    </Suspense>
  );
}
