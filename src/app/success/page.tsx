"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Mail, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Success Page — Post-Checkout Confirmation (clean text + badge, no 3D)
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
  const router = useRouter();
  const installerName = searchParams.get("name") || "";
  const redirectTo = searchParams.get("redirect") || null;

  const [countdown, setCountdown] = useState(redirectTo ? 8 : 0);

  useEffect(() => {
    if (!redirectTo) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(redirectTo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [redirectTo, router]);

  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse at 50% 30%, rgba(250,204,21,0.08) 0%, transparent 50%)",
            "radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.04) 0%, transparent 40%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Success badge */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>

        {/* Headline */}
        <h1 className="mb-2 text-center text-4xl font-black uppercase tracking-tight text-white sm:text-5xl md:text-6xl">
          Order{" "}
          <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
            Confirmed!
          </span>
        </h1>

        {/* Installer subhead */}
        {installerName ? (
          <p className="mb-8 text-center text-lg font-medium text-stone-400">
            <span className="font-bold text-white">{decodeURIComponent(installerName)}</span>{" "}
            has received your order.
          </p>
        ) : (
          <p className="mb-8 text-center text-lg font-medium text-stone-400">
            Your installer has been notified.
          </p>
        )}

        {/* Email prompt */}
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-6 py-4">
          <Mail className="h-5 w-5 shrink-0 text-yellow-400" />
          <p className="text-sm text-stone-400">
            Check your email for the{" "}
            <span className="font-semibold text-white">booking receipt</span>{" "}
            and installer details.
          </p>
        </div>

        {/* Auto-redirect countdown */}
        {redirectTo && countdown > 0 ? (
          <p className="mb-4 text-center text-xs text-stone-500">
            Redirecting in{" "}
            <span className="font-bold text-yellow-400">{countdown}s</span>
            {" "}...
          </p>
        ) : null}

        <a
          href={redirectTo || "/"}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {redirectTo ? "Go to Dashboard" : "Back to Home"}
        </a>
      </div>
    </div>
  );
}
