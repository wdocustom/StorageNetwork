"use client";

import { Star, Trash2, PenLine, ArrowUpFromLine } from "lucide-react";
import type { UnitConfig } from "./types";

interface CartLineItemsProps {
  units: UnitConfig[];
  onRemoveUnit: (id: string) => void;
  indoorDeliveryConfigFee?: number;
  onToggleIndoorDelivery?: (unitIndex: number, enabled: boolean) => void;
}

export default function CartLineItems({
  units,
  onRemoveUnit,
  indoorDeliveryConfigFee,
  onToggleIndoorDelivery,
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
          !unit.raisedBedConfig;

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
                {unit.raisedBedConfig ? (
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
                {unit.raisedBedConfig ? (
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
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-yellow-400">
                {unit.quantity && unit.quantity > 1 && unit.raisedBedConfig ? (
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
              <button
                onClick={() => onRemoveUnit(unit.id)}
                className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
