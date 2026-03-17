"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  DollarSign,
  Download,
  Lock,
  Ruler,
  Scissors,
  ShoppingCart,
  Wrench,
  Zap,
} from "lucide-react";
import { createJigPlanCheckout, verifyJigPlanPurchase, checkJigPlanAccess } from "@/app/actions/jig-plans";
import { useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// Ladder Jig Plans — $9 Digital Download
//
// Gated build plans for the ladder assembly jig. Shows a compelling sales
// section at the top of the /guides page. Unlocks the full cut plan and
// step-by-step build instructions after purchase.
// ═══════════════════════════════════════════════════════════════════════════

// ── Cut Plan Data ────────────────────────────────────────────────────────
const MATERIALS = [
  { qty: 1, item: '4\u2019 x 8\u2019 sheet of 1/2" OSB', note: "Base platform" },
  {
    qty: 3,
    item: "2x4 x 8\u2019 construction lumber",
    note: "Rails & stop block \u2014 pick the straightest ones you can find",
  },
  { qty: 38, item: '2" star-bit countersink head screws', note: "Construction / deck screws" },
];

const TOOLS = [
  "Framing square (NOT a speed square)",
  "Tape measure",
  "Circular saw",
  "Pencil",
  "Clamps (optional, but helpful)",
  "Drill / driver with star bit",
];

const CUT_LIST = [
  {
    piece: "OSB Base",
    material: '1/2" OSB',
    qty: 1,
    dimensions: '37" x 96"',
    notes: "Rip 11\" off the 48\" width. Keep the factory edge.",
  },
  {
    piece: "Rail A (left)",
    material: "2x4 x 8\u2019",
    qty: 1,
    dimensions: '1.5" x 3.5" x 96" (full length)',
    notes: "No cut needed. Use full board.",
  },
  {
    piece: "Rail B (right)",
    material: "2x4 x 8\u2019",
    qty: 1,
    dimensions: '1.5" x 3.5" x 96" (full length)',
    notes: "No cut needed. Use full board.",
  },
  {
    piece: "Stop Block",
    material: "2x4 x 8\u2019",
    qty: 1,
    dimensions: '1.5" x 3.5" x 30"',
    notes: "Cut from third 2x4. Sits between the rails, not over them.",
  },
];

const RUNG_MARKS = [
  { mark: '13"', fromStop: '13"' },
  { mark: '29"', fromStop: '29"' },
  { mark: '45"', fromStop: '45"' },
  { mark: '61"', fromStop: '61"' },
  { mark: '77"', fromStop: '77"' },
  { mark: '93"', fromStop: '93"' },
];

// ── Build Steps ──────────────────────────────────────────────────────────
const BUILD_STEPS = [
  {
    step: 1,
    title: "Cut the OSB base",
    detail:
      'Rip the 4\u2019x8\u2019 OSB sheet to 37" wide. Keep the full 96" length. Use a straight edge or chalk line for an accurate rip.',
  },
  {
    step: 2,
    title: "Fasten Rail A",
    detail:
      'Place a full-length 2x4x8\u2019 flush against one long edge of the OSB. Clamp or pre-drill, then fasten with 2" screws every 12\u201316". Keep it dead-straight along the edge.',
  },
  {
    step: 3,
    title: "Fasten Rail B",
    detail:
      'Place the second full-length 2x4x8\u2019 on the opposite long edge. Measure between the two rails \u2014 it should be exactly 30" the entire length. Fasten down with 2" screws.',
  },
  {
    step: 4,
    title: "Square & fasten the Stop Block",
    detail:
      'Cut the third 2x4 to 30". Place it between Rails A and B on one short end — it sits in the gap, not on top of the rails. Use a framing square to ensure it\u2019s perfectly 90\u00b0 to both rails. Then fasten with 2" screws.',
  },
  {
    step: 5,
    title: "Mark the rung lines",
    detail:
      'From the inside edge of the stop block, mark lines on both rails at: 13", 29", 45", 61", 77", and 93". These are your rung alignment marks.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Build Diagram (inline SVG)
// ═══════════════════════════════════════════════════════════════════════════
function JigBuildDiagram({ blurred = false }: { blurred?: boolean }) {
  return (
    <div className={`relative ${blurred ? "select-none" : ""}`}>
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-[6px] rounded-xl" />
      )}
      <svg
        viewBox="0 0 600 720"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50"
      >
        {/* Background */}
        <rect width="600" height="720" fill="#0f172a" rx="12" />

        {/* Title */}
        <text x="300" y="32" textAnchor="middle" fill="#e2e8f0" fontSize="16" fontWeight="bold" fontFamily="system-ui">
          LADDER BUILDING JIG — Assembly Overview
        </text>
        <line x1="100" y1="42" x2="500" y2="42" stroke="#334155" strokeWidth="1" />

        {/* ── Step 1: OSB Base ─────────────────────────────────── */}
        <text x="30" y="70" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          STEP 1: Cut OSB to 37&quot; x 96&quot;
        </text>
        {/* OSB rectangle */}
        <rect x="50" y="80" width="480" height="80" rx="3" fill="#78716c" fillOpacity="0.3" stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="290" y="125" textAnchor="middle" fill="#a8a29e" fontSize="10" fontFamily="monospace">
          1/2&quot; OSB — 37&quot; x 96&quot;
        </text>
        {/* Width dimension */}
        <line x1="540" y1="80" x2="540" y2="160" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="536" y1="80" x2="544" y2="80" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="536" y1="160" x2="544" y2="160" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="555" y="124" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">
          37&quot;
        </text>
        {/* Length dimension */}
        <line x1="50" y1="170" x2="530" y2="170" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="50" y1="166" x2="50" y2="174" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="530" y1="166" x2="530" y2="174" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="290" y="182" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">
          96&quot;
        </text>

        {/* ── Step 2 & 3: Rails ─────────────────────────────────── */}
        <text x="30" y="205" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          STEPS 2-3: Fasten Rails A &amp; B (30&quot; between rails)
        </text>
        {/* OSB base */}
        <rect x="50" y="215" width="480" height="90" rx="3" fill="#78716c" fillOpacity="0.2" stroke="#57534e" strokeWidth="1" />
        {/* Rail A (top) */}
        <rect x="50" y="215" width="480" height="18" rx="2" fill="#ca8a04" fillOpacity="0.4" stroke="#eab308" strokeWidth="1.5" />
        <text x="290" y="228" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="monospace">
          RAIL A — 2x4 x 96&quot; (full length)
        </text>
        {/* Rail B (bottom) */}
        <rect x="50" y="287" width="480" height="18" rx="2" fill="#ca8a04" fillOpacity="0.4" stroke="#eab308" strokeWidth="1.5" />
        <text x="290" y="300" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="monospace">
          RAIL B — 2x4 x 96&quot; (full length)
        </text>
        {/* 30" dimension between rails */}
        <line x1="38" y1="233" x2="38" y2="287" stroke="#22c55e" strokeWidth="1" />
        <line x1="34" y1="233" x2="42" y2="233" stroke="#22c55e" strokeWidth="0.8" />
        <line x1="34" y1="287" x2="42" y2="287" stroke="#22c55e" strokeWidth="0.8" />
        <text x="26" y="264" textAnchor="middle" fill="#4ade80" fontSize="9" fontWeight="bold" fontFamily="monospace">
          30&quot;
        </text>
        {/* Screw indicators */}
        {[100, 170, 240, 310, 380, 450].map((x) => (
          <g key={`screw-a-${x}`}>
            <circle cx={x} cy="224" r="2" fill="#facc15" fillOpacity="0.6" />
            <circle cx={x} cy="296" r="2" fill="#facc15" fillOpacity="0.6" />
          </g>
        ))}

        {/* ── Step 4: Stop Block ────────────────────────────────── */}
        <text x="30" y="340" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          STEP 4: Square &amp; fasten Stop Block
        </text>
        {/* OSB base */}
        <rect x="50" y="350" width="480" height="90" rx="3" fill="#78716c" fillOpacity="0.2" stroke="#57534e" strokeWidth="1" />
        {/* Rail A */}
        <rect x="50" y="350" width="480" height="18" rx="2" fill="#ca8a04" fillOpacity="0.3" stroke="#a16207" strokeWidth="1" />
        {/* Rail B */}
        <rect x="50" y="422" width="480" height="18" rx="2" fill="#ca8a04" fillOpacity="0.3" stroke="#a16207" strokeWidth="1" />
        {/* Stop Block (between rails, not over them) */}
        <rect x="50" y="368" width="18" height="54" rx="2" fill="#f97316" fillOpacity="0.5" stroke="#fb923c" strokeWidth="1.5" />
        <text x="59" y="399" textAnchor="middle" fill="#fdba74" fontSize="7" fontWeight="bold" fontFamily="monospace" transform="rotate(-90 59 399)">
          STOP 30&quot;
        </text>
        {/* Right angle indicator */}
        <rect x="68" y="368" width="10" height="10" fill="none" stroke="#4ade80" strokeWidth="1" />
        <rect x="68" y="412" width="10" height="10" fill="none" stroke="#4ade80" strokeWidth="1" />
        <text x="90" y="348" fill="#4ade80" fontSize="8" fontFamily="monospace">
          90° (use framing square!)
        </text>

        {/* ── Step 5: Rung Marks ────────────────────────────────── */}
        <text x="30" y="470" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          STEP 5: Mark rung lines from stop block edge
        </text>
        {/* OSB base */}
        <rect x="50" y="480" width="480" height="100" rx="3" fill="#78716c" fillOpacity="0.2" stroke="#57534e" strokeWidth="1" />
        {/* Rails */}
        <rect x="50" y="480" width="480" height="15" rx="2" fill="#ca8a04" fillOpacity="0.25" stroke="#a16207" strokeWidth="0.8" />
        <rect x="50" y="565" width="480" height="15" rx="2" fill="#ca8a04" fillOpacity="0.25" stroke="#a16207" strokeWidth="0.8" />
        {/* Stop Block (between rails) */}
        <rect x="50" y="495" width="15" height="70" rx="2" fill="#f97316" fillOpacity="0.35" stroke="#ea580c" strokeWidth="0.8" />

        {/* Rung mark lines */}
        {[
          { pos: 65 + (13 / 93) * 450, label: '13"' },
          { pos: 65 + (29 / 93) * 450, label: '29"' },
          { pos: 65 + (45 / 93) * 450, label: '45"' },
          { pos: 65 + (61 / 93) * 450, label: '61"' },
          { pos: 65 + (77 / 93) * 450, label: '77"' },
          { pos: 65 + (93 / 93) * 450, label: '93"' },
        ].map((mark, i) => (
          <g key={`mark-${i}`}>
            <line
              x1={mark.pos}
              y1="495"
              x2={mark.pos}
              y2="565"
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
            <text
              x={mark.pos}
              y="590"
              textAnchor="middle"
              fill="#fb7185"
              fontSize="8"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {mark.label}
            </text>
          </g>
        ))}
        {/* Arrow from stop block */}
        <line x1="65" y1="595" x2="515" y2="595" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2 2" />
        <text x="290" y="608" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="system-ui">
          All measurements from inside edge of stop block
        </text>

        {/* ── Finished Jig View ─────────────────────────────────── */}
        <line x1="30" y1="625" x2="570" y2="625" stroke="#334155" strokeWidth="1" />
        <text x="300" y="645" textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="bold" fontFamily="system-ui">
          FINISHED JIG — Three-sided rectangle with rung marks
        </text>
        {/* Mini finished view */}
        <rect x="100" y="655" width="400" height="50" rx="3" fill="#78716c" fillOpacity="0.15" stroke="#57534e" strokeWidth="1" />
        <rect x="100" y="655" width="400" height="10" rx="2" fill="#ca8a04" fillOpacity="0.3" stroke="#a16207" strokeWidth="0.8" />
        <rect x="100" y="695" width="400" height="10" rx="2" fill="#ca8a04" fillOpacity="0.3" stroke="#a16207" strokeWidth="0.8" />
        <rect x="100" y="665" width="10" height="30" rx="2" fill="#f97316" fillOpacity="0.4" stroke="#ea580c" strokeWidth="0.8" />
        {[130, 195, 260, 325, 390, 455].map((x, i) => (
          <line key={`final-${i}`} x1={x} y1="665" x2={x} y2="695" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 1" />
        ))}

        {/* Footer */}
        <text x="300" y="718" textAnchor="middle" fill="#475569" fontSize="8" fontFamily="system-ui">
          storage-network.app | Ladder Building Jig Plans v1.0
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function LadderJigPlans() {
  const searchParams = useSearchParams();
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check DB for existing purchase or admin access on mount
  useEffect(() => {
    checkJigPlanAccess().then((result) => {
      if (result.hasAccess) {
        setPurchased(true);
        setIsAdmin(result.isAdmin);
      }
    });
  }, []);

  // Handle success redirect from Stripe
  useEffect(() => {
    const jigParam = searchParams.get("jig");
    const sessionId = searchParams.get("session_id");

    if (jigParam === "success" && sessionId && !purchased) {
      setVerifying(true);
      verifyJigPlanPurchase(sessionId).then((result) => {
        if (result.verified) {
          setPurchased(true);
          // Clean URL
          window.history.replaceState({}, "", "/dashboard/guides");
        }
        setVerifying(false);
      });
    }
  }, [searchParams, purchased]);

  async function handlePurchase() {
    setLoading(true);
    const result = await createJigPlanCheckout();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900">
      {/* Emerald accent bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-teal-500/8 blur-3xl" />

      <div className="relative p-5">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
              <Wrench className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Ladder Building Jig</p>
                <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  PLANS
                </span>
              </div>
              <p className="text-[10px] font-medium text-emerald-400/60">
                Cut Plan + Build Sheet + Materials List
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-white">$9</p>
            <p className="text-[9px] text-stone-500">one-time</p>
          </div>
        </div>

        {/* ── Compelling Copy ───────────────────────────────────────── */}
        <div className="mb-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
          <p className="mb-2 text-[15px] font-bold leading-snug text-white">
            Improve your ladder builds by 200%+
          </p>
          <p className="text-[13px] leading-relaxed text-stone-400">
            If you&apos;re still building piece by piece on a set of horses, you are{" "}
            <span className="font-semibold text-orange-400">
              wasting a significant amount of time
            </span>
            . Time is money. This jig lets you pre-cut all your rails and rungs,
            drop them into position, and fasten — <span className="font-semibold text-emerald-400">
              repeatably and with dead-on accuracy
            </span>, every single time.
          </p>
        </div>

        {/* ── Value Props ──────────────────────────────────────────── */}
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
              <Zap className="h-3 w-3 text-emerald-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Cut your ladder build time in half</span>{" "}
              — no more measuring, holding, and hoping. The jig does the alignment for you.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-500/10">
              <Ruler className="h-3 w-3 text-teal-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Perfect rung spacing every time</span>{" "}
              — 6 pre-marked positions mean zero measuring errors on every ladder you build.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
              <DollarSign className="h-3 w-3 text-cyan-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Under $20 in materials</span>{" "}
              — one sheet of OSB, three 2x4s, and a box of screws. You probably already have most of it.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
              <Clock className="h-3 w-3 text-emerald-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Build the jig in under 30 minutes</span>{" "}
              — and use it on every single install from here on out.
            </p>
          </div>
        </div>

        {/* ── Preview / Gated Content ──────────────────────────────── */}
        {!purchased ? (
          <>
            {/* Blurred preview on hover */}
            <div className="group relative mb-4 cursor-pointer" onClick={handlePurchase}>
              <JigBuildDiagram blurred />

              {/* Overlay CTA */}
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-slate-950/60 transition-all group-hover:bg-slate-950/40">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Lock className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="mb-1 text-sm font-bold text-white">
                  Hover to preview. Purchase to unlock.
                </p>
                <p className="text-xs text-stone-400">
                  Full cut plans, dimensions, and step-by-step build instructions
                </p>
              </div>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={loading || verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verifying purchase...
                </>
              ) : loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Get the Plans — $9.00
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <p className="mt-2 text-center text-[10px] text-stone-600">
              Instant access after payment. Secure checkout via Stripe.
            </p>
          </>
        ) : (
          <>
            {/* ── Purchased: Full Plans ──────────────────────────────── */}
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
              <Check className="h-4 w-4 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400">
                {isAdmin ? "Plans Unlocked — Admin Preview" : "Plans Unlocked — You own this forever"}
              </p>
            </div>

            {/* Toggle full plans */}
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/15"
            >
              <Download className="h-4 w-4" />
              {showPlans ? "Hide Build Plans" : "View Build Plans"}
            </button>

            {showPlans && (
              <div className="space-y-4">
                {/* ── Build Diagram ──────────────────────────────────── */}
                <JigBuildDiagram />

                {/* ── Materials List ─────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-yellow-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Materials
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {MATERIALS.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-slate-700/30 bg-slate-900/50 px-3 py-2.5"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-yellow-500/10 text-[11px] font-black text-yellow-400">
                          {m.qty}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-stone-300">
                            {m.item}
                          </p>
                          <p className="text-[11px] text-stone-500">{m.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Tools Needed ───────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Tools Needed
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TOOLS.map((tool, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/60" />
                        <p className="text-[11px] text-stone-400">{tool}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Cut List (Job Ticket Style) ────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-rose-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Cut List
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {CUT_LIST.map((cut, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-700/30 bg-slate-900/50 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-500/10 text-[10px] font-black text-rose-400">
                              {cut.qty}
                            </span>
                            <p className="text-[13px] font-bold text-white">
                              {cut.piece}
                            </p>
                          </div>
                          <span className="rounded bg-slate-700/50 px-2 py-0.5 text-[10px] font-mono font-bold text-stone-300">
                            {cut.dimensions}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          <span className="text-stone-400">{cut.material}</span>{" "}
                          — {cut.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Rung Mark Positions ─────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-pink-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Rung Mark Positions
                    </h3>
                    <span className="text-[10px] text-stone-600">
                      (from inside edge of stop block)
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {RUNG_MARKS.map((rm, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center rounded-lg border border-pink-500/10 bg-pink-500/5 px-2 py-2"
                      >
                        <span className="text-[10px] font-bold text-pink-400">
                          #{i + 1}
                        </span>
                        <span className="text-[13px] font-black text-white">
                          {rm.mark}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-stone-600">
                    Mark on both Rail A and Rail B at each position
                  </p>
                </div>

                {/* ── Build Steps ─────────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardIcon className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Build Instructions
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {BUILD_STEPS.map((s) => (
                      <div
                        key={s.step}
                        className="flex gap-3 rounded-lg border border-slate-700/30 bg-slate-900/50 p-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-[12px] font-black text-emerald-400">
                          {s.step}
                        </span>
                        <div>
                          <p className="text-[13px] font-bold text-white">
                            {s.title}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                            {s.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Pro Tip ─────────────────────────────────────────── */}
                <div className="rounded-lg bg-slate-700/30 px-3 py-2.5">
                  <p className="text-[11px] leading-relaxed text-stone-500">
                    <span className="font-semibold text-emerald-400">Pro tip:</span>{" "}
                    Once you build the jig, lean it against the wall or hang it in your
                    trailer. It takes zero extra space and turns a 20-minute ladder build
                    into a 5-minute assembly. Your installs will be faster, your ladders
                    will be straighter, and your customers will notice the quality.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Small clipboard icon (to avoid importing another icon)
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}
