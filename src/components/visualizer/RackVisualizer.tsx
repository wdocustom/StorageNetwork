"use client";

import { Suspense, lazy, useState } from "react";
import { Loader2 } from "lucide-react";
import BlueprintCanvas from "./BlueprintCanvas";
import type { SectionAddon, PaintColorId } from "@/types/viewModels";

// Lazy-load 3D (heavy Three.js bundle)
const Rack3D = lazy(() => import("./Rack3D"));

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
}

export default function RackVisualizer(props: RackVisualizerProps) {
  const [viewMode, setViewMode] = useState<"2D" | "3D">("3D");

  return (
    <div className="relative h-full w-full">
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
          <BlueprintCanvas
            cols={props.cols}
            rows={props.rows}
            toteType={props.toteType}
            toteColor={props.toteColor}
            unitType={props.unitType}
            orientation={props.orientation}
            hasTotes={props.hasTotes}
            hasWheels={props.hasWheels}
            hasTop={props.hasTop}
            totalW={props.totalW}
            totalH={props.totalH}
            presetUnits={props.presetUnits}
            addons={props.addons}
          />
        </div>
      ) : (
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
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
