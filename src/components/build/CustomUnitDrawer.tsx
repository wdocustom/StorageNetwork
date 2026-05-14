"use client";

import { Loader2, Maximize2, Grid3X3, HardHat, Plus, Box } from "lucide-react";
import BottomDrawer from "./BottomDrawer";
import { toFraction } from "@/lib/utils";
import type { InstallerPricing } from "@/types/viewModels";
import type { IndoorDeliveryConfig } from "@/app/actions/delivery-fee";

type ToteType = "HDX" | "GM";
type UnitTypeOption = "standard" | "mini";
type InputMode = "wallFit" | "custom";

interface BuildResultData {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  slots: number;
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
}

interface CustomUnitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  installerPricing?: InstallerPricing;
  indoorDeliveryConfig: IndoorDeliveryConfig | null;

  // inputs
  inputMode: InputMode;
  onInputModeChange: (m: InputMode) => void;
  wallWidth: string;
  onWallWidthChange: (v: string) => void;
  wallHeight: string;
  onWallHeightChange: (v: string) => void;
  customCols: string;
  onCustomColsChange: (v: string) => void;
  customRows: string;
  onCustomRowsChange: (v: string) => void;
  toteType: ToteType;
  onToteTypeChange: (t: ToteType) => void;
  orientation: "standard" | "sideways";
  onOrientationChange: (o: "standard" | "sideways") => void;
  unitType: UnitTypeOption;
  onUnitTypeChange: (u: UnitTypeOption) => void;
  hasTotes: boolean;
  onHasTotesChange: (v: boolean) => void;
  hasWheels: boolean;
  onHasWheelsChange: (v: boolean) => void;
  hasTop: boolean;
  onHasTopChange: (v: boolean) => void;
  indoorDelivery: boolean;
  onIndoorDeliveryChange: (v: boolean) => void;

  // state + actions
  calculating: boolean;
  calcError: string;
  buildResult: BuildResultData | null;
  onCalculate: () => void;
  onAddUnit: () => void;
  onOpenAssemblyGuide: () => void;
}

