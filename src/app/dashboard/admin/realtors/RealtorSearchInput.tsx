"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

// Tiny client-only input that pushes the query string back to the
// server-rendered list page. Kept out of the page itself so the parent can
// stay a pure server component (no hydration cost for the table).

export function RealtorSearchInput({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(next: string) {
    const params = new URLSearchParams();
    if (next) params.set("q", next);
    startTransition(() => {
      router.push(`/dashboard/admin/realtors${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value.trim());
      }}
      className="relative max-w-md"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name, email, or brokerage…"
        className="w-full rounded-xl border border-slate-700 bg-slate-900/60 py-2.5 pl-11 pr-10 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
        disabled={isPending}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            submit("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:bg-slate-800 hover:text-stone-300"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}
