"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio unit editor — the selected line of the order, edited in place.
//
// Tote units get the full option set (only the options the installer offers,
// exactly as the step-by-step configurator gated them); bestsellers get the
// tote choice and quantity; other products show what they are.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { ChevronDown, Loader2, Minus, Plus, Ruler, Trash2 } from "lucide-react";
import { Segmented, Stepper } from "@/components/designer/controls";
import { OrganizerCustomization } from "@/components/design/OrganizerCustomization";
import type { UnitConfig } from "@/hooks/configurator/types";
import type { StudioUnitExtras } from "@/hooks/configurator/useStudio";
import type { AddonPricing } from "@/types/viewModels";
import {
  STUDIO_MAX_COLS,
  miniAvailable,
  presetOfItem,
  presetTotesChoice,
  studioItemKind,
  studioMaxRows,
  toteOptionsOf,
  type StudioRules,
  type ToteUnitOptions,
} from "@/lib/studio";
import { unitLetter } from "@/lib/tote-plans";

/** Organizer customization (doors, shelves, panels, rail removal, paint) — null when the installer doesn't offer it */
export type StudioOrganizer = {
  addonPricing?: AddonPricing;
  addonDefaults?: { plywood_door: number; side_panel: number; concealed_hinge_pair: number; rail_removal: number; shelf: number; paint_frame_price: number; paint_doors_panels_price: number };
} | null;

export interface StudioPrices {
  standardTote: number;
  standardToteClear: number;
  miniTote: number;
  standardWheels: number;
  miniWheels: number;
  plywoodTop: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
/** "+$185" — or no hint when the installer's price for it isn't known (never "+$0") */
const plus = (n: number) => (n > 0 ? `+${money(n)}` : undefined);

function WallFit({ onFit }: { onFit: (w: number, h: number) => Promise<{ cols: number; rows: number } | null> }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 transition hover:text-yellow-300"
      >
        <Ruler className="h-3.5 w-3.5" />
        Not sure? Fit it to my wall
      </button>
    );
  }

  const fit = async () => {
    setBusy(true);
    setMsg("");
    const res = await onFit(parseFloat(w), parseFloat(h));
    setBusy(false);
    setMsg(res ? `Fits ${res.cols} wide × ${res.rows} tall on that wall.` : "Enter the wall's width and height in inches.");
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Your wall (inches)</p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={w}
          onChange={(e) => setW(e.target.value)}
          placeholder="Width"
          aria-label="Wall width in inches"
          className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
        />
        <input
          type="number"
          inputMode="decimal"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="Height"
          aria-label="Wall height in inches"
          className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={fit}
          disabled={busy}
          className="shrink-0 rounded-lg bg-yellow-400 px-4 text-sm font-bold text-zinc-900 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fit"}
        </button>
      </div>
      {msg && <p className="mt-2 text-[11px] text-zinc-400">{msg}</p>}
    </div>
  );
}

