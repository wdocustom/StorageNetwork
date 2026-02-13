"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Scissors,
  ListChecks,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Wrench,
  Lightbulb,
  HardHat,
  Printer,
  QrCode,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Ruler,
  Package,
  Hammer,
  CircleDot,
  Recycle,
  Download,
  ExternalLink,
  Box,
  Layers,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";

export interface BuildManualProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes?: boolean;
  hasWheels?: boolean;
  hasTop?: boolean;
  jobId?: string;
  onExplodeStep?: (stepIndex: number) => void;
  onClose?: () => void;
}

interface CutPart {
  len: number;
  name: string;
  type: "upright" | "rail";
}

interface Board {
  cuts: CutPart[];
  rem: number;
  boardIndex: number;
}

interface ShoppingItem {
  name: string;
  detail: string;
  qty: number | string;
  sku?: string;
  category: "lumber" | "hardware" | "totes" | "accessories";
}

interface AssemblyStep {
  id: string;
  title: string;
  instruction: string;
  proTip?: string;
  safetyWarning?: string;
  toolsNeeded: string[];
  railSpacing?: string;
  screwType?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STOCK_LENGTH = 96; // 8ft board in inches
const KERF = 0.125; // blade width

// Standard Unit Constants
const OPENING_HDX = 19.75;
const OPENING_GM = 20.75;
const GAP = 1.5; // post width (2x4)
const TIER_HEIGHT = 16;
const FIRST_RAIL_HEIGHT = 13;
const DEPTH = 30;
const RAIL_STRIP_WIDTH = 1.875;

// Storage key prefix for localStorage
const STORAGE_KEY_PREFIX = "buildManual_";

// ═══════════════════════════════════════════════════════════════════════════
// BOM GENERATOR - Calculate exact material counts
// ═══════════════════════════════════════════════════════════════════════════

function generateBOM(
  cols: number,
  rows: number,
  toteType: ToteType,
  hasTotes: boolean,
  hasWheels: boolean,
  hasTop: boolean
): { shoppingList: ShoppingItem[]; totals: Record<string, number> } {
  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  const moduleWidth = cols * opening + (cols + 1) * GAP;
  const slots = cols * rows;
  const uprightHeight = rows * TIER_HEIGHT;

  // Calculate lumber parts
  const numPosts = (cols + 1) * 2; // front + back posts
  const numRailSets = 4; // top and bottom plates (front + back)

  // Collect all parts for bin packing
  const allParts: CutPart[] = [];

  // Posts (uprights)
  for (let i = 0; i < numPosts; i++) {
    allParts.push({
      len: uprightHeight,
      name: `Upright ${i + 1}`,
      type: "upright",
    });
  }

  // Rails (plates)
  for (let k = 0; k < numRailSets; k++) {
    allParts.push({
      len: moduleWidth,
      name: k < 2 ? "Bottom Plate" : "Top Plate",
      type: "rail",
    });
  }

  // Bin packing - sort longest first
  allParts.sort((a, b) => b.len - a.len);
  const boards: Board[] = [];
  let boardIdx = 1;

  for (const p of allParts) {
    let placed = false;
    for (const b of boards) {
      if (b.rem >= p.len + KERF) {
        b.cuts.push(p);
        b.rem -= p.len + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) {
      boards.push({
        cuts: [p],
        rem: STOCK_LENGTH - p.len,
        boardIndex: boardIdx++,
      });
    }
  }

  const totalBoards = boards.length;

  // Plywood strips
  const numRails = slots * 2; // left + right per slot
  const backSupports = cols <= 4 ? 4 : 6;
  const totalStrips = numRails + backSupports;

  // Calculate plywood sheets
  let topSheets = 0;
  if (hasTop) {
    if (moduleWidth > 192) topSheets = 3;
    else if (moduleWidth > 96) topSheets = 2;
    else topSheets = 1;
  }

  const stripCredit = topSheets * 27;
  let netStrips = totalStrips - stripCredit;
  if (netStrips < 0) netStrips = 0;
  const structSheets = Math.ceil(netStrips / 72);
  const totalSheets = structSheets + topSheets;

  // Screws
  const screw16Count = numRails * 4;
  const screw3Count = (cols + 1) * 20;
  const screw1Count = hasWheels ? 16 : 0;

  const screw16Boxes = Math.ceil(screw16Count / 725);
  const screw3Boxes = Math.ceil(screw3Count / 350);
  const screw1Boxes = Math.ceil(screw1Count / 95);

  // Build shopping list
  const shoppingList: ShoppingItem[] = [
    {
      name: "2×4 Lumber",
      detail: '8 ft (96") Standard Pine',
      qty: totalBoards,
      sku: "HD-204-96",
      category: "lumber",
    },
    {
      name: '3/4" Plywood',
      detail: topSheets > 0
        ? `${topSheets} Top + ${structSheets} Structural`
        : `${totalSheets} Structural Sheets`,
      qty: totalSheets,
      sku: "HD-PLY-34",
      category: "lumber",
    },
  ];

  if (hasTotes) {
    shoppingList.push({
      name: toteType === "HDX" ? "HDX 27 Gal Totes" : "Greenmade 27 Gal Totes",
      detail: toteType === "HDX" ? "Home Depot" : "Costco",
      qty: slots,
      category: "totes",
    });
  }

  if (hasWheels) {
    shoppingList.push({
      name: "Heavy-Duty Caster Kit",
      detail: '4-Pack Industrial Swivel (5")',
      qty: 1,
      sku: "HD-CASTER-4PK",
      category: "accessories",
    });
  }

  shoppingList.push(
    {
      name: '1-5/8" Construction Screws',
      detail: `#9 Star Drive (${screw16Count} needed)`,
      qty: `${screw16Boxes} Box (725ct)`,
      sku: "GRK-158-725",
      category: "hardware",
    },
    {
      name: '3" Construction Screws',
      detail: `#9 Star Drive (${screw3Count} needed)`,
      qty: `${screw3Boxes} Box (350ct)`,
      sku: "GRK-3-350",
      category: "hardware",
    }
  );

  if (hasWheels) {
    shoppingList.push({
      name: '1" Structural Screws',
      detail: `Lag Screws for Casters (${screw1Count} needed)`,
      qty: `${screw1Boxes} Box (95ct)`,
      sku: "GRK-1-95",
      category: "hardware",
    });
  }

  return {
    shoppingList,
    totals: {
      boards: totalBoards,
      sheets: totalSheets,
      totes: hasTotes ? slots : 0,
      wheelKits: hasWheels ? 1 : 0,
      screwBoxes_1_5_8: screw16Boxes,
      screwBoxes_3: screw3Boxes,
      screwBoxes_1: screw1Boxes,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CUT PLAN GENERATOR - Optimized cutting with waste calculation
// ═══════════════════════════════════════════════════════════════════════════

function generateCutPlan(
  cols: number,
  rows: number,
  toteType: ToteType
): {
  boards: Board[];
  totalWaste: number;
  wastePercentage: number;
  offcuts: { length: number; useFor: string }[];
} {
  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  const moduleWidth = cols * opening + (cols + 1) * GAP;
  const uprightHeight = rows * TIER_HEIGHT;
  const numPosts = (cols + 1) * 2;

  // Collect all parts
  const allParts: CutPart[] = [];

  for (let i = 0; i < numPosts; i++) {
    allParts.push({
      len: uprightHeight,
      name: `Upright`,
      type: "upright",
    });
  }

  for (let k = 0; k < 4; k++) {
    allParts.push({
      len: moduleWidth,
      name: k < 2 ? "Bottom Plate" : "Top Plate",
      type: "rail",
    });
  }

  // Sort longest first for optimal packing
  allParts.sort((a, b) => b.len - a.len);

  const boards: Board[] = [];
  let boardIdx = 1;

  for (const p of allParts) {
    let placed = false;
    for (const b of boards) {
      if (b.rem >= p.len + KERF) {
        b.cuts.push(p);
        b.rem -= p.len + KERF;
        placed = true;
        break;
      }
    }
    if (!placed) {
      boards.push({
        cuts: [p],
        rem: STOCK_LENGTH - p.len,
        boardIndex: boardIdx++,
      });
    }
  }

  // Calculate waste
  const totalStock = boards.length * STOCK_LENGTH;
  const totalUsed = allParts.reduce((sum, p) => sum + p.len, 0);
  const totalWaste = totalStock - totalUsed;
  const wastePercentage = (totalWaste / totalStock) * 100;

  // Identify usable offcuts (anything > 6" can be a spacer block)
  const offcuts: { length: number; useFor: string }[] = [];
  for (const board of boards) {
    if (board.rem >= 6) {
      offcuts.push({
        length: board.rem,
        useFor:
          board.rem >= 12
            ? "Spacer block or rail backing"
            : "Small spacer block",
      });
    }
  }

  return { boards, totalWaste, wastePercentage, offcuts };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSEMBLY STEPS - Based on tote model dimensions
// ═══════════════════════════════════════════════════════════════════════════

function getAssemblySteps(
  cols: number,
  rows: number,
  toteType: ToteType,
  hasWheels: boolean,
  hasTop: boolean
): AssemblyStep[] {
  const opening = toteType === "HDX" ? OPENING_HDX : OPENING_GM;
  const toteWidth = toteType === "HDX" ? "19.75" : "20.75";
  const moduleWidth = cols * opening + (cols + 1) * GAP;
  const uprightHeight = rows * TIER_HEIGHT;

  const steps: AssemblyStep[] = [
    {
      id: "cut-lumber",
      title: "Cut All Lumber",
      instruction: `Cut ${(cols + 1) * 2} uprights to ${uprightHeight}" each. Cut 4 plates (2 top, 2 bottom) to ${moduleWidth.toFixed(1)}" each. Use the Cut Plan tab for optimized board layouts.`,
      proTip:
        "Mark each piece with chalk as you cut. Group uprights together and plates together for faster assembly.",
      safetyWarning:
        "Always wear safety glasses and hearing protection when using power saws.",
      toolsNeeded: ["Miter Saw or Circular Saw", "Tape Measure", "Speed Square", "Pencil"],
    },
    {
      id: "mark-rails",
      title: "Mark Rail Positions",
      instruction: `On each upright, mark rail positions: First rail at ${FIRST_RAIL_HEIGHT}" from bottom, then every ${TIER_HEIGHT}" on center. You should have ${rows} marks per upright.`,
      proTip:
        "Use a story stick - cut one piece to length and mark all positions, then use it as a template for all uprights.",
      toolsNeeded: ["Tape Measure", "Speed Square", "Pencil", "Story Stick"],
      railSpacing: `First rail: ${FIRST_RAIL_HEIGHT}" | Spacing: ${TIER_HEIGHT}" on center`,
    },
    {
      id: "cut-plywood",
      title: "Cut Plywood Rails",
      instruction: `Rip plywood into ${RAIL_STRIP_WIDTH}" wide strips, then cut to ${DEPTH}" length. You need ${cols * rows * 2} rails total (${cols * rows} pairs).`,
      proTip:
        "Set up a fence on your table saw at 1-7/8\" and batch cut all strips. Then crosscut to 30\" using a stop block.",
      safetyWarning:
        "Use push sticks when ripping narrow strips on the table saw.",
      toolsNeeded: ["Table Saw", "Push Stick", "Stop Block", "Tape Measure"],
    },
    {
      id: "build-ladders",
      title: "Build the Ladder Frames",
      instruction: `Pair uprights (front + back) and attach rails at marked positions. Place rail's bottom edge at your mark. Drive 2× 1-5/8\" screws per rail end through the plywood into the upright face.`,
      proTip:
        "Build ladders flat on the ground. Use a spacer block to ensure consistent rail placement across all ladders.",
      screwType: '#9 × 1-5/8" Star Drive Construction Screws',
      toolsNeeded: ["Impact Driver", "T25 Bit", '1-5/8" Screws', "Spacer Block"],
      railSpacing: `Rail width: ${RAIL_STRIP_WIDTH}" | Rail depth: ${DEPTH}"`,
    },
    {
      id: "frame-assembly",
      title: "Assemble the Frame",
      instruction: `Stand all ${cols + 1} ladder frames vertically, spaced ${opening.toFixed(2)}" apart (${toteWidth}" tote slot width). Connect with bottom plates first, then top plates. Use 2× 3" screws per post connection.`,
      proTip: `Use a tote as a spacer jig - it should slide in with about 1/4\" clearance on each side.`,
      screwType: '#9 × 3" Star Drive Construction Screws',
      toolsNeeded: ["Impact Driver", "T25 Bit", '3" Screws', "Clamps", "Level"],
      railSpacing: `Slot opening: ${opening.toFixed(2)}" (${toteType} totes)`,
    },
  ];

  if (hasWheels) {
    steps.push({
      id: "install-casters",
      title: "Install Casters",
      instruction: `Flip unit carefully. Position casters at corner posts, centered on the 2×4. Drill pilot holes, then drive 4× 1/4\" × 1-1/2\" lag screws per caster.`,
      proTip:
        "Have a helper when flipping - use sawhorses to control the roll. Pre-drill with a 3/16\" bit to prevent splitting.",
      safetyWarning:
        "Unit is heavy! Use proper lifting technique and get help.",
      screwType: '1/4" × 1-1/2" Lag Screws (4 per caster)',
      toolsNeeded: ["Drill", "3/16\" Drill Bit", "Socket Wrench", "Helper"],
    });
  }

  if (hasTop) {
    steps.push({
      id: "install-top",
      title: "Install Plywood Top",
      instruction: `Measure and cut plywood to ${moduleWidth.toFixed(1)}" × ${DEPTH + 2}" (1\" overhang each side). Secure with 1-5/8" screws every 8" around perimeter.`,
      proTip:
        "Pre-drill through the plywood to prevent splitting near edges. Sand edges and consider edge banding for a finished look.",
      screwType: '#9 × 1-5/8" Star Drive Construction Screws',
      toolsNeeded: ["Circular Saw", "Drill", '1-5/8" Screws', "Sandpaper"],
    });
  }

  steps.push({
    id: "final-check",
    title: "Final Inspection",
    instruction: `Flip unit upright. Check all screws are tight. Verify unit is square (diagonal measurements should match). Test tote fit in each slot. Roll on flat surface to verify smooth rolling.`,
    proTip:
      "Rack should roll smoothly without vibration. If it wobbles, check that all casters are fully seated and tight.",
    toolsNeeded: ["Tape Measure", "Level", "Test Tote"],
  });

  return steps;
}

// ═══════════════════════════════════════════════════════════════════════════
// QR CODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateQRDataUrl(url: string): string {
  // Generate a simple QR code data URL using a QR API service
  // In production, you'd use a library like qrcode.react
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function BuildManual({
  cols,
  rows,
  toteType,
  hasTotes = true,
  hasWheels = true,
  hasTop = false,
  jobId,
  onExplodeStep,
  onClose,
}: BuildManualProps) {
  const [activeTab, setActiveTab] = useState<"shopping" | "cuts" | "steps">("shopping");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showQRModal, setShowQRModal] = useState(false);

  // Generate storage key for this specific build configuration
  const storageKey = useMemo(
    () =>
      `${STORAGE_KEY_PREFIX}${jobId || `${cols}x${rows}_${toteType}_${hasWheels ? "w" : ""}_${hasTop ? "t" : ""}`}`,
    [cols, rows, toteType, hasWheels, hasTop, jobId]
  );

  // Load checked state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [storageKey]);

  // Save checked state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(checkedItems).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(checkedItems));
    }
  }, [checkedItems, storageKey]);

  // Generate data
  const { shoppingList, totals } = useMemo(
    () => generateBOM(cols, rows, toteType, hasTotes, hasWheels, hasTop),
    [cols, rows, toteType, hasTotes, hasWheels, hasTop]
  );

  const cutPlan = useMemo(
    () => generateCutPlan(cols, rows, toteType),
    [cols, rows, toteType]
  );

  const assemblySteps = useMemo(
    () => getAssemblySteps(cols, rows, toteType, hasWheels, hasTop),
    [cols, rows, toteType, hasWheels, hasTop]
  );

  const currentStep = assemblySteps[currentStepIndex];

  // Handle checkbox toggle
  const toggleCheck = useCallback((key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Handle step navigation with explode sync
  const goToStep = useCallback(
    (index: number) => {
      setCurrentStepIndex(index);
      if (onExplodeStep) {
        // Map step index to assembly guide step
        onExplodeStep(index);
      }
    },
    [onExplodeStep]
  );

  // Reset all progress
  const resetProgress = useCallback(() => {
    setCheckedItems({});
    setCurrentStepIndex(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Calculate progress
  const totalItems = shoppingList.length + cutPlan.boards.reduce((sum, b) => sum + b.cuts.length, 0) + assemblySteps.length;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((checkedCount / totalItems) * 100);

  // Generate job URL for QR code
  const jobUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      const base = window.location.origin;
      const params = new URLSearchParams({
        cols: cols.toString(),
        rows: rows.toString(),
        tote: toteType,
        wheels: hasWheels ? "1" : "0",
        top: hasTop ? "1" : "0",
      });
      return `${base}/build/manual?${params.toString()}`;
    }
    return "";
  }, [cols, rows, toteType, hasWheels, hasTop]);

  // Print handler
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-950 print:bg-white">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3 print:border-slate-300 print:bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white print:text-gray-900">
              <HardHat className="h-4 w-4 text-yellow-400 print:text-gray-600" />
              Assembly Guide & Cut List
            </h1>
            <p className="text-[10px] text-stone-500 print:text-gray-500">
              {cols}×{rows} Unit • {toteType} Totes
              {hasWheels && " • Wheels"}
              {hasTop && " • Top"}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
              <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-yellow-400">
                {progressPercent}%
              </span>
            </div>
            {/* Action buttons */}
            <button
              onClick={() => setShowQRModal(true)}
              className="rounded-lg bg-slate-800 p-2 text-stone-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Generate Job Sticker"
            >
              <QrCode className="h-4 w-4" />
            </button>
            <button
              onClick={handlePrint}
              className="rounded-lg bg-slate-800 p-2 text-stone-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Print"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={resetProgress}
              className="rounded-lg bg-slate-800 p-2 text-stone-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Reset Progress"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── TAB NAVIGATION ─────────────────────────────────────────────────── */}
      <nav className="shrink-0 border-b border-slate-800 bg-slate-900 print:hidden">
        <div className="flex">
          {[
            { id: "shopping", label: "SHOPPING LIST", icon: ShoppingCart },
            { id: "cuts", label: "CUT PLAN", icon: Scissors },
            { id: "steps", label: "STEP-BY-STEP", icon: ListChecks },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? "border-yellow-400 bg-yellow-400/5 text-yellow-400"
                  : "border-transparent text-stone-500 hover:text-stone-300"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENT AREA ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ════════════════════════════════════════════════════════════════════
            SHOPPING LIST TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "shopping" && (
          <div className="space-y-4">
            {/* Quick totals */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "2×4s", value: totals.boards, color: "text-blue-400" },
                { label: "Plywood", value: totals.sheets, color: "text-amber-400" },
                { label: "Totes", value: totals.totes, color: "text-emerald-400" },
                { label: "Casters", value: totals.wheelKits, color: "text-purple-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-center print:border-slate-300"
                >
                  <p className={`text-xl font-black ${stat.color} print:text-gray-900`}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Shopping list with checkboxes */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 print:border-slate-300">
              <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-400 print:text-gray-900">
                  <Package className="h-4 w-4" />
                  Materials Shopping List
                </h2>
              </div>
              <div className="divide-y divide-slate-800 print:divide-slate-300">
                {shoppingList.map((item, idx) => {
                  const key = `shop-${idx}`;
                  const isChecked = checkedItems[key] || false;
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-800/50 ${
                        isChecked ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <button
                        onClick={() => toggleCheck(key)}
                        className="shrink-0"
                      >
                        {isChecked ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-600" />
                        )}
                      </button>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            isChecked
                              ? "text-stone-500 line-through"
                              : "text-white print:text-gray-900"
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {item.detail}
                          {item.sku && (
                            <span className="ml-2 text-stone-600">
                              SKU: {item.sku}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`font-mono text-lg font-black ${
                          isChecked ? "text-stone-600" : "text-yellow-400 print:text-gray-900"
                        }`}
                      >
                        {item.qty}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Pro tip */}
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4 print:border-yellow-600 print:bg-yellow-50">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400 print:text-yellow-600" />
                <div>
                  <p className="text-xs font-bold text-yellow-400 print:text-yellow-700">
                    PRO TIP
                  </p>
                  <p className="mt-1 text-sm text-stone-300 print:text-gray-700">
                    Take a screenshot of this list or print it. Check items off
                    as you load your cart. All materials available at Home Depot
                    or Lowe&apos;s.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            CUT PLAN TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "cuts" && (
          <div className="space-y-4">
            {/* Waste summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-center print:border-slate-300">
                <p className="text-xl font-black text-yellow-400 print:text-gray-900">
                  {cutPlan.boards.length}
                </p>
                <p className="text-[10px] font-bold uppercase text-stone-500">
                  Boards Needed
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-center print:border-slate-300">
                <p className="text-xl font-black text-red-400 print:text-gray-900">
                  {cutPlan.wastePercentage.toFixed(1)}%
                </p>
                <p className="text-[10px] font-bold uppercase text-stone-500">
                  Waste
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-center print:border-slate-300">
                <p className="text-xl font-black text-emerald-400 print:text-gray-900">
                  {cutPlan.offcuts.length}
                </p>
                <p className="text-[10px] font-bold uppercase text-stone-500">
                  Usable Offcuts
                </p>
              </div>
            </div>

            {/* Cut diagrams */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 print:border-slate-300">
              <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-400 print:text-gray-900">
                  <Ruler className="h-4 w-4" />
                  Cut Diagram — 96&quot; Stock Boards
                </h2>
              </div>
              <div className="space-y-4 p-4">
                {cutPlan.boards.map((board, bi) => (
                  <div key={bi} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white print:text-gray-900">
                        Board {board.boardIndex}
                      </span>
                      <span className="font-mono text-[10px] text-red-400 print:text-red-600">
                        {board.rem.toFixed(1)}&quot; waste
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="flex h-10 overflow-hidden rounded-lg bg-slate-700 print:border print:border-slate-300 print:bg-slate-100">
                      {board.cuts.map((cut, ci) => {
                        const pct = (cut.len / STOCK_LENGTH) * 100;
                        const isUpright = cut.type === "upright";
                        const key = `cut-${bi}-${ci}`;
                        const isChecked = checkedItems[key] || false;
                        return (
                          <button
                            key={ci}
                            onClick={() => toggleCheck(key)}
                            className={`relative flex items-center justify-center border-r border-slate-900/60 transition-all ${
                              isChecked ? "opacity-50" : ""
                            }`}
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isChecked
                                ? "#374151"
                                : isUpright
                                  ? "#3b82f6"
                                  : "#f59e0b",
                              minWidth: "40px",
                            }}
                            title={`${cut.name}: ${cut.len.toFixed(1)}"`}
                          >
                            <span className="font-mono text-xs font-black text-white drop-shadow-md">
                              {cut.len.toFixed(1)}&quot;
                            </span>
                            {isChecked && (
                              <CheckCircle2 className="absolute right-1 top-1 h-3 w-3 text-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                      {/* Waste section */}
                      {board.rem > 0 && (
                        <div
                          className="flex-1"
                          style={{
                            background:
                              "repeating-linear-gradient(45deg, rgba(239,68,68,0.15), rgba(239,68,68,0.15) 4px, rgba(220,38,38,0.05) 4px, rgba(220,38,38,0.05) 8px)",
                          }}
                        />
                      )}
                    </div>
                    {/* Cut list text */}
                    <p className="text-[11px] text-stone-400 print:text-gray-600">
                      From Board {board.boardIndex}: Cut{" "}
                      {board.cuts.map((c, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          <span className="font-bold text-yellow-400 print:text-gray-900">
                            {c.len.toFixed(1)}&quot;
                          </span>
                          <span className="text-stone-500"> ({c.name})</span>
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Usable offcuts */}
            {cutPlan.offcuts.length > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 print:border-emerald-600 print:bg-emerald-50">
                <div className="flex items-start gap-3">
                  <Recycle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 print:text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-400 print:text-emerald-700">
                      USABLE OFFCUTS — Don&apos;t Toss These!
                    </p>
                    <ul className="mt-2 space-y-1">
                      {cutPlan.offcuts.map((offcut, i) => (
                        <li
                          key={i}
                          className="text-sm text-stone-300 print:text-gray-700"
                        >
                          <span className="font-bold text-yellow-400 print:text-gray-900">
                            {offcut.length.toFixed(1)}&quot;
                          </span>{" "}
                          → {offcut.useFor}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Color legend */}
            <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 print:border-slate-300">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-blue-500" />
                <span className="text-xs text-stone-400">Upright</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-amber-500" />
                <span className="text-xs text-stone-400">Plate/Rail</span>
              </div>
              <div
                className="h-4 w-4 rounded"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, rgba(239,68,68,0.3), rgba(239,68,68,0.3) 2px, transparent 2px, transparent 4px)",
                }}
              />
              <span className="text-xs text-stone-400">Waste</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP-BY-STEP TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "steps" && (
          <div className="space-y-4">
            {/* Progress stepper */}
            <div className="overflow-x-auto">
              <div className="flex min-w-max items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 print:border-slate-300">
                {assemblySteps.map((step, idx) => {
                  const key = `step-${idx}`;
                  const isChecked = checkedItems[key] || false;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(idx)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase transition-all ${
                        isCurrent
                          ? "bg-yellow-400 text-gray-950"
                          : isChecked
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-800 text-stone-500 hover:bg-slate-700 hover:text-stone-300"
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <CircleDot className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current step card */}
            {currentStep && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 print:border-slate-300">
                {/* Step header */}
                <div className="border-b border-slate-800 px-4 py-4 print:border-slate-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-gray-950">
                          {currentStepIndex + 1}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Step {currentStepIndex + 1} of {assemblySteps.length}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white print:text-gray-900">
                        {currentStep.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => toggleCheck(`step-${currentStepIndex}`)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors print:hidden ${
                        checkedItems[`step-${currentStepIndex}`]
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-800 text-stone-400 hover:bg-slate-700"
                      }`}
                    >
                      {checkedItems[`step-${currentStepIndex}`]
                        ? "Completed"
                        : "Mark Done"}
                    </button>
                  </div>
                </div>

                {/* Instruction */}
                <div className="border-b border-slate-800 px-4 py-4 print:border-slate-300">
                  <div className="flex items-start gap-3">
                    <Hammer className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400 print:text-gray-600" />
                    <p className="text-sm leading-relaxed text-stone-300 print:text-gray-700">
                      {currentStep.instruction}
                    </p>
                  </div>
                </div>

                {/* Rail spacing callout */}
                {currentStep.railSpacing && (
                  <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                    <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 print:border-yellow-600 print:bg-yellow-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 print:text-yellow-700">
                        Key Measurements
                      </p>
                      <p className="mt-1 font-mono text-lg font-black text-yellow-400 print:text-gray-900">
                        {currentStep.railSpacing}
                      </p>
                    </div>
                  </div>
                )}

                {/* Screw callout */}
                {currentStep.screwType && (
                  <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                    <div className="rounded-lg border border-blue-400/30 bg-blue-400/5 px-4 py-3 print:border-blue-600 print:bg-blue-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 print:text-blue-700">
                        Fastener Required
                      </p>
                      <p className="mt-1 text-sm font-bold text-white print:text-gray-900">
                        {currentStep.screwType}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tools needed */}
                <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-stone-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Tools Needed
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentStep.toolsNeeded.map((tool, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-stone-300 print:bg-slate-200 print:text-gray-700"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Safety warning */}
                {currentStep.safetyWarning && (
                  <div className="border-b border-slate-800 px-4 py-3 print:border-slate-300">
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 print:border-red-600 print:bg-red-50">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400 print:text-red-600" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 print:text-red-700">
                            Safety Warning
                          </p>
                          <p className="mt-1 text-sm text-stone-300 print:text-gray-700">
                            {currentStep.safetyWarning}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pro tip */}
                {currentStep.proTip && (
                  <div className="px-4 py-3">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 print:border-emerald-600 print:bg-emerald-50">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 print:text-emerald-600" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-700">
                            Pro Tip
                          </p>
                          <p className="mt-1 text-sm text-stone-300 print:text-gray-700">
                            {currentStep.proTip}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="border-t border-slate-800 px-4 py-4 print:hidden">
                  <div className="flex gap-2">
                    <button
                      onClick={() => goToStep(Math.max(0, currentStepIndex - 1))}
                      disabled={currentStepIndex === 0}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-bold uppercase text-stone-400 transition-colors hover:border-stone-500 hover:text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      onClick={() => {
                        toggleCheck(`step-${currentStepIndex}`);
                        if (currentStepIndex < assemblySteps.length - 1) {
                          goToStep(currentStepIndex + 1);
                        }
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
                    >
                      {currentStepIndex === assemblySteps.length - 1 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Complete Build
                        </>
                      ) : (
                        <>
                          Mark Done & Continue
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sync with 3D button */}
            {onExplodeStep && (
              <button
                onClick={() => onExplodeStep(currentStepIndex)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-3 text-xs font-bold uppercase text-emerald-400 transition-colors hover:bg-emerald-500/20 print:hidden"
              >
                <Box className="h-4 w-4" />
                View in 3D Exploded View
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          QR CODE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
                <QrCode className="h-7 w-7 text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Job Sticker QR</h3>
              <p className="mt-1 text-sm text-stone-400">
                Scan to access this build&apos;s assembly instructions
              </p>
            </div>

            {/* QR Code */}
            <div className="mb-4 flex justify-center rounded-lg bg-white p-4">
              <img
                src={generateQRDataUrl(jobUrl)}
                alt="Build Manual QR Code"
                className="h-48 w-48"
              />
            </div>

            {/* Build specs */}
            <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-3 text-center">
              <p className="text-xs font-bold uppercase text-stone-500">Build Config</p>
              <p className="text-lg font-black text-yellow-400">
                {cols}×{rows} {toteType}
              </p>
              <p className="text-[11px] text-stone-500">
                {hasWheels && "Wheels • "}
                {hasTop && "Top • "}
                {hasTotes && `${cols * rows} Totes`}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <a
                href={generateQRDataUrl(jobUrl)}
                download={`build-manual-${cols}x${rows}.png`}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 py-2.5 text-xs font-bold text-stone-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                onClick={() => setShowQRModal(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PRINT STYLES
      ══════════════════════════════════════════════════════════════════════ */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:text-gray-900 {
            color: #111827 !important;
          }
          .print\\:border-slate-300 {
            border-color: #cbd5e1 !important;
          }
        }
      `}</style>
    </div>
  );
}
