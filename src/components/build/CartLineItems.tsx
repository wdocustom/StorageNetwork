"use client";

import { Star, Trash2, PenLine, ArrowUpFromLine, Plus, X, Loader2 } from "lucide-react";
import type { UnitConfig, UnitOption } from "./types";
import { isRackUnit } from "./unitOptions";

const OPTION_LABEL: Record<UnitOption, string> = { top: "Top", wheels: "Wheels", totes: "Totes" };

interface CartLineItemsProps {
  units: UnitConfig[];
  onRemoveUnit: (id: string) => void;
  indoorDeliveryConfigFee?: number;
  onToggleIndoorDelivery?: (unitIndex: number, enabled: boolean) => void;
  /** Editing a saved quote: add a top / wheels / totes to an existing unit. */
  onAddOption?: (unitId: string, option: UnitOption) => void;
  onUndoOption?: (unitId: string, option: UnitOption) => void;
  /** `${unitId}:${option}` currently being priced. */
  optionBusy?: string | null;
  /** Hide remove on these units (deposit already paid — can't be removed). */
  lockedUnitIds?: Set<string>;
}

export default function CartLineItems({
  units,
  onRemoveUnit,
  indoorDeliveryConfigFee,
  onToggleIndoorDelivery,
  onAddOption,
  onUndoOption,
  optionBusy,
  lockedUnitIds,
}: CartLineItemsProps) {
  const rendered = new Set<string>();

  return (
    <div className="space-y-2">
      {units.map((unit, index) => {
        // Preset group — render once per group
        if (unit.presetGroup) {
          if (rendered.has(unit.presetGroup)) return null;
          rendered.add(unit.presetGroup);
          const groupUnits = units.filter(
            (u) => u.presetGroup === unit.presetGroup
          );
          const groupPrice = groupUnits.reduce((s, u) => s + (u.price || 0), 0);
          const groupSlots = groupUnits.reduce((s, u) => s + (u.slots || 0), 0);
          return (
            <div
              key={unit.presetGroup}
              className="rounded-lg border border-yellow-400/20 bg-slate-800 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    <Star className="mr-1 inline h-3 w-3 text-yellow-400" />
                    {unit.presetName}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {groupUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ")} •{" "}
                    {groupSlots} slots
                    {groupUnits[0].hasTotes && " • Totes"}
                    {groupUnits.some((u) => u.hasWheels) && " • Wheels"}
                    {groupUnits.some((u) => u.hasTop) && " • Top"}
                    {groupUnits.some((u) => u.indoorDelivery) && " • Indoor Delivery"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-yellow-400">
                    ${groupPrice.toLocaleString()}
                  </span>
                  <button
                    onClick={() => onRemoveUnit(unit.id)}
                    className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const isCustom =
          unit.cols === 0 &&
          unit.rows === 0 &&
          !unit.overheadGridPresetId &&
          !unit.shelvingConfigId &&
          !unit.raisedBedConfig &&
          !unit.chairId;

        return (
          <div
            key={unit.id}
            className={`flex items-center justify-between rounded-lg border p-3 ${
              unit.overheadGridPresetId
                ? "border-yellow-400/20 bg-slate-800"
                : "border-slate-700 bg-slate-800"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                {unit.chairId ? (
                  unit.desc
                ) : unit.raisedBedConfig ? (
                  unit.desc
                ) : isCustom ? (
                  <>
                    <PenLine className="mr-1 inline h-3 w-3 text-yellow-400" />
                    {unit.desc}
                  </>
                ) : unit.overheadGridPresetId ? (
                  <>
                    <ArrowUpFromLine className="mr-1 inline h-3 w-3 text-yellow-400" />
                    {unit.desc}
                  </>
                ) : unit.shelvingConfigId ? (
                  unit.desc
                ) : (
                  <>
                    Unit {index + 1}: {unit.cols} × {unit.rows}
                  </>
                )}
              </p>
              <p className="text-[11px] text-stone-500">
                {unit.chairId ? (
                  <>
                    Adirondack Chair
                    {unit.quantity && unit.quantity > 1
                      ? ` • Qty: ${unit.quantity}`
                      : ""}
                  </>
                ) : unit.raisedBedConfig ? (
                  <>
                    Raised Bed
                    {unit.quantity && unit.quantity > 1
                      ? ` • Qty: ${unit.quantity}`
                      : ""}
                  </>
                ) : isCustom ? (
                  "Custom item"
                ) : unit.overheadGridPresetId ? (
                  <>
                    {unit.toteType}
                    {unit.hasTotes && " • Totes"}
                  </>
                ) : unit.shelvingConfigId ? null : (
                  <>
                    {unit.unitType === "mini" ? "Mini" : unit.toteType} • {unit.slots}{" "}
                    slots
                    {unit.hasTotes && " • Totes"}
                    {unit.hasWheels && " • Wheels"}
                    {unit.hasTop && " • Top"}
                    {unit.indoorDelivery && " • Indoor Delivery"}
                  </>
                )}
              </p>
              {indoorDeliveryConfigFee !== undefined && onToggleIndoorDelivery && (
                <label className="mt-1 flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!!unit.indoorDelivery}
                    onChange={(e) =>
                      onToggleIndoorDelivery(index, e.target.checked)
                    }
                    className="h-3 w-3 rounded border-slate-600 bg-slate-700 text-yellow-400 focus:ring-yellow-400/50"
                  />
                  <span className="text-[10px] text-stone-500">
                    Indoor delivery (+${indoorDeliveryConfigFee})
                  </span>
                </label>
              )}
              {onAddOption && isRackUnit(unit) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["top", "wheels", "totes"] as UnitOption[]).map((opt) => {
                    const added = unit.addedOptions?.[opt];
                    if (added !== undefined) {
                      return (
                        <button
                          key={opt}
                          onClick={() => onUndoOption?.(unit.id, opt)}
                          className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                          aria-label={`Remove added ${OPTION_LABEL[opt]}`}
                        >
                          {OPTION_LABEL[opt]} +${added.toLocaleString()}
                          <X className="h-3 w-3" />
                        </button>
                      );
                    }
                    const has =
                      opt === "top" ? unit.hasTop || unit.unitType === "mini" : opt === "wheels" ? unit.hasWheels : unit.hasTotes;
                    if (has) return null;
                    const busy = optionBusy === `${unit.id}:${opt}`;
                    return (
                      <button
                        key={opt}
                        onClick={() => onAddOption(unit.id, opt)}
                        disabled={!!optionBusy}
                        className="flex items-center gap-1 rounded-md border border-yellow-400/30 bg-yellow-400/5 px-2 py-0.5 text-[10px] font-bold text-yellow-400 hover:bg-yellow-400/15 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        {OPTION_LABEL[opt]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-yellow-400">
                {unit.quantity && unit.quantity > 1 && (unit.raisedBedConfig || unit.chairId) ? (
                  <>
                    <span className="text-[10px] font-normal text-stone-400">
                      ${Math.round((unit.price || 0) / unit.quantity).toLocaleString()} × {unit.quantity} ={" "}
                    </span>
                    ${(unit.price || 0).toLocaleString()}
                  </>
                ) : (
                  <>
                    $
                    {(
                      (unit.price || 0) +
                      (unit.indoorDelivery && unit.indoorDeliveryFee
                        ? unit.indoorDeliveryFee
                        : 0)
                    ).toLocaleString()}
                  </>
                )}
              </span>
              {!lockedUnitIds?.has(unit.id) && (
                <button
                  onClick={() => onRemoveUnit(unit.id)}
                  className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
