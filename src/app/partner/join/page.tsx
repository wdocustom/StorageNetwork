"use client";

import { useState } from "react";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Building2,
  MapPin,
  ArrowRight,
  Zap,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { onboardInstaller } from "@/app/actions/onboard-installer";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Onboarding — High-Conversion Signup for Installers
// Split screen: Value Prop (left) + Signup Form (right)
// ═══════════════════════════════════════════════════════════════════════════

const VALUE_PROPS = [
  {
    icon: Zap,
    title: "Automated Leads",
    desc: "Pre-qualified customers with paid deposits land in your dashboard. No chasing.",
  },
  {
    icon: ClipboardList,
    title: "No Math, No Guesswork",
    desc: "Every job comes with a cut list, material list, and step-by-step assembly guide.",
  },
  {
    icon: DollarSign,
    title: "Get Paid Instantly",
    desc: "Collect the balance on-site with one tap. Funds go straight to your bank account.",
  },
];

export default function PartnerJoinPage() {
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
    });

    if (result.success && result.stripeUrl) {
      // Redirect to Stripe onboarding
      window.location.href = result.stripeUrl;
    } else {
      setError(result.error || "Something went wrong.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* ── LEFT: Value Proposition ─────────────────────────────────────── */}
      <div className="hidden w-1/2 flex-col justify-center px-16 lg:flex">
        <div className="max-w-md">
          <h1 className="mb-2 text-4xl font-black tracking-tight text-white">
            Automated Leads.
            <br />
            <span className="text-yellow-400">No Math.</span>
          </h1>
          <p className="mb-10 text-lg text-stone-400">
            Join the partner network and start receiving pre-sold jobs with
            everything you need to build — cut lists, materials, and step-by-step
            guides.
          </p>

          <div className="space-y-6">
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title} className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                  <prop.icon className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="font-bold text-white">{prop.title}</p>
                  <p className="text-sm text-stone-500">{prop.desc}</p>
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

      {/* ── RIGHT: Signup Form ─────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2 lg:bg-slate-900/50">
        <div className="w-full max-w-sm">
          {/* Mobile header (hidden on desktop) */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-black text-white">
              Join the <span className="text-yellow-400">Partner Network</span>
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Automated leads. No math. Get paid.
            </p>
          </div>

          {/* Desktop header */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-xl font-bold text-white">Create Your Account</h2>
            <p className="mt-1 text-sm text-stone-500">
              Set up takes about 2 minutes
            </p>
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
                  onChange={(e) => { setName(e.target.value); setError(""); }}
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
                Business Name <span className="text-stone-600">(optional)</span>
              </label>
              <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                <div className="flex items-center pl-3 text-stone-500">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); setError(""); }}
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
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
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
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
                  onChange={(e) => { setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
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
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Get Started
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[11px] text-stone-600">
            You&apos;ll be redirected to Stripe to connect your bank account.
            <br />
            No fees until you get paid.
          </p>

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
  );
}
