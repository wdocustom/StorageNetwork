"use client";

import { motion } from "framer-motion";
import { Maximize2, Grid3X3 } from "lucide-react";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import { FocusFrame } from "../configurator-primitives";
import BestsellerDropdown from "../BestsellerDropdown";
import ShelvingDropdown from "../ShelvingDropdown";
import OverheadStorageDropdown from "../OverheadStorageDropdown";
import RaisedBedDropdown from "../RaisedBedDropdown";
import ChairDropdown from "../ChairDropdown";
import ZipCheckCard from "../ZipCheckCard";
import ContactInstallerCard from "../ContactInstallerCard";

export default function StepSize({
  props,
  dimensionPulsing,
  wallW,
  wallH,
  hasWallDimensions,
  setActiveStep,
}: {
  props: ConfiguratorSidebarProps;
  dimensionPulsing: boolean;
  wallW: number;
  wallH: number;
  hasWallDimensions: boolean;
  setActiveStep: (step: number) => void;
}) {
  return (
    <>
      <ZipCheckCard props={props} />

      {/* Auto-Fit Wall Calculator */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Maximize2 className="h-3.5 w-3.5 text-yellow-400" />
          Auto-Fit Wall Calculator
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FocusFrame label="Wall Width (inches)" pulsing={dimensionPulsing}>
            <input
              type="number"
              inputMode="decimal"
              value={props.wallWidth}
              onChange={(e) => props.onWallWidthChange(e.target.value)}
              placeholder="e.g. 100"
              className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
            />
          </FocusFrame>
          <FocusFrame label="Wall Height (inches)" pulsing={dimensionPulsing}>
            <input
              type="number"
              inputMode="decimal"
              value={props.wallHeight}
              onChange={(e) => props.onWallHeightChange(e.target.value)}
              placeholder="e.g. 96"
              className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
            />
          </FocusFrame>
        </div>
        <motion.button
          onClick={() => {
            props.onWallFit();
          }}
          disabled={!props.wallWidth || !props.wallHeight || props.buildLoading}
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {props.buildLoading ? "Calculating..." : "Find Max Size"}
        </motion.button>
        {props.wallFitMsg && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center text-xs font-semibold text-emerald-400"
          >
            {props.wallFitMsg}
          </motion.p>
        )}
      </section>

      {/* Grid Size — moved up for structured placement */}
      {!props.activePreset && (
        <section className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 backdrop-blur-sm">
          <Grid3X3 className="h-4 w-4 shrink-0 text-yellow-400" />
          <span className="shrink-0 text-sm font-medium text-zinc-300">
            Grid Size
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Col</label>
              <input
                type="number"
                min={1}
                max={12}
                value={props.cols}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  props.onColsChange(v === "" ? "" : parseInt(v) || "");
                }}
                onBlur={() => {
                  const n = typeof props.cols === "number" ? props.cols : parseInt(props.cols as string);
                  props.onColsChange(Math.min(12, Math.max(1, n || 1)));
                }}
                className="w-12 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-center text-sm font-bold text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
              />
            </div>
            <span className="text-zinc-600">&times;</span>
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Tier</label>
              <input
                type="number"
                min={1}
                max={props.unitType === "mini" ? 4 : props.use2x4Rails ? 6 : 10}
                value={props.rows}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  props.onRowsChange(v === "" ? "" : parseInt(v) || "");
                }}
                onBlur={() => {
                  const n = typeof props.rows === "number" ? props.rows : parseInt(props.rows as string);
                  const maxT = props.unitType === "mini" ? 4 : props.use2x4Rails ? 6 : 10;
                  props.onRowsChange(Math.min(maxT, Math.max(1, n || 1)));
                }}
                className="w-12 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-center text-sm font-bold text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
              />
            </div>
          </div>
        </section>
      )}

      {/* Bestsellers Dropdown */}
      {props.presetOptions.length > 0 && (
        <BestsellerDropdown
          presetOptions={props.presetOptions}
          activePreset={props.activePreset}
          onPresetChange={props.onPresetChange}
          compoundBuild={props.compoundBuild}
          presetLoading={props.presetLoading}
          presetTotes={props.presetTotes}
          onPresetTotesChange={props.onPresetTotesChange}
          onAddPresetUnit={() => { if (props.onAddPresetUnit()) setActiveStep(4); }}
          wallW={wallW}
          wallH={wallH}
          hasWallDimensions={hasWallDimensions}
          totesDisabled={props.totesDisabled}
        />
      )}

      {/* Open Shelving Dropdown */}
      {!props.shelvingHidden && (
        <ShelvingDropdown
          shelvingConfigId={props.shelvingConfigId}
          onShelvingConfigChange={props.onShelvingConfigChange}
          shelvingPrice={props.shelvingPrice}
          shelvingLoading={props.shelvingLoading}
          onAddShelvingUnit={() => { props.onAddShelvingUnit(); setActiveStep(4); }}
        />
      )}

      {/* Overhead Ceiling Storage Dropdown */}
      {!props.overheadStorageHidden && (
        <OverheadStorageDropdown
          onAddOverheadUnit={(result, config) => {
            props.onAddOverheadUnit(result, config);
            setActiveStep(4);
          }}
          onConfigPreview={props.onOverheadConfigPreview}
          installerPricing={props.pricing as import("@/types/viewModels").InstallerPricing | undefined}
        />
      )}

      {/* Raised Bed Planters Dropdown */}
      {!props.raisedBedHidden && (
        <RaisedBedDropdown
          onAddRaisedBed={(config, price, desc) => {
            props.onAddRaisedBed(config, price, desc);
            setActiveStep(4);
          }}
          onConfigPreview={props.onRaisedBedPreview}
          onPriceChange={props.onRaisedBedPriceChange}
          installerPricing={props.pricing as import("@/types/viewModels").InstallerPricing | undefined}
        />
      )}

      {/* Low Boy Adirondack Chair Dropdown */}
      {!props.chairHidden && (
        <ChairDropdown
          selected={props.chairSelected ?? false}
          onSelect={() => {
            props.onChairSelect?.();
            setActiveStep(3);
          }}
        />
      )}

      <ContactInstallerCard props={props} />
    </>
  );
}
