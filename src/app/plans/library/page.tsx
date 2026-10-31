"use client";

// ═══════════════════════════════════════════════════════════════════════════
// MY BUILDS — every plan and guide a customer has bought, in one place
//
//   /plans/library?token=<any of their access tokens>
//
// Reached from the build page header, the 3D guide's Home button, the jig
// page and purchase emails. Each item opens with its own access link.
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import DeviceVerify from "@/components/plans/DeviceVerify";
import Link from "next/link";
import { AlertCircle, Armchair, Box, ChevronRight, Loader2, Mail, Plus, Wrench } from "lucide-react";
import { listMyPlans, type LibraryItem, type LibraryResult } from "@/app/actions/plan-library";
import { CONTACT_EMAIL } from "@/lib/plan-library";
import { formatPlanPrice } from "@/lib/tote-plans";

const ICONS: Record<LibraryItem["kind"], typeof Box> = { tote: Box, jig: Wrench, chair: Armchair };

function ItemCard({ item }: { item: LibraryItem }) {
  const Icon = ICONS[item.kind];
  const date = new Date(item.purchasedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-yellow-400/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
        <Icon className="h-5 w-5 text-yellow-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-white">{item.title}</p>
          {item.badge && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-stone-300">{item.badge}</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-stone-500">{item.subtitle}</p>
        <p className="mt-0.5 text-[10px] text-stone-600">Purchased {date}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-stone-600 transition group-hover:text-yellow-400" />
    </Link>
  );
}

function LibraryInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [result, setResult] = useState<LibraryResult | null>(null);

  useEffect(() => {
    if (!token) {
      setResult({ ok: false, error: "Open My Builds from the link in your purchase email." });
      return;
    }
    listMyPlans(token).then(setResult);
  }, [token]);

  if (token && result && !result.ok && result.verify) {
    return (
      <DeviceVerify
        token={token}
        emailHint={result.verify.emailHint}
        onVerified={() => {
          setResult(null);
          listMyPlans(token).then(setResult);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a href="/plans">
            <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white">My Builds</h1>
            <p className="truncate text-[10px] text-stone-500">
              {result?.ok ? `Plans and guides for ${result.emailHint}` : "Your plans and guides"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        {!result ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        ) : !result.ok ? (
          <div className="rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="mb-4 text-sm text-stone-400">{result.error}</p>
            <p className="text-xs text-stone-500">
              Lost your email? Use &ldquo;Already purchased?&rdquo; on{" "}
              <a href="/plans" className="text-yellow-400 underline">the plans page</a> to get your links again.
            </p>
          </div>
        ) : (
          <>
            {result.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone-500">No plans yet.</p>
            ) : (
              result.items.map((item) => <ItemCard key={item.href} item={item} />)
            )}

            {result.jigOffer && (
              <Link
                href={result.jigOffer.href}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 transition hover:border-emerald-400"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                  <Wrench className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">Build a ladder jig first?</p>
                  <p className="text-xs text-stone-400">
                    Every ladder frame square and identical — {formatPlanPrice(result.jigOffer.price)} for plan owners.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-emerald-400" />
              </Link>
            )}

            <Link
              href="/plans/checkout"
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 py-3 text-xs font-semibold text-stone-400 transition hover:border-slate-700 hover:text-stone-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Plans for another build
            </Link>
          </>
        )}

        <div className="border-t border-slate-800 pt-6 text-center">
          <p className="mb-2 text-xs text-stone-500">Questions about your build?</p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Question about my build plans")}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-stone-300 transition hover:border-yellow-400/50 hover:text-yellow-300"
          >
            <Mail className="h-3.5 w-3.5" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </main>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      }
    >
      <LibraryInner />
    </Suspense>
  );
}