export default function CustomUnitDrawer({
  isOpen,
  onClose,
  installerPricing,
  indoorDeliveryConfig,
  inputMode,
  onInputModeChange,
  wallWidth,
  onWallWidthChange,
  wallHeight,
  onWallHeightChange,
  customCols,
  onCustomColsChange,
  customRows,
  onCustomRowsChange,
  toteType,
  onToteTypeChange,
  orientation,
  onOrientationChange,
  unitType,
  onUnitTypeChange,
  hasTotes,
  onHasTotesChange,
  hasWheels,
  onHasWheelsChange,
  hasTop,
  onHasTopChange,
  indoorDelivery,
  onIndoorDeliveryChange,
  calculating,
  calcError,
  buildResult,
  onCalculate,
  onAddUnit,
  onOpenAssemblyGuide,
}: CustomUnitDrawerProps) {
  const use2x4Rails = installerPricing?.use_2x4_rails === true;
  const miniEnabled = installerPricing?.mini_enabled === true;

  return (
    <BottomDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Custom Unit"
      subtitle="Wall-fit or custom grid build"
      icon={<Grid3X3 className="h-4 w-4 text-blue-400" />}
    >
      {/* Mode Toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => onInputModeChange("wallFit")}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
            inputMode === "wallFit"
              ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
              : "border-slate-700 text-stone-400 hover:border-stone-600"
          }`}
        >
          <Maximize2 className="h-4 w-4" />
          Wall Fit
        </button>
        <button
          onClick={() => onInputModeChange("custom")}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
            inputMode === "custom"
              ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
              : "border-slate-700 text-stone-400 hover:border-stone-600"
          }`}
        >
          <Grid3X3 className="h-4 w-4" />
          Custom Grid
        </button>
      </div>

      {inputMode === "wallFit" && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Maximize2 className="h-4 w-4 text-yellow-400" />
            Wall Dimensions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Width (in)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={wallWidth}
                onChange={(e) => onWallWidthChange(e.target.value)}
                placeholder="e.g. 120"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Height (in)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={wallHeight}
                onChange={(e) => onWallHeightChange(e.target.value)}
                placeholder="e.g. 96"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      {inputMode === "custom" && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Grid3X3 className="h-4 w-4 text-yellow-400" />
            Grid Configuration
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Columns (Wide)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="20"
                value={customCols}
                onChange={(e) => onCustomColsChange(e.target.value)}
                placeholder="e.g. 4"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Rows (High)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={use2x4Rails ? "6" : "20"}
                value={customRows}
                onChange={(e) => onCustomRowsChange(e.target.value)}
                placeholder={use2x4Rails ? "e.g. 4 (max 6)" : "e.g. 5"}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-stone-500">
            {use2x4Rails
              ? "Enter the number of columns and rows (max 6 tiers for 2x4 rail construction; 6-tier uses a full 8' upright)."
              : "Enter the number of tote columns and rows for your unit."}
          </p>
        </>
      )}

      {/* 2x4 Rail indicator */}
      {use2x4Rails && (
        <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            2x4 Rail Construction
          </div>
          <div className="mt-1 text-xs text-stone-400">
            21&quot; universal openings &middot; Ripped 2x4 rails &middot; Max 6 tiers
          </div>
        </div>
      )}

      {/* Unit Size toggle — hidden in 2x4 rail mode */}
      {miniEnabled && !use2x4Rails && (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
            Unit Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUnitTypeChange("standard")}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                unitType === "standard"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-sm font-bold text-stone-200">Standard</div>
              <div className="mt-0.5 text-[10px] text-stone-500">27 Gallon Totes</div>
            </button>
            <button
              onClick={() => {
                onUnitTypeChange("mini");
                onHasTopChange(true);
                onOrientationChange("standard");
              }}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                unitType === "mini"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-sm font-bold text-stone-200">Mini</div>
              <div className="mt-0.5 text-[10px] text-stone-500">6.5 Quart Totes</div>
            </button>
          </div>
        </div>
      )}

      {/* Orientation — Standard units only */}
      {unitType === "standard" && (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
            Tote Orientation
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOrientationChange("standard")}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                orientation === "standard"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-sm font-bold text-stone-200">Standard</div>
              <div className="mt-0.5 text-[10px] text-stone-500">30&quot; Deep</div>
            </button>
            <button
              onClick={() => onOrientationChange("sideways")}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                orientation === "sideways"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-sm font-bold text-stone-200">Sideways</div>
              <div className="mt-0.5 text-[10px] text-stone-500">20&quot; Deep</div>
            </button>
          </div>
        </div>
      )}

      {/* Tote Size — Standard units only, hidden in 2x4 rail mode */}
      {!use2x4Rails && unitType === "standard" ? (
        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
            Tote Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToteTypeChange("HDX")}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                toteType === "HDX"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
                19-3/4&quot; Opening
              </div>
              <div className="text-sm font-bold text-stone-200">Standard</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                  HDX
                </span>
                <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                  Performax
                </span>
              </div>
              <div className="mt-1 text-[9px] text-stone-600">Home Depot &middot; Menards</div>
            </button>
            <button
              onClick={() => onToteTypeChange("GM")}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                toteType === "GM"
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-slate-700 hover:border-stone-600"
              }`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
                20-3/4&quot; Opening
              </div>
              <div className="text-sm font-bold text-stone-200">Wide</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                  GreenMade
                </span>
                <span className="inline-block rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">
                  Project Source
                </span>
              </div>
              <div className="mt-1 text-[9px] text-stone-600">
                Costco &middot; Lowe&apos;s &middot; Walmart
              </div>
            </button>
          </div>
        </div>
      ) : !use2x4Rails ? (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Tote Type
          </div>
          <div className="mt-1 text-sm font-medium text-stone-300">
            6.5 Quart Clear Totes (Yellow Lids)
          </div>
        </div>
      ) : null}

      {/* Toggles */}
      <div className="mt-3 space-y-2">
        {[
          {
            val: hasTotes,
            set: onHasTotesChange,
            label: unitType === "mini" ? "Include Clear Totes" : "Totes",
            disabled: false,
          },
          { val: hasWheels, set: onHasWheelsChange, label: "Wheels", disabled: false },
          {
            val: unitType === "mini" ? true : hasTop,
            set: onHasTopChange,
            label: "Plywood Top",
            disabled: unitType === "mini",
          },
        ].map(({ val, set, label, disabled }) => (
          <label
            key={label}
            className={`flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 ${
              disabled ? "opacity-60" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => set(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-yellow-400"
            />
            <span className="text-sm text-stone-300">{label}</span>
            {disabled && <span className="text-[9px] text-stone-600">(always included)</span>}
          </label>
        ))}
        {indoorDeliveryConfig?.enabled && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
            <input
              type="checkbox"
              checked={indoorDelivery}
              onChange={(e) => onIndoorDeliveryChange(e.target.checked)}
              className="h-4 w-4 accent-yellow-400"
            />
            <span className="text-sm text-stone-300">
              Indoor Delivery (+${indoorDeliveryConfig.fee})
            </span>
          </label>
        )}
      </div>

      <button
        onClick={onCalculate}
        disabled={calculating}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
      >
        {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardHat className="h-4 w-4" />}
        {calculating ? "Calculating…" : "Calculate Build"}
      </button>

      {calcError && <p className="mt-3 text-xs font-medium text-red-400">{calcError}</p>}

      {buildResult && (
        <div className="mt-4 space-y-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-2xl font-black text-white">
                {buildResult.cols} × {buildResult.rows}
              </p>
              <p className="text-[10px] font-bold uppercase text-stone-500">Max Fit</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-2xl font-black text-yellow-400">
                ${buildResult.price.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold uppercase text-stone-500">Est. Price</p>
            </div>
          </div>
          <div className="text-center text-xs text-stone-500">
            {toFraction(buildResult.totalW)}&quot; W × {toFraction(buildResult.totalH)}&quot; H ×{" "}
            {toFraction(buildResult.depth)}&quot; D — {buildResult.slots} slots
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onAddUnit}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400 py-3 text-xs font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
            >
              <Plus className="h-4 w-4" />
              Add to Quote
            </button>
            <button
              onClick={onOpenAssemblyGuide}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-400 bg-emerald-400/10 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-400/20"
            >
              <Box className="h-4 w-4" />
              How-To Guide
            </button>
          </div>
        </div>
      )}
    </BottomDrawer>
  );
}
