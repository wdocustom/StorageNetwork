"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — what a share link and the marketplace show
//
//   SharedDesignView   a view-only link: the design in 3D to look around,
//                      and "Open a copy" to take it into the builder
//   ListingView        a plan for sale: picture, size, what's in it, the
//                      price, and Stripe's checkout. The design itself is
//                      not sent to the browser until it has been bought.
//   ListingCard        one plan in the marketplace grid
// ═══════════════════════════════════════════════════════════════════════════

/* eslint-disable @next/next/no-img-element -- thumbnails are small data URLs, not files next/image can optimize */

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Check, Copy, FileText, Loader2, Lock, Ruler, ShoppingCart } from "lucide-react";
import { createPlanPurchaseCheckout, type Listing } from "@/app/actions/builder";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import { serializeScene, type Scene } from "@/lib/builder/scene";
import { DESIGN_ID_KEY, DRAFT_KEY, FORK_KEY, MARKET_HREF, formatPrice, sharedDesignHref, type DesignStats } from "@/lib/builder/store";
import { formatInches } from "@/lib/builder/units";

const SceneViewer = dynamic(() => import("@/components/builder/BuilderGuide").then((m) => m.SceneViewer), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
    </div>
  ),
});

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <Link href="/plans" aria-label="Storage Network plans" className="shrink-0">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-white">{title}</h1>
          <p className="truncate text-[10px] text-stone-500">{subtitle}</p>
        </div>
        <Link href={MARKET_HREF} className="hidden shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:border-yellow-400/50 hover:text-yellow-300 sm:block">
          Marketplace
        </Link>
        <Link href="/plans/builder" className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300">
          Builder
        </Link>
      </div>
    </header>
  );
}

