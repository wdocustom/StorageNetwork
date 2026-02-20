"use client";

import Image from "next/image";
import {
  Zap,
  MessageSquare,
  Sparkles,
  Users,
  TrendingUp,
  Shield,
} from "lucide-react";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Community Upgrade / Paywall Page
// Shown to non-Pro users who try to access /community routes.
// ═══════════════════════════════════════════════════════════════════════════

const COMMUNITY_BENEFITS = [
  {
    icon: MessageSquare,
    title: "Reddit-Style Discussion Forums",
    desc: "Ask questions, share builds, and get advice from experienced installers in organized topic spaces.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Thread Summaries",
    desc: "Gemini AI generates instant TL;DR summaries of long discussions so you never miss key insights.",
  },
  {
    icon: TrendingUp,
    title: "Smart Feeds & Trending Topics",
    desc: "Discover trending discussions, unanswered questions, and the most valuable content — all sorted by AI.",
  },
  {
    icon: Users,
    title: "Exclusive Pro Network",
    desc: "Connect with verified professionals. Share business strategies, pricing tips, and marketing playbooks.",
  },
  {
    icon: Shield,
    title: "AI Content Organization",
    desc: "Posts are auto-tagged and routed to the right space by AI, keeping discussions organized and discoverable.",
  },
];

export default function CommunityUpgradePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-3">
            <Image
              src={siteConfig.logoPath}
              alt={siteConfig.name}
              width={40}
              height={40}
              className="h-10 w-auto flex-shrink-0 object-contain"
            />
            <span className="text-sm font-bold text-white">
              {siteConfig.name}
            </span>
          </a>
          <a
            href="/dashboard"
            className="text-xs text-stone-500 hover:text-stone-300"
          >
            Back to Dashboard
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="mx-auto w-full max-w-lg">
          {/* Hero */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/10">
              <Users className="h-8 w-8 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-black text-white">
              Pro Community
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              An exclusive, AI-organized forum for Storage Network Pro members.
              <br />
              Connect, learn, and grow your installer business.
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-4 mb-8">
            {COMMUNITY_BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
                  <b.icon className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{b.title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900 p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-400 mb-2">
              Included with Pro
            </p>
            <p className="text-2xl font-black text-white mb-1">$99/mo</p>
            <p className="text-xs text-stone-500 mb-4">
              Community access + 5% fees + custom branding + all Pro features
            </p>
            <a
              href="/dashboard/profile"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-black uppercase tracking-widest text-gray-950 transition-colors hover:bg-yellow-300"
            >
              <Zap className="h-4 w-4" />
              Upgrade to Pro
            </a>
            <p className="mt-2 text-[10px] text-stone-600">
              Cancel anytime. No long-term contracts.
            </p>
          </div>

          {/* Back link */}
          <div className="mt-6 text-center">
            <a
              href="/dashboard"
              className="text-xs text-stone-500 hover:text-stone-300"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
