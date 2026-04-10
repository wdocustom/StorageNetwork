"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import { SelectionCard } from "../configurator-primitives";

export default function StepConfiguration({
  props,
  goNext,
  goPrev,
}: {
  props: ConfiguratorSidebarProps;
  goNext: () => void;
  goPrev: () => void;
}) {
  return (
    <>
      {/* Unit Size Cards — hidden when totes disabled or 2x4 rail mode (universal frame) */}
      {!props.miniDisabled && !props.totesDisabled && !props.use2x4Rails && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Unit Size
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectionCard
              selected={props.unitType === "standard"}
              onSelect={() => {
                props.onUnitTypeChange("standard");
              }}
            >
              <div className="text-xs font-bold text-zinc-300">Standard</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">27 Gallon Totes</div>
            </SelectionCard>
            <SelectionCard
              selected={props.unitType === "mini"}
              onSelect={() => {
                props.onUnitTypeChange("mini");
                props.onOrientationChange("standard");
              }}
            >
              <div className="text-xs font-bold text-zinc-300">Mini</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">6.5 Quart Totes</div>
            </SelectionCard>
          </div>
        </div>
      )}

      {/* Orientation Cards — hidden in 2x4 rail mode (always standard orientation, 30" deep) */}
      {!props.activePreset && props.unitType === "standard" && !props.use2x4Rails && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            {props.totesDisabled ? "Orientation" : "Tote Orientation"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectionCard
              selected={props.orientation === "standard"}
              onSelect={() => props.onOrientationChange("standard")}
            >
              <div className="text-xs font-bold text-zinc-300">Standard</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">30&quot; Deep</div>
            </SelectionCard>
            <SelectionCard
              selected={props.orientation === "sideways"}
              onSelect={() => props.onOrientationChange("sideways")}
            >
              <div className="text-xs font-bold text-zinc-300">Sideways</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">20&quot; Deep</div>
            </SelectionCard>
          </div>
        </div>
      )}

      {/* Tote Size — hidden when totes globally disabled or 2x4 rail mode */}
      {!props.totesDisabled && !props.use2x4Rails && !props.activePreset && props.unitType === "standard" ? (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Tote Size
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectionCard
              selected={props.toteType === "HDX"}
              onSelect={() => props.onToteTypeChange("HDX")}
            >
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                19-3/4&quot; Opening
              </div>
              <div className="text-sm font-bold text-zinc-200">Standard</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                  HDX
                </span>
                <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                  Performax
                </span>
              </div>
              <div className="mt-1.5 text-[9px] text-zinc-600">
                Home Depot &middot; Menards
              </div>
            </SelectionCard>

            <SelectionCard
              selected={props.toteType === "GM"}
              onSelect={() => {
                props.onToteTypeChange("GM");
                props.onToteColorChange("black");
              }}
            >
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                20-3/4&quot; Opening
              </div>
              <div className="text-sm font-bold text-zinc-200">Wide</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                  GreenMade
                </span>
                <span className="inline-block rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">
                  Project Source
                </span>
              </div>
              <div className="mt-1.5 text-[9px] text-zinc-600">
                Costco &middot; Lowe&apos;s &middot; Walmart
              </div>
            </SelectionCard>
          </div>
        </div>
      ) : !props.totesDisabled && !props.use2x4Rails && !props.activePreset && props.unitType !== "standard" ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tote Type</div>
          <div className="mt-1 text-sm font-medium text-zinc-300">
            6.5 Quart Clear Totes (Yellow Lids)
          </div>
        </div>
      ) : null}

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={goPrev}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Back
        </button>
        {!props.activePreset && (
          <motion.button
            onClick={goNext}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            Continue to Add-ons
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </>
  );
}
