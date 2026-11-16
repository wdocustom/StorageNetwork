"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /plans "Give it as a gift": the gift order form, inline on the storefront
//
// Collapsed to one button so the page keeps its single main action
// ("Design your rack"); opens in place on tap, or straight away when the
// page is reached at /plans#gift (header link, the old /plans/gift URL).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Gift } from "lucide-react";
import GiftPlansForm, { GIFT_DRAFT_KEY } from "@/components/plans/GiftPlansForm";

export default function GiftSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#gift") {
        setOpen(true);
        requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };
    fromHash();
    // An unfinished gift order (closed the payment panel, reloaded): reopen it.
    try {
      if (sessionStorage.getItem(GIFT_DRAFT_KEY)?.includes("@")) setOpen(true);
    } catch {
      /* storage blocked */
    }
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  return (
    <section id="gift" ref={ref} className="scroll-mt-4 border-t border-white/5 py-14">
      {children}
      {open ? (
        <div className="mt-10">
          <GiftPlansForm />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-400/50 py-4 text-base font-extrabold text-yellow-400 transition hover:border-yellow-400 hover:bg-yellow-400/5 active:scale-[0.99]"
        >
          <Gift className="h-5 w-5" aria-hidden /> Send plans as a gift
          <ChevronDown className="h-5 w-5" aria-hidden />
        </button>
      )}
    </section>
  );
}
