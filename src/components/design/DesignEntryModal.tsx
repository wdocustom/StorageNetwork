"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Grid3X3,
  Loader2,
  Maximize2,
  Ruler,
  Send,
  UserCheck,
} from "lucide-react";
import { calculateBuild, type Orientation, type ToteColor, type ToteModel, type UnitType } from "@/app/actions/calculator";
import { requestOnSiteMeasure } from "@/app/actions/site-measure";

// ═══════════════════════════════════════════════════════════════════════════
// Design Entry Modal
//
// Front-loads the dimension question before the customer ever sees the
// full configurator. Conversion-first funnel:
//
//   Screen 1 — "Do you have your wall dimensions?"
//     ├── I have them            → Screen 2
//     └── Need an installer to measure → Screen 3
//
//   Screen 2 — Side-by-side options:
//     ├── Enter wall width × height (auto-fits to max rack)
//     └── Pick a grid (cols × tiers) — shows derived dimensions live
//        Pick one, hit "Show me my rack" → enters configurator at Step 2
//
//   Screen 3 — Capture name / email / phone / ZIP, send installer alert.
//
// localStorage `sn_design_entry_done` records that the customer has
// answered, so returning visits skip the modal. The configurator itself
// keeps an "Edit dimensions" link visible for revisit.
// ═══════════════════════════════════════════════════════════════════════════

export type EntryCommit =
  | {
      kind: "wall";
      widthInches: number;
      heightInches: number;
      cols: number;
      rows: number;
    }
  | { kind: "grid"; cols: number; rows: number };

interface Props {
  installerId: string | null;
  defaultZip: string;
  unitType: UnitType;
  use2x4Rails: boolean;
  toteType: ToteModel;
  toteColor: ToteColor;
  orientation: Orientation;
  onCommit: (commit: EntryCommit) => void;
  onDismiss: () => void;
  installerPricing?: Parameters<typeof calculateBuild>[0]["installerPricing"];
}

export const DESIGN_ENTRY_DONE_KEY = "sn_design_entry_done";

