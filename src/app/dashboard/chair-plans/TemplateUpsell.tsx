"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { createChairTemplateCheckout } from "@/app/actions/chair-plans";

export default function TemplateUpsell() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddTemplate() {
    setLoading(true);
    setError(null);
    const result = await createChairTemplateCheckout();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 print:hidden">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
        <Package className="h-5 w-5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">Add the 1/2&quot; MDF Template Set</p>
        <p className="text-xs text-stone-400">Cut every part in under 60 seconds — perfect for batch builds.</p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <button
        onClick={handleAddTemplate}
        disabled={loading}
        className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-amber-300 disabled:opacity-60"
      >
        {loading ? "..." : "$72"}
      </button>
    </div>
  );
}
