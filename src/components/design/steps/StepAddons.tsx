"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import { SelectionCard, StudioToggle } from "../configurator-primitives";
import { OrganizerCustomization } from "../OrganizerCustomization";
import { CHAIR_FINISHES, type ChairFinish } from "@/lib/chairs";
import { calculateChairPriceServer, getChairOptionPrices } from "@/app/actions/platform-defaults";

function ChairCustomization({
  props,
}: {
  props: ConfiguratorSidebarProps;
}) {
  const finish = props.chairFinish ?? "natural";
  const quantity = props.chairQuantity ?? 1;

  const [optionPrices, setOptionPrices] = useState<{ basePrice: number; paintAddon: number } | null>(null);
  useEffect(() => {
    getChairOptionPrices(props.chairInstallerPricing).then(setOptionPrices);
  }, [props.chairInstallerPricing]);

  useEffect(() => {
    let cancelled = false;
    calculateChairPriceServer({ finish, quantity, installerPricing: props.chairInstallerPricing })
      .then((result) => {
        if (!cancelled) props.onChairPriceChange?.(result.total);
      });
    return () => { cancelled = true; };
  }, [finish, quantity, props.chairInstallerPricing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Finish Selection */}
      <div>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Finish
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {CHAIR_FINISHES.map((f) => {
            const isSelected = finish === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  props.onChairFinishChange?.(f.id);
                  props.onChairPreview?.({ finish: f.id });
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all ${
                  isSelected
                    ? "border-yellow-400/60 bg-yellow-400/5 ring-1 ring-yellow-400/30"
                    : "border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600"
                }`}
              >
                <div
                  className="h-6 w-6 rounded-full border border-zinc-600"
                  style={{ backgroundColor: f.hex }}
                />
                <span className={`text-[11px] font-semibold ${isSelected ? "text-yellow-400" : "text-zinc-300"}`}>{f.label}</span>
                {(f.id === "white" || f.id === "black") && optionPrices && (
                  <span className="text-[10px] font-bold text-yellow-400">+${optionPrices.paintAddon}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Quantity
        </h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => props.onChairQuantityChange?.(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2rem] text-center text-sm font-bold text-white">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => props.onChairQuantityChange?.(Math.min(4, quantity + 1))}
            disabled={quantity >= 4}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

export default function StepAddons({
  props,
  numCols,
  numRows,
}: {
  props: ConfiguratorSidebarProps;
  numCols: number;
  numRows: number;
}) {
  // When the chair is being configured, show chair-specific options
  if (props.chairSelected) {
    return <ChairCustomization props={props} />;
  }

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
          addonDefaults={props.addonDefaults}
          paintFrameColor={props.paintFrameColor}
          paintDoorColor={props.paintDoorColor}
          paintSidePanelColor={props.paintSidePanelColor}
          onPaintFrameColorChange={props.onPaintFrameColorChange}
          onPaintDoorColorChange={props.onPaintDoorColorChange}
          onPaintSidePanelColorChange={props.onPaintSidePanelColorChange}
        />
      )}
    </>
  );
}
