"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio "+" — everything a customer can add, inline in the panel so the 3D
// stays in view and previews what's being configured: a custom tote unit,
// the installer's bestsellers (priced with their rates), and the other
// products they offer (open shelving, ceiling tote rail, raised beds, the
// Adirondack chair) using the configurator's own configure-and-add widgets.
// Anything added lands on the map, selected.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, SlidersHorizontal, Star } from "lucide-react";
import { calculateCompoundBuild } from "@/app/actions/calculator";
import type { ConfiguratorSidebarProps } from "@/components/design/configurator-types";
import ShelvingDropdown from "@/components/design/ShelvingDropdown";
import OverheadStorageDropdown from "@/components/design/OverheadStorageDropdown";
import RaisedBedDropdown from "@/components/design/RaisedBedDropdown";
import ChairDropdown from "@/components/design/ChairDropdown";
import ContactInstallerCard from "@/components/design/ContactInstallerCard";
import { ChairCustomization } from "@/components/design/steps/StepAddons";
import { getChairDescription } from "@/lib/chairs";
import type { BestsellerPreset } from "@/lib/presets";
import { presetTotesChoice } from "@/lib/studio";
import type { DesignPageViewModel, InstallerPricing } from "@/types/viewModels";

export default function StudioAddView({
  props,
  presets,
  pricing,
  totesDisabled,
  addingPreset,
  previewingPreset,
  onDone,
  onAddCustom,
  onAddBestseller,
  onPreviewBestseller,
}: {
  props: ConfiguratorSidebarProps;
  presets: BestsellerPreset[];
  pricing: DesignPageViewModel["pricing"] | undefined;
  totesDisabled: boolean;
  addingPreset: string | null;
  /** Bestseller shown in the 3D right now */
  previewingPreset: string | null;
  /** Back to the design (also called after anything is added) */
  onDone: () => void;
  onAddCustom: () => void;
  onAddBestseller: (presetId: string) => Promise<boolean>;
  /** Show a bestseller in the 3D before adding it */
  onPreviewBestseller: (presetId: string) => void;
}) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    for (const p of presets) {
      const choice = presetTotesChoice(p, totesDisabled);
      calculateCompoundBuild({ presetId: p.id, hasTotes: choice !== "never", installerPricing: pricing })
        .then((res) => {
          if (live && res.success) setPrices((prev) => ({ ...prev, [p.id]: res.totalPrice }));
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [presets, pricing, totesDisabled]);

  const installerPricing = props.pricing as InstallerPricing | undefined;
  const chairPrice = props.chairPreviewPrice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-bold text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my design
        </button>
        <h2 className="text-sm font-bold text-white">Add to your design</h2>
      </div>

      <button
        type="button"
        onClick={() => {
          onAddCustom();
          onDone();
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-left transition hover:border-yellow-400"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-zinc-900">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-white">Custom tote unit</span>
          <span className="block text-[11px] text-zinc-400">Any size — set totes wide and tall</span>
        </span>
      </button>

      {presets.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <Star className="h-3 w-3 text-yellow-400" />
            Bestsellers
          </p>
          <ul className="space-y-2">
            {presets.map((p) => {
              const busy = addingPreset === p.id;
              const price = prices[p.id];
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl border bg-zinc-900 p-3 transition ${
                    previewingPreset === p.id ? "border-yellow-400/60" : "border-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPreviewBestseller(p.id)}
                    aria-pressed={previewingPreset === p.id}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-bold text-white">{p.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {p.units.map((u) => `${u.cols}×${u.rows}`).join(" + ")}
                      <span className="ml-1.5 text-yellow-400/80">{previewingPreset === p.id ? "· showing above" : "· tap to preview"}</span>
                    </p>
                  </button>
                  <span className="shrink-0 text-sm font-black text-white">
                    {price != null ? `$${Math.round(price).toLocaleString()}` : <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />}
                  </span>
                  <button
                    type="button"
                    disabled={!!addingPreset}
                    onClick={async () => {
                      if (await onAddBestseller(p.id)) onDone();
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-zinc-900 transition hover:bg-yellow-300 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(!props.shelvingHidden || !props.overheadStorageHidden || !props.raisedBedHidden || !props.chairHidden) && (
        <section className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">More from your installer</p>

          {!props.shelvingHidden && (
            <ShelvingDropdown
              shelvingConfigId={props.shelvingConfigId}
              onShelvingConfigChange={props.onShelvingConfigChange}
              shelvingPrice={props.shelvingPrice}
              shelvingLoading={props.shelvingLoading}
              onAddShelvingUnit={() => {
                props.onAddShelvingUnit();
                onDone();
              }}
            />
          )}

          {!props.overheadStorageHidden && (
            <OverheadStorageDropdown
              onAddOverheadUnit={(result, config) => {
                props.onAddOverheadUnit(result, config);
                onDone();
              }}
              onConfigPreview={props.onOverheadConfigPreview}
              installerPricing={installerPricing}
            />
          )}

          {!props.raisedBedHidden && (
            <RaisedBedDropdown
              onAddRaisedBed={(config, price, desc) => {
                props.onAddRaisedBed(config, price, desc);
                onDone();
              }}
              onConfigPreview={props.onRaisedBedPreview}
              onPriceChange={props.onRaisedBedPriceChange}
              installerPricing={installerPricing}
            />
          )}

          {!props.chairHidden && (
            <div className="space-y-3">
              <ChairDropdown selected={props.chairSelected ?? false} onSelect={() => props.onChairSelect?.()} />
              {props.chairSelected && (
                <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <ChairCustomization props={props} />
                  <button
                    type="button"
                    disabled={chairPrice == null || chairPrice === 0}
                    onClick={() => {
                      const config = { finish: props.chairFinish ?? "natural", quantity: props.chairQuantity ?? 1 };
                      props.onAddChair(config, chairPrice ?? 0, getChairDescription(config));
                      onDone();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition hover:bg-yellow-300 disabled:opacity-40"
                  >
                    {chairPrice == null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add chair{chairPrice ? ` · $${Math.round(chairPrice).toLocaleString()}` : ""}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <ContactInstallerCard props={props} />
    </div>
  );
}