export default function DesignEntryModal({
  installerId,
  defaultZip,
  unitType,
  use2x4Rails,
  toteType,
  toteColor,
  orientation,
  onCommit,
  onDismiss,
  installerPricing,
}: Props) {
  const [screen, setScreen] = useState<"ask" | "dims" | "measure" | "done">("ask");

  // Wall dimensions path
  const [wallW, setWallW] = useState("");
  const [wallH, setWallH] = useState("");
  const [wallPreview, setWallPreview] = useState<{
    cols: number;
    rows: number;
    totalW: number;
    totalH: number;
  } | null>(null);
  const [wallLoading, setWallLoading] = useState(false);

  // Grid path
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [gridPreview, setGridPreview] = useState<{ totalW: number; totalH: number } | null>(null);
  const [gridLoading, setGridLoading] = useState(false);

  // Site-measure form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState(defaultZip ?? "");
  const [notes, setNotes] = useState("");
  const [siteSubmitting, setSiteSubmitting] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  const maxRows = unitType === "mini" ? 4 : use2x4Rails ? 5 : 10;

  // ── Live preview: compute when the wall fields settle ────────────────
  useEffect(() => {
    const w = parseFloat(wallW);
    const h = parseFloat(wallH);
    if (!w || !h || w < 24 || h < 24) {
      setWallPreview(null);
      return;
    }
    let cancelled = false;
    setWallLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await calculateBuild({
          wallWidth: w,
          wallHeight: h,
          toteModel: toteType,
          toteColor,
          unitType,
          orientation,
          addOns: { totes: true, wheels: false, top: false },
          mode: "wallFit",
          installerPricing,
        });
        if (cancelled) return;
        if (res.success) {
          setWallPreview({
            cols: res.cols,
            rows: res.rows,
            totalW: res.dimensions.totalW,
            totalH: res.dimensions.totalH,
          });
        } else {
          setWallPreview(null);
        }
      } catch {
        if (!cancelled) setWallPreview(null);
      } finally {
        if (!cancelled) setWallLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [wallW, wallH, toteType, toteColor, unitType, orientation, installerPricing]);

  // ── Live preview: dimensions for the picked grid ─────────────────────
  useEffect(() => {
    if (gridCols < 1 || gridRows < 1) {
      setGridPreview(null);
      return;
    }
    let cancelled = false;
    setGridLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await calculateBuild({
          cols: gridCols,
          rows: gridRows,
          toteModel: toteType,
          toteColor,
          unitType,
          orientation,
          addOns: { totes: true, wheels: false, top: false },
          mode: "manual",
          installerPricing,
        });
        if (cancelled) return;
        if (res.success) {
          setGridPreview({
            totalW: res.dimensions.totalW,
            totalH: res.dimensions.totalH,
          });
        } else {
          setGridPreview(null);
        }
      } catch {
        if (!cancelled) setGridPreview(null);
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gridCols, gridRows, toteType, toteColor, unitType, orientation, installerPricing]);

  const wallReady = !!wallPreview && !wallLoading;
  const gridReady = !!gridPreview && !gridLoading;

  const commitWall = useCallback(() => {
    const w = parseFloat(wallW);
    const h = parseFloat(wallH);
    if (!w || !h || !wallPreview) return;
    onCommit({
      kind: "wall",
      widthInches: w,
      heightInches: h,
      cols: wallPreview.cols,
      rows: wallPreview.rows,
    });
  }, [wallW, wallH, wallPreview, onCommit]);

  const commitGrid = useCallback(() => {
    onCommit({ kind: "grid", cols: gridCols, rows: gridRows });
  }, [gridCols, gridRows, onCommit]);

  const submitSiteMeasure = useCallback(async () => {
    setSiteError(null);
    setSiteSubmitting(true);
    const result = await requestOnSiteMeasure({
      installerId: installerId || undefined,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      zip,
      notes: notes || undefined,
    });
    setSiteSubmitting(false);
    if (result.success) {
      setScreen("done");
    } else {
      setSiteError(result.error ?? "Something went wrong. Please try again.");
    }
  }, [installerId, name, email, phone, zip, notes]);

  const headerCopy = useMemo(() => {
    if (screen === "ask") return "Let's get your rack right";
    if (screen === "dims") return "Choose how to size it";
    if (screen === "measure") return "Free on-site measure";
    return "We'll be in touch";
  }, [screen]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop — blurs the configurator behind */}
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
        onClick={screen === "ask" ? onDismiss : undefined}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-3xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3">
            {screen !== "ask" && screen !== "done" && (
              <button
                onClick={() => setScreen("ask")}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white"
                aria-label="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                Storage Network · 3D Design
              </p>
              <h2 className="mt-0.5 text-lg font-extrabold text-white">{headerCopy}</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <AnimatePresence mode="wait">
            {/* ── SCREEN 1: ASK ─────────────────────────────────────── */}
            {screen === "ask" && (
              <motion.div
                key="ask"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-400">
                  Two ways to start designing — pick whichever is faster for you.
                </p>

                <button
                  onClick={() => setScreen("dims")}
                  className="group flex w-full items-center gap-4 rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-4 text-left transition-colors hover:border-yellow-400 hover:bg-yellow-400/10"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
                    <Ruler className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">I have my dimensions</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Enter your wall size — or pick a starting grid like 4×4.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-yellow-400/60 transition-transform group-hover:translate-x-1 group-hover:text-yellow-400" />
                </button>

                <button
                  onClick={() => setScreen("measure")}
                  className="group flex w-full items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">
                      Have an installer measure on-site
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Free, no obligation. They'll confirm a time with you.
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </button>

                <div className="pt-2 text-center">
                  <button
                    onClick={onDismiss}
                    className="text-[11px] font-medium text-zinc-600 hover:text-zinc-400"
                  >
                    Skip — I'll figure it out in the configurator
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── SCREEN 2: DIMS (side by side) ───────────────────── */}
            {screen === "dims" && (
              <motion.div
                key="dims"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <p className="text-sm text-zinc-400">
                  Use whichever side is easier. We'll size your rack to match.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Wall measurements */}
                  <section
                    className={`flex flex-col rounded-xl border p-4 transition-colors ${
                      wallReady
                        ? "border-yellow-400/60 bg-yellow-400/5"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Maximize2 className="h-4 w-4 text-yellow-400" />
                      <h3 className="text-sm font-bold text-white">Wall measurements</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Width (in)
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={wallW}
                          onChange={(e) => setWallW(e.target.value)}
                          placeholder="e.g. 100"
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Height (in)
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={wallH}
                          onChange={(e) => setWallH(e.target.value)}
                          placeholder="e.g. 96"
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex min-h-[60px] flex-col justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      {wallLoading ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Calculating max fit…
                        </div>
                      ) : wallPreview ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            Max rack for that wall
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-white">
                            {wallPreview.cols} wide × {wallPreview.rows} tall
                            <span className="font-normal text-zinc-500"> · {wallPreview.cols * wallPreview.rows} totes</span>
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Rack footprint: {Math.round(wallPreview.totalW)}″ × {Math.round(wallPreview.totalH)}″
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-zinc-600">
                          Enter both dimensions to see the max rack that fits.
                        </p>
                      )}
                    </div>

                    <button
                      onClick={commitWall}
                      disabled={!wallReady}
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                    >
                      Show me my rack
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </section>

                  {/* Grid picker */}
                  <section
                    className={`flex flex-col rounded-xl border p-4 transition-colors ${
                      gridReady
                        ? "border-yellow-400/60 bg-yellow-400/5"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4 text-yellow-400" />
                      <h3 className="text-sm font-bold text-white">Pick a grid</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Columns
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={gridCols}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!Number.isFinite(n)) return;
                            setGridCols(Math.min(12, Math.max(1, n)));
                          }}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Tiers
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={maxRows}
                          value={gridRows}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!Number.isFinite(n)) return;
                            setGridRows(Math.min(maxRows, Math.max(1, n)));
                          }}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-yellow-400 focus:outline-none"
                        />
                      </label>
                    </div>

                    {/* Quick chips */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        [2, 2],
                        [3, 3],
                        [4, 4],
                        [4, 5],
                        [5, 4],
                      ].map(([c, r]) => (
                        <button
                          key={`${c}x${r}`}
                          onClick={() => {
                            setGridCols(c);
                            setGridRows(Math.min(maxRows, r));
                          }}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            gridCols === c && gridRows === r
                              ? "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"
                          }`}
                        >
                          {c}×{r}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex min-h-[60px] flex-col justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      {gridLoading ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Sizing…
                        </div>
                      ) : gridPreview ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            {gridCols}×{gridRows} rack dimensions
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-white">
                            {Math.round(gridPreview.totalW)}″ wide × {Math.round(gridPreview.totalH)}″ tall
                            <span className="font-normal text-zinc-500"> · {gridCols * gridRows} totes</span>
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Make sure that fits where you plan to put it.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-zinc-600">Pick columns and tiers.</p>
                      )}
                    </div>

                    <button
                      onClick={commitGrid}
                      disabled={!gridReady}
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                    >
                      Show me my rack
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </section>
                </div>

                <p className="text-center text-[11px] text-zinc-600">
                  You can still tweak everything inside the configurator.
                </p>
              </motion.div>
            )}

            {/* ── SCREEN 3: SITE MEASURE FORM ─────────────────────── */}
            {screen === "measure" && (
              <motion.div
                key="measure"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-400">
                  Drop your info and your local installer will reach out to schedule a quick visit.
                  Free, no obligation.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={zip}
                    onChange={(e) =>
                      setZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                    }
                    placeholder="ZIP"
                    maxLength={5}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know? (best time to call, garage layout, etc.)"
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                />
                {siteError && (
                  <p className="text-xs font-semibold text-red-400">{siteError}</p>
                )}
                <button
                  onClick={submitSiteMeasure}
                  disabled={siteSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-60"
                >
                  {siteSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Request my free measure
                </button>
                <p className="text-center text-[11px] text-zinc-600">
                  We never sell your info. By submitting you agree to be contacted about your project.
                </p>
              </motion.div>
            )}

            {/* ── SCREEN 4: DONE ─────────────────────────────────── */}
            {screen === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 text-center"
              >
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Got it — we'll be in touch
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Your installer will reach out shortly to schedule a quick measure. In the
                    meantime, feel free to poke around the designer.
                  </p>
                </div>
                <button
                  onClick={onDismiss}
                  className="mx-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-800"
                >
                  Continue to the designer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
