"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { checkAvailability } from "@/app/actions/customer";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  Plus,
  X,
  Maximize2,
  ArrowLeft,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE-OF-TRUTH CONSTANTS (from original WDO Custom calculator)
// ═══════════════════════════════════════════════════════════════════════════
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const STUD = 1.5;
const TIER_HEIGHT = 16;
const TOP_GAP = 2.5;
const PLATE_HEIGHT = 1.5;
const PRICE_PER_SLOT = 40;
const PRICE_PER_TOTE = 12;
const PRICE_WHEELS = 45;
const PRICE_PLYWOOD_SHEET = 75;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════
type ToteType = "HDX" | "GM";

interface UnitConfig {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE-OF-TRUTH: Pricing Math (exact port from updateVisual)
// ═══════════════════════════════════════════════════════════════════════════
function calcPrice(
  cols: number,
  rows: number,
  toteType: ToteType,
  hasTotes: boolean,
  hasWheels: boolean,
  hasTop: boolean
) {
  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  const totalW = cols * opening + (cols + 1) * STUD;
  const totalH = rows * TIER_HEIGHT + PLATE_HEIGHT * 2 + TOP_GAP;

  const slots = cols * rows;
  let price = slots * PRICE_PER_SLOT;
  if (hasTotes) price += slots * PRICE_PER_TOTE;
  if (hasWheels) price += PRICE_WHEELS;

  let topSheets = 0;
  if (totalW > 192) topSheets = 3;
  else if (totalW > 96) topSheets = 2;
  else topSheets = 1;
  if (hasTop) price += topSheets * PRICE_PLYWOOD_SHEET;

  return { price, totalW, totalH, slots, topSheets };
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE-OF-TRUTH: Max Wall Fit (exact port from calculateWallFit)
// ═══════════════════════════════════════════════════════════════════════════
function maxFit(wallW: number, wallH: number, toteType: ToteType) {
  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  let maxCols = Math.floor((wallW - STUD) / (opening + STUD));
  let maxRows = Math.floor((wallH - 5.5) / TIER_HEIGHT);
  if (maxCols < 1) maxCols = 1;
  if (maxRows < 1) maxRows = 1;
  return { maxCols, maxRows };
}

// ═══════════════════════════════════════════════════════════════════════════
// Design Configurator Page
// ═══════════════════════════════════════════════════════════════════════════
export default function DesignPage() {
  const searchParams = useSearchParams();
  const incomingZip = searchParams.get("zip") || "";
  const mode = searchParams.get("mode") || "";

  // ── ZIP check ─────────────────────────────────────────────────────────
  const [zip, setZip] = useState(incomingZip);
  const [zipChecking, setZipChecking] = useState(false);
  const [zipResult, setZipResult] = useState<{
    available: boolean;
    installer_name: string | null;
    message: string;
  } | null>(null);

  // Auto-check on mount if zip came from query
  useEffect(() => {
    if (incomingZip.length === 5) {
      handleZipCheckAuto(incomingZip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleZipCheckAuto(zipCode: string) {
    setZipChecking(true);
    setZipResult(null);
    try {
      const res = await checkAvailability(zipCode);
      setZipResult(res);
    } catch {
      setZipResult({
        available: false,
        installer_name: null,
        message: "Unable to check availability.",
      });
    } finally {
      setZipChecking(false);
    }
  }

  // ── Wall fit ──────────────────────────────────────────────────────────
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [wallFitMsg, setWallFitMsg] = useState("");

  // ── Design inputs ─────────────────────────────────────────────────────
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);

  // ── Multi-unit quote list ─────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);

  // ── Booking form ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Derived pricing ───────────────────────────────────────────────────
  const pricing = useMemo(
    () => calcPrice(cols, rows, toteType, hasTotes, hasWheels, hasTop),
    [cols, rows, toteType, hasTotes, hasWheels, hasTop]
  );

  const grandTotal = useMemo(
    () => orderItems.reduce((sum, it) => sum + it.price, 0),
    [orderItems]
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleZipCheck() {
    if (zip.length < 5) return;
    await handleZipCheckAuto(zip);
  }

  function handleWallFit() {
    const wW = parseFloat(wallWidth);
    const wH = parseFloat(wallHeight);
    if (!wW || !wH) return;
    const { maxCols, maxRows } = maxFit(wW, wH, toteType);
    setCols(maxCols);
    setRows(maxRows);
    setWallFitMsg(
      `Max fit: ${maxCols} Wide × ${maxRows} High for that wall.`
    );
  }

  function handleAddUnit() {
    const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
    const totalW = cols * opening + (cols + 1) * STUD;
    const totalH = rows * TIER_HEIGHT + PLATE_HEIGHT * 2 + TOP_GAP;

    setOrderItems((prev) => [
      ...prev,
      {
        cols,
        rows,
        toteType,
        hasTotes,
        hasWheels,
        hasTop,
        price: pricing.price,
        totalW,
        totalH,
        desc: `${cols} Wide × ${rows} High`,
      },
    ]);
  }

  function handleRemoveUnit(index: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBookDeposit() {
    setSubmitError("");
    if (!name.trim() || !email.trim()) {
      setSubmitError("Name and email are required.");
      return;
    }
    if (orderItems.length === 0) {
      setSubmitError("Add at least one unit to your quote first.");
      return;
    }

    setSubmitting(true);
    try {
      await submitNetworkLead({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address,
        quote_data: orderItems,
        grand_total: grandTotal,
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

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b-4 border-yellow-400 bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3">
          <a
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded bg-yellow-400 text-lg font-black text-gray-950 transition-transform hover:scale-105"
            title="Back to Home"
          >
            SD
          </a>
          <div className="flex-1">
            <h1 className="text-base font-extrabold uppercase tracking-widest text-white">
              Professional Grade Garage Storage
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-yellow-400">
              Build Configurator
            </p>
          </div>
          <a
            href="/"
            className="hidden items-center gap-1 text-xs font-semibold text-stone-400 transition-colors hover:text-yellow-400 sm:flex"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </a>
        </div>
      </header>

      {/* ── Shipping mode banner ─────────────────────────────────────── */}
      {mode === "shipping" && (
        <div className="shrink-0 bg-amber-500 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-950">
          We ship nationwide! Design your unit below and we&apos;ll deliver it
          to your door.
        </div>
      )}

      {/* ── Split Layout ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── LEFT SIDEBAR: Controls ──────────────────────────────────── */}
        <aside className="flex w-full shrink-0 flex-col lg:w-[38%] xl:w-[35%]">
          <div className="flex-1 space-y-4 overflow-y-auto bg-stone-100 p-4">
            {/* ── Find My Local Pro ─────────────────────────────────── */}
            <section className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
                <MapPin className="h-4 w-4 text-yellow-600" />
                Find My Local Pro
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => {
                    setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                    setZipResult(null);
                  }}
                  placeholder="ZIP Code"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
                <button
                  onClick={handleZipCheck}
                  disabled={zip.length < 5 || zipChecking}
                  className="shrink-0 rounded-lg bg-gray-950 px-4 py-2 text-xs font-bold uppercase text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
                >
                  {zipChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Check"
                  )}
                </button>
              </div>
              {zipResult?.available && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {zipResult.message}
                </div>
              )}
              {zipResult && !zipResult.available && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {zipResult.message}
                </div>
              )}
            </section>

            {/* ── Auto-Fit Wall Calculator ──────────────────────────── */}
            <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
                <Maximize2 className="h-4 w-4 text-yellow-600" />
                Auto-Fit Wall Calculator
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
                    onChange={(e) => {
                      setWallWidth(e.target.value);
                      setWallFitMsg("");
                    }}
                    placeholder="e.g. 100"
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
                    onChange={(e) => {
                      setWallHeight(e.target.value);
                      setWallFitMsg("");
                    }}
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
                Find Max Size →
              </button>
              {wallFitMsg && (
                <p className="mt-2 text-center text-xs font-semibold text-emerald-600">
                  {wallFitMsg}
                </p>
              )}
            </section>

            {/* ── Manual Configuration ──────────────────────────────── */}
            <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-stone-400">
                Manual Configuration
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Columns
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cols}
                    onChange={(e) =>
                      setCols(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Tiers High
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rows}
                    onChange={(e) =>
                      setRows(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Tote Model
                </label>
                <select
                  value={toteType}
                  onChange={(e) => setToteType(e.target.value as ToteType)}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="HDX">HDX / Standard (19.75&quot; Wide)</option>
                  <option value="GM">Greenmade / Large (20.75&quot; Wide)</option>
                </select>
                <p className="mt-1 text-[10px] italic text-stone-400">
                  *Have your own? Measure top width rim-to-rim. Select closest
                  size.
                </p>
              </div>

              {/* Toggles */}
              <div className="mt-4 space-y-2">
                <Toggle
                  checked={hasTotes}
                  onChange={setHasTotes}
                  label="Show Totes"
                  detail={`+$${PRICE_PER_TOTE} ea`}
                />
                <Toggle
                  checked={hasWheels}
                  onChange={setHasWheels}
                  label="Add Wheels"
                  detail={`+$${PRICE_WHEELS}`}
                />
                <Toggle
                  checked={hasTop}
                  onChange={setHasTop}
                  label="Plywood Top"
                  detail={`+$${PRICE_PLYWOOD_SHEET}/sheet`}
                />
              </div>

              {/* Price + Add to Quote */}
              <div className="mt-5 flex items-center gap-3 border-t border-stone-200 pt-4">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-black text-gray-900">
                    ${pricing.price.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Current Unit
                  </div>
                </div>
                <button
                  onClick={handleAddUnit}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
                >
                  <Plus className="h-4 w-4" />
                  Add to Quote
                </button>
              </div>
            </section>

            {/* ── Quote List ────────────────────────────────────────── */}
            {orderItems.length > 0 && (
              <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
                <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-stone-400">
                  Your Quote List
                </h2>

                <ul className="space-y-2">
                  {orderItems.map((item, index) => {
                    const extras: string[] = [];
                    if (item.hasTotes) extras.push("Totes");
                    if (item.hasWheels) extras.push("Wheels");
                    if (item.hasTop) extras.push("Top");
                    const extraStr =
                      extras.length > 0 ? extras.join(", ") : "Frame Only";

                    return (
                      <li
                        key={index}
                        className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Unit #{index + 1}: {item.desc}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {extraStr}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-900">
                            ${item.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleRemoveUnit(index)}
                            className="text-red-400 transition-colors hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Grand Total */}
                <div className="mt-4 border-t-2 border-dashed border-stone-300 pt-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Estimated Grand Total
                  </div>
                  <div className="mt-1 text-4xl font-black text-gray-900">
                    ${grandTotal.toLocaleString()}
                  </div>
                </div>

                {/* Booking Form */}
                <div className="mt-4 border-t border-stone-200 pt-4">
                  {!submitted ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
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
                      </div>
                      <div className="grid grid-cols-2 gap-2">
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
                          placeholder="Address (optional)"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </div>
                      <button
                        onClick={handleBookDeposit}
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-50"
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
                      <p className="font-bold text-gray-900">
                        Booking Received!
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        We&apos;ll reach out within 24 hours.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* ── RIGHT: Sticky Canvas Visualizer ──────────────────────────── */}
        <main className="flex flex-1 flex-col border-l border-stone-800 bg-white">
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              backgroundColor: "#ffffff",
            }}
          >
            <BlueprintCanvas
              cols={cols}
              rows={rows}
              toteType={toteType}
              hasTotes={hasTotes}
              hasWheels={hasWheels}
              hasTop={hasTop}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm font-medium text-stone-500">
            {pricing.totalW.toFixed(0)}&quot; Width &times;{" "}
            {pricing.totalH.toFixed(0)}&quot; Height &times; 30&quot; Depth
            &nbsp;&mdash;&nbsp;
            <span className="font-bold text-gray-900">
              {cols} &times; {rows} = {cols * rows} slots
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Toggle component
// ═══════════════════════════════════════════════════════════════════════════
function Toggle({
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
        className="h-5 w-5 rounded border-stone-300 accent-yellow-400 focus:ring-yellow-400"
      />
      <span className="flex-1 text-sm font-medium text-gray-800">
        {label}
      </span>
      <span className="text-xs font-semibold text-stone-500">{detail}</span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — exact port of drawBlueprint from source code
// ═══════════════════════════════════════════════════════════════════════════
function BlueprintCanvas({
  cols,
  rows,
  toteType,
  hasTotes,
  hasWheels,
  hasTop,
}: {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  const realW = cols * opening + (cols + 1) * STUD;
  const realH = rows * TIER_HEIGHT + PLATE_HEIGHT * 2 + TOP_GAP;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cW = rect.width;
    const cH = rect.height;
    ctx.clearRect(0, 0, cW, cH);

    const woodFill = "#e2b686";
    const woodStroke = "#925f32";

    const margin = 40;
    const safeW = cW - margin * 2;
    const safeH = cH - margin * 2;

    let visualH_in = realH;
    if (hasWheels) visualH_in += 6;
    if (hasTop) visualH_in += 1;

    const scale = Math.min(safeW / realW, safeH / visualH_in);

    const pTotalW = realW * scale;
    const pTotalH = realH * scale;
    const pStud = STUD * scale;
    const pBay = opening * scale;
    const pPlate = PLATE_HEIGHT * scale;
    const pTopGap = TOP_GAP * scale;

    const startX = (cW - pTotalW) / 2;
    const visualPixelH = visualH_in * scale;
    const startY = (cH - visualPixelH) / 2 + (hasTop ? 1 * scale : 0);

    ctx.fillStyle = woodFill;
    ctx.strokeStyle = woodStroke;
    ctx.lineWidth = 2;

    ctx.fillRect(startX, startY + pTotalH - pPlate, pTotalW, pPlate);
    ctx.strokeRect(startX, startY + pTotalH - pPlate, pTotalW, pPlate);
    ctx.fillRect(startX, startY, pTotalW, pPlate);
    ctx.strokeRect(startX, startY, pTotalW, pPlate);

    const postH = pTotalH - pPlate * 2;
    const postY = startY + pPlate;
    for (let i = 0; i <= cols; i++) {
      const x = startX + i * (pBay + pStud);
      ctx.fillStyle = woodFill;
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(x, postY, pStud, postH);
      ctx.strokeRect(x, postY, pStud, postH);
    }

    const railH = 1.5 * scale;
    const railW = 1.5 * scale;

    for (let c = 0; c < cols; c++) {
      const bayLeftX = startX + pStud + c * (pBay + pStud);
      const bayRightX = bayLeftX + pBay;

      for (let r = 1; r <= rows; r++) {
        const levelY = startY + pPlate + pTopGap + (r - 1) * 16 * scale;

        ctx.fillStyle = woodFill;
        ctx.strokeStyle = woodStroke;
        ctx.fillRect(bayLeftX, levelY, railW, railH);
        ctx.strokeRect(bayLeftX, levelY, railW, railH);
        ctx.fillRect(bayRightX - railW, levelY, railW, railH);
        ctx.strokeRect(bayRightX - railW, levelY, railW, railH);

        if (hasTotes) {
          const tW = pBay * 0.94;
          const tH = 12 * scale;
          const tX = bayLeftX + (pBay - tW) / 2;
          const tY = levelY;
          const lidH = 1.5 * scale;

          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#d97706";
          ctx.fillRect(tX, tY - lidH, tW, lidH);
          ctx.strokeRect(tX, tY - lidH, tW, lidH);

          const bodyW = tW * 0.9;
          const bodyX = tX + (tW - bodyW) / 2;
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#0f172a";
          ctx.fillRect(bodyX, tY, bodyW, tH);
          ctx.strokeRect(bodyX, tY, bodyW, tH);
        }
      }
    }

    if (hasTop) {
      const topThick = 0.75 * scale;
      const overhang = 1 * scale;
      ctx.fillStyle = "#f3d2a3";
      ctx.strokeStyle = woodStroke;
      ctx.fillRect(
        startX - overhang,
        startY - topThick,
        pTotalW + overhang * 2,
        topThick
      );
      ctx.strokeRect(
        startX - overhang,
        startY - topThick,
        pTotalW + overhang * 2,
        topThick
      );
    }

    if (hasWheels) {
      const wSize = 5 * scale;
      const wY = startY + pTotalH;
      ctx.fillStyle = "#334155";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX + pStud * 2, wY + wSize / 2, wSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        startX + pTotalW - pStud * 2,
        wY + wSize / 2,
        wSize / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.font = `bold ${Math.round(cW * 0.08)}px Arial`;
    ctx.fillText("WDO CUSTOM", 0, 0);
    ctx.restore();
  }, [cols, rows, opening, realW, realH, hasTotes, hasWheels, hasTop]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