function StatsRow({ stats }: { stats: DesignStats }) {
  const cells: [string, string][] = [
    ["Width", formatInches(stats.width)],
    ["Height", formatInches(stats.height)],
    ["Depth", formatInches(stats.depth)],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-800/60 px-3 py-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
          <div className="font-mono text-sm font-bold text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

/** "12 pieces · 38 ft of 2×4 · 11.3 sq ft of plywood · 4 casters" */
export function materialsLine(stats: DesignStats): string {
  return [
    `${stats.pieceCount} piece${stats.pieceCount === 1 ? "" : "s"}`,
    ...(stats.lumberFeet > 0 ? [`${stats.lumberFeet} ft of 2×4`] : []),
    ...(stats.sheetSqFt > 0 ? [`${stats.sheetSqFt} sq ft of plywood`] : []),
    ...(stats.casters > 0 ? [`${stats.casters} caster${stats.casters === 1 ? "" : "s"}`] : []),
  ].join(" · ");
}

// ── View-only link ───────────────────────────────────────────────────────

export function SharedDesignView({
  slug,
  name,
  description,
  stats,
  scene,
}: {
  slug: string;
  name: string;
  description: string | null;
  stats: DesignStats;
  scene: Scene;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  /** Put the design in the builder as this device's work in progress. */
  const openCopy = () => {
    try {
      localStorage.setItem(DRAFT_KEY, serializeScene({ ...scene, name: `${name} (copy)`.slice(0, 60) }));
      localStorage.setItem(FORK_KEY, slug);
      // It's a new design here, not the one this device had saved
      localStorage.removeItem(DESIGN_ID_KEY);
    } catch {
      /* storage unavailable: the builder will open empty */
    }
    router.push("/plans/builder");
  };

  const hasDraft = () => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      return !!draft && (JSON.parse(draft) as { pieces?: unknown[] }).pieces?.length !== 0;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-white">
      <PageHeader title={name} subtitle="Shared design · look around in 3D" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5 lg:flex-row">
        <div className="relative min-h-[46dvh] flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-white lg:min-h-[70dvh]">
          <SceneViewer scene={scene} />
          <p className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[10px] text-stone-300">Drag to rotate · pinch to zoom</p>
        </div>
        <aside className="shrink-0 space-y-4 lg:w-80">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-black">{name}</h2>
            <p className="mt-1 text-xs text-stone-400">{materialsLine(stats)}</p>
            {description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-300">{description}</p>}
            <div className="mt-4">
              <StatsRow stats={stats} />
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
            <p className="text-sm font-bold text-white">Make it yours</p>
            <p className="mt-1 text-xs text-stone-400">
              Open a copy in the Custom Builder to change sizes, add shelves or rework it. Getting its cut list, 3D guide and PDF needs a builder subscription.
            </p>
            {asking ? (
              <div className="mt-3 rounded-xl bg-amber-400/10 p-3">
                <p className="text-xs text-amber-100">This replaces the design you have open in the builder on this device.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={openCopy} className="flex-1 rounded-lg bg-yellow-400 py-2 text-xs font-black text-gray-950">
                    Replace it
                  </button>
                  <button type="button" onClick={() => setAsking(false)} className="flex-1 rounded-lg border border-slate-600 py-2 text-xs font-bold text-stone-200">
                    Keep mine
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (hasDraft() ? setAsking(true) : openCopy())}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300"
              >
                <Copy className="h-4 w-4" /> Open a copy
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

// ── A plan for sale ──────────────────────────────────────────────────────

const INCLUDED = [
  { icon: <Ruler className="h-4 w-4" />, text: "Cut list: every board and plywood sheet drawn to scale" },
  { icon: <ShoppingCart className="h-4 w-4" />, text: "Shopping list with exact quantities and screw counts" },
  { icon: <Box className="h-4 w-4" />, text: "Interactive 3D build guide, step by step, on your phone" },
  { icon: <FileText className="h-4 w-4" />, text: "Printable PDF with a picture for every step" },
];

export function ListingView({ listing }: { listing: Listing }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const buy = async () => {
    setBusy(true);
    setError("");
    const res = await createPlanPurchaseCheckout(listing.slug).catch(() => null);
    setBusy(false);
    if (res?.ok) setClientSecret(res.clientSecret);
    else setError(res?.error ?? "Couldn't reach the server. Try again.");
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <PageHeader title={listing.name} subtitle="Build plan · from the Storage Network marketplace" />
      {clientSecret && <EmbeddedCheckoutPanel clientSecret={clientSecret} onClose={() => setClientSecret(null)} />}
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white">
          {listing.thumbnail ? (
            <img src={listing.thumbnail} alt={`${listing.name}, rendered in 3D`} className="aspect-[3/2] w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center text-sm text-slate-400">No picture</div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-black">{listing.name}</h2>
            <p className="mt-1 text-xs text-stone-400">{materialsLine(listing.stats)}</p>
            {listing.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-300">{listing.description}</p>}
            <div className="mt-4">
              <StatsRow stats={listing.stats} />
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-black">{formatPrice(listing.priceCents)}</span>
              <span className="text-xs text-stone-400">one-time · yours for good</span>
            </p>
            <ul className="mt-4 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item.text} className="flex gap-2.5 text-xs text-stone-200">
                  <span className="mt-px shrink-0 text-yellow-400">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
            {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}
            <button
              type="button"
              onClick={buy}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Buy this plan
            </button>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-stone-500">
              <Check className="mt-px h-3 w-3 shrink-0" />
              No account needed. We email your permanent link. Digital plans are final sale.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={sharedDesignHref(listing.slug)}
      className="group block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-yellow-400/50"
    >
      <div className="flex aspect-[3/2] items-center justify-center bg-white">
        {listing.thumbnail ? (
          <img src={listing.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">No picture</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-bold text-white group-hover:text-yellow-300">{listing.name}</h3>
          <span className="shrink-0 rounded-full bg-yellow-400 px-2.5 py-0.5 text-xs font-black text-gray-950">{formatPrice(listing.priceCents)}</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-stone-400">
          {formatInches(listing.stats.width)} W × {formatInches(listing.stats.height)} H × {formatInches(listing.stats.depth)} D
        </p>
        <p className="mt-0.5 truncate text-[11px] text-stone-500">{materialsLine(listing.stats)}</p>
      </div>
    </Link>
  );
}
