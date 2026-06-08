"use client";

import { useState } from "react";
import Image from "next/image";
import { PUBLIC_PLANS } from "@/lib/plans-config";
import { CheckCircle, Mail, Loader2, BookOpen, ExternalLink } from "lucide-react";

// ── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: (typeof PUBLIC_PLANS)[number] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plans/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const priceDisplay = `$${(plan.price / 100).toFixed(0)}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
      <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />

      <div className="relative p-6">
        <div className="flex items-start gap-4">
          {/* Preview image */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <Image
              src={plan.previewImage}
              alt={plan.name}
              fill
              className="object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white">{plan.name}</h2>
            <p className="mt-0.5 text-sm text-stone-400">{plan.tagline}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-black text-yellow-400">{priceDisplay}</span>
              <span className="text-xs text-stone-600">one-time · instant access</span>
            </div>
          </div>
        </div>

        {/* Includes */}
        <ul className="mt-5 space-y-2">
          {plan.includes.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="text-sm text-stone-300">{item}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
        )}

        <button
          onClick={handleBuy}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting…
            </>
          ) : (
            `Get the Plans — ${priceDisplay}`
          )}
        </button>
      </div>
    </div>
  );
}

// ── Resend Link Panel ────────────────────────────────────────────────────────

function ResendLinkPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/plans/resend-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-stone-500" />
        <h3 className="text-sm font-bold text-white">Already purchased?</h3>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        Lost your access link? Enter your purchase email and we&apos;ll resend it.
      </p>

      {sent ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">
            If we have a purchase on file for that email, the link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={handleResend} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 outline-none focus:border-yellow-400"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="shrink-0 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a href="/">
            <Image
              src="/landing_page_logo.png"
              alt="Storage Network"
              width={36}
              height={36}
              className="rounded"
            />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white">DIY Build Plans</h1>
            <p className="text-[10px] text-stone-500">Digital plans · Instant access · Yours forever</p>
          </div>
          <a
            href="/"
            className="hidden items-center gap-1 text-[11px] font-semibold text-stone-500 transition hover:text-stone-300 sm:flex"
          >
            <ExternalLink className="h-3 w-3" />
            Storage Network
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {/* ── Intro ──────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">Handmade furniture plans</span>
          </div>
          <h2 className="mb-2 text-2xl font-black text-white">Build it yourself.</h2>
          <p className="text-sm text-stone-500">
            Professional-quality plans for woodworkers and DIYers.
            Buy once, access forever — we email you a permanent link.
          </p>
        </div>

        {/* ── Plan cards ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {PUBLIC_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* ── Coming soon ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-600">More plans coming soon</p>
          <p className="mt-1 text-xs text-stone-700">Workbenches, planter boxes, overhead storage, and more.</p>
        </div>

        {/* ── Resend link ────────────────────────────────────────── */}
        <ResendLinkPanel />

        {/* ── Pro installer CTA ──────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-center">
          <p className="mb-1 text-xs font-bold text-stone-500">Are you a professional installer?</p>
          <p className="mb-3 text-xs text-stone-600">
            Installers get plans included with their dashboard plus quoting tools, pay links, and job management.
          </p>
          <a
            href="/invite"
            className="inline-block rounded-xl border border-yellow-400/30 px-5 py-2.5 text-xs font-bold text-yellow-400 transition hover:bg-yellow-400/10"
          >
            Join as an Installer
          </a>
        </div>
      </main>
    </div>
  );
}
