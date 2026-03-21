"use client";

import { Suspense, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Mail,
  Lock,
  User,
  Building2,
  MapPin,
  Target,
  ClipboardList,
  Banknote,
  Gift,
  ChevronDown,
  Sparkles,
  DollarSign,
  BarChart3,
  Megaphone,
  Share2,
  Box,
  TrendingUp,
  Link2,
  Wallet,
  Globe,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { onboardInstaller } from "@/app/actions/onboard-installer";
import { checkTerritoryAvailability } from "@/app/actions/territory";
import { stampLastLogin } from "@/app/actions/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import PlatformShowcase from "@/components/PlatformShowcase";

// ═══════════════════════════════════════════════════════════════════════════
// Partner Onboarding — Professional Trade Style (No Stripe Step)
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
    desc: "Job done? Tap \"Complete.\" Funds are sent to your bank account immediately. No invoicing.",
  },
];

export default function PartnerJoinPage() {
  return (
    <Suspense>
      <PartnerJoinPageInner />
    </Suspense>
  );
}

function PartnerJoinPageInner() {
  const searchParams = useSearchParams();
  const referringPartner = searchParams.get("ref");

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Territory availability state
  const [territoryStatus, setTerritoryStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [territoryMessage, setTerritoryMessage] = useState("");
  const territoryCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkTerritory = useCallback(async (zip: string) => {
    if (zip.length !== 5) {
      setTerritoryStatus("idle");
      setTerritoryMessage("");
      return;
    }
    setTerritoryStatus("checking");
    setTerritoryMessage("");
    try {
      const result = await checkTerritoryAvailability(zip);
      if (result.available) {
        setTerritoryStatus("available");
        setTerritoryMessage("Territory available!");
      } else {
        setTerritoryStatus("taken");
        const nearest = result.nearestInstaller;
        const hint = nearest?.city && nearest?.state
          ? ` An installer is already active near ${nearest.city}, ${nearest.state} (${nearest.distance} mi away).`
          : "";
        setTerritoryMessage(`Territory unavailable.${hint} Try a different ZIP code.`);
      }
    } catch {
      setTerritoryStatus("idle");
    }
  }, []);

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

    if (result.success) {
      // Sign in with the new credentials, then redirect to dashboard
      const supabase = getSupabaseBrowserClient();
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInData?.user) {
        await stampLastLogin(signInData.user.id);
      }
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
      {/* ── TOP: Hero — two-col on desktop ───────────────────────── */}
      <div className="relative flex flex-col lg:min-h-screen lg:flex-row">
        {/* ── LEFT: Value Prop ──────────────────────────────────────── */}
        <div className="hidden w-1/2 flex-col justify-center px-16 lg:flex">
          <div className="max-w-lg">
            {/* Professional headline */}
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
              Stop fighting for leads. We handle the design, sales, and logistics.
              You get a confirmed job with a Cut List and a deposit.
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
        <div className="flex w-full flex-col items-center px-6 py-12 lg:w-1/2 lg:justify-center lg:bg-slate-900/50 lg:py-0">
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

          {/* Pro Trial Banner (affiliate signups) */}
          {referringPartner && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                <Gift className="h-4 w-4 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-purple-300">
                  Pro Trial Included
                </p>
                <p className="text-[11px] text-purple-400/70">
                  Courtesy of {referringPartner} — trial ends when the platform demonstrates its true value, after 3 paid jobs land in your dashboard
                </p>
              </div>
            </div>
          )}

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

            {/* Zip Code — with territory check */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Service Zip Code
              </label>
              <div
                className={`flex overflow-hidden rounded-lg border bg-slate-800 transition-colors ${
                  territoryStatus === "available"
                    ? "border-emerald-500"
                    : territoryStatus === "taken"
                      ? "border-red-500"
                      : "border-slate-700 focus-within:border-yellow-400"
                }`}
              >
                <div className={`flex items-center pl-3 ${
                  territoryStatus === "available" ? "text-emerald-400"
                  : territoryStatus === "taken" ? "text-red-400"
                  : "text-stone-500"
                }`}>
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setZipCode(val);
                    setError("");
                    if (territoryCheckTimer.current) clearTimeout(territoryCheckTimer.current);
                    if (val.length === 5) {
                      territoryCheckTimer.current = setTimeout(() => checkTerritory(val), 400);
                    } else {
                      setTerritoryStatus("idle");
                      setTerritoryMessage("");
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="90210"
                  inputMode="numeric"
                  maxLength={5}
                  className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                  autoComplete="postal-code"
                />
                {territoryStatus === "checking" && (
                  <Loader2 className="mr-3 h-4 w-4 shrink-0 animate-spin text-yellow-400" />
                )}
                {territoryStatus === "available" && (
                  <CheckCircle2 className="mr-3 h-4 w-4 shrink-0 text-emerald-400" />
                )}
                {territoryStatus === "taken" && (
                  <XCircle className="mr-3 h-4 w-4 shrink-0 text-red-400" />
                )}
              </div>
              {territoryMessage && (
                <p className={`mt-1 text-xs font-medium ${
                  territoryStatus === "available" ? "text-emerald-400" : "text-red-400"
                }`}>
                  {territoryMessage}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || territoryStatus === "taken" || territoryStatus === "checking"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "CREATE ACCOUNT"
            )}
          </button>

          <p className="mt-4 text-center text-[11px] text-stone-600">
            No credit card required. Connect Stripe later from your dashboard.
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

        {/* ── Scroll Prompt — above the fold ─────────────────────── */}
        <button
          onClick={() => {
            const showcase = document.getElementById("platform-showcase");
            if (showcase) showcase.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 group cursor-pointer rounded-full border border-yellow-400/20 bg-slate-950/80 backdrop-blur-sm px-5 py-2.5 transition-all hover:border-yellow-400/40 hover:bg-slate-900/80"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400 group-hover:text-yellow-300 transition-colors">
            Scroll for more info
          </span>
          <ChevronDown className="h-4 w-4 text-yellow-400 animate-bounce" />
        </button>
      </div>

      {/* ── Platform Showcase — below hero ─────────────────────────── */}
      <div id="platform-showcase">
        <PlatformShowcase />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3D VISUALIZER SHOWCASE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-slate-950 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute right-0 top-0">
          <div className="h-[400px] w-[400px] rounded-full bg-yellow-400/[0.03] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
            {/* Left: Screenshot */}
            <div className="lg:w-[38%]">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-yellow-400/5">
                <Image
                  src="/images/3d-visualizer-preview.png"
                  alt="3D Storage Visualizer showing a fully configured tote shelving system in a garage environment"
                  width={800}
                  height={500}
                  className="block h-auto w-full"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent p-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/15 px-3 py-1.5 text-[11px] font-bold text-yellow-400">
                    <Box className="h-3 w-3" />
                    Interactive 3D
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Copy */}
            <div className="lg:w-[62%]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                3D Visualizer
              </p>
              <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
                Your Customers{" "}
                <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                  See It Before They Buy It.
                </span>
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-stone-400">
                No more &ldquo;can you describe what it looks like?&rdquo; Our interactive
                3D configurator lets homeowners design their exact system &mdash; size, layout,
                tote count &mdash; in real time. When they hit &ldquo;Order,&rdquo; you get a
                confirmed job with zero scope creep.
              </p>

              <div className="space-y-4">
                {[
                  { title: "Eliminates Miscommunication", desc: "Customers see exactly what they're getting. No callbacks. No change orders." },
                  { title: "Closes Sales Faster", desc: "Visual confidence turns browsers into buyers. Average design-to-order time: under 3 minutes." },
                  { title: "Pre-Calculated Everything", desc: "Every 3D design auto-generates a Cut List and Material List so you show up ready to build." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          AI SCRIPT GENERATOR
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-gray-900 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute left-0 bottom-0">
          <div className="h-[500px] w-[600px] rounded-full bg-purple-500/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row-reverse lg:items-start lg:gap-16">
            {/* Right: Screenshot */}
            <div className="lg:w-[38%]">
              <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl shadow-purple-400/5">
                <Image
                  src="/images/ai-script-generator-preview.png"
                  alt="AI Script Generator dashboard producing ready-to-post social media marketing content"
                  width={800}
                  height={500}
                  className="block h-auto w-full"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-800/80 to-transparent p-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-400/15 px-3 py-1.5 text-[11px] font-bold text-purple-400">
                    <Sparkles className="h-3 w-3" />
                    AI-Powered
                  </div>
                </div>
              </div>
            </div>

            {/* Left: Copy */}
            <div className="lg:w-[62%]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">
                AI Script Generator
              </p>
              <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
                Marketing Scripts{" "}
                <span className="bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                  Written For You In Seconds.
                </span>
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-stone-400">
                Stop staring at a blank screen trying to write your next ad, social post,
                or email. Our built-in AI Script Generator creates platform-ready marketing
                copy tailored to your business &mdash; so you can spend your time building, not writing.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Megaphone, title: "Multi-Platform", desc: "Facebook, Instagram, TikTok, YouTube, Nextdoor, email — one click." },
                  { icon: BarChart3, title: "Conversion-Tuned", desc: "Scripts built around proven frameworks that drive calls and bookings." },
                  { icon: Share2, title: "Copy & Post", desc: "One-tap copy. Paste directly into any platform. No reformatting." },
                  { icon: Sparkles, title: "Unlimited Scripts", desc: "Generate as many as you want. Different tones, hooks, and angles every time." },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <item.icon className="mb-2 h-5 w-5 text-purple-400" />
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          CUSTOM PRICING ENGINE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-slate-950 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute right-1/4 top-0">
          <div className="h-[400px] w-[500px] rounded-full bg-emerald-400/[0.03] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
            {/* Left: Screenshot */}
            <div className="lg:w-[38%]">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-emerald-400/5">
                <Image
                  src="/images/custom-pricing-preview.png"
                  alt="Custom Pricing configurator showing adjustable labor rates, markups, and real-time profit calculations"
                  width={800}
                  height={500}
                  className="block h-auto w-full"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent p-6">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-bold text-emerald-400">
                    <DollarSign className="h-3 w-3" />
                    Your Margins, Your Rules
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Copy */}
            <div className="lg:w-[62%]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Custom Pricing
              </p>
              <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
                Set Your Own Rates.{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                  Keep Every Dollar You Earn.
                </span>
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-stone-400">
                You&apos;re not locked into our pricing. Adjust your labor rate, material markup,
                and margin per job. The platform calculates everything in real time so you
                always know your take-home before accepting a job.
              </p>

              <div className="space-y-4">
                {[
                  { title: "Adjustable Labor Rate", desc: "Charge what your market supports. Set your hourly rate or flat-fee per unit — the platform adapts." },
                  { title: "Material Markup Control", desc: "Apply your own markup on materials. The customer sees one clean price; you see your margin." },
                  { title: "Real-Time Profit Preview", desc: "Every quote shows your exact profit before the customer even places the order. No guessing." },
                  { title: "No Platform Fees on Labor", desc: "We don't take a cut of your install labor. Your hands, your rate, your money." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PASSIVE INCOME — REFERRAL PROGRAM
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-gray-900 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute left-1/3 bottom-0">
          <div className="h-[500px] w-[600px] rounded-full bg-yellow-400/[0.03] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row-reverse lg:gap-20">
            {/* Right: Visual */}
            <div className="lg:w-1/2">
              <div className="relative rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-8 shadow-2xl shadow-yellow-400/5">
                {/* Earnings preview card */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/15 ring-1 ring-yellow-400/30">
                    <TrendingUp className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400/60">
                      Passive Earnings
                    </p>
                    <p className="text-2xl font-black text-white">
                      Unlimited Potential
                    </p>
                  </div>
                </div>

                {/* Example referral flow */}
                <div className="space-y-3">
                  {[
                    {
                      step: "1",
                      text: "You share your unique link on social media, your website, or with friends",
                    },
                    {
                      step: "2",
                      text: "A customer in another state designs & books their project",
                    },
                    {
                      step: "3",
                      text: "A local installer builds it — you earn 30% of the deposit",
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3"
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
                        {item.step}
                      </div>
                      <p className="text-sm leading-relaxed text-stone-300">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
                  <p className="text-xs font-bold text-emerald-400">
                    Minimum $15 per referral — no cap on earnings
                  </p>
                </div>
              </div>
            </div>

            {/* Left: Copy */}
            <div className="lg:w-1/2">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                  Passive Income
                </p>
                <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-400 ring-1 ring-yellow-400/30">
                  Pro
                </span>
              </div>
              <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
                Earn Money{" "}
                <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                  While You Sleep.
                </span>
              </h2>
              <p className="mb-8 max-w-md text-base leading-relaxed text-stone-400">
                Every installer gets a personal referral link.
                Share it anywhere — nationwide, no territory limits. When a
                customer books a project through your link, even if they&apos;re
                across the country, you pocket 30% of the deposit automatically.
                You don&apos;t lift a finger.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: Globe,
                    title: "No Territory Limits",
                    desc: "Your link works nationwide. Share it on Facebook, Instagram, your website, Nextdoor — anywhere people need storage solutions.",
                  },
                  {
                    icon: Link2,
                    title: "One Link, Endless Earnings",
                    desc: "Every customer who books through your link earns you money. There's no cap. Refer 5 jobs or 500 — you get paid on every single one.",
                  },
                  {
                    icon: Wallet,
                    title: "Paid Directly to Your Stripe",
                    desc: "Connect your Stripe account from your dashboard and referral payouts hit your bank automatically. No invoicing, no chasing payments.",
                  },
                  {
                    icon: DollarSign,
                    title: "30% of Every Deposit",
                    desc: "That's real money for a link share. A $500 deposit puts $150 in your pocket. A $1,000 deposit? $300. Minimum $15 per referral, guaranteed.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                      <item.icon className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                <p className="text-xs font-bold text-yellow-400">
                  Connect Stripe to start earning.
                </p>
                <p className="mt-1 text-[11px] text-stone-500">
                  Connect Stripe from your dashboard in 2 minutes and referral
                  payouts hit your bank automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-950 px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-3 text-2xl font-black uppercase text-white sm:text-3xl">
            Ready to Stop Chasing Leads?
          </h2>
          <p className="mb-6 text-sm text-stone-400">
            Create your account in 60 seconds. No credit card. No commitment.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
          >
            Create Account Now
          </button>
        </div>
      </section>
    </div>
  );
}
