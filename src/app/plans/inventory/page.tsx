"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/inventory — Smart Inventory for DIY plan buyers
//
//   ?token=<plan link>   from the plan page / My Builds (device-gated)
//   ?rack=<rack link>    from a DIY rack's own page ("My racks")
//   &buy=1               open the $5 checkout straight away
//   &session_id=…        back from checkout: record it, then unlock
//
// Without the add-on: the explainer and one buy button. With it: every rack
// they've added (each opens the full tote inventory at /rack/[token]) and
// "Add a rack" — one tap for a rack from their plans, or any size by hand.
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Loader2, Package, Plus, QrCode, Search, Share2 } from "lucide-react";

import {
  addDiyRack,
  confirmDiyInventory,
  createDiyInventoryCheckout,
  getDiyInventory,
  type DiyInventoryKey,
  type DiyInventoryResult,
} from "@/app/actions/diy-inventory";
import DeviceVerify from "@/components/plans/DeviceVerify";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import { SmartInventoryShowcase } from "@/components/plans/SmartInventory";
import { AddRackSheet, MiniRack } from "@/components/plans/InventoryHubParts";
import { libraryHref } from "@/lib/plan-library";
import { trackPlanEvent } from "@/lib/plan-events";

type Ready = Extract<DiyInventoryResult, { ok: true }>;

