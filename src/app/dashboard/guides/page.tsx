"use client";

import { useState, Suspense, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckSquare,
  Square,
  ClipboardList,
  Instagram,
  MessageSquare,
  Play,
  PlayCircle,
  Camera,
  Hash,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import ProPill from "@/components/dashboard/ProPill";
import LadderJigPlans from "@/components/dashboard/LadderJigPlans";
import AdirondackChairPlans from "@/components/dashboard/AdirondackChairPlans";

// ═══════════════════════════════════════════════════════════════════════════
// Guides & Training Page — Tutorials + Installation Checklist
// ═══════════════════════════════════════════════════════════════════════════

const IG_HANDLE = "storagenetwork.app";
const IG_URL = `https://www.instagram.com/${IG_HANDLE}/`;

// Latest featured posts — update these to rotate content
const IG_POSTS = [
  {
    id: "1",
    label: "Full Garage Build",
    caption: "12-column unit with clear totes — the dream setup",
    type: "reel" as const,
  },
  {
    id: "2",
    label: "Mini Unit Install",
    caption: "Compact pantry storage in under 2 hours",
    type: "reel" as const,
  },
  {
    id: "3",
    label: "Before & After",
    caption: "From cluttered mess to organized perfection",
    type: "post" as const,
  },
];

// Installation checklist items
const INSTALLATION_CHECKLIST = [
  {
    id: "studs",
    text: "Locate Studs",
    detail: "Use magnetic stud finder",
  },
  {
    id: "header",
    text: "Level Header Rail",
    detail: "Laser level recommended",
  },
  {
    id: "verticals",
    text: "Secure Verticals",
    detail: "Use 3\" screws at stud locations",
  },
  {
    id: "totes",
    text: "Install Totes & Check Fit",
    detail: "Verify smooth slide in/out",
  },
  {
    id: "cleanup",
    text: "Cleanup",
    detail: "Wipe down units and sweep the installation area.",
  },
];

export default function GuidesPage() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  function toggleItem(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#chair-plans") return;
    const timer = setTimeout(() => {
      document.getElementById("chair-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Plans & Guides
            </h1>
            <p className="text-[11px] text-stone-500">Training Library</p>
          </div>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION: Ladder Building Jig Plans ($9 Digital Download)
        ═══════════════════════════════════════════════════════════════ */}
        <Suspense fallback={null}>
          <LadderJigPlans />
        </Suspense>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: Adirondack Chair Plans ($18 Plans / $60 Bundle)
        ═══════════════════════════════════════════════════════════════ */}
        <div id="chair-plans">
          <Suspense fallback={null}>
            <AdirondackChairPlans />
          </Suspense>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: Instagram Showcase
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-2xl border border-pink-500/20 bg-slate-900">
          {/* IG gradient header bar */}
          <div
            className="h-1"
            style={{
              background:
                "linear-gradient(to right, #833ab4, #fd1d1d, #fcb045)",
            }}
          />

          {/* Decorative glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pink-500/8 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-purple-500/8 blur-3xl" />

          <div className="relative p-5">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                  }}
                >
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    @{IG_HANDLE}
                  </p>
                  <p className="text-[10px] font-medium text-pink-400/80">
                    Watch. Learn. Build. Share.
                  </p>
                </div>
              </div>
              <a
                href={IG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
                }}
              >
                Follow
              </a>
            </div>

            <p className="mb-4 text-[13px] leading-relaxed text-stone-400">
              See real installs, time-lapse builds, and pro tips from
              installers across the network. New content every week.
            </p>

            {/* Latest Posts Grid */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {IG_POSTS.map((post) => (
                <a
                  key={post.id}
                  href={IG_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 transition-all hover:border-pink-500/30 hover:scale-[1.02]"
                >
                  {/* Gradient fill simulating post thumbnail */}
                  <div
                    className="absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60"
                    style={{
                      background:
                        post.id === "1"
                          ? "linear-gradient(135deg, #1e293b, #334155, #475569)"
                          : post.id === "2"
                            ? "linear-gradient(135deg, #1e293b, #2d3a4a, #3b4a5c)"
                            : "linear-gradient(135deg, #1e293b, #2a3444, #374151)",
                    }}
                  />

                  {/* Grid pattern overlay for texture */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* Content */}
                  <div className="relative flex h-full flex-col items-center justify-center p-2 text-center">
                    {post.type === "reel" ? (
                      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-transform group-hover:scale-110">
                        <Play className="h-3.5 w-3.5 text-white ml-0.5" />
                      </div>
                    ) : (
                      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-transform group-hover:scale-110">
                        <Camera className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                    <p className="text-[10px] font-bold leading-tight text-white/90">
                      {post.label}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-tight text-stone-500 line-clamp-2">
                      {post.caption}
                    </p>
                  </div>

                  {/* Reel badge */}
                  {post.type === "reel" && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/50 px-1 py-0.5 backdrop-blur-sm">
                      <Play className="h-2 w-2 text-white" />
                      <span className="text-[8px] font-bold text-white">
                        REEL
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>

            {/* CTA to visit IG page */}
            <a
              href={IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/5 px-4 py-3 text-sm font-bold text-pink-400 transition-all hover:border-pink-500/40 hover:bg-pink-500/10"
            >
              <Instagram className="h-4 w-4" />
              Watch Builds on Instagram
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>

            {/* Divider */}
            <div className="relative my-0 flex items-center">
              <div className="flex-1 border-t border-slate-700/50" />
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                Grow Your Brand
              </span>
              <div className="flex-1 border-t border-slate-700/50" />
            </div>

            {/* Installer CTA — start posting */}
            <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="mb-3 text-[13px] font-semibold leading-relaxed text-stone-300">
                Your builds are your best marketing. Start sharing them.
              </p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                    <Camera className="h-3 w-3 text-purple-400" />
                  </div>
                  <p className="text-xs text-stone-400">
                    <span className="font-semibold text-stone-300">Film your installs</span>{" "}
                    — time-lapses, before/afters, and finished builds make incredible content
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-pink-500/10">
                    <Hash className="h-3 w-3 text-pink-400" />
                  </div>
                  <p className="text-xs text-stone-400">
                    <span className="font-semibold text-stone-300">Tag @{IG_HANDLE}</span>{" "}
                    — we repost the best builds to the network feed and share them with every installer
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/10">
                    <Heart className="h-3 w-3 text-red-400" />
                  </div>
                  <p className="text-xs text-stone-400">
                    <span className="font-semibold text-stone-300">Build your local following</span>{" "}
                    — homeowners search IG for garage organization. Be the first thing they find in your area
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-700/30 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-stone-500">
                  <span className="font-semibold text-stone-400">Pro tip:</span>{" "}
                  Use hashtags like{" "}
                  <span className="font-mono text-pink-400/70">#StorageNetwork</span>{" "}
                  <span className="font-mono text-pink-400/70">#GarageOrganization</span>{" "}
                  <span className="font-mono text-pink-400/70">#ToteWall</span>{" "}
                  and tag your city. Customers who find you on social media are the warmest leads you&apos;ll get.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION: Community CTA
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-slate-900">
          {/* Yellow accent bar */}
          <div className="h-1 bg-gradient-to-r from-yellow-400 to-amber-500" />

          {/* Decorative glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-400/8 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-amber-500/8 blur-3xl" />

          <div className="relative p-5">
            {/* Header */}
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10">
                <Users className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Pro Community</p>
                  <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] font-medium text-yellow-400/60">
                  Connect. Learn. Grow.
                </p>
              </div>
            </div>

            <p className="mb-4 text-[13px] leading-relaxed text-stone-400">
              Get real advice from other pros who are building these units and
              growing their businesses. Ask questions, share wins, and learn
              what&apos;s working in your market.
            </p>

            {/* Features */}
            <div className="mb-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-yellow-500/10">
                  <MessageSquare className="h-3 w-3 text-yellow-400" />
                </div>
                <p className="text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">Builder discussions</span>{" "}
                  — pricing strategies, install tips, and business growth from experienced pros
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                  <TrendingUp className="h-3 w-3 text-amber-400" />
                </div>
                <p className="text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">Trending topics</span>{" "}
                  — see what other installers are talking about and what&apos;s working right now
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                </div>
                <p className="text-xs text-stone-400">
                  <span className="font-semibold text-stone-300">AI-powered summaries</span>{" "}
                  — never miss key insights from long threads
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <a
              href="/community"
              className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-gray-950 transition-all hover:bg-yellow-300"
            >
              <Users className="h-4 w-4" />
              Browse the Community
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION A: Tutorials
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Tutorials
            </h2>
          </div>

          <p className="mb-4 text-sm text-stone-400">
            Step-by-step guides to help you get the most out of the platform.
          </p>

          <div className="space-y-3">
            {/* Tutorial 1 — Create Quote */}
            <a
              href="https://youtu.be/LC2uZlzrHx0"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 transition-all hover:border-purple-500/50 hover:bg-purple-500/10"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 transition-colors group-hover:bg-purple-500/30">
                <Play className="h-5 w-5 text-purple-300 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white group-hover:text-purple-200">
                  How to Quote a Job
                </h3>
                <p className="text-[11px] text-stone-500">
                  Walk through the build tool from unit sizing to sending a professional quote.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                <Play className="h-2.5 w-2.5" />
                Watch Now
              </span>
            </a>

            {/* Tutorial 2 — 3D Configurator */}
            <a
              href="https://youtu.be/a1buHgU4i58"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 transition-all hover:border-blue-500/50 hover:bg-blue-500/10"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 transition-colors group-hover:bg-blue-500/30">
                <Play className="h-5 w-5 text-blue-300 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white group-hover:text-blue-200">
                  Using the 3D Configurator
                </h3>
                <p className="text-[11px] text-stone-500">
                  Learn how customers use the interactive designer and how leads flow to your dashboard.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
                <Play className="h-2.5 w-2.5" />
                Watch Now
              </span>
            </a>

            {/* Tutorial 3 — Marketing Your Business */}
            <a
              href="https://youtu.be/KygzEUkQJ64"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition-all hover:border-amber-500/50 hover:bg-amber-500/10"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 transition-colors group-hover:bg-amber-500/30">
                <Play className="h-5 w-5 text-amber-300 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white group-hover:text-amber-200">
                  Marketing Your Business
                </h3>
                <p className="text-[11px] text-stone-500">
                  Tips for sharing your link, using scripts, and converting local leads.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                <Play className="h-2.5 w-2.5" />
                Watch Now
              </span>
            </a>
            {/* Tutorial 4 — Using the How-To Guide (Coming Soon) */}
            <div
              className="group flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 opacity-60"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-700/40">
                <Play className="h-5 w-5 text-stone-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-300">
                  Using the How-To Guide
                </h3>
                <p className="text-[11px] text-stone-600">
                  Navigate the guides section, find answers fast, and make the most of every resource.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>

            {/* Tutorial 5 — General Features of Storage-Network.app (Coming Soon) */}
            <div
              className="group flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 opacity-60"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-700/40">
                <Play className="h-5 w-5 text-stone-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-300">
                  General Features of Storage-Network.app
                </h3>
                <p className="text-[11px] text-stone-600">
                  A complete walkthrough of the platform — dashboard, leads, scheduling, and everything in between.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>

            {/* Tutorial 6 — Building your Tote Organizer (Coming Soon) */}
            <div
              className="group flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 opacity-60"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-700/40">
                <Play className="h-5 w-5 text-stone-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-300">
                  Building your Tote Organizer
                </h3>
                <p className="text-[11px] text-stone-600">
                  Step-by-step assembly instructions from framing to final tote placement.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-700/40 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                Coming Soon
              </span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION B: Installation Checklist
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Installation Checklist
            </h2>
          </div>

          <p className="mb-4 text-sm text-stone-400">
            Tap each step to mark it complete. Great for use on-site!
          </p>

          <div className="space-y-2">
            {INSTALLATION_CHECKLIST.map((item) => {
              const checked = checkedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                    checked
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div className="mt-0.5">
                    {checked ? (
                      <CheckSquare className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Square className="h-5 w-5 text-stone-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        checked
                          ? "text-emerald-400 line-through"
                          : "text-white"
                      }`}
                    >
                      {item.text}
                    </p>
                    <p
                      className={`text-xs ${
                        checked ? "text-emerald-400/60" : "text-stone-500"
                      }`}
                    >
                      {item.detail}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-4 border-t border-slate-700 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-stone-500">Progress</span>
              <span className="font-bold text-emerald-400">
                {checkedItems.size} / {INSTALLATION_CHECKLIST.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{
                  width: `${
                    (checkedItems.size / INSTALLATION_CHECKLIST.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
