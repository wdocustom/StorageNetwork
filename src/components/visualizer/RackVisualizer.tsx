"use client";

import { Component, Suspense, lazy, useState, useEffect, useRef } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Loader2, Eye, EyeOff, Layers, ChevronDown } from "lucide-react";
import BlueprintCanvas from "./BlueprintCanvas";
import type { SectionAddon, PaintColorId } from "@/types/viewModels";

// Lazy-load 3D (heavy Three.js bundle — only fetched when user switches to 3D)
const Rack3D = lazy(() => import("./Rack3D"));

function getDefaultViewMode(): "2D" | "3D" {
  if (typeof window === "undefined") return "2D";
  return window.innerWidth < 768 ? "2D" : "3D";
}

// ── ErrorBoundary for WebGL / Three.js crashes ───────────────────────────
// Falls back to 2D view if 3D rendering fails (WebGL unavailable, GPU
// driver issue, context lost, etc.)

interface ErrorBoundaryProps {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class Render3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[RackVisualizer] 3D render failed, falling back to 2D:", error.message, info.componentStack);
    // Defer parent state update to avoid React #310 ("Cannot update a component
    // while rendering a different component") when Three.js context-loss cascades.
    queueMicrotask(() => this.props.onError?.());
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RackVisualizer — 2D/3D Toggle Container
// Default: Fast 2D Blueprint. Toggle to interactive 3D model.
// Supports compound presets (multiple sub-units rendered as one).
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

/** Sub-unit definition for compound presets */
export interface VisualizerSubUnit {
  cols: number;
  rows: number;
  totalW: number;
  totalH: number;
  hasTop: boolean;
  hasWheels: boolean;
}

/** Open shelving config for 3D rendering */
export interface ShelvingConfig3D {
  widthIn: number;
  frameH: number;
  depth: number;
  shelves: number;
}

interface RackVisualizerProps {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  totalW: number;
  totalH: number;
  /** When set, renders a compound preset (multiple sub-units side by side) */
  presetUnits?: VisualizerSubUnit[];
  /** Per-section addons (doors, side panels, rail removal, hinges) */
  addons?: SectionAddon[];
  /** Paint color for the 2×4 frame */
  paintFrameColor?: PaintColorId | null;
  /** Paint color for plywood doors */
  paintDoorColor?: PaintColorId | null;
  /** Paint color for side panels */
  paintSidePanelColor?: PaintColorId | null;
  /** When set, renders an open shelving unit instead of a tote organizer */
  shelvingConfig?: ShelvingConfig3D;
  /** When set, renders a ceiling tote rail system */
  overheadConfig?: { slotsWide: number; slotsDeep: number; toteType: "HDX" | "GM"; hasTotes?: boolean };
  /** When set, renders a raised bed planter */
  raisedBedConfig?: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover?: string; finish?: string };
  /** Multi-unit mode: renders multiple finished units side-by-side */
  multiUnitItems?: MultiUnitItem[];
  /** Controls for the multi-unit overlay (rendered on the 3D canvas) */
  multiUnitControls?: {
    showMultiUnit3D: boolean;
    onShowMultiUnit3DChange: (v: boolean) => void;
    unitVisibility: Record<number, boolean>;
    onUnitVisibilityChange: (index: number, visible: boolean) => void;
    orderItems: Array<{ desc: string }>;
  };
  /** Text displayed as a diagonal watermark behind the visualizer */
  watermarkText?: string;
}

/** A completed order item for multi-unit 3D rendering */
export interface MultiUnitItem {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  totalW: number;
  totalH: number;
  depth?: number;
  addons?: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  shelvingConfigId?: string;
  shelvingConfig?: { widthIn: number; frameH: number; depth: number; shelves: number };
  overheadStorageConfig?: { slotsWide: number; slotsDeep: number; toteType: "HDX" | "GM" };
  raisedBedConfig?: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover?: string; finish?: string };
  presetUnits?: Array<{ cols: number; rows: number; totalW: number; totalH: number; hasTop: boolean; hasWheels: boolean }>;
  visible: boolean;
  desc: string;
}