function InventoryHub() {
  const params = useSearchParams();
  const router = useRouter();
  const [key] = useState<DiyInventoryKey | null>(() => {
    const token = params.get("token");
    const rack = params.get("rack");
    return token ? { token } : rack ? { rack } : params.get("account") === "1" ? { account: true } : null;
  });
  const [result, setResult] = useState<DiyInventoryResult | null>(null);
  const [checkout, setCheckout] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);
  const started = useRef(false);

  const load = useCallback(async () => {
    if (!key) return;
    setResult(await getDiyInventory(key));
  }, [key]);

  const buy = useCallback(async () => {
    if (!key) return;
    trackPlanEvent("inventory_buy_tap", "hub");
    setBuying(true);
    setBuyError("");
    const r = await createDiyInventoryCheckout(key).catch(() => ({ ok: false as const, error: "We couldn't open checkout. Please try again." }));
    setBuying(false);
    if (r.ok) setCheckout(r.clientSecret);
    else setBuyError(r.error);
  }, [key]);

  useEffect(() => {
    if (started.current || !key) return;
    started.current = true;
    (async () => {
      const sessionId = params.get("session_id");
      if (sessionId) {
        const confirmed = await confirmDiyInventory(key, sessionId);
        if (confirmed.ok) {
          trackPlanEvent("inventory_bought");
          setWelcome(true);
        }
      }
      const r = await getDiyInventory(key);
      setResult(r);
      // Clean one-time params out of the URL
      const clean =
        "token" in key ? `?token=${encodeURIComponent(key.token)}` : "rack" in key ? `?rack=${encodeURIComponent(key.rack)}` : "?account=1";
      if (sessionId || params.get("buy")) router.replace(`/plans/inventory${clean}`);
      if (r.ok && !r.hasAccess && params.get("buy") === "1") buy();
    })();
  }, [key, params, router, buy]);

  if (!key) {
    return (
      <Shell>
        <p className="text-center text-sm text-stone-400">
          Open this from your plan page.{" "}
          <Link href="/plans" className="text-yellow-300 underline">Find my plans</Link>
        </p>
      </Shell>
    );
  }

  if (!result) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-yellow-400" />
        </div>
      </Shell>
    );
  }

  if (!result.ok) {
    if (result.verify) {
      return <DeviceVerify token={result.verify.token} emailHint={result.verify.emailHint} onVerified={load} />;
    }
    return (
      <Shell>
        <p className="text-center text-sm text-stone-400">{result.error}</p>
      </Shell>
    );
  }

  const backHref = "token" in key ? libraryHref(key.token) : "rack" in key ? `/rack/${key.rack}` : "/plans/checkout";
  const data: Ready = result;

  if (!data.hasAccess) {
    return (
      <Shell backHref={backHref}>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <SmartInventoryShowcase onBuy={buy} buying={buying} />
          {buyError && <p className="mt-3 text-center text-xs text-amber-400">{buyError}</p>}
        </div>
        {checkout && <EmbeddedCheckoutPanel clientSecret={checkout} onClose={() => setCheckout(null)} />}
      </Shell>
    );
  }

  const totalTotes = data.racks.reduce((s, r) => s + r.cols * r.rows, 0);
  const totalFilled = data.racks.reduce((s, r) => s + r.filled, 0);
  const totalItems = data.racks.reduce((s, r) => s + r.items, 0);

  return (
    <Shell backHref={backHref}>
      {welcome && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-100">
            <strong>You&apos;re set — Smart Inventory is yours for life.</strong> Add the rack you built, then tap a tote to
            start listing what&apos;s inside.
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-black uppercase tracking-widest text-yellow-400">My Inventory</p>
        <h1 className="mt-1 text-2xl font-black text-white">
          {data.racks.length === 0 ? "Add the rack you built" : `${data.racks.length} rack${data.racks.length === 1 ? "" : "s"}`}
        </h1>
        {data.racks.length > 0 && (
          <p className="mt-1 text-sm text-stone-400">
            {totalFilled} of {totalTotes} totes cataloged · {totalItems} item{totalItems === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {data.racks.length > 0 && (
        <div className="space-y-3">
          {data.racks.map((r) => (
            <div
              key={r.token}
              className={`rounded-2xl border bg-slate-900 p-4 transition ${justAdded === r.token ? "border-emerald-400/70" : "border-slate-800"}`}
            >
              <Link href={`/rack/${r.token}`} className="flex items-center gap-4">
                <MiniRack cols={r.cols} rows={r.rows} filled={r.filled} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-white">{r.label}</span>
                  <span className="block text-xs text-stone-400">
                    {r.cols}×{r.rows} · {r.filled} of {r.cols * r.rows} totes · {r.items} item{r.items === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" />
              </Link>
              <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                <Link
                  href={`/rack/${r.token}`}
                  className="flex-1 rounded-lg bg-yellow-400 py-2 text-center text-xs font-black text-gray-950 hover:bg-yellow-300"
                >
                  {r.filled === 0 ? "Start filling totes" : "Open"}
                </Link>
                <Link
                  href={`/rack/${r.token}/qr`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-stone-300 hover:border-yellow-400/50"
                >
                  <QrCode className="h-3.5 w-3.5" /> QR label
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black transition ${
          data.racks.length === 0
            ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
            : "border border-dashed border-slate-600 text-stone-300 hover:border-yellow-400 hover:text-yellow-300"
        }`}
      >
        <Plus className="h-4 w-4" /> {data.racks.length === 0 ? "Add my rack" : "Add another rack"}
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Package, text: "Tap any tote to list what's inside and snap a photo." },
          { icon: Search, text: "Search from any rack to find an item across all of them." },
          { icon: Share2, text: "Share a rack's link so your household can look things up too." },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-stone-400">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            {text}
          </div>
        ))}
      </div>

      {adding && (
        <AddRackSheet
          suggestions={data.suggestions}
          onClose={() => setAdding(false)}
          onAdd={async (rack) => {
            const r = await addDiyRack(key, rack).catch(() => ({ ok: false as const, error: "We couldn't add that rack. Please try again." }));
            if (!r.ok) return r.error;
            trackPlanEvent("inventory_rack_added", `${rack.cols}x${rack.rows}`);
            setAdding(false);
            setJustAdded(r.token);
            await load();
            return null;
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children, backHref }: { children: React.ReactNode; backHref?: string }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {backHref ? (
            <Link href={backHref} aria-label="Back" className="rounded-lg p-1.5 text-stone-400 hover:bg-slate-800 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Smart Inventory</p>
            <p className="text-[10px] text-stone-500">Every tote, on your phone</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-5 px-4 py-6">{children}</main>
    </div>
  );
}

export default function DiyInventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-7 w-7 animate-spin text-yellow-400" />
        </div>
      }
    >
      <InventoryHub />
    </Suspense>
  );
}
