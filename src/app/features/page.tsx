"use client";

import Image from "next/image";
import dynamic from "next/dynamic";

const InstallerChatWidget = dynamic(() => import("@/components/chat/InstallerChatWidget"), { ssr: false });
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
  Package,
  QrCode,
  Rocket,
  Rows3,
  Shield,
  Sprout,
  Star,
  Target,
  TrendingUp,
  Users,
  Warehouse,
  Wrench,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Features Page — What's Included
//
// Single plan: $49/mo, 3% maintenance fee on direct leads, 15% on network leads.
// ═══════════════════════════════════════════════════════════════════════════

// ── Feature list data ────────────────────────────────────────────────────

interface FeatureRow {
  name: string;
  included: string | boolean;
  id: string;
  icon: React.ElementType;
  highlight?: boolean;
}

const FEATURES: FeatureRow[] = [
  { name: "Pre-Sold Leads from Network", included: true, id: "leads", icon: Target },
  { name: "3D Configurator & Quoting", included: true, id: "configurator", icon: Layout },
  { name: "Auto-Generated Material Lists", included: true, id: "materials", icon: ClipboardList, highlight: true },
  { name: "Auto-Generated Cut Plans", included: true, id: "cutplans", icon: Wrench, highlight: true },
  { name: "Smart Inventory Manager", included: true, id: "inventory", icon: Package },
  { name: "Direct Lead Maintenance Fee", included: "3%", id: "fees", icon: DollarSign, highlight: true },
  { name: "Network Lead Fee", included: "15%", id: "fees", icon: DollarSign },
  { name: "Stripe Instant Payouts", included: true, id: "payments", icon: CreditCard },
  { name: "Branded Booking Page", included: true, id: "booking", icon: Globe },
  { name: "Job Scheduling & Calendar", included: true, id: "scheduling", icon: Calendar },
  { name: "AI Marketing Scripts", included: true, id: "marketing", icon: Megaphone },
  { name: "Where to Post Finder", included: true, id: "marketing", icon: Target },
  { name: "Installer Community", included: true, id: "community", icon: Users, highlight: true },
  { name: "Guides & Training Library", included: true, id: "guides", icon: BookOpen },
  { name: "Photo QR Upload (Desktop)", included: true, id: "community", icon: Camera },
  { name: "Referral Bounty Program", included: true, id: "referrals", icon: Banknote, highlight: true },
  { name: "Analytics Dashboard", included: true, id: "analytics", icon: BarChart3 },
  { name: "Custom Pricing Controls", included: true, id: "pricing", icon: Calculator },
  { name: "Open Shelving Systems", included: true, id: "shelving", icon: Rows3, highlight: true },
  { name: "Overhead Ceiling Storage", included: true, id: "overhead", icon: Warehouse, highlight: true },
  { name: "Raised Bed Planters", included: true, id: "raised-beds", icon: Sprout, highlight: true },
  { name: "Customer Tote Inventory", included: true, id: "tote-inventory", icon: QrCode, highlight: true },
  { name: "Verified Customer Reviews", included: true, id: "reviews", icon: Star, highlight: true },
  { name: "Auto-Marketing Engine", included: "Coming Soon", id: "auto-marketing", icon: Rocket, highlight: true },
];

