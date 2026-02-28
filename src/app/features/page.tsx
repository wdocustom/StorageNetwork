"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Banknote,
  BookOpen,
  Calculator,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  Globe,
  Layout,
  Megaphone,
  Minus,
  Package,
  Star,
  Target,
  TrendingUp,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Features Page — Master reference: Free vs Pro comparison
//
// Not linked publicly yet. Lives at /features for internal reference.
// ═══════════════════════════════════════════════════════════════════════════

// ── Feature comparison data ──────────────────────────────────────────────

interface FeatureRow {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  id: string;
  icon: React.ElementType;
  highlight?: boolean;
}

const FEATURES: FeatureRow[] = [
  { name: "Pre-Sold Leads from Network", free: true, pro: true, id: "leads", icon: Target },
  { name: "3D Configurator & Quoting", free: true, pro: true, id: "configurator", icon: Layout },
  { name: "Auto-Generated Material Lists", free: false, pro: true, id: "materials", icon: ClipboardList, highlight: true },
  { name: "Auto-Generated Cut Plans", free: false, pro: true, id: "cutplans", icon: Wrench, highlight: true },
  { name: "Smart Inventory Manager", free: true, pro: true, id: "inventory", icon: Package },
  { name: "Direct Lead Fee", free: "15%", pro: "3%", id: "fees", icon: DollarSign, highlight: true },
  { name: "Network Lead Fee", free: "15%", pro: "15%", id: "fees", icon: DollarSign },
  { name: "Stripe Instant Payouts", free: true, pro: true, id: "payments", icon: CreditCard },
  { name: "Branded Booking Page", free: true, pro: true, id: "booking", icon: Globe },
  { name: "Job Scheduling & Calendar", free: true, pro: true, id: "scheduling", icon: Calendar },
  { name: "AI Marketing Scripts", free: true, pro: true, id: "marketing", icon: Megaphone },
  { name: "Where to Post Finder", free: true, pro: true, id: "marketing", icon: Target },
  { name: "Installer Community", free: false, pro: true, id: "community", icon: Users, highlight: true },
  { name: "Guides & Training Library", free: true, pro: true, id: "guides", icon: BookOpen },
  { name: "Photo QR Upload (Desktop)", free: false, pro: true, id: "community", icon: Camera },
  { name: "Referral Bounty Program", free: false, pro: true, id: "referrals", icon: Banknote, highlight: true },
  { name: "Analytics Dashboard", free: true, pro: true, id: "analytics", icon: BarChart3 },
  { name: "Custom Pricing Controls", free: false, pro: true, id: "pricing", icon: Calculator },
];

// ── Job analysis scenarios ───────────────────────────────────────────────
import { getMarketingComparison } from "@/app/actions/fee-engine";

const SCENARIOS = [
  { label: "Small Pantry Build", price: 400, materials: 60 },
  { label: "Standard Garage Unit", price: 800, materials: 120 },
  { label: "Full Garage Build (2 units)", price: 1600, materials: 220 },
  { label: "Premium Custom Build", price: 2400, materials: 310 },
];

