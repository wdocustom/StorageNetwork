"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateShelfMaterials,
  getMaxFit,
  type CalculationResult,
  type AddOns,
} from "@/app/actions/calculate";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  ArrowRight,
  Receipt,
  Truck,
  Package,
  CircleDot,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Public Calculator Page — "Construction Pro" Theme
// ═══════════════════════════════════════════════════════════════════════════

export default function PublicCalculatorPage() {
  // ── Zip code check ──────────────────────────────────────────────────────
  const [zip, setZip] = useState("");
  const [zipStatus, setZipStatus] = useState<
    null | "local" | "hq"
  >(null);

  // ── Wall-fit inputs ─────────────────────────────────────────────────────
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [wallFitResult, setWallFitResult] = useState<{
    maxCols: number;
    maxRows: number;
  } | null>(null);

  // ── Design inputs ───────────────────────────────────────────────────────
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);
  const [toteType, setToteType] = useState<"hdx" | "greenmade">("hdx");

  // ── Add-ons ─────────────────────────────────────────────────────────────
  const [includeTotes, setIncludeTotes] = useState(false);
  const [includeWheels, setIncludeWheels] = useState(false);
  const [includePlywoodTop, setIncludePlywoodTop] = useState(false);

  // ── Calculation state ───────────────────────────────────────────────────
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calcError, setCalcError] = useState("");
  const [calculating, setCalculating] = useState(false);

  // ── Quote form ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Auto-recalculate when design changes ────────────────────────────────
  const addOns: AddOns = useMemo(
    () => ({ includeTotes, includeWheels, includePlywoodTop }),
    [includeTotes, includeWheels, includePlywoodTop]
  );

  const runCalculation = useCallback(async () => {
    setCalcError("");
    setCalculating(true);
    try {
      const res = await calculateShelfMaterials(cols, rows, toteType, addOns);
      setResult(res);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Calculation failed.");
      setResult(null);
    } finally {
      setCalculating(false);
    }
  }, [cols, rows, toteType, addOns]);

  useEffect(() => {
    runCalculation();
  }, [runCalculation]);

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleZipCheck() {
    if (zip.trim() === "68102") {
      setZipStatus("local");
    } else {
      setZipStatus("hq");
    }
  }

  async function handleWallFit() {
    const w = parseFloat(wallWidth);
    const h = parseFloat(wallHeight);
    if (!w || !h) return;
    const fit = await getMaxFit(w, h, toteType);
    setWallFitResult(fit);
    setCols(fit.maxCols);
    setRows(fit.maxRows);
  }

  async function handleBookDeposit() {
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
          width: result.specs.total_width,
          height: result.specs.total_height,
          tote_type: toteType,
        },
        estimated_price: result.grand_total,
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

  // ── Dropdown option generators ──────────────────────────────────────────
  const colOptions = Array.from({ length: 10 }, (_, i) => i + 1);
  const rowOptions = Array.from({ length: 8 }, (_, i) => i + 1);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-stone-100">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="border-b-4 border-yellow-400 bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-yellow-400 text-lg font-black text-gray-950">
              SD
            </div>
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-widest text-white">
                The Shelf Dude
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-yellow-400">
                Partner Network &mdash; Build Configurator
              </p>
            </div>
          </div>
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/dashboard`}
            className="hidden text-xs font-semibold text-stone-400 transition-colors hover:text-yellow-400 sm:inline-flex sm:items-center sm:gap-1"
          >
            Installer Login <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* ── Main Split Layout ──────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* ════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — Controls
        ════════════════════════════════════════════════════════════════ */}
        <aside className="w-full shrink-0 space-y-4 p-4 lg:w-[420px] lg:overflow-y-auto lg:border-r lg:border-stone-300">
          {/* ── 1. Installer Availability ──────────────────────────────── */}
          <section className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
              <MapPin className="h-4 w-4 text-yellow-600" />
              Check Installer Availability
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => {
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                  setZipStatus(null);
                }}
                placeholder="ZIP Code"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              />
              <button
                onClick={handleZipCheck}
                disabled={zip.length < 5}
                className="shrink-0 rounded-lg bg-gray-950 px-4 py-2 text-xs font-bold uppercase text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
              >
                Check
              </button>
            </div>
            {zipStatus === "local" && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                WDO Custom serves your area.
              </div>
            )}
            {zipStatus === "hq" && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No local partner found. Routing to HQ.
              </div>
            )}
          </section>

          {/* ── 2. Wall Fit Calculator ─────────────────────────────────── */}
          <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-gray-800">
              Wall Fit Calculator
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Wall Width (in)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={wallWidth}
                  onChange={(e) => setWallWidth(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Wall Height (in)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={wallHeight}
                  onChange={(e) => setWallHeight(e.target.value)}
                  placeholder="e.g. 96"
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>
            </div>
            <button
              onClick={handleWallFit}
              disabled={!wallWidth || !wallHeight}
              className="mt-3 w-full rounded-lg bg-gray-950 py-2.5 text-xs font-bold uppercase tracking-wide text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              Find Max Size for This Wall
            </button>
            {wallFitResult && (
              <p className="mt-2 text-center text-xs text-stone-500">
                Max fit:{" "}
                <span className="font-bold text-gray-900">
                  {wallFitResult.maxCols} cols × {wallFitResult.maxRows} tiers
                </span>
                &ensp;&mdash;&ensp;applied below.
              </p>
            )}
          </section>

          {/* ── 3. Design Your Unit ────────────────────────────────────── */}
          <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-gray-800">
              Design Your Unit
            </h2>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Columns
                </label>
                <select
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-2 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  {colOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Tiers High
                </label>
                <select
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-2 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  {rowOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Tote Model
                </label>
                <select
                  value={toteType}
                  onChange={(e) =>
                    setToteType(e.target.value as "hdx" | "greenmade")
                  }
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-2 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="hdx">HDX (19.75&quot;)</option>
                  <option value="greenmade">Greenmade (20.75&quot;)</option>
                </select>
              </div>
            </div>

            {/* Upsells */}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                Add-Ons
              </p>
              <Checkbox
                checked={includeTotes}
                onChange={setIncludeTotes}
                label="Add Totes"
                detail="+$12 ea"
              />
              <Checkbox
                checked={includeWheels}
                onChange={setIncludeWheels}
                label="Add Wheels"
                detail="+$45 flat"
              />
              <Checkbox
                checked={includePlywoodTop}
                onChange={setIncludePlywoodTop}
                label="Plywood Top"
                detail="+$75 flat"
              />
            </div>
          </section>

          {/* ── 4. Quote Receipt ───────────────────────────────────────── */}
          {result && (
            <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
              {/* Receipt header */}
              <div className="border-b border-dashed border-stone-300 bg-stone-50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
                  <Receipt className="h-4 w-4" />
                  Quote Summary
                </h2>
              </div>

              {/* Line items */}
              <div className="divide-y divide-dashed divide-stone-200 px-4">
                {result.line_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.qty !== null
                          ? `${item.qty} × $${item.unit_price}`
                          : `Flat fee`}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900">
                      ${item.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t-2 border-gray-950 bg-gray-950 px-4 py-4">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Total
                  </span>
                  <span className="text-4xl font-black text-yellow-400">
                    ${result.grand_total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Booking form / success */}
              <div className="border-t border-stone-200 bg-stone-50 px-4 py-4">
                {!submitted ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name *"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email *"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Address / City (optional)"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    <button
                      onClick={handleBookDeposit}
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {submitting ? "Submitting…" : "Pay Deposit & Book"}
                    </button>
                    {submitError && (
                      <p className="text-xs font-medium text-red-600">
                        {submitError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    <p className="font-bold text-gray-900">Booking Received!</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      We&apos;ll reach out within 24 hours.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {calcError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {calcError}
            </p>
          )}
        </aside>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT SIDE — Visualizer
        ════════════════════════════════════════════════════════════════ */}
        <main className="flex flex-1 items-start justify-center p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          {calculating && !result ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
            </div>
          ) : result ? (
            <ShelfVisualizer
              rows={result.specs.rows}
              cols={result.specs.cols}
              totalWidth={result.specs.total_width}
              totalHeight={result.specs.total_height}
              showWheels={includeWheels}
              showPlywoodTop={includePlywoodTop}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Checkbox component
// ═══════════════════════════════════════════════════════════════════════════

function Checkbox({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 transition-colors hover:bg-stone-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-stone-300 text-yellow-500 accent-yellow-400 focus:ring-yellow-400"
      />
      <span className="flex-1 text-sm font-medium text-gray-800">
        {label}
      </span>
      <span className="text-xs font-semibold text-stone-500">{detail}</span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shelf Visualizer — Construction-Style Schematic
// ═══════════════════════════════════════════════════════════════════════════

function ShelfVisualizer({
  rows,
  cols,
  totalWidth,
  totalHeight,
  showWheels,
  showPlywoodTop,
}: {
  rows: number;
  cols: number;
  totalWidth: number;
  totalHeight: number;
  showWheels: boolean;
  showPlywoodTop: boolean;
}) {
  const displayCols = Math.min(cols, 10);
  const displayRows = Math.min(rows, 8);
  const truncated = cols > displayCols || rows > displayRows;

  // Sizing constants (px)
  const POST_W = 8;
  const BEAM_H = 6;
  const TOTE_W = 52;
  const TOTE_H = 42;
  const ARROW_GAP = 32;
  const WHEEL_R = 7;
  const TOP_H = 8;

  const gridW = POST_W + displayCols * (TOTE_W + POST_W);
  const gridH = BEAM_H + displayRows * (TOTE_H + BEAM_H);
  const extraBottom = showWheels ? WHEEL_R * 2 + 4 : 0;
  const extraTop = showPlywoodTop ? TOP_H + 2 : 0;

  return (
    <div className="flex flex-col items-center">
      {/* Specs pills */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <Pill icon={<Package className="h-3 w-3" />} label={`${cols}×${rows}`} sub="layout" />
        <Pill icon={<Truck className="h-3 w-3" />} label={`${totalWidth}"`} sub="wide" />
        <Pill icon={<CircleDot className="h-3 w-3" />} label={`${totalHeight}"`} sub="tall" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-300 bg-white p-4 shadow-lg">
        <div
          className="relative"
          style={{
            padding: `${ARROW_GAP}px`,
            paddingBottom: ARROW_GAP + extraBottom,
            paddingTop: ARROW_GAP + extraTop,
          }}
        >
          {/* Width arrow (top) */}
          <DimensionArrow
            direction="horizontal"
            length={gridW}
            label={`${totalWidth}"`}
            style={{ top: extraTop, left: ARROW_GAP, width: gridW }}
          />
          {/* Height arrow (left) */}
          <DimensionArrow
            direction="vertical"
            length={gridH + extraTop + extraBottom}
            label={`${totalHeight}"`}
            style={{
              left: 0,
              top: ARROW_GAP,
              height: gridH + extraTop + extraBottom,
            }}
          />

          {/* Plywood Top */}
          {showPlywoodTop && (
            <div
              className="rounded-t"
              style={{
                position: "absolute",
                top: ARROW_GAP,
                left: ARROW_GAP,
                width: gridW,
                height: TOP_H,
                background:
                  "repeating-linear-gradient(90deg, #d4a574 0px, #c49660 3px, #deb887 6px)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                borderBottom: "1px solid #b8860b",
              }}
            />
          )}

          {/* Main grid */}
          <div
            className="relative rounded"
            style={{
              width: gridW,
              height: gridH,
              background: "#f5f5f4",
              marginTop: extraTop,
            }}
          >
            {/* Top beam */}
            <WoodBeam top={0} width={gridW} height={BEAM_H} />

            {Array.from({ length: displayRows }).map((_, row) => {
              const rowTop = BEAM_H + row * (TOTE_H + BEAM_H);
              return (
                <div key={`row-${row}`}>
                  {Array.from({ length: displayCols }).map((_, col) => {
                    const left = POST_W + col * (TOTE_W + POST_W);
                    return (
                      <ConstructionTote
                        key={`tote-${row}-${col}`}
                        top={rowTop}
                        left={left}
                        width={TOTE_W}
                        height={TOTE_H}
                      />
                    );
                  })}
                  <WoodBeam
                    top={rowTop + TOTE_H}
                    width={gridW}
                    height={BEAM_H}
                  />
                </div>
              );
            })}

            {/* Vertical posts */}
            {Array.from({ length: displayCols + 1 }).map((_, col) => (
              <WoodPost
                key={`post-${col}`}
                left={col * (TOTE_W + POST_W)}
                width={POST_W}
                height={gridH}
              />
            ))}
          </div>

          {/* Wheels */}
          {showWheels && (
            <div
              className="relative"
              style={{ width: gridW, height: WHEEL_R * 2 + 4, marginTop: 2 }}
            >
              {Array.from({ length: displayCols + 1 }).map((_, col) => {
                const cx = col * (TOTE_W + POST_W) + POST_W / 2;
                return (
                  <div
                    key={`wheel-${col}`}
                    className="absolute rounded-full border-2 border-stone-500 bg-stone-700"
                    style={{
                      width: WHEEL_R * 2,
                      height: WHEEL_R * 2,
                      left: cx - WHEEL_R,
                      top: 2,
                    }}
                  >
                    <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-400" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {truncated && (
        <p className="mt-2 text-[10px] text-stone-400">
          Showing {displayCols}&times;{displayRows} of {cols}&times;{rows}
        </p>
      )}
      <p className="mt-2 text-xs text-stone-500">
        {cols} columns &times; {rows} tiers ={" "}
        <span className="font-bold text-gray-900">{cols * rows} slots</span>
      </p>
    </div>
  );
}

// ── Pill stat ─────────────────────────────────────────────────────────────

function Pill({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs">
      <span className="text-yellow-600">{icon}</span>
      <span className="font-bold text-gray-900">{label}</span>
      <span className="text-stone-400">{sub}</span>
    </div>
  );
}

// ── Structural components ─────────────────────────────────────────────────

function WoodPost({
  left,
  width,
  height,
}: {
  left: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className="absolute top-0"
      style={{
        left,
        width,
        height,
        background:
          "repeating-linear-gradient(180deg, #a1887f 0px, #bcaaa4 1px, #8d6e63 3px, #a1887f 4px)",
        boxShadow: "inset -1px 0 0 rgba(0,0,0,0.15), 1px 0 2px rgba(0,0,0,0.08)",
      }}
    />
  );
}

function WoodBeam({
  top,
  width,
  height,
}: {
  top: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className="absolute left-0"
      style={{
        top,
        width,
        height,
        background:
          "repeating-linear-gradient(90deg, #a1887f 0px, #bcaaa4 1px, #8d6e63 3px, #a1887f 4px)",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.08)",
      }}
    />
  );
}

/** Construction tote: black body, yellow lid */
function ConstructionTote({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}) {
  const LID_H = 7;
  const HANDLE_W = 16;
  const HANDLE_H = 4;

  return (
    <div
      className="absolute overflow-hidden rounded-sm"
      style={{ top, left, width, height }}
    >
      {/* Body — black plastic */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          background: "linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 40%, #1a1a1a 100%)",
          border: "1px solid #333",
        }}
      >
        {/* Inner depth line */}
        <div className="absolute inset-[3px] rounded-sm border border-white/5" />
        {/* Subtle ribs */}
        <div className="absolute bottom-2 left-[6px] right-[6px] top-[12px] opacity-20">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="mb-[4px] h-[1px] bg-white/20"
            />
          ))}
        </div>
      </div>

      {/* Lid — yellow strip */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{
          height: LID_H,
          background: "linear-gradient(180deg, #facc15 0%, #eab308 100%)",
          borderBottom: "1px solid #ca8a04",
        }}
      >
        {/* Lid snap ridge */}
        <div className="absolute inset-x-1 bottom-0 h-[1px] bg-yellow-700/30" />
        <div className="absolute inset-x-1 top-[1px] h-[1px] bg-yellow-200/50" />
      </div>

      {/* Handle — dark centered pill */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/8"
        style={{ width: HANDLE_W, height: HANDLE_H }}
      />
    </div>
  );
}

