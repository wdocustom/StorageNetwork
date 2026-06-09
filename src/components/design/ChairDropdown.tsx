"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Armchair } from "lucide-react";

interface ChairDropdownProps {
  onSelect: () => void;
  selected: boolean;
}

export default function ChairDropdown({
  onSelect,
  selected,
}: ChairDropdownProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden backdrop-blur-sm">
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/40 ${
          selected ? "bg-yellow-400/5" : ""
        }`}
      >
        <Armchair className={`h-4 w-4 shrink-0 ${selected ? "text-yellow-400" : "text-zinc-500"}`} />
        <span className={`flex-1 text-left text-sm font-medium ${selected ? "text-yellow-400" : "text-zinc-300"}`}>
          Low Boy Adirondack Chair
        </span>
        {selected && (
          <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-yellow-400">
            Selected
          </span>
        )}
      </button>
    </section>
  );
}
