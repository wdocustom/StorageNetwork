"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS SUCCESS — Post-purchase page that generates the PDF
//
// After Stripe payment completes, the user lands here. This page:
//   1. Verifies the Stripe session (optional, for extra security)
//   2. Renders the 3D snapshot engine (hidden canvas)
//   3. Generates the cut list
//   4. Combines snapshots + cut list into a downloadable PDF
//
// The config is carried in the URL query string so no DB lookup is needed.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { Download, Loader2, CheckCircle2, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { generateCutList } from "@/lib/diy-cut-list";
import { downloadDIYPDF } from "@/lib/diy-pdf-generator";
import type { BlueprintSnapshotResult, BlueprintConfig } from "@/components/visualizer/BlueprintVisualizer";

// Lazy-load the 3D snapshot engine (heavy Three.js bundle)
const BlueprintVisualizer = dynamic(
  () => import("@/components/visualizer/BlueprintVisualizer"),
  { ssr: false }
);

type GenerationState = "capturing" | "ready" | "downloading" | "done";

function SuccessContent() {
  const searchParams = useSearchParams();

  const config = useMemo<BlueprintConfig | null>(() => {
    const raw = searchParams.get("config");
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }, [searchParams]);

  const [state, setState] = useState<GenerationState>("capturing");
  const [snapshots, setSnapshots] = useState<BlueprintSnapshotResult[]>([]);

  const cutList = useMemo(() => {
    if (!config) return null;
    return generateCutList(config);
  }, [config]);

  const handleSnapshotsComplete = useCallback(
    (results: BlueprintSnapshotResult[]) => {
      setSnapshots(results);
      setState("ready");
    },
    []
  );

  const handleDownload = useCallback(() => {
    if (!config || !cutList || snapshots.length === 0) return;

    setState("downloading");

    // Use requestAnimationFrame to let the UI update before PDF generation
    requestAnimationFrame(() => {
      const desc = `${config.cols}×${config.rows} ${config.unitType === "mini" ? "Mini" : "Standard"} Tote Organizer`;

      downloadDIYPDF({
        unitName: desc,
        cols: config.cols,
        rows: config.rows,
        toteType: config.toteType,
        hasWheels: config.hasWheels,
        hasTop: config.hasTop,
        cutList,
        snapshots,
        installerName: config.installerName,
        installerPhone: config.installerPhone,
      });

      setState("done");
    });
  }, [config, cutList, snapshots]);

  if (!config) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Missing Configuration</h1>
          <p className="mt-2 text-slate-400">
            Something went wrong. Please{" "}
            <Link href="/design" className="text-blue-400 hover:underline">
              design your unit
            </Link>{" "}
            again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* ── 3D Snapshot Engine (hidden, runs on mount) ── */}
      {state === "capturing" && (
        <BlueprintVisualizer
          config={config}
          onComplete={handleSnapshotsComplete}
          width={1600}
          height={1200}
        />
      )}

      {/* ── Success header ── */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/20">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Payment Successful!</h1>
        <p className="mt-2 text-slate-400">
          Your DIY Assembly Blueprint is being generated.
        </p>
      </div>

      {/* ── Generation status ── */}
      <div className="mb-8 rounded-xl border border-slate-700/60 bg-slate-800/60 p-8">
        {/* Step indicators */}
        <div className="space-y-4">
          {/* Step 1: Payment */}
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-sm text-slate-300">Payment confirmed</span>
          </div>

          {/* Step 2: 3D Rendering */}
          <div className="flex items-center gap-3">
            {state === "capturing" ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            )}
            <span className="text-sm text-slate-300">
              {state === "capturing"
                ? "Rendering 3D assembly diagrams..."
                : "3D diagrams generated"}
            </span>
          </div>

          {/* Step 3: PDF Ready */}
          <div className="flex items-center gap-3">
            {state === "capturing" ? (
              <div className="h-5 w-5 rounded-full border-2 border-slate-700" />
            ) : state === "downloading" ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            ) : state === "done" ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <FileText className="h-5 w-5 text-blue-400" />
            )}
            <span className="text-sm text-slate-300">
              {state === "capturing"
                ? "Waiting..."
                : state === "downloading"
                ? "Generating PDF..."
                : state === "done"
                ? "PDF downloaded!"
                : "PDF ready for download"}
            </span>
          </div>
        </div>

        {/* ── Download button ── */}
        {(state === "ready" || state === "done") && (
          <button
            onClick={handleDownload}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {state === "done" ? "Download Again" : "Download Blueprint PDF"}
          </button>
        )}

        {state === "capturing" && (
          <div className="mt-6 rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />
            <p className="mt-2 text-xs text-slate-500">
              Rendering 3D diagrams for each assembly step...
            </p>
            <p className="mt-1 text-xs text-slate-600">
              This takes a few seconds.
            </p>
          </div>
        )}
      </div>

      {/* ── Preview thumbnails ── */}
      {snapshots.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
            Assembly Step Previews
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {snapshots.map((snap, i) => (
              <div
                key={snap.stepId}
                className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snap.imageDataUrl}
                  alt={snap.title}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="px-2 py-1.5">
                  <div className="text-[10px] font-bold text-blue-400">
                    Step {i + 1}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">
                    {snap.title.replace(/^Step \d+:\s*/, "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Back to design ── */}
      <div className="text-center">
        <Link
          href="/design"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Designer
        </Link>
      </div>
    </main>
  );
}

export default function DIYCheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
