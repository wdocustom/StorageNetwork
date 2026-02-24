"use client";

import { useState } from "react";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Building2,
  MapPin,
  Zap,
  Target,
  ClipboardList,
  Banknote,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { onboardInstaller } from "@/app/actions/onboard-installer";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// Join the Network — Standard System Trial (7-day Pro)
//
// This is the direct-from-landing-page join flow.
// Different from /partner/join which is partner-referred.
// ═══════════════════════════════════════════════════════════════════════════

const VALUE_PROPS = [
  {
    icon: Target,
    label: "SALES",
    title: "Pre-Sold Jobs",
    desc: "We secure the customer and the deposit. You don't quote. You don't sell. You just build.",
  },
  {
    icon: ClipboardList,
    label: "PLANNING",
    title: "No Math",
    desc: "Every job comes with a pre-calculated Material List and Cut List. Show up, cut, assemble.",
  },
  {
    icon: Banknote,
    label: "PAYMENTS",
    title: "Instant Payout",
    desc: 'Job done? Tap "Complete." Funds are sent to your bank account immediately. No invoicing.',
  },
];

export default function JoinPage() {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    if (!name.trim() || !email.trim() || !password || !zipCode.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const result = await onboardInstaller({
      name: name.trim(),
      businessName: businessName.trim() || name.trim(),
      email: email.trim(),
      password,
      zipCode: zipCode.trim(),
      withStandardTrial: true,
    });

    if (result.success) {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      window.location.href = result.redirectUrl || "/dashboard";
    } else {
      setError(result.error || "Something went wrong.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Hero — two-col on desktop ───────────────────────────── */}
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {/* ── LEFT: Value Prop ──────────────────────────────────────── */}
        <div className="hidden w-1/2 flex-col justify-center px-16 lg:flex">
          <div className="max-w-lg">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
              Installer Network
            </p>
            <h1 className="mb-3 text-4xl font-black leading-[1.1] tracking-tight text-white xl:text-5xl">
              We Close the Sale.
              <br />
              <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                You Build the Project.
              </span>
            </h1>
            <p className="mb-12 max-w-md text-lg leading-relaxed text-stone-400">
              Stop fighting for leads. We handle the design, sales, and
              logistics. You get a confirmed job with a Cut List and a deposit.
              No bidding. No chasing checks.
            </p>

            {/* 3-Block Value Props */}
            <div className="space-y-5">
              {VALUE_PROPS.map((block) => (
                <div key={block.label} className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                    <block.icon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                        {block.label}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {block.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-500">
                      {block.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 border-t border-slate-800 pt-6">
              <p className="text-xs text-stone-600">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-semibold text-yellow-400 hover:text-yellow-300"
                >
                  Sign In
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Signup Form ───────────────────────────────────── */}
        <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 lg:bg-slate-900/50 lg:py-0">
          <div className="w-full max-w-sm">
            {/* Mobile header */}
            <div className="mb-8 text-center lg:hidden">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-yellow-400" />
              <h1 className="text-2xl font-black text-white">
                We Close.{" "}
                <span className="text-yellow-400">You Build.</span>
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Pre-sold jobs. Cut lists. Instant pay.
              </p>
            </div>

            {/* Desktop header */}
            <div className="mb-8 hidden lg:block">
              <h2 className="text-xl font-bold text-white">Create Account</h2>
              <p className="mt-1 text-sm text-stone-500">
                60 seconds. No credit card. No Stripe setup required yet.
              </p>
            </div>

            {/* Standard Trial Banner */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400/20">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-yellow-300">
                  7-Day Free Pro Trial
                </p>
                <p className="text-[11px] text-yellow-400/70">
                  All Pro features unlocked — no credit card required
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Full Name
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="John Smith"
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Business Name */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Business Name{" "}
                  <span className="text-stone-600">(optional)</span>
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Smith Installations LLC"
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                    autoComplete="organization"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Email
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="you@example.com"
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Password
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Min 6 characters"
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Zip Code */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Service Zip Code
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                  <div className="flex items-center pl-3 text-stone-500">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => {
                      setZipCode(
                        e.target.value.replace(/\D/g, "").slice(0, 5)
                      );
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="90210"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                    autoComplete="postal-code"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Start Free Trial
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="mt-4 text-center text-[11px] text-stone-600">
              No credit card required. Connect Stripe later from your dashboard.
            </p>

            <div className="mt-4 text-center">
              <a
                href="/demo"
                className="text-[11px] font-semibold text-yellow-400/70 transition-colors hover:text-yellow-400"
              >
                Want to see how it works first? Book a free demo call &rarr;
              </a>
            </div>

            {/* Mobile sign-in link */}
            <div className="mt-6 text-center lg:hidden">
              <p className="text-xs text-stone-600">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="font-semibold text-yellow-400 hover:text-yellow-300"
                >
                  Sign In
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
