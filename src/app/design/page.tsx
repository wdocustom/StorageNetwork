"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checkAvailability,
  getInstallerById,
  getInstallerByRef,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import { calculateBuild } from "@/app/actions/calculator";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import BookingModal from "@/components/booking/BookingModal";
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
  User,
  CreditCard,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types (display-only — no pricing or math constants)
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

interface ServerBuild {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  slots: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Design Configurator Page
// ═══════════════════════════════════════════════════════════════════════════
export default function DesignPage() {
  return (
    <Suspense>
      <DesignPageInner />
    </Suspense>
  );
}

// ── Cookie helpers (installer attribution) ─────────────────────────────
function setInstallerCookie(id: string) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `installer_id=${encodeURIComponent(id)};path=/;expires=${expires};SameSite=Lax`;
}

function getInstallerCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)installer_id=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function DesignPageInner() {
  const searchParams = useSearchParams();
  const incomingZip = searchParams.get("zip") || "";
  const mode = searchParams.get("mode") || "";
  const paramInstallerId = searchParams.get("installer_id") || searchParams.get("installer") || "";
  const paramRef = searchParams.get("ref") || "";

  // ── Installer context ─────────────────────────────────────────────────
  const [installerId, setInstallerId] = useState(paramInstallerId);
  const [installer, setInstaller] = useState<AvailabilityResult | null>(null);
  const [installerLocked, setInstallerLocked] = useState(false);
  const [installerLoading, setInstallerLoading] = useState(false);

  // Resolve installer from URL params on mount
  useEffect(() => {
    async function resolveInstaller() {
      if (paramRef) {
        // Scenario B: /design?ref=storage-network
        setInstallerLoading(true);
        const res = await getInstallerByRef(paramRef);
        if (res.available && res.installer_id) {
          setInstaller(res);
          setInstallerId(res.installer_id);
          setInstallerCookie(res.installer_id);
          setInstallerLocked(true);
        }
        setInstallerLoading(false);
      } else if (paramInstallerId) {
        // Scenario B: /design?installer=uuid
        setInstallerLoading(true);
        const res = await getInstallerById(paramInstallerId);
        if (res.available && res.installer_id) {
          setInstaller(res);
          setInstallerId(res.installer_id);
          setInstallerCookie(res.installer_id);
          setInstallerLocked(true);
        }
        setInstallerLoading(false);
      } else {
        // Scenario A: check cookie
        const cookieId = getInstallerCookie();
        if (cookieId) setInstallerId(cookieId);
      }
    }
    resolveInstaller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ZIP check ─────────────────────────────────────────────────────────
  const [zip, setZip] = useState(incomingZip);
  const [zipChecking, setZipChecking] = useState(false);
  const [zipResult, setZipResult] = useState<AvailabilityResult | null>(null);

  useEffect(() => {
    if (incomingZip.length === 5 && !paramInstallerId && !paramRef) {
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
      if (res.available && res.installer_id) {
        setInstaller(res);
        setInstallerId(res.installer_id);
        setInstallerCookie(res.installer_id);
      }
    } catch {
      setZipResult({
        available: false,
        installer_id: null,
        installer_name: null,
        installer_stripe_id: null,
        installer_avatar_url: null,
        installer_phone: null,
        installer_lead_time: 5,
        installer_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
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
  const [cols, setCols] = useState<number | string>(4);
  const [rows, setRows] = useState<number | string>(4);
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);

  // ── Server-provided build result ──────────────────────────────────────
  const [build, setBuild] = useState<ServerBuild>({
    cols: 4, rows: 4, price: 0, totalW: 0, totalH: 0, slots: 0,
  });
  const [buildLoading, setBuildLoading] = useState(false);

  // ── Multi-unit quote list ─────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);

  // ── Booking form ──────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Address is captured in BookingModal, not the sidebar form
  const address = "";
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);

  // ── Booking modal ─────────────────────────────────────────────────────
  const [showBookingModal, setShowBookingModal] = useState(false);

  const grandTotal = orderItems.reduce((sum, it) => sum + it.price, 0);
  const depositAmount = Math.round(grandTotal * 0.15 * 100) / 100;

  // Does any unit have wheels?
  const anyHasWheels = orderItems.some((it) => it.hasWheels);
  // Total cols of largest unit (for capacity weight)
  const maxCols = orderItems.reduce((max, it) => Math.max(max, it.cols), 0);

  // ── Debounced server call ─────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBuild = useCallback(
    (
      c: number,
      r: number,
      model: ToteType,
      totes: boolean,
      wheels: boolean,
      top: boolean
    ) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setBuildLoading(true);
        try {
          const res = await calculateBuild({
            cols: c,
            rows: r,
            toteModel: model,
            addOns: { totes, wheels, top },
            mode: "manual",
          });
          if (res.success) {
            setBuild({
              cols: res.cols,
              rows: res.rows,
              price: res.price,
              totalW: res.dimensions.totalW,
              totalH: res.dimensions.totalH,
              slots: res.config.slots,
            });
          }
        } catch {
          // keep previous build on error
        } finally {
          setBuildLoading(false);
        }
      }, 500);
    },
    []
  );

  // Fire on every config change (only when cols/rows are valid numbers)
  const numCols = typeof cols === "number" ? cols : parseInt(cols as string) || 0;
  const numRows = typeof rows === "number" ? rows : parseInt(rows as string) || 0;
  useEffect(() => {
    if (numCols >= 1 && numRows >= 1) {
      fetchBuild(numCols, numRows, toteType, hasTotes, hasWheels, hasTop);
    }
  }, [numCols, numRows, toteType, hasTotes, hasWheels, hasTop, fetchBuild]);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleZipCheck() {
    if (zip.length < 5) return;
    await handleZipCheckAuto(zip);
  }

  async function handleWallFit() {
    const wW = parseFloat(wallWidth);
    const wH = parseFloat(wallHeight);
    if (!wW || !wH) return;

    setBuildLoading(true);
    try {
      const res = await calculateBuild({
        wallWidth: wW,
        wallHeight: wH,
        toteModel: toteType,
        addOns: { totes: hasTotes, wheels: hasWheels, top: hasTop },
        mode: "wallFit",
      });
      if (res.success) {
        setCols(res.cols);
        setRows(res.rows);
        setBuild({
          cols: res.cols,
          rows: res.rows,
          price: res.price,
          totalW: res.dimensions.totalW,
          totalH: res.dimensions.totalH,
          slots: res.config.slots,
        });
        setWallFitMsg(
          `Max fit: ${res.cols} Wide × ${res.rows} High for that wall.`
        );
      }
    } catch {
      // keep previous state on error
    } finally {
      setBuildLoading(false);
    }
  }

  function handleAddUnit() {
    setOrderItems((prev) => [
      ...prev,
      {
        cols: build.cols,
        rows: build.rows,
        toteType,
        hasTotes,
        hasWheels,
        hasTop,
        price: build.price,
        totalW: build.totalW,
        totalH: build.totalH,
        desc: `${build.cols} Wide × ${build.rows} High`,
      },
    ]);
  }

  function handleRemoveUnit(index: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBookDeposit() {
    setSubmitError("");
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setSubmitError("Name, email, and phone are required.");
      return;
    }
    if (orderItems.length === 0) {
      setSubmitError("Add at least one unit to your quote first.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitNetworkLead({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address,
        quote_data: orderItems,
        grand_total: grandTotal,
        installer_id: installerId || undefined,
      });

      setLeadId(result.id);

      // If installer has Stripe connected, open the booking modal for inline payment
      if (installer?.installer_stripe_id) {
        setShowBookingModal(true);
      } else {
        // No Stripe — just show confirmation
        setSubmitted(true);
      }
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
            className="shrink-0 transition-transform hover:scale-105"
            title="Back to Home"
          >
            <img src="/logo.png" alt="Storage Network" className="h-12 w-12" />
          </a>
          <div className="flex-1">
            <h1 className="text-base font-extrabold uppercase tracking-widest text-white">
              Professional Grade Storage
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

      {/* ── Installer locked banner (Scenario B) ──────────────────────── */}
      {installerLocked && installer?.installer_name && (
        <div className="shrink-0 bg-emerald-600 px-4 py-2 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <User className="h-3.5 w-3.5" />
            Designing with {installer.installer_name}
          </span>
        </div>
      )}

      {/* ── Split Layout ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── LEFT SIDEBAR: Controls ──────────────────────────────────── */}
        <aside className="flex w-full shrink-0 flex-col lg:w-[38%] xl:w-[35%]">
          <div className="flex-1 space-y-4 overflow-y-auto bg-stone-100 p-4">
            {/* ── Find My Local Pro (hidden when installer locked) ──── */}
            {!installerLocked && (
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
            )}

            {/* ── Installer loading state ──────────────────────────── */}
            {installerLoading && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-xs font-semibold text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading installer profile…
              </div>
            )}

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
                disabled={!wallWidth || !wallHeight || buildLoading}
                className="mt-3 w-full rounded-lg bg-gray-950 py-2.5 text-xs font-bold uppercase tracking-wide text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
              >
                {buildLoading ? "Calculating…" : "Find Max Size →"}
              </button>
              {wallFitMsg && (
                <p className="mt-2 text-center text-xs font-semibold text-emerald-600">
                  {wallFitMsg}
                </p>
              )}
            </section>

            {/* ── Manual Configuration ──────────────────────────────── */}
            <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-gray-700">
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCols(v === "" ? "" : parseInt(v) || "");
                    }}
                    onBlur={() => {
                      const n = typeof cols === "number" ? cols : parseInt(cols as string);
                      setCols(Math.min(12, Math.max(1, n || 1)));
                    }}
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows(v === "" ? "" : parseInt(v) || "");
                    }}
                    onBlur={() => {
                      const n = typeof rows === "number" ? rows : parseInt(rows as string);
                      setRows(Math.min(10, Math.max(1, n || 1)));
                    }}
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
                  label="Totes"
                />
                <Toggle
                  checked={hasWheels}
                  onChange={setHasWheels}
                  label="Wheels"
                />
                <Toggle
                  checked={hasTop}
                  onChange={setHasTop}
                  label="Plywood Top"
                />
              </div>

              {/* Price + Add to Quote */}
              <div className="mt-5 flex items-center gap-3 border-t border-stone-200 pt-4">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-black text-gray-900">
                    {buildLoading ? "…" : `$${build.price.toLocaleString()}`}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    Current Unit
                  </div>
                </div>
                <button
                  onClick={handleAddUnit}
                  disabled={buildLoading || build.price === 0}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add to Quote
                </button>
              </div>
            </section>

            {/* ── Quote List ────────────────────────────────────────── */}
            {orderItems.length > 0 && (
              <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
                <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-gray-700">
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
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    Estimated Grand Total
                  </div>
                  <div className="mt-1 text-4xl font-black text-gray-900">
                    ${grandTotal.toLocaleString()}
                  </div>
                  {installer?.installer_stripe_id && (
                    <div className="mt-1 text-xs text-stone-500">
                      Deposit (15%):{" "}
                      <span className="font-bold text-yellow-600">
                        ${depositAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
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
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone *"
                        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                      <button
                        onClick={handleBookDeposit}
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : installer?.installer_stripe_id ? (
                          <CreditCard className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {submitting
                          ? "Submitting…"
                          : installer?.installer_stripe_id
                          ? "Pay Deposit & Book"
                          : "Submit Quote Request"}
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

        {/* ── RIGHT: Visualizer (2D/3D Toggle) ────────────────────── */}
        <main className="flex flex-1 flex-col border-l border-stone-200 bg-white">
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: "300px" }}>
            <RackVisualizer
              cols={build.cols || numCols || 1}
              rows={build.rows || numRows || 1}
              toteType={toteType}
              hasTotes={hasTotes}
              hasWheels={hasWheels}
              hasTop={hasTop}
              totalW={build.totalW}
              totalH={build.totalH}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm font-medium text-stone-500">
            {build.totalW > 0 ? build.totalW.toFixed(0) : "—"}&quot; W
            &times;{" "}
            {build.totalH > 0 ? build.totalH.toFixed(0) : "—"}&quot; H
            &times; 30&quot; D &nbsp;&mdash;&nbsp;
            <span className="font-bold text-gray-900">
              {build.cols || numCols || 1} &times; {build.rows || numRows || 1} ={" "}
              {build.slots || (numCols || 1) * (numRows || 1)} slots
            </span>
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOOKING MODAL — Address → Schedule → Inline Stripe Payment
      ═══════════════════════════════════════════════════════════════════ */}
      {leadId && installer?.installer_stripe_id && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSubmitted(true);
          }}
          leadId={leadId}
          depositAmount={depositAmount}
          totalPrice={grandTotal}
          installerStripeId={installer.installer_stripe_id}
          customerEmail={email || undefined}
          customerName={name || undefined}
          installerLeadTime={installer.installer_lead_time}
          installerWorkingDays={installer.installer_working_days}
          hasWheels={anyHasWheels}
          totalCols={maxCols}
          onSuccess={() => {
            setShowBookingModal(false);
            setSubmitted(true);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Toggle component (no pricing details exposed)
// ═══════════════════════════════════════════════════════════════════════════
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
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
    </label>
  );
}

// BlueprintCanvas has been extracted to src/components/visualizer/BlueprintCanvas.tsx
// Rack3D has been extracted to src/components/visualizer/Rack3D.tsx
// Both are consumed by src/components/visualizer/RackVisualizer.tsx
