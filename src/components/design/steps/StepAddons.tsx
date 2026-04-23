"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Plus } from "lucide-react";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import { SelectionCard, StudioToggle } from "../configurator-primitives";
import { OrganizerCustomization } from "../OrganizerCustomization";

export default function StepAddons({
  props,
  numCols,
  numRows,
  goPrev,
  setActiveStep,
}: {
  props: ConfiguratorSidebarProps;
  numCols: number;
  numRows: number;
  goPrev: () => void;
  setActiveStep: (step: number) => void;
}) {
  return (
    <>
      {/* HDX Color Cards — hidden when totes globally disabled */}
      {!props.totesDisabled && props.toteType === "HDX" && props.hasTotes && props.unitType === "standard" && (
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Tote Color
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <SelectionCard
              selected={props.toteColor === "black"}
              onSelect={() => props.onToteColorChange("black")}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-zinc-900">
                  <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Black / Yellow</div>
                  <div className="text-[10px] text-zinc-500">
                    ${props.pricing?.standard_tote ?? props.platformDefaults.standard_tote}/tote
                  </div>
                </div>
              </div>
            </SelectionCard>
            <SelectionCard
              selected={props.toteColor === "clear"}
              onSelect={() => props.onToteColorChange("clear")}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-800">
                  <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Clear / Yellow</div>
                  <div className="text-[10px] text-amber-400">
                    ${props.pricing?.standard_tote_clear ?? props.platformDefaults.standard_tote_clear}/tote
                  </div>
                </div>
              </div>
            </SelectionCard>
          </div>
        </div>
      )}

      {/* Add-on Toggles */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Add-ons
        </h3>
        {!props.totesDisabled && (
          <div className="flex items-center justify-between">
            <StudioToggle
              checked={props.hasTotes}
              onChange={props.onHasTotesChange}
              label={props.unitType === "mini" ? "Include Clear Totes" : "Include Totes"}
            />
            <span className="text-[10px] font-bold text-yellow-400">
              +${props.unitType === "mini"
                ? (props.pricing?.mini_tote ?? props.platformDefaults.mini_tote)
                : props.toteType === "HDX" && props.toteColor === "clear"
                  ? (props.pricing?.standard_tote_clear ?? props.platformDefaults.standard_tote_clear)
                  : (props.pricing?.standard_tote ?? props.platformDefaults.standard_tote)}/ea
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <StudioToggle
            checked={props.hasWheels}
            onChange={props.onHasWheelsChange}
            label="Add Wheels"
          />
          <span className="text-[10px] font-bold text-yellow-400">
            +${props.unitType === "mini"
              ? (props.pricing?.mini_wheels ?? props.platformDefaults.mini_wheels)
              : (props.pricing?.standard_wheels ?? props.platformDefaults.standard_wheels)}
          </span>
        </div>
        {props.unitType === "standard" ? (
          <div className="flex items-center justify-between">
            <StudioToggle
              checked={props.hasTop}
              onChange={props.onHasTopChange}
              label="Add Plywood Top"
            />
            <span className="text-[10px] font-bold text-yellow-400">
              +${props.pricing?.plywood_top ?? props.platformDefaults.plywood_top}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">
              Plywood Top (Included)
            </span>
          </div>
        )}
      </div>

      {/* Indoor Delivery Toggle */}
      {props.indoorDeliveryConfig?.enabled && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Delivery
          </h3>
          <StudioToggle
            checked={props.indoorDelivery}
            onChange={props.onIndoorDeliveryChange}
            label={`Indoor Delivery (+$${props.indoorDeliveryConfig.fee}/ea)`}
          />
          {props.indoorDelivery && (
            <p className="ml-1 text-[10px] text-amber-400/80">
              Built &amp; delivered inside the home
            </p>
          )}
        </div>
      )}

      {/* Organizer Customization (per-section addons) */}
      {!props.activePreset && props.installerId && (props.addonPricing?.organizer_customization_enabled !== false) && (
        <OrganizerCustomization
          cols={numCols}
          rows={numRows}
          addons={props.addons}
          onAddonsChange={props.onAddonsChange}
          addonPricing={props.addonPricing}
          paintFrameColor={props.paintFrameColor}
          paintDoorColor={props.paintDoorColor}
          paintSidePanelColor={props.paintSidePanelColor}
          onPaintFrameColorChange={props.onPaintFrameColorChange}
          onPaintDoorColorChange={props.onPaintDoorColorChange}
          onPaintSidePanelColorChange={props.onPaintSidePanelColorChange}
        />
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={goPrev}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Back
        </button>
        {/* Custom organizers: "Add to Quote" adds the unit and jumps to summary */}
        {!props.activePreset && !props.shelvingConfigId ? (
          <motion.button
            onClick={() => { props.onAddUnit(); setActiveStep(4); }}
            disabled={props.buildLoading || props.build.price === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Add to My Quote
          </motion.button>
        ) : (
          <motion.button
            onClick={() => setActiveStep(4)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            Review Summary
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </>
  );
}
