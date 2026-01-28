"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculateBuild } from "@/app/actions/calculator";
import { generateBuildManifest } from "@/lib/buildEngine";
import { createQuote } from "@/app/actions/createQuote";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine";
import {
  ArrowLeft,
  HardHat,
  Lock,
  Loader2,
  Maximize2,
  ShoppingCart,
  Wrench,
  FileText,
  X,
  Send,
  CheckCircle2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Build Configurator — Estimate, Quote & New Build
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

export default function BuildConfiguratorPage() {
  const supabase = getSupabaseBrowserClient();

  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  // Inputs
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(false);

  // Results
  const [buildResult, setBuildResult] = useState<{
    cols: number;
    rows: number;
    price: number;
    totalW: number;
    totalH: number;
    slots: number;
  } | null>(null);
  const [manifest, setManifest] = useState<BuildManifest | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  // Quote modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  // Check if user is PRO
  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("is_pro, subscription_tier, business_name, first_name")
      .eq("id", user.id)
      .single();

    if (data) {
      setIsPro(data.is_pro || data.subscription_tier === "pro");
      setBusinessName(data.business_name || data.first_name || "Your Business");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleCalculate() {
    const wW = parseFloat(wallWidth);
    const wH = parseFloat(wallHeight);
    if (!wW || !wH) {
      setCalcError("Enter valid wall dimensions.");
      return;
    }

    setCalcError("");
    setCalculating(true);
    setBuildResult(null);
    setManifest(null);

    try {
      const res = await calculateBuild({
        wallWidth: wW,
        wallHeight: wH,
        toteModel: toteType,
        addOns: { totes: hasTotes, wheels: hasWheels, top: hasTop },
        mode: "wallFit",
      });

      if (!res.success) {
        setCalcError("error" in res ? res.error : "Calculation failed.");
        return;
      }

      const result = {
        cols: res.cols,
        rows: res.rows,
        price: res.price,
        totalW: res.dimensions.totalW,
        totalH: res.dimensions.totalH,
        slots: res.config.slots,
      };
      setBuildResult(result);

      // Generate manifest for cut plans
      const unit: QuoteUnit = {
        cols: res.cols,
        rows: res.rows,
        toteType,
        hasTotes,
        hasWheels,
        hasTop,
        price: res.price,
        totalW: res.dimensions.totalW,
        totalH: res.dimensions.totalH,
        desc: `${res.cols} Wide × ${res.rows} High`,
      };
      setManifest(generateBuildManifest([unit]));
    } catch {
      setCalcError("Calculation failed. Please try again.");
    } finally {
      setCalculating(false);
    }
  }

  async function handleSendQuote() {
    if (!customerName.trim() || !customerEmail.trim()) {
      setQuoteError("Name and email are required.");
      return;
    }
    if (!buildResult || !userId) {
      setQuoteError("No build calculated or not logged in.");
      return;
    }

    setQuoteError("");
    setQuoteSending(true);

    try {
      const unit: QuoteUnit = {
        cols: buildResult.cols,
        rows: buildResult.rows,
        toteType,
        hasTotes,
        hasWheels,
        hasTop,
        price: buildResult.price,
        totalW: buildResult.totalW,
        totalH: buildResult.totalH,
        desc: `${buildResult.cols} Wide × ${buildResult.rows} High`,
      };

      const result = await createQuote({
        installer_id: userId,
        installer_business_name: businessName,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || undefined,
        quote_data: [unit],
        grand_total: buildResult.price,
      });

      if (!result.success) {
        setQuoteError(result.error || "Failed to send quote.");
        return;
      }

      setQuoteSent(true);
    } catch {
      setQuoteError("Failed to send quote. Please try again.");
    } finally {
      setQuoteSending(false);
    }
  }

  function resetQuoteModal() {
    setShowQuoteModal(false);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setQuoteSent(false);
    setQuoteError("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-yellow-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Build Configurator
            </h1>
            <p className="text-[10px] text-stone-500">
              Estimate, Quote & New Build
            </p>
          </div>
          {isPro && (
            <span className="rounded-full bg-yellow-400/20 px-3 py-1 text-[10px] font-bold text-yellow-400">
              PRO
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* ── Input Card ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Maximize2 className="h-4 w-4 text-yellow-400" />
            Wall Dimensions
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Width (in)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={wallWidth}
                onChange={(e) => setWallWidth(e.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Height (in)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={wallHeight}
                onChange={(e) => setWallHeight(e.target.value)}
                placeholder="e.g. 96"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
              Tote Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["HDX", "GM"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setToteType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    toteType === t
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                      : "border-slate-700 text-stone-400 hover:border-stone-600"
                  }`}
                >
                  {t === "HDX" ? 'HDX (19.75")' : 'Greenmade (20.75")'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="mt-3 space-y-2">
            {[
              { val: hasTotes, set: setHasTotes, label: "Include Totes" },
              { val: hasWheels, set: setHasWheels, label: "Add Wheels" },
              { val: hasTop, set: setHasTop, label: "Plywood Top" },
            ].map(({ val, set, label }) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardHat className="h-4 w-4" />
            )}
            {calculating ? "Calculating…" : "Calculate Build"}
          </button>

          {calcError && (
            <p className="mt-3 text-xs font-medium text-red-400">{calcError}</p>
          )}
        </section>

        {/* ── Results ────────────────────────────────────────────────── */}
        {buildResult && (
          <>
            {/* Specs + Price */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-800 p-3">
                  <p className="text-2xl font-black text-white">
                    {buildResult.cols} × {buildResult.rows}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Max Fit
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800 p-3">
                  <p className="text-2xl font-black text-yellow-400">
                    ${buildResult.price.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Est. Price
                  </p>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-stone-500">
                {buildResult.totalW.toFixed(0)}&quot; W × {buildResult.totalH.toFixed(0)}
                &quot; H × 30&quot; D — {buildResult.slots} slots
              </div>

              {/* CREATE QUOTE BUTTON */}
              <button
                onClick={() => setShowQuoteModal(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400/10 py-3 text-sm font-bold uppercase tracking-wider text-yellow-400 transition-all hover:bg-yellow-400/20"
              >
                <FileText className="h-4 w-4" />
                Create Quote / Job
              </button>
            </section>

            {/* Material List — PRO-gated */}
            <section className="relative rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <ShoppingCart className="h-4 w-4 text-yellow-400" />
                Material List
              </h2>

              {manifest && (
                <div className={!isPro ? "select-none blur-[6px]" : ""}>
                  <ul className="space-y-1">
                    {manifest.shopping_list.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {item.detail}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold text-yellow-400">
                          {item.qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* PRO overlay */}
              {!isPro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
                    <Lock className="h-7 w-7 text-yellow-400" />
                  </div>
                  <p className="mb-1 text-base font-bold text-white">
                    Pro Feature
                  </p>
                  <p className="mb-4 max-w-[260px] text-center text-xs text-stone-400">
                    Subscribe to PRO to unlock detailed Material Lists and Cut
                    Plans.
                  </p>
                  <a
                    href="/upgrade"
                    className="rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-950 shadow-lg transition-all hover:bg-yellow-300"
                  >
                    Upgrade to Pro
                  </a>
                </div>
              )}
            </section>

            {/* Cut Plan — PRO-gated */}
            <section className="relative rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Wrench className="h-4 w-4 text-yellow-400" />
                Cut Plan
              </h2>

              {manifest && (
                <div className={!isPro ? "select-none blur-[6px]" : ""}>
                  {manifest.cut_plan_visuals.map((mod, mi) => (
                    <div key={mi} className="mb-4">
                      <h3 className="mb-2 text-sm font-bold text-yellow-400">
                        Module {mod.moduleIndex} ({mod.cols}x{mod.rows})
                      </h3>
                      <div className="space-y-2">
                        {mod.boards.map((board, bi) => (
                          <div key={bi}>
                            <div className="mb-0.5 flex justify-between text-[10px] text-stone-500">
                              <span>Board {bi + 1}</span>
                              <span>{board.rem.toFixed(1)}&quot; waste</span>
                            </div>
                            <div className="flex h-7 overflow-hidden rounded bg-slate-700">
                              {board.cuts.map((cut, ci) => {
                                const pct = (cut.len / 96) * 100;
                                const color =
                                  cut.type === "rail" ? "#f59e0b" : "#3b82f6";
                                return (
                                  <div
                                    key={ci}
                                    className="flex items-center justify-center border-r border-slate-900 text-[10px] font-bold text-slate-900"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: color,
                                      minWidth: "20px",
                                    }}
                                  >
                                    {cut.len.toFixed(0)}&quot;
                                  </div>
                                );
                              })}
                              {board.rem > 0 && (
                                <div
                                  className="flex-1 opacity-30"
                                  style={{
                                    background:
                                      "repeating-linear-gradient(45deg, #ef4444, #ef4444 5px, #dc2626 5px, #dc2626 10px)",
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PRO overlay */}
              {!isPro && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
                    <Lock className="h-7 w-7 text-yellow-400" />
                  </div>
                  <p className="mb-1 text-base font-bold text-white">
                    Pro Feature
                  </p>
                  <p className="mb-4 max-w-[260px] text-center text-xs text-stone-400">
                    Subscribe to PRO to unlock detailed Cut Plans for your
                    builds.
                  </p>
                  <a
                    href="/upgrade"
                    className="rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-950 shadow-lg transition-all hover:bg-yellow-300"
                  >
                    Upgrade to Pro
                  </a>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Back Link ──────────────────────────────────────────────── */}
        <div className="pb-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </a>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          QUOTE MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-gray-900 p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={resetQuoteModal}
              className="absolute right-4 top-4 text-stone-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!quoteSent ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
                  <FileText className="h-7 w-7 text-yellow-400" />
                </div>

                <h3 className="mb-1 text-center text-lg font-bold text-white">
                  Create Quote
                </h3>
                <p className="mb-5 text-center text-sm text-stone-400">
                  Send a professional quote to your customer
                </p>

                {/* Quote Details */}
                {buildResult && (
                  <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center">
                    <p className="text-sm text-stone-400">
                      {buildResult.cols}×{buildResult.rows} Unit
                    </p>
                    <p className="text-2xl font-black text-yellow-400">
                      ${buildResult.price.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Customer Form */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="john@email.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendQuote}
                  disabled={quoteSending}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                >
                  {quoteSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {quoteSending ? "Sending…" : "Send Quote"}
                </button>

                {quoteError && (
                  <p className="mt-3 text-center text-xs font-medium text-red-400">
                    {quoteError}
                  </p>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
                <h3 className="mb-1 text-lg font-bold text-white">
                  Quote Sent!
                </h3>
                <p className="mb-5 text-sm text-stone-400">
                  Your customer will receive an email with their quote and a
                  link to confirm.
                </p>
                <button
                  onClick={resetQuoteModal}
                  className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
