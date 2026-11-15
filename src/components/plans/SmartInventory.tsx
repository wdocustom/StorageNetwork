"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Smart Inventory for DIY plan buyers — the pitch
//
//   SmartInventoryCta       one calm card on the plan page / My Builds:
//                           "Built it? Let's get organized." → opens the
//                           explainer. Owners see their racks instead.
//   SmartInventoryShowcase  the explainer itself (also the locked state of
//                           /plans/inventory): a live-looking rack where a
//                           search finds the right tote, then 4 benefits.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Camera, ChevronRight, Layers, Loader2, Package, QrCode, Search, X } from "lucide-react";

import { getDiyInventory, type DiyInventoryKey } from "@/app/actions/diy-inventory";
import { DIY_INVENTORY, diyInventoryUrl, rememberInventoryReturn } from "@/lib/diy-inventory";
import { formatPlanPrice } from "@/lib/tote-plans";
import { trackPlanEvent } from "@/lib/plan-events";

const PRICE = formatPlanPrice(DIY_INVENTORY.price);

// What's in the totes of the illustrated rack (cols × rows = 4 × 3)
const TOTES = [
  "Xmas lights", "Camping", "Tools", "Baby clothes",
  "Halloween", "Sports", "Paint", "Tax docs",
  "Car care", "Fishing", "Kids toys", "Wrapping",
];
const FOUND = 1; // "Camping"

/** A rack of totes; searching "camping" lights up the right one. */
export function InventoryIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 ${compact ? "p-2.5" : "p-4"}`}>
      <style>{`
        @keyframes sni-type { 0%,12% { width: 0 } 40%,100% { width: 7ch } }
        @keyframes sni-found { 0%,42% { box-shadow: 0 0 0 0 rgba(250,204,21,0); border-color: rgb(51 65 85) } 50%,92% { box-shadow: 0 0 0 3px rgba(250,204,21,.85); border-color: rgb(250 204 21) } 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0) } }
        .sni-type { animation: sni-type 5s steps(7) infinite; }
        .sni-found { animation: sni-found 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sni-type { animation: none; width: 7ch } .sni-found { animation: none; box-shadow: 0 0 0 3px rgba(250,204,21,.85); border-color: rgb(250 204 21) } }
      `}</style>
      {!compact && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-stone-300">
          <Search className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
          <span className="sni-type inline-block overflow-hidden whitespace-nowrap align-bottom font-mono">camping</span>
          <span className="ml-auto text-[11px] text-emerald-400">Tote B1 · Garage rack</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 rounded-lg border-x-4 border-y-2 border-amber-700/80 bg-amber-900/20 p-1.5">
        {TOTES.map((t, i) => (
          <div
            key={t}
            className={`flex flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-900 ${i === FOUND ? "sni-found" : ""}`}
          >
            <div className={`${compact ? "h-1" : "h-1.5"} bg-yellow-400/90`} />
            {compact ? (
              // Too small for words: a plain tote with a label strip
              <div className="flex h-4 items-center justify-center">
                <span className="h-0.5 w-3 rounded bg-slate-600" />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center px-1 py-2.5">
                <span className="text-center text-[10px] font-semibold leading-tight text-stone-300">{t}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const BENEFITS = [
  { icon: Package, title: "Every tote, on your phone", text: "Tap a tote on your rack to list what's in it. Add a photo of the contents in one tap." },
  { icon: Search, title: "Search, then walk straight to it", text: "Type “camping stove” and the right tote lights up, on whichever rack it's on." },
  { icon: QrCode, title: "QR labels for your racks", text: "Print a label, stick it on the rack, and anyone in the house can scan it to look things up." },
  { icon: Layers, title: "Grows with every rack you build", text: "A 4×4 today, a 4×2 next spring: add each rack as you build it. Everything stays in one place." },
];

/** The explainer: illustration, benefits, price, one button. */
export function SmartInventoryShowcase({
  onBuy,
  buying,
  onLater,
}: {
  onBuy: () => void;
  buying?: boolean;
  onLater?: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-yellow-400">{DIY_INVENTORY.name}</p>
      <h2 className="mt-1 text-2xl font-black leading-tight text-white">Now that you&apos;ve built your rack, let&apos;s get organized.</h2>
      <p className="mt-2 text-sm text-stone-400">{DIY_INVENTORY.tagline}</p>

      <div className="mt-5">
        <InventoryIllustration />
      </div>

      <ul className="mt-5 space-y-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
              <Icon className="h-5 w-5 text-yellow-400" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">{title}</span>
              <span className="block text-sm text-stone-400">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-stone-200">One payment. Every rack you build, for life.</p>
          <p className="shrink-0 text-3xl font-black text-white">{PRICE}</p>
        </div>
        <button
          type="button"
          onClick={onBuy}
          disabled={buying}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-4 text-base font-black text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
        >
          {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" aria-hidden />}
          {buying ? "Opening checkout…" : `Get organized — ${PRICE}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-stone-500">No subscription · works on any phone · share it with your household</p>
      </div>
      {onLater && (
        <button type="button" onClick={onLater} className="mt-3 w-full text-center text-xs font-semibold text-stone-500 hover:text-stone-300">
          Maybe later
        </button>
      )}
    </div>
  );
}

