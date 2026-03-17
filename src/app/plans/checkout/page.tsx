"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS CHECKOUT — Purchase page for custom blueprint PDFs
//
// Reads the configuration from the URL query string, displays a summary
// of what the user is buying, and processes a Stripe checkout.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useMemo, Suspense } from "react";
import { ArrowLeft, Hammer, Loader2, CheckCircle2, FileText, Ruler, ShoppingCart, Phone } from "lucide-react";
import Link from "next/link";
import { createDIYPlanCheckout, type DIYPlanCheckoutConfig } from "@/app/actions/diy-plan-checkout";
import { generateCutList } from "@/lib/diy-cut-list";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const config = useMemo<DIYPlanCheckoutConfig | null>(() => {
    const raw = searchParams.get("config");
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }, [searchParams]);

  const cancelled = searchParams.get("cancelled") === "1";

  const cutList = useMemo(() => {
    if (!config) return null;
    return generateCutList(config);
  }, [config]);

  if (!config) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Invalid Configuration</h1>
          <p className="mt-2 text-slate-400">
            Please configure your unit on the{" "}
            <Link href="/design" className="text-blue-400 hover:underline">
              design page
            </Link>{" "}
            first.
          </p>
        </div>
      </main>
    );
  }

  const desc = `${config.cols}×${config.rows} ${config.unitType === "mini" ? "Mini" : "Standard"} Tote Organizer`;

  const handleCheckout = async () => {
    setLoading(true);
    setError("");

    const result = await createDIYPlanCheckout(config);

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Back link */}
      <Link
        href="/design"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Designer
      </Link>

      {/* Cancelled notice */}
      {cancelled && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Checkout was cancelled. You can try again below.
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
            <Hammer className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">DIY Assembly Blueprint</h1>
            <p className="text-sm text-slate-400">Visual step-by-step build plan for your custom unit</p>
          </div>
        </div>
      </div>

      {/* ── Installer branding (when linked from an installer's design page) ── */}
      {config.installerName && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Designed with
            </div>
            <div className="text-sm font-semibold text-white">{config.installerName}</div>
          </div>
          {config.installerPhone && (
            <a
              href={`tel:${config.installerPhone}`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400"
            >
              <Phone className="h-3 w-3" />
              Call
            </a>
          )}
        </div>
      )}

      {/* ── Unit summary card ── */}
      <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">{desc}</h2>

        {/* Config chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300">
            {config.cols * config.rows} totes
          </span>
          <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300">
            {config.toteType === "HDX" ? "HDX / Home Depot" : "Greenmade / Costco"}
          </span>
          {config.hasWheels && (
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-400">
              Casters
            </span>
          )}
          {config.hasTop && (
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-400">
              Plywood Worktop
            </span>
          )}
        </div>

        {/* Dimensions */}
        {cutList && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-3">
            <div className="text-center">
              <div className="text-xs text-slate-500">Width</div>
              <div className="font-mono text-sm font-bold text-white">{cutList.dimensions.totalWStr}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">Height</div>
              <div className="font-mono text-sm font-bold text-white">{cutList.dimensions.totalHStr}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500">Depth</div>
              <div className="font-mono text-sm font-bold text-white">{cutList.dimensions.depthStr}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── What's included ── */}
      <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-800/60 p-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
          What&apos;s Included
        </h3>
        <div className="space-y-3">
          {[
            { icon: FileText, text: "4 high-res 3D assembly diagrams (isometric view)" },
            { icon: Ruler, text: "Complete cut list with color-coded part labels" },
            { icon: ShoppingCart, text: "Shopping list with exact quantities" },
            { icon: CheckCircle2, text: "Step-by-step instructions with fastener callouts" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0 text-green-400" />
              <span className="text-sm text-slate-300">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price + Checkout ── */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 text-center">
        <div className="mb-1 text-sm text-slate-400">One-time purchase</div>
        <div className="mb-4 text-4xl font-black text-white">$19</div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {loading ? "Redirecting to Stripe..." : "Purchase Blueprint — $19"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Instant download after payment. PDF format, print-ready.
        </p>
      </div>
    </main>
  );
}

export default function DIYCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
