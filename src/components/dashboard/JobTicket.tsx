"use client";

import { useMemo, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  DollarSign,
  Loader2,
  Mail,
  Package,
  TrendingUp,
  X,
} from "lucide-react";
import {
  calculateMaterialCost,
  type MaterialConfig,
} from "@/utils/calculateMaterials";
import { createPaymentSession, sendPaymentInvoice, markLeadAsPaid } from "@/app/actions/payments";

// ═══════════════════════════════════════════════════════════════════════════
// JobTicket — The "Money Shot" Financial Breakdown
//
// Layout:
//   ┌──────────┐  ┌──────────────────────┐  ┌──────────┐
//   │   EST.   │  │    AMOUNT TO COLLECT  │  │   EST.   │
//   │MATERIALS │  │       $X,XXX          │  │  PROFIT  │
//   │  (slate) │  │       (yellow)        │  │  (green) │
//   └──────────┘  └──────────────────────┘  └──────────┘
//                 ┌──────────────────────┐
//                 │      GET PAID        │
//                 └──────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

interface JobTicketProps {
  leadId: string;
  totalPrice: number;
  depositAmount: number;
  depositPaid: boolean;
  payoutStatus: string | null;
  quoteData: MaterialConfig[] | null;
  customerEmail: string | null;
  customerName: string;
  installerStripeId: string | null;
  onRefresh: () => void;
}

export default function JobTicket({
  leadId,
  totalPrice,
  depositAmount,
  depositPaid,
  payoutStatus,
  quoteData,
  customerEmail,
  customerName,
  installerStripeId,
  onRefresh,
}: JobTicketProps) {
  const [showPayMenu, setShowPayMenu] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // ── Derived financials ───────────────────────────────────────────────
  const balance = totalPrice - (depositPaid ? depositAmount : 0);
  const isPaid = payoutStatus === "paid";

  const materialBreakdown = useMemo(() => {
    if (!quoteData || quoteData.length === 0) return null;
    return calculateMaterialCost(quoteData);
  }, [quoteData]);

  const estMaterials = materialBreakdown?.totalCost ?? 0;
  const estProfit = Math.max(0, balance - estMaterials);

  // ── Payment handlers ─────────────────────────────────────────────────
  async function handlePayNow() {
    if (!installerStripeId) return;
    setPayLoading(true);
    const result = await createPaymentSession({
      leadId,
      amount: balance,
      installerStripeId,
      customerEmail: customerEmail || undefined,
    });
    setPayLoading(false);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    }
    setShowPayMenu(false);
  }

  async function handleSendInvoice() {
    if (!installerStripeId || !customerEmail) return;
    setPayLoading(true);
    await sendPaymentInvoice({
      leadId,
      amount: balance,
      installerStripeId,
      customerEmail,
      customerName,
      businessName: "The Shelf Dude",
    });
    setPayLoading(false);
    setShowPayMenu(false);
    onRefresh();
  }

  async function handleMarkPaid() {
    setPayLoading(true);
    await markLeadAsPaid(leadId);
    setPayLoading(false);
    setShowPayMenu(false);
    onRefresh();
  }

  // ── Format helper ────────────────────────────────────────────────────
  const fmt = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <section className="space-y-4">
      {/* ── 3-Box Layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Box 1: Est. Materials (slate) */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            <Package className="h-3 w-3" />
            Materials
          </div>
          <div className="text-xl font-black text-stone-300">
            {fmt(estMaterials)}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">estimated cost</div>
        </div>

        {/* Box 2: Amount to Collect (yellow — THE BIG NUMBER) */}
        <div className="rounded-xl border-2 border-yellow-400 bg-yellow-400/5 p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
            <DollarSign className="h-3 w-3" />
            Collect
          </div>
          <div className="text-3xl font-black text-white">
            {fmt(balance)}
          </div>
          <div className="mt-1 text-[10px] text-stone-500">
            {depositPaid ? "deposit applied" : "before deposit"}
          </div>
        </div>

        {/* Box 3: Est. Profit (green) */}
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/5 p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            Profit
          </div>
          <div className="text-xl font-black text-emerald-400">
            {fmt(estProfit)}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">estimated net</div>
        </div>
      </div>

      {/* ── Breakdown row ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-6 text-xs text-stone-500">
        <span>
          Total:{" "}
          <span className="font-bold text-white">{fmt(totalPrice)}</span>
        </span>
        <span>
          Deposit (15%):{" "}
          <span className="font-bold text-emerald-400">
            -{fmt(depositAmount)}
          </span>
        </span>
      </div>

      {/* ── GET PAID Button / PAID Badge ──────────────────────────────── */}
      {isPaid ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-black uppercase tracking-wider text-emerald-400">
            PAID
          </span>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setShowPayMenu((v) => !v)}
            disabled={payLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98] disabled:opacity-50"
          >
            {payLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-6 w-6" />
                GET PAID
              </>
            )}
          </button>

          {/* Dropdown menu */}
          {showPayMenu && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
              <button
                onClick={() => setShowPayMenu(false)}
                className="absolute right-2 top-2 text-stone-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleSendInvoice}
                disabled={!customerEmail || payLoading}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                <Mail className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Send Invoice</p>
                  <p className="text-[11px] text-stone-500">
                    Email payment link to customer
                  </p>
                </div>
              </button>
              <button
                onClick={handlePayNow}
                disabled={payLoading}
                className="flex w-full items-center gap-3 border-t border-slate-700 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                <CreditCard className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Pay Now</p>
                  <p className="text-[11px] text-stone-500">
                    Open Stripe Checkout in new tab
                  </p>
                </div>
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={payLoading}
                className="flex w-full items-center gap-3 border-t border-slate-700 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Mark as Paid</p>
                  <p className="text-[11px] text-stone-500">
                    Manual confirmation (cash/check)
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Material Breakdown (expandable) ──────────────────────────── */}
      {materialBreakdown && materialBreakdown.items.length > 0 && (
        <details className="group rounded-xl border border-slate-800 bg-slate-900">
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Material Cost Breakdown
          </summary>
          <div className="border-t border-slate-800 px-4 py-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-600">
                  <th className="pb-2 text-left font-semibold">Item</th>
                  <th className="pb-2 text-center font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Unit</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {materialBreakdown.items.map((item) => (
                  <tr key={item.name} className="border-t border-slate-800/50">
                    <td className="py-1.5 text-stone-300">{item.name}</td>
                    <td className="py-1.5 text-center font-mono text-stone-400">
                      {item.qty}
                    </td>
                    <td className="py-1.5 text-right font-mono text-stone-500">
                      ${item.unitCost.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold text-white">
                      ${item.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td colSpan={3} className="pt-2 text-right font-bold text-stone-400">
                    Total Materials
                  </td>
                  <td className="pt-2 text-right font-mono font-black text-yellow-400">
                    ${materialBreakdown.totalCost.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
