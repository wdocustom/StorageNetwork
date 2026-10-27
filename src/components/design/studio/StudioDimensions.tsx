"use client";

// Studio caption under the 3D view: the whole order's footprint and totes.

import type { UnitConfig } from "@/hooks/configurator/types";
import { studioItemKind, studioSystemSize } from "@/lib/studio";

export default function StudioDimensions({ items, repricing }: { items: UnitConfig[]; repricing: boolean }) {
  const size = studioSystemSize(items);
  if (!size || size.widthIn <= 0) {
    return <>{repricing ? "Calculating…" : "Add a unit to see it here"}</>;
  }
  const parts = items
    .filter((it) => studioItemKind(it) === "tote" || studioItemKind(it) === "bestseller")
    .flatMap((it) => Array.from({ length: it.quantity || 1 }, () => (it.presetUnits?.length ? it.presetUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ") : `${it.cols}×${it.rows}`)));
  const depth = Math.max(...items.map((it) => it.depth || 0));
  return (
    <>
      {size.widthIn.toFixed(1)}&quot; W &times; {size.heightIn.toFixed(1)}&quot; H{depth > 0 ? <> &times; {depth}&quot; D</> : null} &nbsp;&mdash;&nbsp;
      <span className="font-bold text-gray-900">
        {parts.join(" + ")} = {size.slots} slots
      </span>
      {repricing && <span className="ml-1 text-[10px] italic text-stone-400">· updating…</span>}
    </>
  );
}
