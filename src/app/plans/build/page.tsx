"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MY BUILD — retail customer's home for a purchased tote organizer plan
//
//   /plans/build?session_id=…  first visit from Stripe (verified server-side)
//   /plans/build?token=…       permanent link from the purchase email
//   /plans/build?access=pro&config=…  Pro installers / admins
//
// Delivers both products:
//   • Printable PDF — every guide step rendered offscreen, then jsPDF
//   • Interactive 3D Build Guide — the installer AssemblyGuide, full screen
//     (PDF-tier buyers see an upgrade for the price difference)
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  AlertCircle,
  Box,
  CheckCircle,
  Crown,
  Download,
  FileText,
  Loader2,
  Lock,
  Play,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import {
  openTotePlan,
  createTotePlanUpgradeCheckout,
  type OpenTotePlanInput,
  type OpenTotePlanResult,
} from "@/app/actions/tote-plan-access";
import {
  TOTE_PLAN_TIERS,
  TOTE_PLAN_UPGRADE_PRICE,
  decodeTotePlanConfig,
  formatPlanPrice,
  totePlanSummary,
} from "@/lib/tote-plans";
import type { AssemblyStepSnapshot } from "@/components/visualizer/AssemblyGuide";

const AssemblyGuide = dynamic(() => import("@/components/visualizer/AssemblyGuide"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
    </div>
  ),
});

const AssemblyStepSnapshots = dynamic(
  () => import("@/components/visualizer/AssemblyGuide").then((m) => m.AssemblyStepSnapshots),
  { ssr: false },
);

type Ready = Extract<OpenTotePlanResult, { ok: true }>;

// ── PDF card ─────────────────────────────────────────────────────────────

type PdfState =
  | { phase: "idle" }
  | { phase: "rendering"; done: number; total: number }
  | { phase: "writing" }
  | { phase: "done" }
  | { phase: "error" };

