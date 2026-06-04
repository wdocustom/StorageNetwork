"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 transition-colors"
    >
      Print
    </button>
  );
}