/** Extract a short label from a unit description.
 *  Bestseller: "Indiana Joe (2x4 + 2x2 + 2x4)" → "Indiana Joe"
 *  Standard:   "Standard: 4W × 4H" → "4W × 4H"
 */
function shortUnitLabel(desc: string): string {
  // Bestseller — has name before parenthesized sub-units
  const parenIdx = desc.indexOf(" (");
  if (parenIdx > 0) {
    const name = desc.slice(0, parenIdx).trim();
    // Strip leading "Unit #N: " if present
    return name.replace(/^Unit\s*#?\d+:\s*/i, "");
  }
  // Standard/Mini — "Standard: 4W × 4H" → "4W × 4H"
  const colonIdx = desc.indexOf(": ");
  if (colonIdx > 0) return desc.slice(colonIdx + 2).trim();
  return desc;
}

/** Multi-unit overlay — renders on the 3D canvas top-left */
function MultiUnitOverlay({ controls }: {
  controls: NonNullable<RackVisualizerProps["multiUnitControls"]>;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isActive = controls.showMultiUnit3D;
  const visibleCount = controls.orderItems.filter(
    (_, i) => controls.unitVisibility[i] !== false
  ).length;

  return (
    <div ref={panelRef} className="absolute left-3 top-3 z-10">
      {/* Toggle Button */}
      <button
        onClick={() => {
          if (!isActive) {
            controls.onShowMultiUnit3DChange(true);
            setOpen(true);
          } else {
            setOpen(!open);
          }
        }}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm transition-all ${
          isActive
            ? "border-yellow-400/60 bg-gray-900/90 text-yellow-400"
            : "border-stone-300/60 bg-white/80 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
        }`}
      >
        <Layers className="h-3.5 w-3.5" />
        Multi-Unit
        {isActive && (
          <span className="ml-0.5 rounded-full bg-yellow-400/20 px-1.5 text-[9px] font-black text-yellow-400">
            {visibleCount}/{controls.orderItems.length}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="mt-1.5 w-56 rounded-lg border border-stone-700/80 bg-gray-900/95 shadow-xl backdrop-blur-md">
          {/* Turn off button */}
          {isActive && (
            <button
              onClick={() => {
                controls.onShowMultiUnit3DChange(false);
                setOpen(false);
              }}
              className="w-full border-b border-stone-700/50 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-red-400"
            >
              Turn Off Multi-Unit
            </button>
          )}
          {/* Unit list */}
          <div className="p-1.5 space-y-0.5">
            {controls.orderItems.map((item, index) => {
              const isVisible = controls.unitVisibility[index] !== false;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => controls.onUnitVisibilityChange(index, !isVisible)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-all ${
                    isVisible
                      ? "bg-yellow-400/10 text-yellow-400"
                      : "text-stone-600 hover:bg-stone-800 hover:text-stone-400"
                  }`}
                >
                  {isVisible ? (
                    <Eye className="h-3 w-3 shrink-0" />
                  ) : (
                    <EyeOff className="h-3 w-3 shrink-0" />
                  )}
                  <span className={`flex-1 truncate text-[11px] font-semibold ${
                    isVisible ? "text-stone-200" : "text-stone-600"
                  }`}>
                    {shortUnitLabel(item.desc)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RackVisualizer(props: RackVisualizerProps) {
  const [viewMode, setViewMode] = useState<"2D" | "3D">(getDefaultViewMode);

  // Sync default on hydration (SSR always renders "2D", client may upgrade to "3D")
  useEffect(() => {
    setViewMode(getDefaultViewMode());
  }, []);

  const showMultiUnitOverlay = viewMode === "3D" && props.multiUnitControls && props.multiUnitControls.orderItems.length >= 1;

  // When in 2D + multi-unit mode, derive BlueprintCanvas props from the first
  // visible multi-unit item so that overhead/shelving units render correctly
  // instead of falling through to the default standard tote unit.
  const activeMultiUnit = viewMode === "2D" && props.multiUnitItems
    ? props.multiUnitItems.find((u) => u.visible)
    : undefined;

  const bp2dOverheadConfig = activeMultiUnit?.overheadStorageConfig
    ? { slotsWide: activeMultiUnit.overheadStorageConfig.slotsWide, slotsDeep: activeMultiUnit.overheadStorageConfig.slotsDeep, toteType: activeMultiUnit.overheadStorageConfig.toteType, hasTotes: activeMultiUnit.hasTotes }
    : props.overheadConfig;

  const bp2dShelvingConfig = activeMultiUnit?.shelvingConfig ?? props.shelvingConfig;
  const bp2dIsRaisedBed = !!(activeMultiUnit?.raisedBedConfig || props.raisedBedConfig);

  const bp2dCols = activeMultiUnit ? activeMultiUnit.cols : props.cols;
  const bp2dRows = activeMultiUnit ? activeMultiUnit.rows : props.rows;
  const bp2dToteType = activeMultiUnit ? activeMultiUnit.toteType : props.toteType;
  const bp2dToteColor = activeMultiUnit ? activeMultiUnit.toteColor : props.toteColor;
  const bp2dUnitType = activeMultiUnit ? activeMultiUnit.unitType : props.unitType;
  const bp2dOrientation = activeMultiUnit ? activeMultiUnit.orientation : props.orientation;
  const bp2dHasTotes = activeMultiUnit ? activeMultiUnit.hasTotes : props.hasTotes;
  const bp2dHasWheels = activeMultiUnit ? activeMultiUnit.hasWheels : props.hasWheels;
  const bp2dHasTop = activeMultiUnit ? activeMultiUnit.hasTop : props.hasTop;
  const bp2dTotalW = activeMultiUnit ? activeMultiUnit.totalW : props.totalW;
  const bp2dTotalH = activeMultiUnit ? activeMultiUnit.totalH : props.totalH;
  const bp2dPresetUnits = activeMultiUnit?.presetUnits ?? props.presetUnits;
  const bp2dAddons = activeMultiUnit?.addons ?? props.addons;

  return (
    <div className="relative h-full w-full">
      {/* ── Multi-Unit Overlay (top-left, 3D only) ──────────────── */}
      {showMultiUnitOverlay && (
        <MultiUnitOverlay controls={props.multiUnitControls!} />
      )}

      {/* ── View Toggle Button (top-right overlay) ──────────────── */}
      <div className="absolute right-3 top-3 z-10">
        <div className="flex overflow-hidden rounded-lg border border-stone-300/60 bg-white/80 shadow-sm backdrop-blur-sm">
          <button
            onClick={() => setViewMode("2D")}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              viewMode === "2D"
                ? "bg-gray-900 text-yellow-400"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode("3D")}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              viewMode === "3D"
                ? "bg-gray-900 text-yellow-400"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            }`}
          >
            3D
          </button>
        </div>
      </div>

      {/* ── Active View ─────────────────────────────────────────── */}
      {viewMode === "2D" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundColor: "#ffffff",
          }}
        >
          {bp2dIsRaisedBed ? (
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center">
                <p className="text-4xl mb-2">{"\u{1F331}"}</p>
                <p className="text-sm font-bold text-stone-700">Raised Bed Planter</p>
                <p className="text-xs text-stone-400 mt-1">Switch to 3D for a full preview</p>
              </div>
            </div>
          ) : (
            <BlueprintCanvas
              cols={bp2dCols}
              rows={bp2dRows}
              toteType={bp2dToteType}
              toteColor={bp2dToteColor}
              unitType={bp2dUnitType}
              orientation={bp2dOrientation}
              hasTotes={bp2dHasTotes}
              hasWheels={bp2dHasWheels}
              hasTop={bp2dHasTop}
              totalW={bp2dTotalW}
              totalH={bp2dTotalH}
              presetUnits={bp2dPresetUnits}
              addons={bp2dAddons}
              shelvingConfig={bp2dShelvingConfig}
              overheadConfig={bp2dOverheadConfig}
              watermarkText={props.watermarkText}
            />
          )}
        </div>
      ) : (
        <Render3DErrorBoundary
          onError={() => setViewMode("2D")}
          fallback={
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "20px 20px",
                backgroundColor: "#ffffff",
              }}
            >
              {bp2dIsRaisedBed ? (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-center">
                    <p className="text-4xl mb-2">{"\u{1F331}"}</p>
                    <p className="text-sm font-bold text-stone-700">Raised Bed Planter</p>
                    <p className="text-xs text-stone-400 mt-1">Loading 3D preview...</p>
                  </div>
                </div>
              ) : (
                <BlueprintCanvas
                  cols={bp2dCols}
                  rows={bp2dRows}
                  toteType={bp2dToteType}
                  toteColor={bp2dToteColor}
                  unitType={bp2dUnitType}
                  orientation={bp2dOrientation}
                  hasTotes={bp2dHasTotes}
                  hasWheels={bp2dHasWheels}
                  hasTop={bp2dHasTop}
                  totalW={bp2dTotalW}
                  totalH={bp2dTotalH}
                  presetUnits={bp2dPresetUnits}
                  addons={bp2dAddons}
                  shelvingConfig={bp2dShelvingConfig}
                  overheadConfig={bp2dOverheadConfig}
                  watermarkText={props.watermarkText}
                />
              )}
            </div>
          }
        >
          <div
            className="absolute inset-0"
            style={{ touchAction: "none" }}
          >
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-400" />
                    <p className="mt-2 text-xs text-stone-500">
                      Loading 3D Model...
                    </p>
                  </div>
                </div>
              }
            >
              <Rack3D
                cols={props.cols}
                rows={props.rows}
                toteType={props.toteType}
                toteColor={props.toteColor}
                unitType={props.unitType}
                orientation={props.orientation}
                hasTotes={props.hasTotes}
                hasWheels={props.hasWheels}
                hasTop={props.hasTop}
                presetUnits={props.presetUnits}
                addons={props.addons}
                paintFrameColor={props.paintFrameColor}
                paintDoorColor={props.paintDoorColor}
                paintSidePanelColor={props.paintSidePanelColor}
                shelvingConfig={props.shelvingConfig}
                overheadConfig={props.overheadConfig}
                raisedBedConfig={props.raisedBedConfig}
                multiUnitItems={props.multiUnitItems?.filter((u) => u.visible).map((u) => ({
                  cols: u.cols,
                  rows: u.rows,
                  toteType: u.toteType,
                  toteColor: u.toteColor,
                  unitType: u.unitType,
                  orientation: u.orientation,
                  hasTotes: u.hasTotes,
                  hasWheels: u.hasWheels,
                  hasTop: u.hasTop,
                  totalW: u.totalW,
                  totalH: u.totalH,
                  depth: u.depth,
                  addons: u.addons,
                  paintFrameColor: u.paintFrameColor,
                  paintDoorColor: u.paintDoorColor,
                  paintSidePanelColor: u.paintSidePanelColor,
                  shelvingConfig: u.shelvingConfig,
                  overheadConfig: u.overheadStorageConfig ? { slotsWide: u.overheadStorageConfig.slotsWide, slotsDeep: u.overheadStorageConfig.slotsDeep, toteType: u.overheadStorageConfig.toteType } : undefined,
                  raisedBedConfig: u.raisedBedConfig,
                  presetUnits: u.presetUnits,
                }))}
                watermarkText={props.watermarkText}
              />
            </Suspense>
          </div>
        </Render3DErrorBoundary>
      )}
    </div>
  );
}