/** Bottom sheet with the explainer; "buy" goes to the inventory hub, which opens checkout. */
function ShowcaseSheet({ hubUrl, onClose }: { hubUrl: string; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Smart Inventory"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-2 text-stone-500 hover:bg-slate-800 hover:text-stone-300"
        >
          <X className="h-5 w-5" />
        </button>
        <SmartInventoryShowcase
          onBuy={() => {
            trackPlanEvent("inventory_buy_tap", "sheet");
            rememberInventoryReturn(window.location.pathname.startsWith("/plans/library") ? "My Plans" : "Build plan");
            window.location.href = `${hubUrl}&buy=1`;
          }}
          onLater={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

/**
 * The plan page / My Builds card. Buyers without the add-on see a calm
 * teaser that opens the explainer; owners see their inventory at a glance.
 */
export function SmartInventoryCta({
  inventoryKey,
  placement,
}: {
  /** A plan link, or { account: true } for a signed-in admin / Pro */
  inventoryKey: DiyInventoryKey;
  placement: "plan" | "library";
}) {
  const hubUrl = diyInventoryUrl(inventoryKey);
  const keyId = JSON.stringify(inventoryKey);
  const [state, setState] = useState<{ hasAccess: boolean; included: boolean; racks: number; items: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getDiyInventory(JSON.parse(keyId) as DiyInventoryKey)
      .then((r) => {
        if (r.ok) {
          setState({
            hasAccess: r.hasAccess,
            included: r.included === true,
            racks: r.racks.length,
            items: r.racks.reduce((s, x) => s + x.items, 0),
          });
        }
      })
      .catch(() => {});
  }, [keyId]);

  if (!state) return null;

  if (state.hasAccess) {
    const owner = (
      <Link
        href={hubUrl}
        onClick={() => rememberInventoryReturn(placement === "plan" ? "Build plan" : "My Plans")}
        className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-yellow-400/50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          <Package className="h-5 w-5 text-yellow-400" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">My Inventory</span>
          <span className="block text-xs text-stone-400">
            {state.racks === 0
              ? "Add the rack you built and start filling your totes."
              : `${state.racks} rack${state.racks === 1 ? "" : "s"} · ${state.items} item${state.items === 1 ? "" : "s"} cataloged`}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" />
      </Link>
    );
    if (!state.included) return owner;
    // Admin / Pro: it's included for you — but you can still see the buyer pitch.
    return (
      <div>
        {owner}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 w-full text-center text-[11px] font-semibold text-stone-500 hover:text-yellow-300"
        >
          Included with your account · Preview what buyers see ($5 offer)
        </button>
        {open && <ShowcaseSheet hubUrl={hubUrl} onClose={() => setOpen(false)} />}
      </div>
    );
  }

  return (
    <>
      <SmartInventoryTeaser
        onOpen={() => {
          trackPlanEvent("inventory_info", placement);
          setOpen(true);
        }}
      />
      {open && <ShowcaseSheet hubUrl={hubUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The calm "Built it? Let's get organized." card (opens the explainer). */
export function SmartInventoryTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-2xl border border-yellow-400/25 bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-left transition hover:border-yellow-400/60"
    >
        <div className="w-28 shrink-0">
          <InventoryIllustration compact />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black uppercase tracking-widest text-yellow-400">Built it?</span>
          <span className="block text-base font-black leading-tight text-white">Let&apos;s get organized.</span>
          <span className="mt-0.5 block text-xs text-stone-400">Know what&apos;s in every tote, without opening one.</span>
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-yellow-300 group-hover:text-yellow-200">
            See how it works <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </span>
    </button>
  );
}
