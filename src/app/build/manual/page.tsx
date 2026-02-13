"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import BuildManual from "@/components/BuildManual";

// ═══════════════════════════════════════════════════════════════════════════
// Build Manual Page — Public route for assembly guides
// Accessed via QR code on job stickers or direct link
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

function BuildManualContent() {
  const searchParams = useSearchParams();

  // Parse URL parameters
  const cols = parseInt(searchParams.get("cols") || "0");
  const rows = parseInt(searchParams.get("rows") || "0");
  const toteParam = searchParams.get("tote")?.toUpperCase();
  const toteType: ToteType = toteParam === "GM" ? "GM" : "HDX";
  const hasWheels = searchParams.get("wheels") === "1";
  const hasTop = searchParams.get("top") === "1";
  const jobId = searchParams.get("jobId") || undefined;

  // Validate required parameters
  if (!cols || !rows || cols < 1 || rows < 1) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="mb-2 text-lg font-bold text-white">
            Invalid Build Configuration
          </h1>
          <p className="mb-4 text-sm text-stone-400">
            This link is missing required build parameters. Please make sure
            you&apos;re using a valid build manual link.
          </p>
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-3 text-left">
            <p className="mb-2 text-xs font-bold uppercase text-stone-500">
              Required Parameters
            </p>
            <ul className="space-y-1 text-xs text-stone-400">
              <li>
                <code className="text-yellow-400">cols</code> — Number of columns (1+)
              </li>
              <li>
                <code className="text-yellow-400">rows</code> — Number of rows (1+)
              </li>
            </ul>
            <p className="mt-2 text-xs font-bold uppercase text-stone-500">
              Optional Parameters
            </p>
            <ul className="space-y-1 text-xs text-stone-400">
              <li>
                <code className="text-yellow-400">tote</code> — HDX or GM (default: HDX)
              </li>
              <li>
                <code className="text-yellow-400">wheels</code> — 1 for wheels
              </li>
              <li>
                <code className="text-yellow-400">top</code> — 1 for plywood top
              </li>
            </ul>
          </div>
          <a
            href="/design"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Designer
          </a>
        </div>
      </div>
    );
  }

  // Validate reasonable limits
  if (cols > 20 || rows > 20) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="mb-2 text-lg font-bold text-white">
            Build Too Large
          </h1>
          <p className="mb-4 text-sm text-stone-400">
            The specified dimensions ({cols}×{rows}) exceed the maximum
            supported size of 20×20.
          </p>
          <a
            href="/design"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Designer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <BuildManual
        cols={cols}
        rows={rows}
        toteType={toteType}
        hasTotes={true}
        hasWheels={hasWheels}
        hasTop={hasTop}
        jobId={jobId}
      />
    </div>
  );
}

export default function BuildManualPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
            <p className="text-sm text-stone-400">Loading build manual...</p>
          </div>
        </div>
      }
    >
      <BuildManualContent />
    </Suspense>
  );
}
