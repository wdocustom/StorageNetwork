"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const InstallerChatWidget = dynamic(() => import("@/components/chat/InstallerChatWidget"), { ssr: false });
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
  ChevronDown,
  CheckCircle2,
  Sparkles,
  DollarSign,
  BarChart3,
  Megaphone,
  Share2,
  Box,
  TrendingUp,
  Link2,
  Package,
  Rocket,
  Rows3,
  Wallet,
  Warehouse,
  Globe,
  ArrowRight,
  Wrench,
  Video,
  XCircle,
  QrCode,
  Sprout,
  Star,
  Shield,
} from "lucide-react";
import Image from "next/image";
import { onboardInstaller } from "@/app/actions/onboard-installer";
import { checkTerritoryAvailability } from "@/app/actions/territory";
import { getDemandPreviewForZip } from "@/app/actions/demand-signals";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { stampLastLogin } from "@/app/actions/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import PlatformShowcase from "@/components/PlatformShowcase";
import InstallerTestimonials from "@/components/landing/InstallerTestimonials";

// ═══════════════════════════════════════════════════════════════════════════
// Join the Network — Pro Trial (3 paid jobs + 45-day hidden expiry)
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

  // Territory check state
  const [territoryStatus, setTerritoryStatus] = useState<
    "idle" | "checking" | "available" | "shared" | "invalid"
  >("idle");
  const [territoryMessage, setTerritoryMessage] = useState("");
  const territoryCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customers within 85 miles already on the waitlist. Hidden when zero.
  const [demandWaiting, setDemandWaiting] = useState<number | null>(null);

  const checkTerritory = useCallback(async (zip: string) => {
    if (zip.length !== 5) {
      setTerritoryStatus("idle");
      setTerritoryMessage("");
      setDemandWaiting(null);
      return;
    }
    setTerritoryStatus("checking");
    setTerritoryMessage("");
    setDemandWaiting(null);
    try {
      const [territory, demand] = await Promise.all([
        checkTerritoryAvailability(zip),
        getDemandPreviewForZip(zip).catch(() => null),
      ]);

      if (!territory.available) {
        setTerritoryStatus("invalid");
        setTerritoryMessage(territory.reason || "Invalid ZIP code.");
      } else {
        const preview = territory.clusterPreview;
        const existingCount = territory.existingInstallerCount ?? 0;
        if (existingCount > 0) {
          setTerritoryStatus("shared");
          setTerritoryMessage(
            existingCount === 1
              ? `1 installer already serves this area. You'll cover ~${preview?.estimatedZips ?? 0} ZIP codes and compete for jobs via tiered priority.`
              : `${existingCount} installers already serve this area. You'll cover ~${preview?.estimatedZips ?? 0} ZIP codes and compete for jobs via tiered priority.`
          );
        } else {
          setTerritoryStatus("available");
          setTerritoryMessage(
            preview
              ? `No installers here yet! You'll be the first, covering ~${preview.estimatedZips} ZIP codes.`
              : "No installers here yet! You'll be the first."
          );
        }
      }

      setDemandWaiting(demand && demand.waitlist > 0 ? demand.waitlist : null);
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
    if (isDisposableEmail(email)) {
      setError("Please use a real business or personal email. Temporary and alias email services are not accepted.");
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

            <div className="mt-10">
              <a
                href="/demo"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-semibold text-stone-300 transition-all hover:border-yellow-400/30 hover:bg-slate-800 hover:text-white"
              >
                <Video className="h-3.5 w-3.5 text-yellow-400" />
                Not ready to commit? Book a free demo call
                <ArrowRight className="h-3 w-3 text-stone-500" />
              </a>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-6">
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

            {/* Standard Trial Banner */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400/20">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-yellow-300">
                  Pro Trial Included
                </p>
                <p className="text-[11px] text-yellow-400/70">
                  Trial ends when the platform demonstrates its true value — after 3 paid jobs land in your dashboard
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

              {/* Zip Code — territory check + waiting-customer preview */}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Service Zip Code
                </label>
                <p className="mb-2 text-[11px] text-stone-400">
                  Drop your ZIP — we&rsquo;ll check if customers in your area are <span className="font-semibold text-yellow-400">already asking and waiting</span> for an installer.
                </p>
                <div
                  className={`flex overflow-hidden rounded-lg border bg-slate-800 transition-colors ${
                    territoryStatus === "available"
                      ? "border-emerald-500"
                      : territoryStatus === "shared"
                        ? "border-yellow-500"
                        : territoryStatus === "invalid"
                          ? "border-red-500"
                          : "border-slate-700 focus-within:border-yellow-400"
                  }`}
                >
                  <div className={`flex items-center pl-3 ${
                    territoryStatus === "available" ? "text-emerald-400"
                    : territoryStatus === "shared" ? "text-yellow-400"
                    : territoryStatus === "invalid" ? "text-red-400"
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
                  {territoryStatus === "shared" && (
                    <CheckCircle2 className="mr-3 h-4 w-4 shrink-0 text-yellow-400" />
                  )}
                  {territoryStatus === "invalid" && (
                    <XCircle className="mr-3 h-4 w-4 shrink-0 text-red-400" />
                  )}
                </div>
                {territoryMessage && (
                  <p className={`mt-1 text-xs font-medium ${
                    territoryStatus === "available" ? "text-emerald-400"
                    : territoryStatus === "shared" ? "text-yellow-400"
                    : "text-red-400"
                  }`}>
                    {territoryMessage}
                  </p>
                )}
                {demandWaiting !== null && demandWaiting > 0 && (
                  <div className="mt-3 rounded-lg border border-yellow-400/40 bg-yellow-400/[0.06] p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                      🔥 Customers waiting in your area
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-300">
                      Real homeowners within 85 miles of {zipCode} have asked us to find them a vetted installer. Sign up below to be the first installer in their area — and win these waitlisted jobs.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || territoryStatus === "invalid" || territoryStatus === "checking"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-widest text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Start Your Trial
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

      {/* ── Demo CTA — after 3D Visualizer ────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-950 px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:flex-row sm:gap-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
            <Video className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-white">
              Want to see the configurator live?
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              We&apos;ll walk you through the 3D design tool, the build engine, and how jobs land in your dashboard. 15 minutes, no pressure.
            </p>
          </div>
          <a
            href="/demo"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
          >
            Book a Demo
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BUILD ENGINE — MATERIAL LISTS, CUT PLANS & SMART INVENTORY
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-gray-900 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute left-0 bottom-0">
          <div className="h-[500px] w-[600px] rounded-full bg-yellow-400/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Build Engine
          </p>
          <h2 className="mb-4 text-center text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
            Material Lists. Cut Plans.{" "}
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
              Smart Inventory.
            </span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-base leading-relaxed text-stone-400">
            Every job comes with a pre-calculated shopping list, a board-by-board cut plan with
            fractional measurements, and an inventory system that tracks every screw and offcut
            across jobs &mdash; so you never overbuy again.
          </p>

          {/* Two-col: Material Lists + Cut Plans */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Material Lists */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <ClipboardList className="h-5 w-5 text-yellow-400" />
                </div>
                <p className="text-lg font-bold text-white">Auto Material Lists</p>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Walk into the lumber yard knowing exactly what to grab. The platform calculates
                every board, sheet, tote, wheel kit, and screw count &mdash; down to the individual
                fastener. No spreadsheets. No guessing.
              </p>
              <div className="space-y-2">
                {[
                  "2x4 studs with exact qty (bin-packed)",
                  "Plywood sheets by type (top, structural, shelving)",
                  "Tote count by type and color",
                  "Screw counts: 1\", 1-5/8\", 3\" with 5% error buffer",
                  "Wheel kits per unit",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Cut Plans */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Wrench className="h-5 w-5 text-yellow-400" />
                </div>
                <p className="text-lg font-bold text-white">Board-by-Board Cut Plans</p>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                No more measuring and math on the job site. Every job generates a visual cut
                plan showing exactly which parts go on which board, with fractional measurements
                and offcut tracking so nothing gets wasted.
              </p>
              <div className="space-y-2">
                {[
                  "Color-coded cut diagrams with fraction labels",
                  "FFD bin packing minimizes lumber waste",
                  "Kerf (blade width) accounted for on every cut",
                  "Offcut carry-forward between modules",
                  "Plywood rail strips + back supports per module",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Smart Inventory Manager */}
          <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.03] p-6 lg:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="lg:w-3/5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                    <Package className="h-5 w-5 text-yellow-400" />
                  </div>
                  <p className="text-lg font-bold text-white">Smart Inventory Manager</p>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-stone-400">
                  This is the feature that turns a side hustle into a real business. The inventory
                  manager tracks every screw, every plywood strip, every leftover from every
                  job &mdash; so your purchase list only shows what you actually need to buy.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "Screw Tracking",
                      desc: "Individual counts for 1\", 1-5/8\", and 3\" screws across jobs. Includes a 5% human error buffer for drops and miscounts.",
                    },
                    {
                      title: "Offcut Recycling",
                      desc: "Plywood strip offcuts from top sheets carry forward as free rail material for future builds. One job\u2019s waste = next job\u2019s savings.",
                    },
                    {
                      title: "Smart Purchase Lists",
                      desc: "Items covered by existing inventory are hidden. You see a clean shopping list \u2014 only what you actually need to buy.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                      <p className="mb-1 text-xs font-bold text-yellow-400">{item.title}</p>
                      <p className="text-[11px] leading-relaxed text-stone-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works steps */}
              <div className="lg:w-2/5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                  How It Works
                </p>
                <div className="space-y-3">
                  {[
                    { step: "1", title: "Complete a job", desc: "Leftover screws and strips are logged automatically" },
                    { step: "2", title: "Next job comes in", desc: "Platform checks your stock before building the purchase list" },
                    { step: "3", title: "Buy only what\u2019s needed", desc: "Items in stock are hidden \u2014 clean shopping list, no noise" },
                    { step: "4", title: "Repeat", desc: "Every job makes the next one cheaper" },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/20">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{s.title}</p>
                        <p className="text-[11px] leading-relaxed text-stone-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA to /features */}
            <div className="mt-6 border-t border-yellow-400/10 pt-5 text-center">
              <a
                href="/features#inventory"
                className="inline-flex items-center gap-2 text-sm font-bold text-yellow-400 transition-colors hover:text-yellow-300"
              >
                See the full breakdown on our Features page
                <ArrowRight className="h-4 w-4" />
              </a>
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

      {/* ── AI Design Assistant ────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10">
              <Sparkles className="h-6 w-6 text-yellow-400" />
            </div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">New Feature</p>
            <h2 className="text-2xl font-black uppercase text-white sm:text-3xl">AI Design Assistant</h2>
            <p className="mt-2 text-sm text-stone-400">
              An AI-powered chatbot that guides your customers through building their storage system &mdash; using your name, your pricing, and only the products you offer.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Your Pricing, Your Brand", desc: "Uses your exact per-slot, per-tote, and add-on rates. Quotes are always accurate." },
              { title: "Only What You Offer", desc: "Won't mention mini totes, shelving, or planters unless you've enabled them." },
              { title: "Guides Customers Step-by-Step", desc: "Asks about wall space, height, totes, wheels, and top — one question at a time." },
              { title: "Sells 24/7", desc: "Available on your design page around the clock. Converts browsers into bookings while you sleep." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo CTA — midpage strip ──────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-950 px-6 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">
            Still have questions?
          </p>
          <p className="mb-4 text-lg font-bold text-white">
            See the entire platform in action &mdash; live, in 15 minutes.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-6 py-3 text-sm font-bold text-yellow-400 transition-all hover:border-yellow-400/50 hover:bg-yellow-400/20"
            >
              <Video className="h-4 w-4" />
              Book a Free Demo Call
            </a>
            <span className="text-xs text-stone-600">or</span>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 text-sm font-bold text-yellow-400 transition-colors hover:text-yellow-300"
            >
              Create your account now
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
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

      {/* ── Features Page CTA Strip ───────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-950 px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              Want the full picture?
            </p>
            <p className="text-xs text-stone-500">
              Pricing, feature breakdown, inventory deep-dive, and everything included in your plan.
            </p>
          </div>
          <a
            href="/features"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-yellow-400 transition-all hover:border-yellow-400/50 hover:bg-yellow-400/20"
          >
            View All Features
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
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

                <div className="space-y-3">
                  {[
                    { step: "1", text: "You share your unique link on social media, your website, or with friends" },
                    { step: "2", text: "A customer in another state designs & books their project" },
                    { step: "3", text: "A local installer builds it — you earn 30% of the deposit" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
                        {item.step}
                      </div>
                      <p className="text-sm leading-relaxed text-stone-300">{item.text}</p>
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
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{item.desc}</p>
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

      {/* ══════════════════════════════════════════════════════════════════
          NEW PRODUCT LINES — OPEN SHELVING & OVERHEAD STORAGE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-slate-950 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute right-0 top-0">
          <div className="h-[400px] w-[400px] rounded-full bg-yellow-400/[0.03] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Platform Features
          </p>
          <h2 className="mb-4 text-center text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
            More Products.{" "}
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
              More Tools. More Revenue.
            </span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-base leading-relaxed text-stone-400">
            Tote organizers are just the start. Open shelving, overhead ceiling
            storage, AI-powered inventory, and verified reviews &mdash; all through the same platform.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Open Shelving */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Rows3 className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    New
                  </span>
                  <p className="text-lg font-bold text-white">Open Shelving</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Versatile open shelving for tools, bins, and everything that doesn&apos;t fit in a tote.
                Multiple width and height configurations, full 3D preview, and auto-generated material
                lists. Customers can add shelving alongside tote organizers in the same order.
              </p>
              <div className="space-y-2">
                {[
                  "Multiple size configurations",
                  "3D configurator support",
                  "Auto-generated cut plans",
                  "Combine with tote units",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Overhead Ceiling Storage */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Warehouse className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    New
                  </span>
                  <p className="text-lg font-bold text-white">Overhead Ceiling Storage</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Maximize dead space above vehicles and walkways. Customers configure width, depth, and
                drop height in the design tool. Full 3D visualization, auto-calculated materials
                including lag bolts, and a high-ticket upsell that customers love.
              </p>
              <div className="space-y-2">
                {[
                  "Custom width, depth & drop height",
                  "Ceiling-mounted 3D preview",
                  "Full material & hardware lists",
                  "High-margin upsell opportunity",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Raised Bed Planters */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Sprout className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    New
                  </span>
                  <p className="text-lg font-bold text-white">Raised Bed Planters</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Handmade cedar raised beds in 8 sizes — elevated or ground-level. Customers configure
                finish, depth, and pest protection in the 3D design tool. High-margin seasonal product
                that upsells naturally on every garage job.
              </p>
              <div className="space-y-2">
                {[
                  "8 sizes with 4 finish options",
                  "4 pest protection cover styles",
                  "3D preview + instant pricing",
                  "Custom installer pricing controls",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Tote Inventory */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <QrCode className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    New
                  </span>
                  <p className="text-lg font-bold text-white">Customer Tote Inventory</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Every rack you build gets a free digital inventory system. Customers scan a QR code
                to catalog what&apos;s in every tote &mdash; AI photo scanning identifies contents instantly.
                No app, no login. When they run out of space, the lead comes back to you.
              </p>
              <div className="space-y-2">
                {[
                  "AI-powered photo scanning",
                  "Organization score & progress tracking",
                  "Built-in referral engine to your design page",
                  "Always free for your customers",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Customer Reviews */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Star className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/60">
                    New
                  </span>
                  <p className="text-lg font-bold text-white">Verified Customer Reviews</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Collect verified reviews from real customers, tied to actual paid jobs on the platform.
                Reviews display on your portfolio page with star ratings, distribution charts,
                and a <span className="text-emerald-400 font-semibold">&#10003; Verified</span> badge
                that builds instant trust.
              </p>
              <div className="space-y-2">
                {[
                  "One-click request or copy link to text",
                  "No customer login — review in 30 seconds",
                  "Quick-tap tags: Professional, On Time, etc.",
                  "Portfolio showcase with rating summary",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          AUTO-MARKETING ENGINE — COMING SOON
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-slate-800 bg-gray-900 px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute left-0 bottom-0">
          <div className="h-[500px] w-[600px] rounded-full bg-yellow-400/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
            {/* Left: Copy */}
            <div className="lg:w-[55%]">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                  Auto-Marketing
                </p>
                <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-400 ring-1 ring-yellow-400/30">
                  Coming Soon
                </span>
              </div>
              <h2 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white xl:text-4xl">
                The Platform{" "}
                <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                  Markets For You.
                </span>
              </h2>
              <p className="mb-6 max-w-md text-base leading-relaxed text-stone-400">
                We&apos;re building a full-scale automated marketing engine so you never have to
                think about where your next customer comes from. The platform handles everything
                from SEO to social media content &mdash; all you do is build.
              </p>

              {/* Already Live */}
              <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">Already Live</span>
                </div>
                <p className="text-sm font-bold text-white">Auto-Generated City Pages</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  Thousands of SEO-optimized landing pages are already live across the country,
                  funneling homeowners searching for garage storage directly to local installers
                  on the platform.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: Megaphone,
                    title: "Instagram Post Generator",
                    desc: "Auto-generates complete Instagram posts with captions, hashtags, and content direction. Just copy, post, and grow.",
                  },
                  {
                    icon: BarChart3,
                    title: "Full Marketing Strategy",
                    desc: "A planned-out content calendar with topics, timing, and platform-specific strategies tailored to your local market.",
                  },
                  {
                    icon: Globe,
                    title: "Nationwide SEO Pages",
                    desc: "Auto-generated city and service area pages that rank in Google and drive organic traffic — already live and growing.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
                      <item.icon className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual card */}
            <div className="lg:w-[45%]">
              <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900 p-8 shadow-2xl shadow-yellow-400/5">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/15 ring-1 ring-yellow-400/30">
                    <Rocket className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400/60">
                      Auto-Marketing
                    </p>
                    <p className="text-xl font-black text-white">
                      Zero Effort Growth
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { step: "1", text: "Platform auto-generates city pages that rank in Google search results" },
                    { step: "2", text: "Homeowners find their local area page and design their storage system" },
                    { step: "3", text: "They get matched with you — a confirmed job with deposit paid" },
                    { step: "4", text: "AI generates your social media posts so you can grow even faster" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
                        {item.step}
                      </div>
                      <p className="text-sm leading-relaxed text-stone-300">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 text-center">
                  <p className="text-xs font-bold text-yellow-400">
                    You build. The platform brings the customers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          INSTALLER TESTIMONIALS
      ══════════════════════════════════════════════════════════════════ */}
      <InstallerTestimonials />

      {/* ── Bottom CTA ───────────────────────────────────────────────── */}
      <section className="border-t border-slate-800 bg-slate-950 px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-3 text-2xl font-black uppercase text-white sm:text-3xl">
            Ready to Stop Chasing Leads?
          </h2>
          <p className="mb-6 text-sm text-stone-400">
            Create your account in 60 seconds. No credit card. No commitment.
          </p>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Create Account Now
            </button>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 text-sm font-semibold text-stone-400 transition-colors hover:text-yellow-400"
            >
              <Video className="h-4 w-4" />
              Prefer a walkthrough first? Book a free demo call
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app
          </p>
          <a
            href="/login"
            className="text-[11px] text-stone-600 transition-colors hover:text-yellow-400"
          >
            Partner Login
          </a>
        </div>
      </footer>

      {/* AI Sales Chatbot */}
      <InstallerChatWidget />
    </div>
  );
}