function PdfCard({ data }: { data: Ready }) {
  const [state, setState] = useState<PdfState>({ phase: "idle" });
  const snapshotsRef = useRef<AssemblyStepSnapshot[] | null>(null);

  const writePdf = useCallback(
    async (snapshots: AssemblyStepSnapshot[]) => {
      setState({ phase: "writing" });
      try {
        const { downloadDIYPDF } = await import("@/lib/diy-pdf-generator");
        downloadDIYPDF({ plan: data.plan, snapshots });
        setState({ phase: "done" });
      } catch (err) {
        console.error("[BuildPlan] PDF generation failed:", err);
        setState({ phase: "error" });
      }
    },
    [data.plan],
  );

  const handleSnapshots = useCallback(
    (snapshots: AssemblyStepSnapshot[]) => {
      snapshotsRef.current = snapshots;
      writePdf(snapshots);
    },
    [writePdf],
  );

  const handleProgress = useCallback((done: number, total: number) => {
    setState({ phase: "rendering", done, total });
  }, []);

  const start = () => {
    if (snapshotsRef.current) {
      writePdf(snapshotsRef.current);
      return;
    }
    setState({ phase: "rendering", done: 0, total: data.plan.assemblySteps.length });
  };

  const busy = state.phase === "rendering" || state.phase === "writing";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      {state.phase === "rendering" && (
        <AssemblyStepSnapshots
          cols={data.config.cols}
          rows={data.config.rows}
          toteType={data.config.toteType}
          hasWheels={data.config.hasWheels}
          hasTop={data.config.hasTop}
          onProgress={handleProgress}
          onComplete={handleSnapshots}
        />
      )}

      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-white">Printable PDF Plan</h2>
      </div>
      <p className="mb-4 text-xs text-stone-400">
        {data.plan.assemblySteps.length} illustrated steps, cut diagrams, shopping and tool checklists.
        Prints on US Letter.
      </p>

      {state.phase === "rendering" && (
        <div className="mb-3">
          <div className="mb-1.5 flex justify-between text-[11px] text-stone-400">
            <span>Rendering step {Math.min(state.done + 1, state.total)} of {state.total}…</span>
            <span>{Math.round((state.done / state.total) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-yellow-400 transition-all"
              style={{ width: `${(state.done / state.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      {state.phase === "error" && (
        <p className="mb-3 text-xs font-medium text-red-400">
          Something went wrong building the PDF. Please try again.
        </p>
      )}

      <button
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {state.phase === "writing"
          ? "Building PDF…"
          : state.phase === "rendering"
            ? "Rendering…"
            : state.phase === "done"
              ? "Download Again"
              : "Download PDF"}
      </button>
      {state.phase === "rendering" && (
        <p className="mt-2 text-center text-[10px] text-stone-600">Keep this tab open — about 10 seconds.</p>
      )}
    </div>
  );
}

// ── Interactive guide card ───────────────────────────────────────────────

function GuideCard({ data, onLaunch }: { data: Ready; onLaunch: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upgrade() {
    if (!data.token) return;
    setLoading(true);
    setError("");
    const result = await createTotePlanUpgradeCheckout(data.token);
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  if (data.tier === "interactive") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="mb-3 flex items-center gap-2">
          <Box className="h-4 w-4 text-yellow-400" />
          <h2 className="text-sm font-bold text-white">Interactive 3D Build Guide</h2>
        </div>
        <p className="mb-4 text-xs text-stone-400">
          Step through the build in 3D. Rotate and zoom, hover any part for its exact size.
          Prop your phone up in the garage and go.
        </p>
        <button
          onClick={onLaunch}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400"
        >
          <Play className="h-4 w-4" />
          Launch Build Guide
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-stone-500" />
        <h2 className="text-sm font-bold text-white">Interactive 3D Build Guide</h2>
      </div>
      <ul className="mb-4 space-y-1.5">
        {TOTE_PLAN_TIERS.interactive.includes.slice(1).map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-stone-400">
            <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
      {error && <p className="mb-2 text-xs font-medium text-red-400">{error}</p>}
      <button
        onClick={upgrade}
        disabled={loading || !data.token}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/40 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-400/10 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
        Upgrade for {formatPlanPrice(TOTE_PLAN_UPGRADE_PRICE)}
      </button>
    </div>
  );
}

// ── Checklists ───────────────────────────────────────────────────────────

function Checklists({ data }: { data: Ready }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-stone-500" />
          <h3 className="text-sm font-bold text-white">Shopping List</h3>
        </div>
        <ul className="space-y-2">
          {data.plan.shoppingList.map((item) => (
            <li key={item.name} className="flex gap-3 text-xs">
              <span className="w-12 shrink-0 font-mono font-bold text-yellow-400">{item.qty}</span>
              <span className="min-w-0">
                <span className="font-semibold text-stone-200">{item.name}</span>
                <span className="block text-stone-500">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-stone-500" />
          <h3 className="text-sm font-bold text-white">Tools</h3>
        </div>
        <ul className="grid grid-cols-1 gap-1.5">
          {data.plan.allTools.map((tool) => (
            <li key={tool} className="flex items-center gap-2 text-xs text-stone-300">
              <CheckCircle className="h-3 w-3 shrink-0 text-stone-600" />
              {tool}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

function BuildPlanInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<OpenTotePlanResult | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = searchParams.get("token");
    const sessionId = searchParams.get("session_id");
    const upgradeSessionId = searchParams.get("upgrade_session_id") ?? undefined;

    let input: OpenTotePlanInput | null = null;
    if (token) input = { token, upgradeSessionId };
    else if (sessionId) input = { sessionId };
    else if (searchParams.get("access") === "pro") {
      input = { proConfig: decodeTotePlanConfig(searchParams.get("config")) };
    }

    if (!input) {
      router.replace("/plans");
      return;
    }

    openTotePlan(input).then((res) => {
      setResult(res);
      // Swap one-time Stripe params for the permanent link.
      if (res.ok && res.token && (sessionId || upgradeSessionId)) {
        router.replace(`/plans/build?token=${res.token}`);
      }
    });
  }, [searchParams, router]);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-yellow-400" />
          <p className="text-sm text-stone-500">Loading your build plan…</p>
        </div>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <h1 className="mb-2 text-base font-bold text-white">We couldn&apos;t open this plan</h1>
          <p className="mb-5 text-sm text-stone-500">{result.error}</p>
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

  const { plan, config } = result;
  const dims = plan.dimensions;

  return (
    <div className="min-h-screen bg-slate-950">
      {guideOpen && result.tier === "interactive" && (
        <div className="fixed inset-0 z-50">
          <AssemblyGuide
            cols={config.cols}
            rows={config.rows}
            toteType={config.toteType}
            hasWheels={config.hasWheels}
            hasTop={config.hasTop}
            onClose={() => setGuideOpen(false)}
          />
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <a href="/plans">
            <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white">{plan.unitName}</h1>
            <p className="text-[10px] text-stone-500">{TOTE_PLAN_TIERS[result.tier].name}</p>
          </div>
          {result.access !== "purchase" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-400">
              <Crown className="h-3 w-3" />
              {result.access === "admin" ? "Admin access" : "Included with Pro"}
            </span>
          )}
        </div>
      </header>

      {result.emailSentTo && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
          <p className="mx-auto max-w-3xl text-xs text-emerald-300">
            <strong>Check your email</strong> — we sent your permanent link to{" "}
            <span className="font-semibold">{result.emailSentTo}</span>. Bookmark this page to come back any time.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-stone-400">{totePlanSummary(config)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Width", dims.totalWidth],
              ["Height", dims.totalHeightWithWheels ?? dims.totalHeight],
              ["Depth", dims.depth],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-800/60 px-3 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
                <div className="font-mono text-sm font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <GuideCard data={result} onLaunch={() => setGuideOpen(true)} />
          <PdfCard data={result} />
        </div>

        <Checklists data={result} />

        {result.token && (
          <p className="text-center text-[11px] text-stone-600">
            Lost this page? The link in your email always works, or use &ldquo;Already purchased?&rdquo; on{" "}
            <a href="/plans" className="text-stone-400 underline hover:text-stone-200">the plans page</a>.
          </p>
        )}
      </main>
    </div>
  );
}

export default function BuildPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      }
    >
      <BuildPlanInner />
    </Suspense>
  );
}
