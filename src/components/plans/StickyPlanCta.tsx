"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Sticky bottom call to action for the plans funnel
//
// 90% of /plans visitors are on phones, arriving from ads. Once the page's
// own main button scrolls out of view, this keeps the next step one tap
// away: price on the left, action on the right. It hides again while the
// watched element (the in-page button or offer) is on screen, so the two
// never compete.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function StickyPlanCta({
  watchId,
  price,
  note,
  label,
  href,
  onClick,
  loading = false,
}: {
  /** Element id that, while visible, hides the bar */
  watchId: string;
  price: string;
  note: string;
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    // Show only once the watched element has been scrolled past or is off screen.
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  const button =
    "flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 text-sm font-black uppercase tracking-wide text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60";

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-lg font-black text-white">{price}</p>
          <p className="truncate text-[11px] font-semibold text-yellow-400">{note}</p>
        </div>
        {href ? (
          <Link href={href} className={button} tabIndex={show ? 0 : -1}>
            {label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <button type="button" onClick={onClick} disabled={loading} className={button} tabIndex={show ? 0 : -1}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {label}
          </button>
        )}
      </div>
    </div>
  );
}