function Quantity({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900/60 px-3 py-2">
      <span className="text-xs font-semibold text-zinc-400">How many of this unit</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="One fewer"
          onClick={() => onChange(value - 1)}
          disabled={value <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-white transition hover:bg-zinc-700 disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-base font-black text-white">{value}</span>
        <button
          type="button"
          aria-label="One more"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-white transition hover:bg-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MoreOptions({ offered, chosen, children }: { offered: string[]; chosen: string[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(chosen.length > 0);
  return (
    <div className="rounded-xl border border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-xs font-bold text-zinc-200">More options</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">
          {chosen.length > 0 ? <span className="text-yellow-400/90">{chosen.join(" · ")}</span> : offered.join(", ")}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-4 border-t border-zinc-800 p-3">{children}</div>}
    </div>
  );
}

export default function StudioUnitEditor({
  item,
  index,
  canRemove,
  repricing,
  rules,
  prices,
  organizer,
  indoorFee,
  onUpdate,
  onExtras,
  onIndoorDelivery,
  onFitToWall,
  onBestsellerTotes,
  onQuantity,
  onRemove,
  measureSlot,
}: {
  item: UnitConfig;
  index: number;
  canRemove: boolean;
  repricing: boolean;
  rules: StudioRules;
  prices: StudioPrices;
  organizer: StudioOrganizer;
  /** Indoor delivery fee per unit, or null when the installer doesn't offer it */
  indoorFee: number | null;
  onUpdate: (patch: Partial<ToteUnitOptions>) => void;
  onExtras: (extras: StudioUnitExtras) => void;
  onIndoorDelivery: (on: boolean) => void;
  onFitToWall: (w: number, h: number) => Promise<{ cols: number; rows: number } | null>;
  onBestsellerTotes: (hasTotes: boolean) => void;
  onQuantity: (n: number) => void;
  onRemove: () => void;
  /** Rendered under "Fit it to my wall" (the free on-site measure offer) */
  measureSlot?: React.ReactNode;
}) {
  const kind = studioItemKind(item);
  const letter = unitLetter(index);
  const qty = item.quantity || 1;
  const lineTotal = item.price * qty;

  // Rarer choices live under "More options": what this installer offers here,
  // and what's already picked (the summary, and it opens itself when any is)
  const isRack = kind === "tote" || kind === "bestseller";
  const moreOffered: string[] = [];
  const moreChosen: string[] = [];
  if (kind === "tote" && miniAvailable(rules)) {
    moreOffered.push("Mini size");
    if (item.unitType === "mini") moreChosen.push("Mini");
  }
  if (kind === "tote" && item.unitType !== "mini") {
    moreOffered.push("sideways");
    if (item.orientation === "sideways") moreChosen.push("Sideways");
  }
  if (isRack && indoorFee != null) {
    moreOffered.push("indoor delivery");
    if (item.indoorDelivery) moreChosen.push("Indoor delivery");
  }
  if (kind === "tote" && organizer) {
    moreOffered.push("doors, shelves & paint");
    const n = item.addons?.length ?? 0;
    if (n > 0) moreChosen.push(`${n} organizer add-on${n === 1 ? "" : "s"}`);
    if (item.paintFrameColor || item.paintDoorColor || item.paintSidePanelColor) moreChosen.push("Paint");
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">
            Unit <span className="text-yellow-400">{letter}</span>
            <span className="ml-1.5 font-semibold text-zinc-500">{item.desc}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-black text-white">
            {repricing ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : money(lineTotal)}
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove unit ${letter}`}
              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 transition hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      {kind === "tote" && (
        <ToteOptions section="main" item={item} rules={rules} prices={prices} onUpdate={onUpdate} onFitToWall={onFitToWall} measureSlot={measureSlot} />
      )}

      {kind === "bestseller" && <BestsellerOptions item={item} rules={rules} onTotes={onBestsellerTotes} />}

      {moreOffered.length > 0 && (
        <MoreOptions key={index} offered={moreOffered} chosen={moreChosen}>
          {kind === "tote" && (
            <ToteOptions section="more" item={item} rules={rules} prices={prices} onUpdate={onUpdate} onFitToWall={onFitToWall} />
          )}
          {(kind === "tote" || kind === "bestseller") && indoorFee != null && (
            <Segmented
              label="Delivery"
              value={!!item.indoorDelivery}
              onChange={onIndoorDelivery}
              options={[
                { value: false, label: "Standard" },
                { value: true, label: "Inside the home", hint: `${plus(indoorFee) ?? ""}${indoorFee > 0 ? " each · " : ""}built & delivered inside` },
              ]}
            />
          )}
          {kind === "tote" && organizer && (
            <OrganizerCustomization
              cols={item.cols}
              rows={item.rows}
              addons={item.addons ?? []}
              onAddonsChange={(addons) => onExtras({ addons })}
              addonPricing={organizer.addonPricing}
              addonDefaults={organizer.addonDefaults}
              paintFrameColor={item.paintFrameColor ?? null}
              paintDoorColor={item.paintDoorColor ?? null}
              paintSidePanelColor={item.paintSidePanelColor ?? null}
              onPaintFrameColorChange={(c) => onExtras({ paintFrameColor: c })}
              onPaintDoorColorChange={(c) => onExtras({ paintDoorColor: c })}
              onPaintSidePanelColorChange={(c) => onExtras({ paintSidePanelColor: c })}
            />
          )}
        </MoreOptions>
      )}

      <Quantity value={qty} onChange={onQuantity} />
    </section>
  );
}

function ToteOptions({
  section,
  item,
  rules,
  prices,
  onUpdate,
  onFitToWall,
  measureSlot,
}: {
  /** "main" = everyday choices; "more" = unit size and tote direction */
  section: "main" | "more";
  item: UnitConfig;
  rules: StudioRules;
  prices: StudioPrices;
  onUpdate: (patch: Partial<ToteUnitOptions>) => void;
  onFitToWall: (w: number, h: number) => Promise<{ cols: number; rows: number } | null>;
  measureSlot?: React.ReactNode;
}) {
  const o = toteOptionsOf(item);
  const mini = o.unitType === "mini";
  const totePrice = mini ? prices.miniTote : o.toteType === "HDX" && o.toteColor === "clear" ? prices.standardToteClear : prices.standardTote;
  const totesLabel = mini ? "Clear totes" : "Totes";

  if (section === "more") {
    return (
      <>
        {miniAvailable(rules) && (
          <Segmented
            label="Unit size"
            value={o.unitType}
            onChange={(unitType) => onUpdate({ unitType })}
            options={[
              { value: "standard", label: "Standard", hint: "27-gallon totes" },
              { value: "mini", label: "Mini", hint: "6.5-quart totes" },
            ]}
          />
        )}
        {!mini && (
          <Segmented
            label={rules.totesDisabled ? "Orientation" : "Tote direction"}
            value={o.orientation}
            onChange={(orientation) => onUpdate({ orientation })}
            options={[
              { value: "standard", label: "Standard", hint: '30" deep — best for garages' },
              { value: "sideways", label: "Sideways", hint: '20" deep — tight spaces' },
            ]}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stepper label="Totes wide" value={o.cols} min={1} max={STUDIO_MAX_COLS} onChange={(cols) => onUpdate({ cols })} />
        <Stepper
          label="Totes tall"
          value={o.rows}
          min={1}
          max={studioMaxRows(o.unitType, rules.use2x4Rails)}
          onChange={(rows) => onUpdate({ rows })}
        />
      </div>
      <WallFit onFit={onFitToWall} />
      {measureSlot}

      {!mini && !rules.totesDisabled && !rules.use2x4Rails && (
        <Segmented
          label="Tote size"
          value={o.toteType}
          onChange={(toteType) => onUpdate({ toteType, ...(toteType === "GM" ? { toteColor: "black" as const } : {}) })}
          options={[
            { value: "HDX", label: "Standard totes", hint: "Home Depot, Menards" },
            { value: "GM", label: "Wider totes", hint: "Costco, Lowe's, Walmart" },
          ]}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="Casters"
          value={o.hasWheels}
          onChange={(hasWheels) => onUpdate({ hasWheels })}
          options={[
            { value: true, label: "Rolling", hint: plus(mini ? prices.miniWheels : prices.standardWheels) },
            { value: false, label: "Stationary" },
          ]}
        />
        {mini ? (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">Top</div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm font-bold text-emerald-300">
              Plywood top included
            </div>
          </div>
        ) : (
          <Segmented
            label="Top"
            value={o.hasTop}
            onChange={(hasTop) => onUpdate({ hasTop })}
            options={[
              { value: true, label: "Plywood worktop", hint: plus(prices.plywoodTop) },
              { value: false, label: "Open" },
            ]}
          />
        )}
      </div>

      {!rules.totesDisabled && (
        <Segmented
          label={totesLabel}
          value={o.hasTotes}
          onChange={(hasTotes) => onUpdate({ hasTotes })}
          options={[
            { value: true, label: "Include totes", hint: totePrice > 0 ? `+${money(totePrice)} each · ${o.cols * o.rows} totes` : `${o.cols * o.rows} totes` },
            { value: false, label: "I have my own" },
          ]}
        />
      )}

      {!rules.totesDisabled && !mini && o.toteType === "HDX" && o.hasTotes && (
        <Segmented
          label="Tote color"
          value={o.toteColor}
          onChange={(toteColor) => onUpdate({ toteColor })}
          options={[
            { value: "black", label: "Black / yellow", hint: prices.standardTote > 0 ? `${money(prices.standardTote)} each` : undefined },
            { value: "clear", label: "Clear / yellow", hint: prices.standardToteClear > 0 ? `${money(prices.standardToteClear)} each` : undefined },
          ]}
        />
      )}
    </>
  );
}

function BestsellerOptions({
  item,
  rules,
  onTotes,
}: {
  item: UnitConfig;
  rules: StudioRules;
  onTotes: (hasTotes: boolean) => void;
}) {
  const preset = presetOfItem(item);
  const choice = preset ? presetTotesChoice(preset, rules.totesDisabled) : "never";
  const slots = (item.presetUnits ?? []).reduce((s, u) => s + u.cols * u.rows, 0);

  return (
    <>
      <ul className="space-y-1 rounded-xl bg-zinc-950/60 p-3">
        {(item.presetUnits ?? []).map((u, i) => (
          <li key={i} className="flex justify-between text-xs">
            <span className="font-semibold text-zinc-300">
              {u.cols} wide × {u.rows} tall
            </span>
            <span className="text-zinc-500">
              {u.hasTop ? "worktop" : "open top"}
              {u.hasWheels ? " · rolling" : ""}
            </span>
          </li>
        ))}
        <li className="border-t border-zinc-800 pt-1 text-[11px] text-zinc-500">{slots} totes in all</li>
      </ul>
      {choice === "choice" ? (
        <Segmented
          label="Totes"
          value={item.hasTotes}
          onChange={onTotes}
          options={[
            { value: true, label: "Include totes" },
            { value: false, label: "I have my own" },
          ]}
        />
      ) : (
        <p className="rounded-xl bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-400">
          {choice === "always" ? "Totes included — drawer slide system" : "Frame only — no totes"}
        </p>
      )}
    </>
  );
}
