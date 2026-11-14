"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — material library
//
// Everything that can be added to a design, grouped the way a lumber aisle
// is. Tap an item and it lands on the floor in front of the build, selected
// and ready to move. The list is LIBRARY_ITEMS in @/lib/builder/catalog.
// ═══════════════════════════════════════════════════════════════════════════

import { Plus } from "lucide-react";
import { LIBRARY_ITEMS, LIBRARY_SECTIONS, getStock, type LibraryItem } from "@/lib/builder/catalog";

/** A small to-scale picture of the piece's end (lumber) or face (plywood). */
function Swatch({ item }: { item: LibraryItem }) {
  const stock = getStock(item.stock);
  if (!stock) return null;
  if (stock.kind === "lumber") {
    // End grain: thickness × width at 6 px per inch
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950">
        <span
          className="block rounded-[2px] border border-amber-900/50 bg-[#e2d1a8]"
          style={{ width: item.width * 6, height: stock.thickness * 6 }}
        />
      </span>
    );
  }
  if (stock.kind === "hardware") {
    // A caster is a wheel under a plate; a tote is a dark bin with a yellow lid
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950">
        {stock.look === "caster" ? (
          <span className="flex flex-col items-center">
            <span className="block h-[3px] w-4 rounded-sm bg-slate-400" />
            <span className="mt-px block h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-slate-600" />
          </span>
        ) : (
          <span className="flex flex-col items-center">
            <span className="block h-[4px] w-6 rounded-sm bg-yellow-500" />
            <span className="block h-3 w-5 rounded-b-sm bg-zinc-700" />
          </span>
        )}
      </span>
    );
  }
  // Face: width × length scaled so a 4 × 8 sheet fills the swatch
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950">
      <span
        className="block rounded-[1px] border border-amber-900/50 bg-[#d4b896]"
        style={{ width: Math.max(5, (item.width / 48) * 14), height: Math.max(6, (item.length / 96) * 28) }}
      />
    </span>
  );
}

export default function BuilderLibrary({ onAdd, disabled }: { onAdd: (item: LibraryItem) => void; disabled?: boolean }) {
  return (
    <div className="space-y-5">
      {LIBRARY_SECTIONS.map((section) => (
        <section key={section}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{section}</h3>
          <ul className="space-y-1.5">
            {LIBRARY_ITEMS.filter((item) => item.section === section).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onAdd(item)}
                  disabled={disabled}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-2 text-left transition hover:border-yellow-400/50 hover:bg-slate-800 disabled:opacity-40"
                >
                  <Swatch item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-white">{item.label}</span>
                    <span className="block truncate text-[10px] text-stone-500">{item.detail}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-stone-600 transition group-hover:text-yellow-400" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[10px] leading-snug text-stone-600">
        Any board or panel can be cut to size after you add it. Narrow a 2×4&apos;s width to rip it.
      </p>
    </div>
  );
}