// ── Dimension arrows ──────────────────────────────────────────────────────

function DimensionArrow({
  direction,
  length,
  label,
  style,
}: {
  direction: "horizontal" | "vertical";
  length: number;
  label: string;
  style: React.CSSProperties;
}) {
  const color = "#ca8a04"; // yellow-700

  if (direction === "horizontal") {
    return (
      <div className="absolute flex flex-col items-center" style={style}>
        <span
          className="mb-0.5 text-[10px] font-bold"
          style={{ color }}
        >
          {label}
        </span>
        <div
          className="relative flex w-full items-center"
          style={{ height: 8 }}
        >
          <div
            className="absolute left-0 h-0 w-0"
            style={{
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              borderRight: `5px solid ${color}`,
            }}
          />
          <div
            className="mx-[5px] h-[1px] flex-1"
            style={{ background: color }}
          />
          <div
            className="absolute right-0 h-0 w-0"
            style={{
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              borderLeft: `5px solid ${color}`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute flex items-center" style={style}>
      <div
        className="relative flex flex-col items-center"
        style={{ width: 8, height: length }}
      >
        <div
          className="absolute top-0 h-0 w-0"
          style={{
            borderLeft: "3px solid transparent",
            borderRight: "3px solid transparent",
            borderBottom: `5px solid ${color}`,
          }}
        />
        <div
          className="my-[5px] w-[1px] flex-1"
          style={{ background: color }}
        />
        <div
          className="absolute bottom-0 h-0 w-0"
          style={{
            borderLeft: "3px solid transparent",
            borderRight: "3px solid transparent",
            borderTop: `5px solid ${color}`,
          }}
        />
      </div>
      <span
        className="-rotate-90 whitespace-nowrap text-[10px] font-bold"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