export default function FeaturesPage() {
  const [selectedScenario, setSelectedScenario] = useState(1);
  const scenario = SCENARIOS[selectedScenario];

  // Fee comparison — computed server-side (black box)
  const [comparison, setComparison] = useState({ freeProfit: 0, proProfit: 0, freeFee: 0, proFee: 0, savings: 0, monthlyPrice: 49 });
  useEffect(() => {
    getMarketingComparison(scenario.price, scenario.materials).then(setComparison);
  }, [scenario.price, scenario.materials]);
  const { freeProfit, proProfit, savings } = comparison;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-slate-800 pb-20 pt-16">
        {/* Subtle grid bg */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#facc15 1px, transparent 1px), linear-gradient(90deg, #facc15 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <a href="/" className="mb-8 inline-block">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={72}
              height={72}
              className="mx-auto h-[72px] w-auto object-contain"
            />
          </a>

          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-400">
            Platform Features
          </p>
          <h1 className="mx-auto mb-4 max-w-3xl text-4xl font-black leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
            Everything You Need.
            <br />
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
              Nothing You Don&apos;t.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-stone-400">
            The Storage Network platform handles sales, planning, payments, and
            marketing so you can focus on what you do best — building. Here&apos;s
            every feature, and why Pro pays for itself on your first job.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Start Free Trial
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="#comparison"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              Compare Plans
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — 3 Step Overview
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-slate-800 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            How It Works
          </p>
          <h2 className="mb-12 text-center text-3xl font-black text-white md:text-4xl">
            Three Steps. That&apos;s It.
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                icon: Target,
                title: "We Sell the Job",
                desc: "Customers design their storage unit in our 3D configurator and pay a deposit. The job is pre-sold before you ever hear about it.",
              },
              {
                step: "2",
                icon: ClipboardList,
                title: "You Get the Plan",
                desc: "Material list, cut plan with fractions, plywood rail counts, back supports — everything calculated down to the inch. Just grab your lumber and go.",
              },
              {
                step: "3",
                icon: Banknote,
                title: "Build. Get Paid. Repeat.",
                desc: "Tap \"Complete\" when you're done. The customer pays, and funds hit your bank account via Stripe. No invoicing, no chasing checks.",
              },
            ].map((block) => (
              <div
                key={block.step}
                className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-sm font-black text-yellow-400 ring-1 ring-yellow-400/20">
                    {block.step}
                  </div>
                  <block.icon className="h-5 w-5 text-yellow-400" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{block.title}</h3>
                <p className="text-sm leading-relaxed text-stone-400">{block.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PLAN COMPARISON TABLE
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="comparison" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Plans &amp; Pricing
          </p>
          <h2 className="mb-4 text-center text-3xl font-black text-white md:text-4xl">
            Free vs. Pro
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-sm text-stone-400">
            Every installer starts with a 7-day Pro trial. No credit card required.
            After that, choose the plan that fits — or let the math decide for you.
          </p>

          {/* Plan headers */}
          <div className="mb-0 grid grid-cols-[1fr_120px_120px] gap-0 md:grid-cols-[1fr_160px_160px]">
            <div />
            <div className="rounded-t-xl border border-b-0 border-slate-700 bg-slate-800 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Free</p>
              <p className="text-lg font-black text-white">$0</p>
              <p className="text-[10px] text-stone-600">forever</p>
            </div>
            <div className="rounded-t-xl border border-b-0 border-yellow-400/30 bg-yellow-400/5 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Pro</p>
              <p className="text-lg font-black text-yellow-400">$99</p>
              <p className="text-[10px] text-yellow-400/60">/month</p>
            </div>
          </div>

          {/* Feature rows */}
          <div className="overflow-hidden rounded-b-xl border border-slate-700">
            {FEATURES.map((f, i) => (
              <a
                key={i}
                href={`#${f.id}`}
                className={`grid grid-cols-[1fr_120px_120px] gap-0 border-b border-slate-800 transition-colors hover:bg-slate-800/50 md:grid-cols-[1fr_160px_160px] ${
                  f.highlight ? "bg-yellow-400/[0.02]" : ""
                } ${i === FEATURES.length - 1 ? "border-b-0" : ""}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <f.icon className="hidden h-4 w-4 shrink-0 text-stone-600 sm:block" />
                  <span className="text-sm font-medium text-stone-300">{f.name}</span>
                  {f.highlight && (
                    <span className="hidden rounded bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-yellow-400 sm:inline-block">
                      Key
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center border-x border-slate-800 py-3">
                  {typeof f.free === "boolean" ? (
                    f.free ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-700" />
                    )
                  ) : (
                    <span className="text-sm font-bold text-stone-400">{f.free}</span>
                  )}
                </div>
                <div className="flex items-center justify-center py-3">
                  {typeof f.pro === "boolean" ? (
                    f.pro ? (
                      <Check className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Minus className="h-4 w-4 text-stone-700" />
                    )
                  ) : (
                    <span className="text-sm font-black text-yellow-400">{f.pro}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE MONEY MATH — Interactive Scenario Calculator
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="fees" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            The No-Brainer Math
          </p>
          <h2 className="mb-4 text-center text-3xl font-black text-white md:text-4xl">
            Pro Pays for Itself. Every Single Month.
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-sm text-stone-400">
            On your own direct leads, Free plan charges 15%. Pro drops it to 3%.
            That 12% difference adds up fast. Pick a scenario:
          </p>

          {/* Scenario selector */}
          <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCENARIOS.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedScenario(i)}
                className={`rounded-lg border px-3 py-3 text-center transition-all ${
                  selectedScenario === i
                    ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                    : "border-slate-700 bg-slate-800 text-stone-600 hover:border-slate-600 hover:text-stone-400"
                }`}
              >
                <p className="text-xs font-bold">{s.label}</p>
                <p className="mt-1 text-lg font-black">${s.price.toLocaleString()}</p>
              </button>
            ))}
          </div>

          {/* Side-by-side comparison */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Free column */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Free Plan</span>
                <span className="rounded-full bg-stone-800 px-3 py-1 text-[10px] font-bold text-stone-400">15% FEE</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Job Price</span>
                  <span className="font-bold text-white">${scenario.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Platform Fee (15%)</span>
                  <span className="font-bold text-red-400">-${comparison.freeFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Est. Materials</span>
                  <span className="font-bold text-stone-400">-${scenario.materials.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-stone-400">Your Profit</span>
                    <span className="text-xl font-black text-white">${freeProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pro column */}
            <div className="rounded-2xl border-2 border-yellow-400/30 bg-yellow-400/[0.03] p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Pro Plan</span>
                <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-[10px] font-bold text-yellow-400">3% FEE</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Job Price</span>
                  <span className="font-bold text-white">${scenario.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Platform Fee (3%)</span>
                  <span className="font-bold text-emerald-400">-${comparison.proFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Est. Materials</span>
                  <span className="font-bold text-stone-400">-${scenario.materials.toLocaleString()}</span>
                </div>
                <div className="border-t border-yellow-400/20 pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-yellow-400">Your Profit</span>
                    <span className="text-xl font-black text-yellow-400">${proProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Savings callout */}
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <p className="mb-1 text-sm font-bold text-emerald-400">
              You keep an extra ${savings.toLocaleString()} on this one job alone.
            </p>
            <p className="text-xs text-stone-500">
              At just 2 direct jobs per month, that&apos;s <span className="font-bold text-white">${(savings * 2).toLocaleString()}/mo extra</span> in your pocket — minus the ${comparison.monthlyPrice} subscription, you net{" "}
              <span className="font-bold text-emerald-400">${(savings * 2 - comparison.monthlyPrice).toLocaleString()}/mo more</span> than Free plan.
            </p>
            <p className="mt-3 text-xs text-stone-600">
              At 4 direct jobs/month → <span className="text-white font-bold">${(savings * 4 - comparison.monthlyPrice).toLocaleString()}/mo</span> extra profit. At 8 → <span className="text-white font-bold">${(savings * 8 - comparison.monthlyPrice).toLocaleString()}/mo</span>. The more you build, the more Pro saves.
            </p>
          </div>

          <p className="mt-4 text-center text-[11px] text-stone-600">
            Network leads (jobs we find for you) are 15% on both plans. The 3% Pro rate applies to direct leads — jobs from your own customers via your booking link.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURE DEEP DIVES
      ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Pre-Sold Leads ─────────────────────────────────────────────── */}
      <section id="leads" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Target className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Pre-Sold Leads</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                You never cold-call. You never quote. Customers come to the platform,
                design their storage unit in our 3D configurator, and pay a deposit
                before you&apos;re even assigned the job. By the time you see it in your
                dashboard, the customer is confirmed and ready.
              </p>
              <ul className="space-y-2">
                {[
                  "Customer pays deposit upfront — skin in the game",
                  "Full address, contact info, and project specs included",
                  "Accept or pass — no obligation",
                  "Job ticket includes material list, cut plans, and financials",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Screenshot placeholder */}
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
              <Image
                src="/feature-leads-dashboard.png"
                alt="Leads dashboard"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Configurator ────────────────────────────────────────────── */}
      <section id="configurator" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 md:order-1">
              <Image
                src="/feature-configurator.png"
                alt="3D configurator"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Layout className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">3D Configurator &amp; Quoting</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Customers build their own storage unit in a visual configurator — choosing
                columns, rows, tote type (HDX or Greenmade), color, wheels, and tops.
                Pricing updates in real time. They see exactly what they&apos;re getting and
                pay a deposit to confirm. No back-and-forth. No surprises.
              </p>
              <ul className="space-y-2">
                {[
                  "Visual 3D preview of the final build with dimensions",
                  "Supports HDX (19-3/4\" opening) and Greenmade (20-3/4\" opening)",
                  "Standard and sideways orientations",
                  "Auto-calculates state sales tax",
                  "Branded with your business when using your booking link",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Material Lists & Cut Plans (PRO) ──────────────────────────── */}
      <section id="materials" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <ClipboardList className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="rounded bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                  Pro Only
                </span>
              </div>
              <h3 id="cutplans" className="mb-3 scroll-mt-8 text-2xl font-black text-white">Material Lists &amp; Cut Plans</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                This is where Pro installers save hours of planning on every single job.
                The platform auto-generates a complete shopping list and a board-by-board
                cut plan with fractional measurements — so you walk into the lumber yard
                knowing exactly what to grab and exactly where to cut.
              </p>
              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Material List Includes:
                </p>
                <ul className="space-y-1 text-xs text-stone-400">
                  <li>2x4 studs with exact qty</li>
                  <li>3/4&quot; plywood sheet count</li>
                  <li>Tote count by type and color</li>
                  <li>Wheel kits, screws (1&quot;, 1-5/8&quot;, 3&quot;), wood glue</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Cut Plan Includes:
                </p>
                <ul className="space-y-1 text-xs text-stone-400">
                  <li>Visual board diagrams — color-coded cuts with fraction labels</li>
                  <li>Plywood rail strips + back supports per module</li>
                  <li>Vertical post spacing (19-3/4&quot; HDX / 20-3/4&quot; Greenmade)</li>
                  <li>Waste tracking per board (minimize scrap)</li>
                </ul>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
              <Image
                src="/feature-cutplan.png"
                alt="Cut plan and material list"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Smart Inventory Manager ─────────────────────────────────────── */}
      <section id="inventory" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-2 md:order-1">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Package className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Smart Inventory Manager</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                This is the feature that turns a side hustle into a real business. The
                inventory manager tracks every screw, every plywood strip, every leftover
                from every job — so your purchase list only shows what you actually need to
                buy. No spreadsheets. No guessing at the lumber yard. No buying a full box
                of 3&quot; screws when you already have 40 sitting in your garage from the
                last build.
              </p>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Most installers waste money on materials they already have because there&apos;s
                no easy way to track what&apos;s left over between jobs. The platform solves
                that automatically. When you complete a job, your inventory updates. When
                you open the next job ticket, the purchase list already accounts for
                what&apos;s in your stock. You just grab what&apos;s on the list and go build.
              </p>
            </div>
            <div className="order-1 md:order-2">
              {/* Inventory feature visual — card-style breakdown */}
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                  How It Works
                </p>
                <div className="space-y-3">
                  {[
                    { step: "1", title: "You complete a job", desc: "Leftover screws and plywood strips are logged automatically" },
                    { step: "2", title: "Next job comes in", desc: "The platform checks your stock before building the purchase list" },
                    { step: "3", title: "You only buy what\u2019s needed", desc: "Items covered by inventory are hidden \u2014 you see a clean shopping list" },
                    { step: "4", title: "Repeat", desc: "Every job makes the next one cheaper. Your inventory grows smarter over time" },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/20">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{s.title}</p>
                        <p className="text-xs leading-relaxed text-stone-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed breakdown cards */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-yellow-400/80">
                Screw Tracking
              </p>
              <p className="text-sm leading-relaxed text-stone-400">
                Tracks individual counts for 1&quot; screws, 1-5/8&quot; screws, and 3&quot; screws.
                Knows exactly how many are left over from your last job, calculates how
                many the next job needs, and only tells you to buy a new box when you
                actually need one. No more half-used boxes piling up.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-yellow-400/80">
                Plywood Offcut Recycling
              </p>
              <p className="text-sm leading-relaxed text-stone-400">
                When you cut tops from a plywood sheet, the leftover strips are usable as
                rail material for future builds. The platform tracks these offcuts and
                applies them to your next job before recommending new sheet purchases.
                One job&apos;s waste becomes the next job&apos;s free materials.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-yellow-400/80">
                Smart Purchase Lists
              </p>
              <p className="text-sm leading-relaxed text-stone-400">
                Your job ticket purchase list only shows what you genuinely need to buy.
                Items fully covered by your existing inventory are hidden from the main
                list so you get a clean, no-noise shopping experience. Walk into the store,
                grab exactly what&apos;s listed, and walk out. Done.
              </p>
            </div>
          </div>

          {/* Why it matters callout */}
          <div className="mt-8 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.03] p-6">
            <h4 className="mb-3 text-lg font-bold text-white">Why This Is a Gamechanger</h4>
            <p className="mb-4 text-sm leading-relaxed text-stone-400">
              Whether you&apos;re doing this part-time on weekends or running it as a full-time
              operation, material waste kills your margins. Every unnecessary box of screws
              or extra plywood sheet is money out of your pocket. The inventory manager
              eliminates that problem entirely — it runs in the background, updates itself
              after every job, and gives you the one thing every builder wants:
            </p>
            <p className="text-center text-lg font-black text-yellow-400">
              Just show up. Just build. The platform handles the rest.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              No separate inventory app. No notebook in your truck. No mental math at
              Home Depot trying to remember if you have screws left from Tuesday&apos;s
              job. It&apos;s all tracked, all automatic, and it gets smarter the more
              you build. Your fifth job is cheaper than your first — not because prices
              dropped, but because you&apos;re spending less on materials you already have.
            </p>
          </div>
        </div>
      </section>

      {/* ── Payments & Payouts ─────────────────────────────────────────── */}
      <section id="payments" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 md:order-1">
              <Image
                src="/feature-payment.png"
                alt="Payment and payout flow"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <CreditCard className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Instant Payments &amp; Payouts</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                No invoicing. No chasing checks. When the job is done, tap &quot;Complete,&quot;
                snap a proof photo, and the customer gets an invoice email with a payment link.
                You can also enter their card on-site, send the link via text, or mark it paid
                for cash/Venmo/Zelle. Funds go directly to your bank via Stripe Connect.
              </p>
              <ul className="space-y-2">
                {[
                  "One-tap job completion with proof photo",
                  "Auto-generated invoice emailed to customer",
                  "Manual card entry, SMS link, or mark paid (cash/Venmo)",
                  "Stripe Connect direct deposit to your bank",
                  "Full financial breakdown: fees, materials, net profit",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Booking & Scheduling ───────────────────────────────────────── */}
      <section id="booking" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Globe className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 id="scheduling" className="mb-3 scroll-mt-8 text-2xl font-black text-white">Branded Booking &amp; Scheduling</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Every installer gets a personal booking link that opens the configurator
                with your branding. Share it on your Instagram, Craigslist ads, business
                cards — anywhere. Jobs that come through your link are &quot;direct leads&quot;
                and qualify for the Pro 3% fee rate instead of 15%.
              </p>
              <ul className="space-y-2">
                {[
                  "Your own booking URL: storage-network.app/i/your-slug",
                  "Set your working days and blackout dates",
                  "Automatic availability management",
                  "Reschedule jobs with one tap — customer gets notified",
                  "Direct leads from your link = 3% fee on Pro",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
              <Image
                src="/feature-booking.png"
                alt="Booking and scheduling"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Marketing Tools ────────────────────────────────────────────── */}
      <section id="marketing" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 md:order-1">
              <Image
                src="/feature-marketing.png"
                alt="AI marketing script generator"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Megaphone className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Both Plans
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Marketing Tools</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Don&apos;t know what to post? The platform writes it for you. The AI Script
                Generator creates ready-to-post marketing copy for Facebook, Craigslist,
                Nextdoor, and Instagram — localized to your area. The &quot;Where to Post&quot;
                finder tells you exactly which local groups and sections to target.
              </p>
              <ul className="space-y-2">
                {[
                  "AI-powered ad copy for Facebook, Craigslist, Nextdoor, IG",
                  "Location-aware group finder with direct links",
                  "Craigslist section targeting (for sale, services, etc.)",
                  "Copy-to-clipboard one-tap posting",
                  "Every direct lead you generate = 3% fee on Pro (vs 15% Free)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community (PRO) ────────────────────────────────────────────── */}
      <section id="community" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Users className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="rounded bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                  Pro Only
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Installer Community</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Connect with other Pro installers. Share build photos, ask questions,
                swap tips on tricky installs, and learn what&apos;s working in other
                markets. The community is exclusive to Pro subscribers so the quality
                stays high and the conversations stay relevant.
              </p>
              <ul className="space-y-2">
                {[
                  "Post builds, ask questions, share tips",
                  "Comment threads on every post",
                  "Photo uploads with QR code support (desktop → phone)",
                  "Pro-only access keeps signal-to-noise ratio high",
                  "Learn from installers who are actively building",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
              <Image
                src="/feature-community.png"
                alt="Installer community"
                width={400}
                height={700}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Referral Bounties (PRO) ────────────────────────────────────── */}
      <section id="referrals" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Banknote className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="rounded bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
              Pro Only
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-black text-white">Referral Bounty Program</h3>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-stone-400">
            Know someone who&apos;d make a great installer? Refer them. When they join and
            start completing jobs, you earn a bounty. It&apos;s passive income on top of
            your build income — and it grows the network in your area, which means more
            capacity and faster delivery for customers nearby.
          </p>
        </div>
      </section>

      {/* ── Guides & Training ──────────────────────────────────────────── */}
      <section id="guides" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <BookOpen className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
              Both Plans
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-black text-white">Guides &amp; Training Library</h3>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-stone-400">
            Step-by-step installation guides, Instagram marketing tutorials, hashtag
            strategies, and content creation tips. Whether you&apos;re new to building
            or just new to selling your work, the training library gets you up to
            speed fast. Includes checklists you can follow on-site.
          </p>
        </div>
      </section>

      {/* ── Custom Pricing (PRO) ───────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Calculator className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="rounded bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
              Pro Only
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-black text-white">Custom Pricing Controls</h3>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-stone-400">
            Pro installers can customize their pricing structure. Adjust your base
            rates, add delivery fees, and tailor quotes for your local market. Standard
            plan uses the default network pricing.
          </p>
        </div>
      </section>

      {/* ── Analytics ──────────────────────────────────────────────────── */}
      <section id="analytics" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <BarChart3 className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
              Both Plans
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-black text-white">Analytics Dashboard</h3>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-stone-400">
            Track your booking link page views, lead conversion, and job history. See
            how your marketing efforts translate into actual bookings and revenue. Data
            drives decisions — know what&apos;s working and double down.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/10 ring-1 ring-yellow-400/20">
            <Zap className="h-8 w-8 text-yellow-400" />
          </div>
          <h2 className="mb-4 text-3xl font-black text-white md:text-4xl">
            Ready to Build Smarter?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-sm leading-relaxed text-stone-400">
            Start with a 7-day Pro trial. No credit card. No commitment. See every
            feature in action, complete a few jobs, and let the numbers speak for
            themselves. Most installers who try Pro never go back.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-10 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Start Free Trial
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              Book a Free Demo
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-6 text-[11px] text-stone-600">
            Already have an account?{" "}
            <a href="/login" className="font-semibold text-yellow-400 hover:text-yellow-300">
              Sign In
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6">
          <a href="/">
            <Image
              src="/Header_avatar_logo.png"
              alt="Storage Network"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
          </a>
          <p className="text-[10px] text-stone-700">
            &copy; {new Date().getFullYear()} Storage-Network.app
          </p>
          <div className="flex gap-4">
            <a href="/legal/terms" className="text-[10px] text-stone-600 transition-colors hover:text-yellow-400">
              Terms
            </a>
            <a href="/legal/privacy" className="text-[10px] text-stone-600 transition-colors hover:text-yellow-400">
              Privacy
            </a>
            <a href="/login" className="text-[10px] text-stone-600 transition-colors hover:text-yellow-400">
              Partner Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
