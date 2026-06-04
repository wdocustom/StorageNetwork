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
  Sun,
  Wrench,
  Zap,
} from "lucide-react";
import {
  createChairPlanCheckout,
  verifyChairPlanPurchase,
  checkChairPlanAccess,
} from "@/app/actions/chair-plans";
import { useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// Adirondack Chair Plans — $12 Digital Download
//
// Gated build plans for the Low Boy Modern Adirondack Chair. Shown on
// /dashboard/guides. Unlocks the full cut list, angle diagrams, and
// step-by-step assembly instructions after purchase.
// ═══════════════════════════════════════════════════════════════════════════

const MATERIALS = [
  { qty: 5, item: "2×6×8' dimensional lumber", note: "Slats, legs, back supports, and armrests" },
  { qty: 1, item: "2×8×8' dimensional lumber", note: "Base / side rails" },
  { qty: 40, item: '2-1/2" pocket hole screws', note: "Outdoor-coated or stainless" },
  { qty: 12, item: '2" deck screws', note: "Exterior-coated, for legs" },
  { qty: 6,  item: '3" deck screws', note: "Extra draw at leg / base joint" },
  { qty: 2,  item: '2" lag screws', note: "One per armrest rear anchor" },
  { qty: 1,  item: "Titebond III (or equiv.)", note: "Waterproof wood glue for all joints" },
];

const TOOLS = [
  "Miter saw",
  "Table saw / circular saw (rip cuts)",
  "Jig saw (armrest round-overs)",
  "Drill / driver",
  "Pocket hole jig (Kreg or equiv.)",
  "Framing square",
  "Clamps (×2 minimum)",
  '1/4" spacer block',
  "Tape measure & pencil",
  "1\" washer (round-over template)",
];

const CUT_LIST = [
  {
    piece: "Seat Slats",
    material: "2×6",
    qty: 3,
    dimensions: '23-1/4" × 5-1/2"',
    notes: "No rip needed. Cut square on both ends.",
  },
  {
    piece: "Back Slats",
    material: "2×6",
    qty: 3,
    dimensions: '23-1/4" × 5-1/2"',
    notes: "Identical to seat slats — cut all 6 at once.",
  },
  {
    piece: "Legs",
    material: "2×6",
    qty: 2,
    dimensions: '20-1/4" × 5-1/2"',
    notes: 'Angle cut both ends. 1-3/8" offset — see Angle Cut diagram.',
  },
  {
    piece: "Base / Side Rails",
    material: "2×8",
    qty: 2,
    dimensions: '38" × 7-1/2"',
    notes: 'Front cut: 4" up, 2" over. Rear cut: 2-1/2" up, 6-1/2" over.',
  },
  {
    piece: "Back Supports",
    material: "2×6 (ripped)",
    qty: 2,
    dimensions: '17-1/2" × 4-1/4"',
    notes: "Rip to 4-1/4\". Angle rear end only. Mirror orientation on second board.",
  },
  {
    piece: "Arm Rests",
    material: "2×6 (ripped)",
    qty: 2,
    dimensions: '24-1/4" × 4"',
    notes: "Rip to 4\". Round-over front end with jig saw. Pre-drill 3 holes at 3/4\" from edge.",
  },
];

const ASSEMBLY_STEPS = [
  {
    step: 1,
    title: "Attach Back Supports to Base Rails",
    detail:
      'Apply Titebond III to each back support. Position on the rear of the base rail with pocket holes facing inward. Drive 2-1/2" pocket hole screws. Build two mirror-image assemblies.',
  },
  {
    step: 2,
    title: "Attach the 3 Back Slats",
    detail:
      'Start with the bottom back slat flush to the back support shelf. Glue and screw with 2-1/2" pocket hole screws. Use a 1/4" spacer block between each slat before fastening the next.',
  },
  {
    step: 3,
    title: "Attach the 3 Seat Slats (chair upside down)",
    detail:
      'Flip the assembly upside down. The seat slats run front to back across the base rails. Start at the rear. Use a 1/4" spacer block between each slat. The front slat sits flush with the front edge of the base.',
  },
  {
    step: 4,
    title: "Attach the Legs",
    detail:
      'Prop the chair on its rear angle and clamp steady. Glue each leg to the outside face of the base rail at the front. Drive 2" deck screws through the leg face, then one 3" deck screw from above for extra pull-through.',
  },
  {
    step: 5,
    title: "Cut & Attach the Armrests",
    detail:
      'Rip armrests to 4" wide. Cut the round-over on the front end using a 1" washer as a template and a jig saw. Pre-drill 3 holes at 3/4" from the edge. Anchor rear with a 2" lag screw into the back support; fasten front with 3 deck screws into the leg.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 1 — Part Reference Sheet
// Shows all 6 part types as proportional, color-coded shapes with dimensions.
// Scale ≈ 7px per inch.
// ═══════════════════════════════════════════════════════════════════════════
function ChairPartsDiagram({ blurred = false }: { blurred?: boolean }) {
  // Base rail polygon (38"×7.5", front & rear angle cuts at 7px/in):
  // Front-right cut: 2" over (14px) top, 4" up (28px) right side
  // Rear-left cut:  6.5" right (46px) bottom, 2.5" up (18px) left side
  const baseW = 266, baseH = 53;
  const bx = (600 - baseW) / 2; // 167

  // Leg polygon (20.25"×5.5") as parallelogram, 1-3/8"=10px offset
  const legW = 142, legH = 39;
  const lx = (600 - legW) / 2 - 80; // left leg
  const lx2 = lx + legW + 18;       // right leg

  // Back support (17.5"×4.25") — angled rear end (10px), square front
  const bsW = 123, bsH = 30;
  const bsx = (600 - bsW * 2 - 16) / 2;
  const bsx2 = bsx + bsW + 16;

  // Armrest (24.25"×4") — round front end, drawn as path
  const arW = 170, arH = 28;
  const arx = (600 - arW * 2 - 16) / 2;
  const arx2 = arx + arW + 16;

  return (
    <div className={`relative ${blurred ? "select-none" : ""}`}>
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-[6px] rounded-xl" />
      )}
      <svg
        viewBox="0 0 600 630"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50"
      >
        <rect width="600" height="630" fill="#0f172a" rx="12" />

        {/* ── Title ─────────────────────────────────────────────────── */}
        <text x="300" y="28" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold" fontFamily="system-ui">
          PART REFERENCE — All 6 Part Types
        </text>
        <line x1="80" y1="38" x2="520" y2="38" stroke="#334155" strokeWidth="1" />

        {/* ── Slats (6×, identical) ─────────────────────────────────── */}
        <text x="30" y="60" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          SEAT SLATS (×3) + BACK SLATS (×3) — All 6 identical
        </text>
        {/* Three stacked rectangles centered */}
        {[0, 1, 2].map((i) => {
          const sy = 68 + i * 43;
          return (
            <g key={`slat-${i}`}>
              <rect x="218" y={sy} width="163" height="38" rx="3"
                fill="#78350f" fillOpacity="0.35" stroke="#d97706" strokeWidth="1.5" />
              {i === 1 && (
                <text x="300" y={sy + 23} textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  23-1/4&quot; × 5-1/2&quot;
                </text>
              )}
              {i !== 1 && (
                <text x="300" y={sy + 23} textAnchor="middle" fill="#92400e" fontSize="9" fontFamily="monospace">
                  23-1/4&quot; × 5-1/2&quot;
                </text>
              )}
            </g>
          );
        })}
        {/* Dimension brace right side */}
        <line x1="392" y1="68" x2="392" y2="192" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="388" y1="68"  x2="396" y2="68"  stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="388" y1="192" x2="396" y2="192" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="408" y="133" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace" transform="rotate(90 408 133)">
          3 boards
        </text>
        {/* Qty badge */}
        <rect x="510" y="120" width="60" height="22" rx="11" fill="#78350f" fillOpacity="0.5" />
        <text x="540" y="135" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="system-ui">QTY: 6</text>

        {/* ── Base Rails ────────────────────────────────────────────── */}
        <text x="30" y="220" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          BASE / SIDE RAILS (×2) — 2×8 with front &amp; rear angle cuts
        </text>
        {/* Two base rail polygons side by side */}
        {[0, 1].map((i) => {
          const ox = 20 + i * (baseW + 14);
          const oy = 228;
          const pts = [
            `${ox},${oy}`,
            `${ox + baseW - 14},${oy}`,
            `${ox + baseW},${oy + 25}`,
            `${ox + baseW},${oy + baseH}`,
            `${ox + 46},${oy + baseH}`,
            `${ox},${oy + 35}`,
          ].join(" ");
          return (
            <g key={`base-${i}`}>
              <polygon points={pts}
                fill="#7c2d12" fillOpacity="0.35" stroke="#f97316" strokeWidth="1.5" />
              {i === 0 && (
                <>
                  {/* Dimension lines */}
                  <line x1={ox} y1={oy + baseH + 10} x2={ox + baseW} y2={oy + baseH + 10}
                    stroke="#94a3b8" strokeWidth="0.8" />
                  <line x1={ox} y1={oy + baseH + 7} x2={ox} y1={oy + baseH + 13}
                    stroke="#94a3b8" strokeWidth="0.8" />
                  <line x1={ox + baseW} y1={oy + baseH + 7} x2={ox + baseW} y1={oy + baseH + 13}
                    stroke="#94a3b8" strokeWidth="0.8" />
                  <text x={ox + baseW / 2} y={oy + baseH + 23} textAnchor="middle"
                    fill="#94a3b8" fontSize="9" fontFamily="monospace">38&quot;</text>
                  {/* Width brace */}
                  <line x1={ox - 10} y1={oy} x2={ox - 10} y2={oy + baseH}
                    stroke="#94a3b8" strokeWidth="0.8" />
                  <text x={ox - 22} y={oy + 32} textAnchor="middle" fill="#94a3b8" fontSize="9"
                    fontFamily="monospace" transform={`rotate(-90 ${ox - 22} ${oy + 32})`}>
                    7-1/2&quot;
                  </text>
                  {/* Cut labels */}
                  <text x={ox + baseW - 24} y={oy - 6} fill="#fb923c" fontSize="8" fontFamily="monospace">
                    front
                  </text>
                  <text x={ox - 2} y={oy + 18} fill="#fb923c" fontSize="8" fontFamily="monospace">
                    rear
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* ── Legs ──────────────────────────────────────────────────── */}
        <text x="30" y="320" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          LEGS (×2) — 2×6, angle cut both ends (1-3/8&quot; offset)
        </text>
        {[
          { ox: lx },
          { ox: lx2 },
        ].map(({ ox }, i) => {
          const oy = 328;
          const off = 10;
          const pts = [
            `${ox + off},${oy}`,
            `${ox + legW},${oy}`,
            `${ox + legW - off},${oy + legH}`,
            `${ox},${oy + legH}`,
          ].join(" ");
          return (
            <g key={`leg-${i}`}>
              <polygon points={pts}
                fill="#713f12" fillOpacity="0.4" stroke="#eab308" strokeWidth="1.5" />
              {i === 0 && (
                <>
                  <text x={ox + legW / 2 + 5} y={oy + 23} textAnchor="middle"
                    fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="monospace">
                    20-1/4&quot; × 5-1/2&quot;
                  </text>
                  {/* offset arrows */}
                  <line x1={ox} y1={oy + legH + 8} x2={ox + off} y2={oy + legH + 8} stroke="#4ade80" strokeWidth="1" />
                  <line x1={ox} y1={oy + legH + 5} x2={ox} y1={oy + legH + 11} stroke="#4ade80" strokeWidth="0.8" />
                  <line x1={ox + off} y1={oy + legH + 5} x2={ox + off} y1={oy + legH + 11} stroke="#4ade80" strokeWidth="0.8" />
                  <text x={ox + 5} y={oy + legH + 20} fill="#4ade80" fontSize="8" fontFamily="monospace">1-3/8&quot;</text>
                </>
              )}
            </g>
          );
        })}

        {/* ── Back Supports ─────────────────────────────────────────── */}
        <text x="30" y="398" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          BACK SUPPORTS (×2) — 2×6 ripped to 4-1/4&quot;, rear end angled
        </text>
        {[
          { ox: bsx, mirror: false },
          { ox: bsx2, mirror: true },
        ].map(({ ox, mirror }, i) => {
          const oy = 406;
          const off = 12;
          // Front (right) is square, rear (left) has angle cut
          // mirror: flip the angled end to the right for second board
          const pts = mirror
            ? [
                `${ox},${oy}`,
                `${ox + bsW - off},${oy}`,
                `${ox + bsW},${oy + bsH / 2}`,
                `${ox + bsW},${oy + bsH}`,
                `${ox},${oy + bsH}`,
              ].join(" ")
            : [
                `${ox + off},${oy}`,
                `${ox + bsW},${oy}`,
                `${ox + bsW},${oy + bsH}`,
                `${ox},${oy + bsH}`,
                `${ox},${oy + bsH / 2}`,
              ].join(" ");
          return (
            <g key={`bs-${i}`}>
              <polygon points={pts}
                fill="#134e4a" fillOpacity="0.5" stroke="#2dd4bf" strokeWidth="1.5" />
              {i === 0 && (
                <text x={ox + bsW / 2 + 6} y={oy + 18} textAnchor="middle"
                  fill="#5eead4" fontSize="8" fontWeight="bold" fontFamily="monospace">
                  17-1/2&quot; × 4-1/4&quot;
                </text>
              )}
              {/* Mirror label */}
              {i === 1 && (
                <text x={ox + bsW / 2} y={oy + 18} textAnchor="middle"
                  fill="#5eead4" fontSize="8" fontFamily="monospace">↔ mirror</text>
              )}
            </g>
          );
        })}

        {/* ── Armrests ──────────────────────────────────────────────── */}
        <text x="30" y="460" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          ARM RESTS (×2) — 2×6 ripped to 4&quot;, round-over front end
        </text>
        {[
          { ox: arx },
          { ox: arx2 },
        ].map(({ ox }, i) => {
          const oy = 468;
          const r = arH / 2; // 14px radius for round-over
          // Path: left-square end → top edge → arc at right → bottom edge
          const d = `M ${ox},${oy} L ${ox + arW - r},${oy} A ${r},${r} 0 0,1 ${ox + arW - r},${oy + arH} L ${ox},${oy + arH} Z`;
          return (
            <g key={`ar-${i}`}>
              <path d={d} fill="#3b0764" fillOpacity="0.5" stroke="#a855f7" strokeWidth="1.5" />
              {i === 0 && (
                <>
                  <text x={ox + (arW - r) / 2} y={oy + 18} textAnchor="middle"
                    fill="#d8b4fe" fontSize="8" fontWeight="bold" fontFamily="monospace">
                    24-1/4&quot; × 4&quot;
                  </text>
                  <text x={ox + arW - 2} y={oy + 12} fill="#a855f7" fontSize="7" fontFamily="monospace">
                    round
                  </text>
                  <text x={ox + arW - 2} y={oy + 22} fill="#a855f7" fontSize="7" fontFamily="monospace">
                    -over
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* ── Lumber Summary ────────────────────────────────────────── */}
        <line x1="30" y1="515" x2="570" y2="515" stroke="#1e293b" strokeWidth="1" />
        <text x="300" y="532" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="system-ui">
          Lumber needed:
        </text>
        <rect x="110" y="538" width="160" height="26" rx="6" fill="#1e293b" />
        <text x="190" y="555" textAnchor="middle" fill="#d97706" fontSize="11" fontWeight="bold" fontFamily="monospace">
          5× 2×6×8
        </text>
        <rect x="330" y="538" width="160" height="26" rx="6" fill="#1e293b" />
        <text x="410" y="555" textAnchor="middle" fill="#f97316" fontSize="11" fontWeight="bold" fontFamily="monospace">
          1× 2×8×8
        </text>

        {/* Footer */}
        <text x="300" y="622" textAnchor="middle" fill="#334155" fontSize="8" fontFamily="system-ui">
          storage-network.app | Low Boy Adirondack Chair Plans v1.0
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 2 — Angle Cut Guide
// Shows the critical angle cut measurements for the base rail and legs.
// Scale ≈ 8px per inch.
// ═══════════════════════════════════════════════════════════════════════════
function ChairAngleDiagram({ blurred = false }: { blurred?: boolean }) {
  // Base rail at 8px/inch: 38"=304px wide, 7.5"=60px tall
  const bx = 50, by = 60;
  const bW = 304, bH = 60;
  // Front cut (right end): 2"=16px over top, 4"=32px up right side
  // Rear cut (left end):  6.5"=52px right bottom, 2.5"=20px up left side
  const basePts = [
    `${bx},${by}`,                         // top-left
    `${bx + bW - 16},${by}`,               // top, 2" before right
    `${bx + bW},${by + bH - 32}`,          // right edge, 4" from bottom
    `${bx + bW},${by + bH}`,               // bottom-right
    `${bx + 52},${by + bH}`,               // bottom, 6.5" from left
    `${bx},${by + bH - 20}`,               // left edge, 2.5" from bottom
  ].join(" ");

  // Leg at 8px/inch: 20.25"=162px, 5.5"=44px. Parallelogram, 1-3/8"=11px offset
  const lx = 100, ly = 270;
  const lW = 162, lH = 44, lOff = 11;
  const legPts = [
    `${lx + lOff},${ly}`,
    `${lx + lW},${ly}`,
    `${lx + lW - lOff},${ly + lH}`,
    `${lx},${ly + lH}`,
  ].join(" ");

  return (
    <div className={`relative ${blurred ? "select-none" : ""}`}>
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-[6px] rounded-xl" />
      )}
      <svg
        viewBox="0 0 420 390"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50"
      >
        <rect width="420" height="390" fill="#0f172a" rx="12" />

        {/* ── Title ─────────────────────────────────────────────────── */}
        <text x="210" y="26" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="bold" fontFamily="system-ui">
          ANGLE CUT GUIDE
        </text>
        <line x1="60" y1="35" x2="360" y2="35" stroke="#334155" strokeWidth="1" />

        {/* ── Base Rail ─────────────────────────────────────────────── */}
        <text x="50" y="52" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          BASE / SIDE RAIL — 38&quot; × 7-1/2&quot; (cut two, mirror images)
        </text>

        {/* Board shape */}
        <polygon points={basePts}
          fill="#7c2d12" fillOpacity="0.3" stroke="#f97316" strokeWidth="2" />

        {/* Board total length dimension */}
        <line x1={bx} y1={by + bH + 12} x2={bx + bW} y2={by + bH + 12} stroke="#475569" strokeWidth="0.8" />
        <line x1={bx}      y1={by + bH + 9} x2={bx}      y2={by + bH + 15} stroke="#475569" strokeWidth="0.8" />
        <line x1={bx + bW} y1={by + bH + 9} x2={bx + bW} y2={by + bH + 15} stroke="#475569" strokeWidth="0.8" />
        <text x={(bx + bx + bW) / 2} y={by + bH + 24} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">38&quot; total length</text>

        {/* ── FRONT CUT annotations (right end) ──────────────────── */}
        {/* 2" horizontal measurement on top */}
        <line x1={bx + bW - 16} y1={by - 6} x2={bx + bW} y2={by - 6} stroke="#4ade80" strokeWidth="1.2" />
        <line x1={bx + bW - 16} y1={by - 9} x2={bx + bW - 16} y2={by - 3} stroke="#4ade80" strokeWidth="1" />
        <line x1={bx + bW}      y1={by - 9} x2={bx + bW}      y2={by - 3} stroke="#4ade80" strokeWidth="1" />
        <text x={bx + bW - 8} y={by - 12} textAnchor="middle" fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="monospace">2&quot;</text>

        {/* 4" vertical measurement on right side */}
        <line x1={bx + bW + 8} y1={by + bH - 32} x2={bx + bW + 8} y2={by + bH} stroke="#4ade80" strokeWidth="1.2" />
        <line x1={bx + bW + 5} y1={by + bH - 32} x2={bx + bW + 11} y2={by + bH - 32} stroke="#4ade80" strokeWidth="1" />
        <line x1={bx + bW + 5} y1={by + bH}      x2={bx + bW + 11} y2={by + bH}      stroke="#4ade80" strokeWidth="1" />
        <text x={bx + bW + 22} y={by + bH - 12} textAnchor="middle" fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="monospace">4&quot;</text>

        {/* Cut line highlight */}
        <line x1={bx + bW - 16} y1={by} x2={bx + bW} y2={by + bH - 32}
          stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="5 3" />
        <text x={bx + bW - 55} y={by + 10} fill="#fb7185" fontSize="8" fontFamily="system-ui">FRONT CUT</text>

        {/* ── REAR CUT annotations (left end) ──────────────────────── */}
        {/* 6.5" horizontal measurement on bottom */}
        <line x1={bx} y1={by + bH + 46} x2={bx + 52} y2={by + bH + 46} stroke="#fbbf24" strokeWidth="1.2" />
        <line x1={bx}      y1={by + bH + 43} x2={bx}      y2={by + bH + 49} stroke="#fbbf24" strokeWidth="1" />
        <line x1={bx + 52} y1={by + bH + 43} x2={bx + 52} y2={by + bH + 49} stroke="#fbbf24" strokeWidth="1" />
        <text x={bx + 26} y={by + bH + 59} textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="monospace">6-1/2&quot;</text>

        {/* 2.5" vertical measurement on left side */}
        <line x1={bx - 10} y1={by + bH - 20} x2={bx - 10} y2={by + bH} stroke="#fbbf24" strokeWidth="1.2" />
        <line x1={bx - 7} y1={by + bH - 20} x2={bx - 13} y2={by + bH - 20} stroke="#fbbf24" strokeWidth="1" />
        <line x1={bx - 7} y1={by + bH}       x2={bx - 13} y2={by + bH}       stroke="#fbbf24" strokeWidth="1" />
        <text x={bx - 32} y={by + bH - 6} textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="monospace">2-1/2&quot;</text>

        {/* Cut line highlight */}
        <line x1={bx} y1={by + bH - 20} x2={bx + 52} y2={by + bH}
          stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="5 3" />
        <text x={bx + 8} y={by + 30} fill="#fb7185" fontSize="8" fontFamily="system-ui">REAR CUT</text>

        {/* Front / Rear end labels */}
        <text x={bx + bW - 4} y={by + bH / 2 + 4} textAnchor="middle" fill="#64748b" fontSize="8"
          fontFamily="system-ui" transform={`rotate(90 ${bx + bW - 4} ${by + bH / 2 + 4})`}>
          FRONT →
        </text>
        <text x={bx + 6} y={by + bH / 2 + 4} textAnchor="middle" fill="#64748b" fontSize="8"
          fontFamily="system-ui" transform={`rotate(90 ${bx + 6} ${by + bH / 2 + 4})`}>
          ← REAR
        </text>

        {/* ── Separator ─────────────────────────────────────────────── */}
        <line x1="30" y1="240" x2="390" y2="240" stroke="#1e293b" strokeWidth="1" />

        {/* ── Leg ───────────────────────────────────────────────────── */}
        <text x="50" y="258" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="system-ui">
          LEGS — 20-1/4&quot; × 5-1/2&quot; (cut two, both ends angled)
        </text>

        <polygon points={legPts}
          fill="#713f12" fillOpacity="0.35" stroke="#eab308" strokeWidth="2" />

        {/* Total length dimension */}
        <line x1={lx} y1={ly + lH + 12} x2={lx + lW} y2={ly + lH + 12} stroke="#475569" strokeWidth="0.8" />
        <line x1={lx}      y1={ly + lH + 9}  x2={lx}      y2={ly + lH + 15} stroke="#475569" strokeWidth="0.8" />
        <line x1={lx + lW} y1={ly + lH + 9}  x2={lx + lW} y2={ly + lH + 15} stroke="#475569" strokeWidth="0.8" />
        <text x={lx + lW / 2} y={ly + lH + 24} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
          20-1/4&quot; total length
        </text>

        {/* Left-end offset dimension */}
        <line x1={lx} y1={ly - 7} x2={lx + lOff} y2={ly - 7} stroke="#4ade80" strokeWidth="1.2" />
        <line x1={lx}         y1={ly - 10} x2={lx}         y2={ly - 4} stroke="#4ade80" strokeWidth="1" />
        <line x1={lx + lOff}  y1={ly - 10} x2={lx + lOff}  y2={ly - 4} stroke="#4ade80" strokeWidth="1" />
        <text x={lx + 5} y={ly - 13} fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="monospace">1-3/8&quot;</text>
        <text x={lx - 5} y={ly - 22} fill="#64748b" fontSize="8" fontFamily="system-ui">same offset</text>

        {/* Right-end offset dimension */}
        <line x1={lx + lW - lOff} y1={ly - 7} x2={lx + lW} y2={ly - 7} stroke="#4ade80" strokeWidth="1.2" />
        <line x1={lx + lW - lOff} y1={ly - 10} x2={lx + lW - lOff} y2={ly - 4} stroke="#4ade80" strokeWidth="1" />
        <line x1={lx + lW}        y1={ly - 10} x2={lx + lW}        y2={ly - 4} stroke="#4ade80" strokeWidth="1" />
        <text x={lx + lW - 6} y={ly - 13} fill="#4ade80" fontSize="10" fontWeight="bold" fontFamily="monospace">1-3/8&quot;</text>
        <text x={lx + lW - 30} y={ly - 22} fill="#64748b" fontSize="8" fontFamily="system-ui">both ends</text>

        {/* Cut lines on each leg end */}
        <line x1={lx} y1={ly + lH} x2={lx + lOff} y2={ly}
          stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 3" />
        <line x1={lx + lW - lOff} y1={ly} x2={lx + lW} y2={ly + lH}
          stroke="#f43f5e" strokeWidth="2" strokeDasharray="4 3" />

        {/* Note */}
        <rect x="50" y="340" width="320" height="32" rx="6" fill="#0f1f2e" stroke="#1e3a5f" strokeWidth="1" />
        <text x="210" y="353" textAnchor="middle" fill="#7dd3fc" fontSize="9" fontFamily="system-ui">
          Both cuts on each leg are parallel — the same 1-3/8&quot; offset,
        </text>
        <text x="210" y="365" textAnchor="middle" fill="#7dd3fc" fontSize="9" fontFamily="system-ui">
          same direction. This makes the leg a parallelogram in profile.
        </text>

        {/* Footer */}
        <text x="210" y="384" textAnchor="middle" fill="#334155" fontSize="8" fontFamily="system-ui">
          storage-network.app | Angle Cut Reference
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM 3 — Assembly Sequence (side-profile schematic)
// Shows the chair being built in 5 stages, viewed from the right side.
// ═══════════════════════════════════════════════════════════════════════════
function ChairAssemblyDiagram({ blurred = false }: { blurred?: boolean }) {
  // Shared chair geometry (scale ≈ 2.2px/inch)
  // Panel: 500px wide × 95px tall per stage
  // Ground at py + 88 in each panel
  // Front of chair is on the right side of each panel

  type Stage = {
    label: string;
    color: string;
    note: string;
  };

  const stages: Stage[] = [
    { label: "STEP 1", color: "#f97316", note: "Base Rail + Back Support (L-shape)" },
    { label: "STEP 2", color: "#eab308", note: "3 Back Slats added (1/4\" spacer gaps)" },
    { label: "STEP 3", color: "#22c55e", note: "3 Seat Slats added (flip chair upside down)" },
    { label: "STEP 4", color: "#38bdf8", note: "Legs attached at front base" },
    { label: "STEP 5", color: "#a855f7", note: "Arm Rests attached (lag screw rear, 3 screws front)" },
  ];

  // Helper: draw the chair profile at a given stage
  // Panel origin (px, py), ground at py+88
  // showBase, showBackSlats, showSeatSlats, showLegs, showArmrests
  function chairProfile(
    px: number,
    py: number,
    showBase: boolean,
    showBackSupport: boolean,
    showBackSlats: boolean,
    showSeatSlats: boolean,
    showLegs: boolean,
    showArmrests: boolean,
    highlightColor: string,
  ) {
    const ground = py + 88;

    // Key geometry (all coords relative to px, py)
    // Base rail: runs from front-right to rear-left, slightly angled
    const baseFrontX = px + 350, baseFrontY = ground - 26; // front of base (seat height ~12")
    const baseRearX  = px + 200, baseRearY  = ground - 20; // rear of base (slightly lower)
    const baseH = 14; // base rail thickness

    // Back support: attached to rear of base, angles up-right (toward the back)
    // 17.5" long at 2.2px/in = 38.5px, angled ~70° from horizontal
    const bsStartX = baseRearX + 8,  bsStartY = baseRearY - baseH;
    const bsEndX   = bsStartX  - 14, bsEndY   = bsStartY - 36;

    // Back slats: 23.25" long = 51px at 2.2px/in, nearly vertical, attached to back supports
    // 3 slats shown as thin parallel lines
    const slat1StartX = bsStartX,      slat1StartY = bsStartY;
    const slat1EndX   = slat1StartX - 11, slat1EndY = slat1StartY - 46;
    const slatSpacing = 4; // 1/4" spacer shown as gap between lines

    // Seat slats: 3 horizontal boards on top of the base, front to back
    // Shown as thin horizontal lines
    const seatStartX = baseFrontX - 8, seatY = baseFrontY - 3;
    const seatEndX   = baseRearX  + 8;

    // Leg: vertical-ish board from front of base to ground
    const legX = baseFrontX, legTopY = baseFrontY + baseH;
    const legW = 11, legH = ground - legTopY;

    // Armrest: near-horizontal from top-of-leg extending back over seat
    const armFrontX = legX + legW / 2, armFrontY = baseFrontY - 4;
    const armRearX  = bsEndX + 8,      armRearY  = bsEndY + 4;

    // Determine which new elements to highlight
    const baseColor       = showBase        ? "#f97316" : "#334155";
    const bsColor         = showBackSupport ? highlightColor : "#334155";
    const backSlatColor   = showBackSlats   ? "#eab308" : "#334155";
    const seatSlatColor   = showSeatSlats   ? "#22c55e" : "#334155";
    const legColor        = showLegs        ? "#38bdf8" : "#334155";
    const armColor        = showArmrests    ? "#a855f7" : "#334155";

    return (
      <g>
        {/* Ground line */}
        <line x1={px + 150} y1={ground} x2={px + 420} y2={ground} stroke="#1e293b" strokeWidth="1" />
        <text x={px + 160} y={ground + 9} fill="#1e293b" fontSize="7" fontFamily="monospace">ground</text>

        {/* Base rail */}
        {showBase && (
          <polygon
            points={`${baseFrontX},${baseFrontY} ${baseRearX},${baseRearY} ${baseRearX},${baseRearY + baseH} ${baseFrontX},${baseFrontY + baseH}`}
            fill="#7c2d12" fillOpacity="0.4" stroke={baseColor} strokeWidth="2"
          />
        )}

        {/* Back support */}
        {showBackSupport && (
          <line x1={bsStartX} y1={bsStartY} x2={bsEndX} y2={bsEndY}
            stroke={bsColor} strokeWidth="8" strokeLinecap="round" />
        )}

        {/* Back slats (3 lines) */}
        {showBackSlats && [0, 1, 2].map((i) => (
          <line
            key={`bs-${i}`}
            x1={slat1StartX - i * (slatSpacing + 1)}
            y1={slat1StartY - i * 3}
            x2={slat1EndX - i * (slatSpacing + 1)}
            y2={slat1EndY - i * 3}
            stroke={backSlatColor} strokeWidth="5" strokeLinecap="round"
          />
        ))}

        {/* Seat slats (3 horizontal lines) */}
        {showSeatSlats && [0, 1, 2].map((i) => (
          <line
            key={`ss-${i}`}
            x1={seatStartX - i * 22}
            y1={seatY}
            x2={seatStartX - i * 22}
            y2={seatY + 6}
            stroke={seatSlatColor} strokeWidth="5" strokeLinecap="round"
            transform={`rotate(90 ${seatStartX - i * 22} ${seatY + 3})`}
          />
        ))}

        {/* Legs */}
        {showLegs && (
          <rect x={legX - legW / 2} y={legTopY} width={legW} height={legH}
            fill="#1e3a5f" fillOpacity="0.5" stroke={legColor} strokeWidth="2" />
        )}

        {/* Armrests */}
        {showArmrests && (
          <line x1={armFrontX} y1={armFrontY} x2={armRearX} y2={armRearY}
            stroke={armColor} strokeWidth="6" strokeLinecap="round" />
        )}
      </g>
    );
  }

  const panelH = 105;
  const totalH = 40 + stages.length * (panelH + 36) + 30;

  return (
    <div className={`relative ${blurred ? "select-none" : ""}`}>
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-[6px] rounded-xl" />
      )}
      <svg
        viewBox={`0 0 500 ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50"
      >
        <rect width="500" height={totalH} fill="#0f172a" rx="12" />

        <text x="250" y="26" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="bold" fontFamily="system-ui">
          ASSEMBLY SEQUENCE — Side Profile View
        </text>
        <line x1="50" y1="34" x2="450" y2="34" stroke="#334155" strokeWidth="1" />

        {stages.map((stage, i) => {
          const py = 44 + i * (panelH + 36);

          return (
            <g key={stage.label}>
              {/* Step label */}
              <rect x="15" y={py} width="56" height="18" rx="9"
                fill={stage.color} fillOpacity="0.15" />
              <text x="43" y={py + 12} textAnchor="middle" fill={stage.color}
                fontSize="9" fontWeight="black" fontFamily="system-ui">
                {stage.label}
              </text>
              <text x="80" y={py + 12} fill="#94a3b8" fontSize="9" fontFamily="system-ui">
                {stage.note}
              </text>

              {/* Panel bg */}
              <rect x="15" y={py + 22} width="470" height={panelH} rx="6"
                fill="#0f172a" stroke="#1e293b" strokeWidth="1" />

              {/* Chair profile for this stage */}
              {chairProfile(
                0, py + 22,
                true,                // base always shown after step 1
                true,                // back support always shown after step 1
                i >= 1,              // back slats from step 2
                i >= 2,              // seat slats from step 3
                i >= 3,              // legs from step 4
                i >= 4,              // armrests step 5
                stage.color,
              )}

              {/* Highlight label for new part added in this step */}
              <text x="30" y={py + panelH + 15} fill={stage.color}
                fontSize="8" fontFamily="system-ui" fontStyle="italic">
                {i === 0 && "▶ Pocket holes + glue. Build both L-shapes as mirror images."}
                {i === 1 && "▶ Start from bottom slat. Use 1/4\" spacer between each board."}
                {i === 2 && "▶ Flip chair upside down. Front slat flush with base front edge."}
                {i === 3 && "▶ Prop chair on rear angle. Clamp steady before fastening."}
                {i === 4 && "▶ Rear: lag screw into back support. Front: 3 deck screws into leg."}
              </text>
            </g>
          );
        })}

        {/* Footer */}
        <text x="250" y={totalH - 8} textAnchor="middle" fill="#334155" fontSize="8" fontFamily="system-ui">
          storage-network.app | Assembly Sequence Reference
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function AdirondackChairPlans() {
  const searchParams = useSearchParams();
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"parts" | "angles" | "assembly">("parts");

  useEffect(() => {
    checkChairPlanAccess().then((result) => {
      if (result.hasAccess) {
        setPurchased(true);
        setIsAdmin(result.isAdmin);
      }
    });
  }, []);

  useEffect(() => {
    const chairParam = searchParams.get("chair");
    const sessionId = searchParams.get("session_id");

    if (chairParam === "success" && sessionId && !purchased) {
      setVerifying(true);
      verifyChairPlanPurchase(sessionId).then((result) => {
        if (result.verified) {
          setPurchased(true);
          window.history.replaceState({}, "", "/dashboard/guides");
        }
        setVerifying(false);
      });
    }
  }, [searchParams, purchased]);

  async function handlePurchase() {
    setLoading(true);
    const result = await createChairPlanCheckout();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
      {/* Amber accent bar */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-orange-500/8 blur-3xl" />

      <div className="relative p-5">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
              <Sun className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Low Boy Adirondack Chair</p>
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-400">
                  PLANS
                </span>
              </div>
              <p className="text-[10px] font-medium text-amber-400/60">
                Cut List + Angle Diagrams + Assembly Guide
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-white">$12</p>
            <p className="text-[9px] text-stone-500">one-time</p>
          </div>
        </div>

        {/* ── Compelling Copy ───────────────────────────────────────── */}
        <div className="mb-4 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
          <p className="mb-2 text-[15px] font-bold leading-snug text-white">
            A chair that sells itself — and upsells the install
          </p>
          <p className="text-[13px] leading-relaxed text-stone-400">
            Build one of these for your showroom or next garage job and watch
            customers ask about it.{" "}
            <span className="font-semibold text-amber-400">
              Weekend build, $60–$80 in lumber
            </span>
            , zero special skills required. Ship it as an add-on to any storage
            install or sell the plans direct — your call.
          </p>
        </div>

        {/* ── Value Props ──────────────────────────────────────────── */}
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
              <Zap className="h-3 w-3 text-amber-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">3–4 hour weekend build</span>{" "}
              — 5 dimensional lumber boards, a pocket-hole jig, and basic tools. No router, no joinery.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
              <Ruler className="h-3 w-3 text-orange-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Three visual diagrams included</span>{" "}
              — part reference sheet, angle-cut guide with labeled measurements, and a 5-stage assembly sequence.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500/10">
              <DollarSign className="h-3 w-3 text-rose-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Instant upsell opportunity</span>{" "}
              — pair pricing on two chairs returns 4–6× the plan cost in a single job.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
              <Clock className="h-3 w-3 text-amber-400" />
            </div>
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-stone-300">Beginner-friendly</span>{" "}
              — angle cuts explained in plain English, no "see diagram" guesswork. The trickiest cut is a straight line on a marked board.
            </p>
          </div>
        </div>

        {/* ── Preview / Gated Content ──────────────────────────────── */}
        {!purchased ? (
          <>
            {/* Blurred preview */}
            <div className="group relative mb-4 cursor-pointer" onClick={handlePurchase}>
              <ChairPartsDiagram blurred />
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-slate-950/60 transition-all group-hover:bg-slate-950/40">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Lock className="h-7 w-7 text-amber-400" />
                </div>
                <p className="mb-1 text-sm font-bold text-white">
                  Hover to preview. Purchase to unlock.
                </p>
                <p className="text-xs text-stone-400">
                  Full cut plans, angle diagrams, and step-by-step assembly guide
                </p>
              </div>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={loading || verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 hover:shadow-amber-500/30 active:scale-[0.98] disabled:opacity-60"
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
                  Get the Plans — $12.00
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
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
              <Check className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-semibold text-amber-400">
                {isAdmin ? "Plans Unlocked — Admin Preview" : "Plans Unlocked — You own this forever"}
              </p>
            </div>

            <button
              onClick={() => setShowPlans(!showPlans)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-400 transition-all hover:border-amber-500/50 hover:bg-amber-500/15"
            >
              <Download className="h-4 w-4" />
              {showPlans ? "Hide Build Plans" : "View Build Plans"}
            </button>

            {showPlans && (
              <div className="space-y-4">

                {/* ── Materials ──────────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Materials & Hardware
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {MATERIALS.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-700/30 bg-slate-900/50 px-3 py-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-[11px] font-black text-amber-400">
                          {m.qty}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-stone-300">{m.item}</p>
                          <p className="text-[11px] text-stone-500">{m.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Tools ──────────────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Tools Needed
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TOOLS.map((tool, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/60" />
                        <p className="text-[11px] text-stone-400">{tool}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Cut List ───────────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-rose-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Cut List
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {CUT_LIST.map((cut, i) => (
                      <div key={i} className="rounded-lg border border-slate-700/30 bg-slate-900/50 p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-500/10 text-[10px] font-black text-rose-400">
                              {cut.qty}
                            </span>
                            <p className="text-[13px] font-bold text-white">{cut.piece}</p>
                          </div>
                          <span className="rounded bg-slate-700/50 px-2 py-0.5 text-[10px] font-mono font-bold text-stone-300">
                            {cut.dimensions}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          <span className="text-stone-400">{cut.material}</span> — {cut.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Diagrams (tabbed) ───────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-sky-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Build Diagrams
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      {(["parts", "angles", "assembly"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            activeTab === tab
                              ? "bg-amber-500/20 text-amber-400"
                              : "text-stone-500 hover:text-stone-300"
                          }`}
                        >
                          {tab === "parts" ? "Parts" : tab === "angles" ? "Angles" : "Assembly"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeTab === "parts"    && <ChairPartsDiagram />}
                  {activeTab === "angles"   && <ChairAngleDiagram />}
                  {activeTab === "assembly" && <ChairAssemblyDiagram />}
                </div>

                {/* ── Assembly Steps ─────────────────────────────────── */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardIcon className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Assembly Instructions
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {ASSEMBLY_STEPS.map((s) => (
                      <div key={s.step} className="flex gap-3 rounded-lg border border-slate-700/30 bg-slate-900/50 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-[12px] font-black text-amber-400">
                          {s.step}
                        </span>
                        <div>
                          <p className="text-[13px] font-bold text-white">{s.title}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Pro Tips ───────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="rounded-lg bg-slate-700/30 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-stone-500">
                      <span className="font-semibold text-amber-400">Pro tip:</span>{" "}
                      Apply your first coat of exterior finish to all cut parts{" "}
                      <span className="text-stone-400">before</span> glue-up. Getting sealer into end
                      grain and pocket holes dramatically extends chair life in wet climates. Apply a second
                      coat after assembly.
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-700/30 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-stone-500">
                      <span className="font-semibold text-amber-400">Pro tip:</span>{" "}
                      Quote chairs as a pair — a single chair at a customer&apos;s door rarely sells. A
                      pair on display does. Shop-build time is ~2.5 hrs/chair once you have the rhythm.
                    </p>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" />
      <path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  );
}
