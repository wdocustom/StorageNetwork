"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Design studio — the single-page designer that replaces the 4-step sidebar.
//
//   unit map (A, B, +) → the selected unit's options → total + one CTA
//
// The order is the design: what's on the map is exactly what's priced and
// booked. Booking opens the configurator's own Book Install step in a sheet.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { CalendarCheck, Clock, Layers, Loader2, Plus, Star } from "lucide-react";
import type { ConfiguratorSidebarProps } from "@/components/design/configurator-types";
import { RollingPrice } from "@/components/design/configurator-primitives";
import type { useStudio } from "@/hooks/configurator/useStudio";
import type { BestsellerPreset } from "@/lib/presets";
import { studioSystemSize, studioUnitCount, type StudioRules } from "@/lib/studio";
import { toFraction } from "@/lib/utils";
import type { DesignPageViewModel } from "@/types/viewModels";
import { formatCurrency } from "@/utils/paymentHelpers";
import StudioAddSheet from "./StudioAddSheet";
import StudioBookingSheet from "./StudioBookingSheet";
import StudioMap from "./StudioMap";
import StudioUnitEditor, { type StudioPrices } from "./StudioUnitEditor";

export default function StudioPanel({
  props,
  studio,
  rules,
  prices,
  presets,
  pricing,
}: {
  props: ConfiguratorSidebarProps;
  studio: ReturnType<typeof useStudio>;
  rules: StudioRules;
  prices: StudioPrices;
  presets: BestsellerPreset[];
  pricing: DesignPageViewModel["pricing"] | undefined;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  const items = props.orderItems;
  const active = items[studio.activeIndex];
  const units = studioUnitCount(items);
  const size = studioSystemSize(items);
  const canBook = items.length > 0 && !studio.repricing && !props.submitted;

  return (
    <aside className="order-2 flex w-full shrink-0 flex-col bg-zinc-950 lg:order-1 lg:h-full lg:w-[40%] xl:w-[38%]">
      <div className="flex-1 space-y-4 p-4 pb-32 lg:overflow-y-auto lg:pb-4 lg:scrollbar-dark">
        {/* ── Whole system ── */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Layers className="h-3.5 w-3.5 text-yellow-400" />
              Your design
            </p>
            {size && (
              <p className="shrink-0 font-mono text-[11px] text-zinc-400">
                {units} unit{units === 1 ? "" : "s"} · {size.slots} totes
              </p>
            )}
          </div>
          {items.length > 0 ? (
            <>
              <StudioMap items={items} activeIndex={studio.activeIndex} onSelect={studio.setActiveIndex} onAdd={() => setAddOpen(true)} />
              {items.length > 1 && <p className="mt-2 text-center text-[10px] text-zinc-600">Tap a unit to edit it</p>}
              {size && size.widthIn > 0 && (
                <p className="mt-1 text-center font-mono text-[10px] text-zinc-500">
                  {toFraction(size.widthIn)}&quot; wide side by side · {toFraction(size.heightIn)}&quot; tallest
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2 py-2 text-center">
              <p className="text-sm text-zinc-400">Start with a unit — you can add more after.</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={studio.addToteUnit}
                  className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-900 transition hover:bg-yellow-300"
                >
                  <Plus className="h-4 w-4" />
                  Custom unit
                </button>
                {presets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-yellow-400"
                  >
                    <Star className="h-4 w-4 text-yellow-400" />
                    Bestsellers
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Selected unit ── */}
        {active && (
          <StudioUnitEditor
            item={active}
            index={studio.activeIndex}
            canRemove={items.length > 1}
            repricing={studio.repricing}
            rules={rules}
            prices={prices}
            onUpdate={(patch) => studio.updateTote(studio.activeIndex, patch)}
            onFitToWall={(w, h) => studio.fitToWall(studio.activeIndex, w, h)}
            onBestsellerTotes={(v) => studio.setBestsellerTotes(studio.activeIndex, v)}
            onQuantity={(n) => studio.setQuantity(studio.activeIndex, n)}
            onRemove={() => studio.removeItem(studio.activeIndex)}
          />
        )}

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-sm font-bold text-zinc-300 transition hover:border-yellow-400 hover:text-yellow-300"
          >
            <Plus className="h-4 w-4" />
            Add another unit or a bestseller
          </button>
        )}
      </div>

      {/* ── Total + the one CTA (fixed on phones, foot of the panel on desktop) ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur lg:sticky lg:inset-x-auto">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                <RollingPrice value={props.grandTotal} />
              </span>
              {studio.repricing && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" aria-label="Updating price" />}
            </div>
            <p className="truncate text-[11px] font-semibold text-yellow-400">
              {props.stripeAccountId && items.length > 0
                ? `Book today for ${formatCurrency(props.depositAmount)} deposit`
                : "Installed by a local pro"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBookOpen(true)}
            disabled={!canBook}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold uppercase tracking-wider shadow-lg transition disabled:opacity-40 ${
              props.installerAtCapacity
                ? "bg-amber-500 text-zinc-900 shadow-amber-500/20 hover:bg-amber-400"
                : "bg-yellow-400 text-zinc-900 shadow-yellow-400/20 hover:bg-yellow-300"
            }`}
          >
            {props.installerAtCapacity ? <Clock className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
            {props.installerAtCapacity ? "Join waitlist" : "Book install"}
          </button>
        </div>
      </div>

      <StudioAddSheet
        open={addOpen}
        presets={presets}
        pricing={pricing}
        totesDisabled={rules.totesDisabled}
        addingPreset={studio.addingPreset}
        onClose={() => setAddOpen(false)}
        onAddCustom={studio.addToteUnit}
        onAddBestseller={(id) => studio.addBestseller(id)}
      />
      <StudioBookingSheet open={bookOpen} props={props} onClose={() => setBookOpen(false)} />
    </aside>
  );
}
