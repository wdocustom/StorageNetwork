"use client";

import { useState } from "react";
import {
  calculateShelfMaterials,
  type CalculationResult,
} from "@/app/actions/calculate";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import {
  Ruler,
  DollarSign,
  Loader2,
  Grid3X3,
  Send,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Public Calculator Page
// ---------------------------------------------------------------------------

export default function PublicCalculatorPage() {
  // Calculator inputs
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [toteType, setToteType] = useState<"hdx" | "greenmade">("hdx");

  // Calculation state
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calcError, setCalcError] = useState("");
  const [calculating, setCalculating] = useState(false);

  // Quote form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // -- Handlers -------------------------------------------------------------

  async function handleCalculate() {
    setCalcError("");
    setResult(null);
    setSubmitted(false);

    const w = parseFloat(width);
    const h = parseFloat(height);
    if (!w || !h) {
      setCalcError("Please enter valid width and height values.");
      return;
    }

    setCalculating(true);
    try {
      const res = await calculateShelfMaterials(w, h, toteType);
      setResult(res);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  async function handleGetQuote() {
    setSubmitError("");
    if (!name.trim() || !email.trim()) {
      setSubmitError("Name and email are required.");
      return;
    }
    if (!result) return;

    setSubmitting(true);
    try {
      await submitNetworkLead({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address,
        dimensions: {
          width: parseFloat(width),
          height: parseFloat(height),
          tote_type: toteType,
        },
        estimated_price: result.price,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* ── Hero / Header ──────────────────────────────────────────────── */}
      <header className="px-4 pb-6 pt-10 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          The Shelf Dude
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
          Tote-based garage shelving — built to fit your wall. Enter your
          dimensions below to see what we can build.
        </p>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 pb-16">
        {/* ── Dimension Inputs ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            Your Wall
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Width (inches)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Height (inches)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 96"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-400">
              Tote Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["hdx", "greenmade"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setToteType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    toteType === t
                      ? "border-blue-500 bg-blue-600/20 text-blue-400"
                      : "border-gray-600 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {t === "hdx" ? 'HDX (19.75")' : 'Greenmade (20.75")'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ruler className="h-4 w-4" />
            )}
            {calculating ? "Calculating…" : "See My Build"}
          </button>

          {calcError && (
            <p className="mt-3 rounded-lg bg-red-900/40 p-3 text-sm text-red-400">
              {calcError}
            </p>
          )}
        </section>

        {/* ── Results ──────────────────────────────────────────────────── */}
        {result && (
          <>
            {/* Visualizer */}
            <section className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                <Grid3X3 className="h-4 w-4 text-blue-400" />
                Your Shelf Layout
              </h3>
              <ShelfVisualizer
                rows={result.specs.rows}
                cols={result.specs.cols}
              />
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <StatCard label="Columns" value={result.specs.cols} />
                <StatCard label="Rows (Tiers)" value={result.specs.rows} />
                <StatCard
                  label="Built Width"
                  value={`${result.specs.total_width}"`}
                />
                <StatCard
                  label="Built Height"
                  value={`${result.specs.total_height}"`}
                />
              </div>
            </section>

            {/* Price */}
            <section className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5 text-center">
              <DollarSign className="mx-auto mb-1 h-6 w-6 text-green-400" />
              <p className="text-3xl font-extrabold">
                ${result.price.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {result.specs.rows * result.specs.cols} slots &times; $40 per
                slot
              </p>
            </section>

            {/* Get Quote Form */}
            {!submitted ? (
              <section className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
                <h3 className="mb-1 text-sm font-semibold text-gray-300">
                  Like what you see?
                </h3>
                <p className="mb-4 text-xs text-gray-500">
                  Enter your info and we&apos;ll connect you with a local
                  installer.
                </p>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name *"
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email *"
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Address / City (optional)"
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <button
                    onClick={handleGetQuote}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting ? "Submitting…" : "Get Quote"}
                  </button>

                  {submitError && (
                    <p className="rounded-lg bg-red-900/40 p-3 text-sm text-red-400">
                      {submitError}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-green-800 bg-green-900/30 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-400" />
                <h3 className="text-lg font-bold text-green-300">
                  Quote Request Sent!
                </h3>
                <p className="mt-1 text-sm text-green-400/70">
                  We&apos;ll match you with a local installer shortly.
                </p>
              </section>
            )}
          </>
        )}

        {/* ── Installer CTA ────────────────────────────────────────────── */}
        <div className="pt-4 text-center">
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/dashboard`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-blue-400"
          >
            Are you an installer? Log in here
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </main>
    </div>
  );
}

// ===========================================================================
// Shelf Visualizer – CSS Grid representation
// ===========================================================================

function ShelfVisualizer({ rows, cols }: { rows: number; cols: number }) {
  // Cap the visual grid so it doesn't get absurdly large on screen
  const displayCols = Math.min(cols, 12);
  const displayRows = Math.min(rows, 8);
  const truncatedCols = cols > displayCols;
  const truncatedRows = rows > displayRows;

  return (
    <div className="flex flex-col items-center">
      <div
        className="inline-grid gap-0 rounded border border-gray-600 bg-gray-900 p-1"
        style={{
          gridTemplateColumns: `repeat(${displayCols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: displayRows * displayCols }).map((_, i) => {
          const row = Math.floor(i / displayCols);
          const col = i % displayCols;
          return (
            <div
              key={i}
              className="flex aspect-[4/3] w-10 items-center justify-center border border-gray-700 bg-gray-800 text-[9px] text-gray-500 sm:w-12"
              title={`Row ${row + 1}, Col ${col + 1}`}
            >
              <ToteIcon />
            </div>
          );
        })}
      </div>
      {(truncatedCols || truncatedRows) && (
        <p className="mt-1 text-[10px] text-gray-600">
          Showing {displayCols}×{displayRows} of {cols}×{rows}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        {cols} columns &times; {rows} tiers = {cols * rows} slots
      </p>
    </div>
  );
}

// Tiny tote SVG icon for each slot
function ToteIcon() {
  return (
    <svg
      viewBox="0 0 24 20"
      fill="none"
      className="h-4 w-5 text-blue-500/40"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M7 4V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ===========================================================================
// Stat card helper
// ===========================================================================

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-900/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
