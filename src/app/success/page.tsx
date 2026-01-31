"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import { getInstallerById } from "@/app/actions/customer";
import { CheckCircle2, Loader2, Mail, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Success Page — Post-Checkout Hype Screen with 3D Rack
// ═══════════════════════════════════════════════════════════════════════════

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const searchParams = useSearchParams();
  const installerId = searchParams.get("installer") || "";
  const cols = parseInt(searchParams.get("cols") || "4") || 4;
  const rows = parseInt(searchParams.get("rows") || "4") || 4;
  const toteType = (searchParams.get("tote") || "HDX") as "HDX" | "GM";

  const [installerName, setInstallerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!installerId);

  useEffect(() => {
    if (!installerId) return;
    (async () => {
      const res = await getInstallerById(installerId);
      if (res.available && res.installer_name) {
        setInstallerName(res.installer_name);
      }
      setLoading(false);
    })();
  }, [installerId]);

  return (
    <div className="relative min-h-screen bg-gray-950">
      {/* Grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(250,204,21,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Success badge */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-center text-4xl font-black uppercase tracking-tight text-white sm:text-5xl md:text-6xl">
          Order{" "}
          <span className="text-yellow-400">Confirmed!</span>
        </h1>

        {/* Installer subhead */}
        {loading ? (
          <div className="mb-8 flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : installerName ? (
          <p className="mb-8 text-center text-lg font-medium text-stone-400">
            <span className="font-bold text-white">{installerName}</span>{" "}
            has received your order.
          </p>
        ) : (
          <p className="mb-8 text-center text-lg font-medium text-stone-400">
            Your installer has been notified.
          </p>
        )}

        {/* 3D Rack Visualizer — View Only */}
        <div className="mb-8 w-full max-w-lg overflow-hidden rounded-2xl border border-stone-800 bg-gray-900 shadow-2xl shadow-yellow-400/5">
          <div style={{ height: 320 }}>
            <RackVisualizer
              cols={cols}
              rows={rows}
              toteType={toteType}
              hasTotes
              hasWheels
              hasTop
              totalW={0}
              totalH={0}
            />
          </div>
          <div className="border-t border-stone-800 bg-gray-950 px-4 py-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-stone-600">
              {cols} Wide &times; {rows} High
            </span>
          </div>
        </div>

        {/* Email prompt */}
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-stone-800 bg-gray-900 px-6 py-4">
          <Mail className="h-5 w-5 shrink-0 text-yellow-400" />
          <p className="text-sm text-stone-400">
            Check your email for the{" "}
            <span className="font-semibold text-white">booking receipt</span>{" "}
            and installer details.
          </p>
        </div>

        {/* Back to home */}
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </a>
      </div>
    </div>
  );
}
