"use client";

// Studio caption under the 3D view: the racks' footprint and totes, plus the
// order's other products by name.

import type { UnitConfig } from "@/hooks/configurator/types";
import { studioItemKind, studioSystemSize, type StudioItemKind } from "@/lib/studio";

const OTHER_LABEL: Partial<Record<StudioItemKind, string>> = {
  shelving: "open shelving",
  overhead: "ceiling rail",
  "raised-bed": "raised bed",
  chair: "chair",
};

export default function StudioDimensions({ items, repricing }: { items: UnitConfig[]; repricing: boolean }) {
  const size = studioSystemSize(items);
  const racks = items.filter((it) => {
    const k = studioItemKind(it);
    return k === "tote" || k === "bestseller";
  });
  const others = items
    .filter((it) => OTHER_LABEL[studioItemKind(it)])
    .map((it) => {
      const qty = it.quantity || 1;
      return `${qty > 1 ? `${qty}× ` : ""}${OTHER_LABEL[studioItemKind(it)]}`;
    });

  if (!size || size.widthIn <= 0) {
    if (others.length > 0) return <span className="font-bold text-gray-900">{others.join(" + ")}</span>;
    return <>{repricing ? "Calculating…" : "Add a unit to see it here"}</>;
  }
  const parts = racks.flatMap((it) =>
    Array.from({ length: it.quantity || 1 }, () =>
      it.presetUnits?.length ? it.presetUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ") : `${it.cols}×${it.rows}`,
    ),
  );
  const depth = Math.max(...racks.map((it) => it.depth || 0));
  return (
    <>
      {size.widthIn.toFixed(1)}&quot; W &times; {size.heightIn.toFixed(1)}&quot; H{depth > 0 ? <> &times; {depth}&quot; D</> : null} &nbsp;&mdash;&nbsp;
      <span className="font-bold text-gray-900">
        {parts.join(" + ")} = {size.slots} slots
      </span>
      {others.length > 0 && <span className="text-stone-500"> · + {others.join(" + ")}</span>}
      {repricing && <span className="ml-1 text-[10px] italic text-stone-400">· updating…</span>}
    </>
  );
}
