import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, FileText, Package } from "lucide-react";
import {
  checkChairPlanAccess,
  verifyChairPlanPurchase,
  verifyChairBundlePurchase,
  verifyChairTemplatePurchase,
} from "@/app/actions/chair-plans";
import TemplateUpsell from "./TemplateUpsell";

export default async function ChairPlansPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sessionId = typeof searchParams.session_id === "string" ? searchParams.session_id : null;
  const purchaseType = typeof searchParams.type === "string" ? searchParams.type : null;

  // Verify Stripe purchase if redirected back from checkout
  if (sessionId) {
    if (purchaseType === "bundle") {
      await verifyChairBundlePurchase(sessionId);
    } else if (purchaseType === "template") {
      await verifyChairTemplatePurchase(sessionId);
    } else {
      await verifyChairPlanPurchase(sessionId);
    }
  }

  const { hasAccess, hasTemplate } = await checkChairPlanAccess();
  if (!hasAccess) redirect("/dashboard/guides");

  const justPurchased = !!sessionId;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/dashboard/guides"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Low Boy Adirondack Chair
            </h1>
            <p className="text-[11px] text-stone-500">Build Plans</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">

        {/* ── Purchase success banner ─────────────────────────────── */}
        {justPurchased && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-bold text-emerald-300">
              {purchaseType === "bundle"
                ? "Bundle purchased! Plans unlocked below. Template will ship to the address you entered."
                : purchaseType === "template"
                ? "Template ordered! We'll ship it to the address you provided."
                : "Plans unlocked! Open your build guide below."}
            </p>
          </div>
        )}

        {/* ── Template upsell (plans-only purchasers) ─────────────── */}
        {!hasTemplate && <TemplateUpsell />}

        {/* ── Plans launcher card ─────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/5 blur-3xl" />

          <div className="relative p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
                <FileText className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Low Boy Adirondack Chair</p>
                <p className="text-[11px] text-amber-400/70">Pro Build Plans — Point-to-Point Profiles</p>
              </div>
            </div>

            <p className="mb-5 text-[13px] leading-relaxed text-stone-400">
              Your plans include a cover page, tools &amp; materials list, master cut list,
              point-to-point cut profiles for every piece, and a 6-step assembly guide.
            </p>

            <a
              href="/api/chair-plans"
              className="flex w-full items-center justify-between rounded-xl bg-amber-400 px-5 py-4 text-sm font-black text-gray-950 transition-all hover:bg-amber-300 active:scale-[0.98]"
            >
              <span>Open Build Plans</span>
              <ArrowRight className="h-5 w-5" />
            </a>

            <p className="mt-3 text-center text-[11px] text-stone-600">
              Opens in this tab · Use your browser&apos;s Print menu to save as PDF
            </p>
          </div>
        </section>

        {/* ── Template status (if purchased) ─────────────────────── */}
        {hasTemplate && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
            <Package className="h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-stone-300">1/2&quot; MDF Template Set — ordered</p>
              <p className="text-[10px] text-stone-500">Ships separately to your Stripe address</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