export default function FeaturesPage() {
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
            every feature included in your subscription.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Start Your Trial
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              See All Features
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
          WHAT'S INCLUDED — Feature List
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            What&apos;s Included
          </p>
          <h2 className="mb-4 text-center text-3xl font-black text-white md:text-4xl">
            Everything, One Plan
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-sm text-stone-400">
            Full platform access — every tool, every feature, no upsells.
            3% maintenance fee on direct leads, 15% on network leads.
          </p>

          {/* Pricing card */}
          <div className="mx-auto mb-10 max-w-sm rounded-2xl border-2 border-yellow-400/30 bg-yellow-400/[0.03] p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Pro</p>
            <div className="mt-1 flex items-center justify-center gap-3">
              <span className="text-2xl font-black text-stone-600 line-through decoration-red-500/70 decoration-2">$99</span>
              <span className="text-4xl font-black text-yellow-400">$49</span>
            </div>
            <p className="text-sm text-yellow-400/60">/month</p>
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2">
              <p className="text-xs font-bold text-amber-400">Limited Time — Next 50 Installers Only</p>
              <p className="text-[10px] text-amber-400/60 mt-0.5">Lock in $49/mo before it goes back to $99</p>
            </div>
            <p className="mt-3 text-xs text-stone-500">3% maintenance fee on direct leads &middot; 15% on network leads</p>
          </div>

          {/* Feature rows */}
          <div className="overflow-hidden rounded-xl border border-slate-700">
            {FEATURES.map((f, i) => (
              <a
                key={i}
                href={`#${f.id}`}
                className={`grid grid-cols-[1fr_100px] gap-0 border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${
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
                <div className="flex items-center justify-center py-3">
                  {typeof f.included === "boolean" ? (
                    f.included ? (
                      <Check className="h-4 w-4 text-yellow-400" />
                    ) : null
                  ) : (
                    <span className="text-sm font-black text-yellow-400">{f.included}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE FEE STRUCTURE
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="fees" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400">
            Simple Pricing
          </p>
          <h2 className="mb-4 text-center text-3xl font-black text-white md:text-4xl">
            Transparent Fees. No Surprises.
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-sm text-stone-400">
            Two fee tiers based on where the lead comes from. Direct leads you bring in yourself
            have a low 3% maintenance fee. Network leads we find for you are 15%.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Direct leads */}
            <div className="rounded-2xl border-2 border-yellow-400/30 bg-yellow-400/[0.03] p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">Direct Leads</span>
                <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-[10px] font-bold text-yellow-400">3% MAINTENANCE FEE</span>
              </div>
              <p className="text-sm leading-relaxed text-stone-400">
                Jobs from your own customers via your personal booking link. You drive the traffic
                through your marketing — Craigslist, Facebook, Instagram, word of mouth — and the
                platform handles the rest. You keep the vast majority of every dollar.
              </p>
            </div>

            {/* Network leads */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Network Leads</span>
                <span className="rounded-full bg-stone-800 px-3 py-1 text-[10px] font-bold text-stone-400">15% FEE</span>
              </div>
              <p className="text-sm leading-relaxed text-stone-400">
                Jobs we find for you through the Storage Network marketplace. Customers come to
                the platform, design their build, and get matched with an installer in their area.
                You didn&apos;t lift a finger to get the lead — the platform did the selling for you.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-stone-600">
            The more direct leads you generate, the more you keep. Use the marketing tools and your personal booking link to maximize your 3% rate.
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
                  Included
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
                  Included
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

      {/* ── Material Lists & Cut Plans ──────────────────────────────────── */}
      <section id="materials" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <ClipboardList className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Included
                </span>
              </div>
              <h3 id="cutplans" className="mb-3 scroll-mt-8 text-2xl font-black text-white">Material Lists &amp; Cut Plans</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Save hours of planning on every single job.
                The platform auto-generates a complete shopping list and a board-by-board
                cut plan with fractional measurements — so you walk into the lumber yard
                knowing exactly what to grab and exactly where to cut. Material lists include
                direct purchase links for specialty items like caster kits, so you can click
                through and order the exact hardware we recommend — vetted for quality and value.
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
                  <li>Direct purchase links for caster kits and specialty hardware</li>
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
                  Included
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
                  Included
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
                  Included
                </span>
              </div>
              <h3 id="scheduling" className="mb-3 scroll-mt-8 text-2xl font-black text-white">Branded Booking &amp; Scheduling</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Every installer gets a personal booking link that opens the configurator
                with your branding. Share it on your Instagram, Craigslist ads, business
                cards — anywhere. Jobs that come through your link are &quot;direct leads&quot;
                and qualify for the 3% maintenance fee rate instead of 15%.
              </p>
              <ul className="space-y-2">
                {[
                  "Your own booking URL: storage-network.app/i/your-slug",
                  "Set your working days and blackout dates",
                  "Automatic availability management",
                  "Reschedule jobs with one tap — customer gets notified",
                  "Direct leads from your link = 3% maintenance fee",
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
                  Included
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
                  "Every direct lead you generate = 3% maintenance fee",
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

      {/* ── Community ────────────────────────────────────────────────────── */}
      <section id="community" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Users className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Included
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Installer Community</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Connect with other installers. Share build photos, ask questions,
                swap tips on tricky installs, and learn what&apos;s working in other
                markets. The community keeps the quality
                high and the conversations relevant.
              </p>
              <ul className="space-y-2">
                {[
                  "Post builds, ask questions, share tips",
                  "Comment threads on every post",
                  "Photo uploads with QR code support (desktop \u2192 phone)",
                  "High signal-to-noise ratio",
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

      {/* ── Referral Bounties ────────────────────────────────────────────── */}
      <section id="referrals" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Banknote className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
              Included
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
              Included
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

      {/* ── Custom Pricing ───────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
              <Calculator className="h-4 w-4 text-yellow-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
              Included
            </span>
          </div>
          <h3 className="mb-3 text-2xl font-black text-white">Custom Pricing Controls</h3>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-stone-400">
            Customize your pricing structure. Adjust your base
            rates, add delivery fees, and tailor quotes for your local market.
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
              Included
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

      {/* ── Open Shelving Systems ────────────────────────────────────────── */}
      <section id="shelving" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Rows3 className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  New Feature
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Open Shelving Systems</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Not every garage needs totes. Open shelving gives your customers a clean, versatile
                storage option for tools, bins, paint cans, and everything in between. The platform
                now supports full open shelving configurations &mdash; designed, quoted, and planned
                just like tote organizers.
              </p>
              <ul className="space-y-2">
                {[
                  "Multiple width and height configurations",
                  "Auto-generated material lists and cut plans",
                  "Full 3D preview in the configurator",
                  "Seamless quoting — same workflow as tote units",
                  "Combine with tote organizers in multi-unit orders",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                Why Offer Open Shelving
              </p>
              <div className="space-y-3">
                {[
                  { title: "Upsell Opportunity", desc: "Customers designing a tote organizer often want shelving for the rest of the wall. Now they can add it in the same order." },
                  { title: "Faster Builds", desc: "Open shelving is quicker to build than tote systems. More jobs per day, higher throughput." },
                  { title: "Broader Market", desc: "Not every customer needs totes. Open shelving captures the segment that just wants clean, sturdy garage shelves." },
                ].map((s) => (
                  <div key={s.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
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
      </section>

      {/* ── Overhead Ceiling Storage ──────────────────────────────────────── */}
      <section id="overhead" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="order-2 md:order-1">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                  How It Works
                </p>
                <div className="space-y-3">
                  {[
                    { step: "1", title: "Customer selects dimensions", desc: "Width, depth, and drop height — all configurable in the design tool" },
                    { step: "2", title: "3D preview renders instantly", desc: "See the overhead unit mounted to the ceiling in the configurator" },
                    { step: "3", title: "Material list auto-generates", desc: "Lumber, hardware, lag bolts — everything calculated for a ceiling mount" },
                    { step: "4", title: "You install and get paid", desc: "Same workflow — accept the job, build it, tap complete" },
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
            <div className="order-1 md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Warehouse className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  New Feature
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Overhead Ceiling Storage</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Maximize every inch of the garage. Overhead ceiling storage uses the dead space above
                vehicles and walkways to create heavy-duty storage platforms mounted directly to the
                ceiling joists. Customers configure width, depth, and drop height &mdash; and the
                platform handles the rest.
              </p>
              <ul className="space-y-2">
                {[
                  "Customizable width, depth, and ceiling drop height",
                  "Full 3D visualization mounted to ceiling",
                  "Auto-calculated material lists including lag bolts and hardware",
                  "Combine with wall-mounted tote organizers and shelving",
                  "High-ticket upsell — customers love reclaiming ceiling space",
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

      {/* ── Raised Bed Planters ──────────────────────────────────────── */}
      <section id="raised-beds" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Sprout className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  New Product
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Raised Bed Planters</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Handmade cedar raised bed planters — elevated with legs or ground-level. Customers
                configure size, finish (natural cedar, stain, liner, or painted white), planting depth,
                and pest protection covers all through the same 3D design tool. A high-margin product
                that&apos;s in massive demand from homeowners with gardens.
              </p>
              <ul className="space-y-2">
                {[
                  "8 sizes: 12\"×48\" to 48\"×48\", elevated or ground-level",
                  "4 finish options with custom installer pricing",
                  "4 pest protection covers: hoop netting to 48\" cabinet cage",
                  "3D preview + instant pricing in the configurator",
                  "Full quote integration — add alongside tote racks",
                  "Toggle on/off in your profile settings",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6 md:order-1">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                Why Offer Planters
              </p>
              <div className="space-y-3">
                {[
                  { title: "Seasonal Revenue Stream", desc: "Spring and summer demand is massive. Planters sell year-round as gifts, too. This product fills the seasonal gap when garage projects slow down." },
                  { title: "High Margins", desc: "Cedar planters are premium products with strong margins. Platform defaults start at $165 and scale to $675+ with pest covers. Your pricing, your profit." },
                  { title: "Upsell on Every Job", desc: "Every customer who books a garage storage build is a homeowner who likely gardens. One conversation can add $200-500+ to the ticket." },
                ].map((s) => (
                  <div key={s.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Customer Tote Inventory ────────────────────────────────────── */}
      <section id="tote-inventory" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <QrCode className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Included
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Customer Tote Inventory</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Every rack you build comes with a free digital inventory system for your customer.
                They scan a QR code on the rack and instantly manage what&apos;s in every tote &mdash;
                no app download, no login required. AI photo scanning identifies contents automatically.
              </p>
              <ul className="space-y-2">
                {[
                  "QR code printed and attached to each rack",
                  "AI photo scan — snap a photo, contents identified instantly",
                  "Organization score tracks progress and motivates customers",
                  "Search across all totes — \"where are my Christmas lights?\"",
                  "Category emoji labels for at-a-glance visual organization",
                  "Share with household — family members access the same inventory",
                  "Always free for your customers, forever",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                Why This Drives Repeat Business
              </p>
              <div className="space-y-3">
                {[
                  { title: "Customers Stay Engaged", desc: "Once they've cataloged 20+ totes of holiday decorations, tools, and camping gear — they're never ripping out that rack. And they'll tell their neighbors." },
                  { title: "Built-In Referral Engine", desc: "Every inventory page has a \"Need More Storage?\" link that goes directly to your branded design page. When totes fill up, the lead comes back to you." },
                  { title: "Premium Differentiator", desc: "No other shelf builder offers a digital inventory system. This is the kind of value-add that wins the job before you even show up." },
                ].map((s) => (
                  <div key={s.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Verified Customer Reviews ──────────────────────────────────── */}
      <section id="reviews" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10 ring-1 ring-yellow-400/20">
                  <Star className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400/60">
                  Included
                </span>
              </div>
              <h3 className="mb-3 text-2xl font-black text-white">Verified Customer Reviews</h3>
              <p className="mb-4 text-sm leading-relaxed text-stone-400">
                Build trust with verified reviews from real customers. Every review is tied to an actual
                paid job on the platform and displayed with a <span className="text-emerald-400 font-semibold">&#10003; Verified</span> badge.
                Reviews are showcased on your portfolio page with star ratings, distribution bars,
                and quick-tap tags.
              </p>
              <ul className="space-y-2">
                {[
                  "One-click review request from any completed job",
                  "Copy link to text, DM, or share however you want",
                  "No customer login required — review in 30 seconds",
                  "Quick-tap tags: Professional, On Time, Quality Build, etc.",
                  "Star rating + headline + detailed comment",
                  "Portfolio page shows average rating + distribution chart",
                  "Toggle reviews on/off from your profile settings",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6 md:order-1">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                Why Reviews Win You More Jobs
              </p>
              <div className="space-y-3">
                {[
                  { title: "Social Proof Converts", desc: "92% of consumers read reviews before making a purchase. Your portfolio with verified reviews converts browsers into booked jobs." },
                  { title: "The Verified Badge", desc: "Every review is tied to a real paid job — not fake, not incentivized. The \"Verified Purchase\" badge means something, and customers notice." },
                  { title: "Your Reputation, Quantified", desc: "Average rating, star distribution, top tags like \"Professional\" and \"On Time\" — all displayed beautifully on your portfolio page for every visitor to see." },
                ].map((s) => (
                  <div key={s.title} className="flex gap-3">
                    <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{s.title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-stone-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample review card */}
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="flex items-center gap-1 mb-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 uppercase">
                    <Shield className="h-2.5 w-2.5" /> Verified
                  </span>
                </div>
                <p className="text-xs font-bold text-white mb-0.5">Incredible craftsmanship</p>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  &ldquo;The team was professional, on time, and the build quality is outstanding.
                  My garage has never been this organized.&rdquo;
                </p>
                <p className="text-[10px] text-stone-600 mt-1.5">Sarah M. &bull; 2 weeks ago</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Auto-Marketing Engine (Coming Soon) ──────────────────────────── */}
      <section id="auto-marketing" className="scroll-mt-8 border-b border-slate-800 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5">
              <Rocket className="h-4 w-4 text-yellow-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">
                Coming Soon
              </span>
            </div>
            <h3 className="mb-3 text-3xl font-black text-white md:text-4xl">
              Auto-Marketing Engine
            </h3>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-stone-400">
              The platform is building a full-scale automated marketing system designed
              to drive customers directly to installers &mdash; without you spending a
              dime on ads or writing a single post.
            </p>
          </div>

          {/* Already Live */}
          <div className="mb-6 rounded-2xl border-2 border-emerald-400/30 bg-emerald-400/[0.03] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Already Live
              </span>
            </div>
            <h4 className="mb-2 text-lg font-bold text-white">
              Auto-Generated City &amp; Service Pages
            </h4>
            <p className="mb-4 text-sm leading-relaxed text-stone-400">
              The platform automatically generates SEO-optimized landing pages for cities and
              metro areas across the country. When a homeowner searches for garage storage
              solutions in their area, these pages rank in search results and funnel them
              directly into the configurator &mdash; where they get matched with a local
              installer. This is already running and driving organic traffic to the network.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: "Nationwide Coverage", desc: "Pages generated for thousands of cities and zip codes across the US" },
                { title: "SEO-Optimized", desc: "Built for search engines — title tags, meta descriptions, structured data, local keywords" },
                { title: "Auto-Updated", desc: "Pages refresh automatically as new installers join and coverage areas expand" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.02] p-3">
                  <p className="text-xs font-bold text-emerald-400">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Soon */}
          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.03] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400/15">
                <Rocket className="h-4 w-4 text-yellow-400" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                Coming Soon
              </span>
            </div>
            <h4 className="mb-2 text-lg font-bold text-white">
              AI-Powered Social Media &amp; Marketing Strategy
            </h4>
            <p className="mb-4 text-sm leading-relaxed text-stone-400">
              We&apos;re building a system that auto-generates complete marketing plans for installers &mdash;
              ready-to-post Instagram content with captions, hashtags, and visual direction, plus a
              full strategic calendar so you always know what to post and when. No marketing
              experience needed. The platform does the thinking for you.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Instagram Post Generator",
                  desc: "Auto-generates lists of Instagram posts complete with copy, captions, hashtags, and content direction. Just post and go.",
                },
                {
                  title: "Full Marketing Strategy",
                  desc: "A planned-out content calendar with post topics, timing recommendations, and platform-specific strategies tailored to your market.",
                },
                {
                  title: "Multi-Platform Ready",
                  desc: "Content formatted for Instagram, Facebook, TikTok, and Nextdoor — one generation, every platform covered.",
                },
                {
                  title: "Localized to Your Area",
                  desc: "Posts reference your service area, local neighborhoods, and regional trends. Not generic — built for your market.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
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
            Start your trial and see every feature in action. The trial ends when the
            platform demonstrates its true value — after 3 paid jobs land in your dashboard.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/join"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-10 py-4 text-sm font-black uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:-translate-y-0.5"
            >
              Start Your Trial
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 text-sm font-bold text-stone-300 transition-all hover:border-yellow-400/30 hover:text-white"
            >
              Book a Demo
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
      {/* AI Sales Chatbot */}
      <InstallerChatWidget />
    </div>
  );
}
