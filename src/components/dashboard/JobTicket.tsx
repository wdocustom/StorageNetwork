"use client";

import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  calculateMaterialCost,
  type MaterialConfig,
} from "@/utils/calculateMaterials";
import {
  calculateNetProfit,
  formatCurrency,
} from "@/utils/paymentHelpers";
import { createPaymentSession, sendPaymentInvoice, markLeadAsPaid } from "@/app/actions/payments";
import { uploadJobPhoto } from "@/app/actions/photo-upload";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════════════════
// JobTicket — True Profit Financial Breakdown + Photo-Verified Completion
//
// Layout:
//   ┌──────────┐  ┌──────────────────────┐  ┌──────────┐
//   │   EST.   │  │   AMOUNT TO COLLECT   │  │   NET    │
//   │MATERIALS │  │       $745            │  │  PROFIT  │
//   │  (slate) │  │       (yellow)        │  │  (green) │
//   └──────────┘  └──────────────────────┘  └──────────┘
//
// Flow: Complete Job → Snap Photo → Upload → Choose Payment → PAID
// ═══════════════════════════════════════════════════════════════════════════

interface JobTicketProps {
  leadId: string;
  totalPrice: number;
  depositAmount: number;
  depositPaid: boolean;
  payoutStatus: string | null;
  status: string;
  feeStatus: "standard" | "waived";
  photoUrl: string | null;
  quoteData: MaterialConfig[] | null;
  customerEmail: string | null;
  customerName: string;
  customerPhone?: string | null;
  scheduledAt?: string | null;
  installerStripeId: string | null;
  onRefresh: () => void;
  onStatusChange?: (newStatus: string) => void;
}

export default function JobTicket({
  leadId,
  totalPrice,
  depositAmount,
  depositPaid,
  payoutStatus,
  status,
  feeStatus,
  photoUrl,
  quoteData,
  customerEmail,
  customerName,
  customerPhone,
  scheduledAt,
  installerStripeId,
  onRefresh,
  onStatusChange,
}: JobTicketProps) {
  const supabase = getSupabaseBrowserClient();

  const [showPayMenu, setShowPayMenu] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(photoUrl);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Material calculation ─────────────────────────────────────────────
  const materialBreakdown = useMemo(() => {
    if (!quoteData || quoteData.length === 0) return null;
    return calculateMaterialCost(quoteData);
  }, [quoteData]);

  const estMaterials = materialBreakdown?.totalCost ?? 0;

  // ── True Profit Calculation ──────────────────────────────────────────
  const profit = useMemo(
    () =>
      calculateNetProfit({
        totalPrice,
        materialCost: estMaterials,
        feeStatus,
      }),
    [totalPrice, estMaterials, feeStatus]
  );

  const isPaid = payoutStatus === "paid";
  const isCompleted = status === "completed" || status === "paid";
  const fmt = formatCurrency;

  // ── Photo upload handler (via server action — ensures bucket exists) ──
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);

    const formData = new FormData();
    formData.append("photo", file);

    const result = await uploadJobPhoto(leadId, formData);

    if (result.success && result.publicUrl) {
      setUploadedPhotoUrl(result.publicUrl);
    } else {
      console.error("[JobTicket] Photo upload error:", result.error);
    }

    setUploadingPhoto(false);
  }

  // ── Complete job handler ─────────────────────────────────────────────
  async function handleCompleteJob() {
    setPayLoading(true);
    await supabase
      .from("leads")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    setPayLoading(false);
    onStatusChange?.("completed");
    onRefresh();
  }

  // ── Payment handlers ─────────────────────────────────────────────────
  async function handlePayNow() {
    if (!installerStripeId) return;
    setPayLoading(true);
    const result = await createPaymentSession({
      leadId,
      amount: profit.amountToCollect,
      installerStripeId,
      customerEmail: customerEmail || undefined,
    });
    setPayLoading(false);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    }
    setShowPayMenu(false);
    setShowCompletionModal(false);
  }

  async function handleSendInvoice() {
    if (!installerStripeId || !customerEmail) return;
    setPayLoading(true);
    await sendPaymentInvoice({
      leadId,
      amount: profit.amountToCollect,
      installerStripeId,
      customerEmail,
      customerName,
      businessName: "Storage Network",
    });
    setPayLoading(false);
    setShowPayMenu(false);
    setShowCompletionModal(false);
    onRefresh();
  }

  async function handleSendToPhone() {
    if (!customerPhone || !installerStripeId) return;
    setPayLoading(true);
    const result = await createPaymentSession({
      leadId,
      amount: profit.amountToCollect,
      installerStripeId,
      customerEmail: customerEmail || undefined,
    });
    setPayLoading(false);
    if (result.success && result.url) {
      // Send via SMS link
      const smsBody = encodeURIComponent(
        `Your payment of ${fmt(profit.amountToCollect)} is ready: ${result.url}`
      );
      window.open(`sms:${customerPhone}?body=${smsBody}`, "_self");
    }
    setShowPayMenu(false);
    setShowCompletionModal(false);
  }

  async function handleMarkPaid() {
    setPayLoading(true);
    await markLeadAsPaid(leadId);
    setPayLoading(false);
    setShowPayMenu(false);
    setShowCompletionModal(false);
    onStatusChange?.("paid");
    onRefresh();
  }

  async function handleReschedule() {
    if (!rescheduleDate) return;
    setRescheduling(true);
    await supabase
      .from("leads")
      .update({ scheduled_at: rescheduleDate, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    setRescheduling(false);
    setShowRescheduleModal(false);
    setRescheduleDate("");
    onRefresh();
  }

  return (
    <section className="space-y-4">
      {/* ── Waived Fee Pill ──────────────────────────────────────────── */}
      {profit.feeWaived && (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/15 px-3 py-1 text-[11px] font-bold text-yellow-400">
            <CheckCircle2 className="h-3 w-3" />
            Waived Fee — Pro
          </span>
        </div>
      )}

      {/* ── 3-Box Layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Box 1: Est. Materials (slate) */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            <Package className="h-3 w-3" />
            Materials
          </div>
          <div className="text-xl font-black text-stone-300">
            {fmt(profit.estMaterials)}
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
            {fmt(profit.amountToCollect)}
          </div>
          <div className="mt-1 text-[10px] text-stone-500">
            {profit.feeWaived ? "no deposit (Pro)" : "after deposit"}
          </div>
        </div>

        {/* Box 3: Net Profit (green) */}
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/5 p-4 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            Net Profit
          </div>
          <div className="text-xl font-black text-emerald-400">
            {fmt(profit.netProfit)}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">after materials</div>
        </div>
      </div>

      {/* ── Breakdown row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-stone-500">
        <span>
          Total:{" "}
          <span className="font-bold text-white">{fmt(profit.totalPrice)}</span>
        </span>
        {!profit.feeWaived && (
          <span>
            Deposit (15%):{" "}
            <span className="font-bold text-emerald-400">
              -{fmt(profit.depositAmount)}
            </span>
          </span>
        )}
        <span>
          Materials:{" "}
          <span className="font-bold text-stone-300">
            -{fmt(profit.estMaterials)}
          </span>
        </span>
      </div>

      {/* ── Action Button Area ────────────────────────────────────────── */}
      {isPaid ? (
        /* ── PAID badge ───────────────────────────────────────────── */
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-black uppercase tracking-wider text-emerald-400">
            PAID
          </span>
        </div>
      ) : !isCompleted ? (
        /* ── COMPLETE JOB button (opens photo modal) ──────────────── */
        <button
          onClick={() => setShowCompletionModal(true)}
          disabled={payLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98] disabled:opacity-50"
        >
          {payLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Camera className="h-6 w-6" />
              COMPLETE JOB
            </>
          )}
        </button>
      ) : (
        /* ── GET PAID button (job already completed, awaiting payment) */
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

          {showPayMenu && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
              <button
                onClick={() => setShowPayMenu(false)}
                className="absolute right-2 top-2 text-stone-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              {customerPhone && (
                <button
                  onClick={handleSendToPhone}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
                >
                  <Phone className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Send to Phone</p>
                    <p className="text-[11px] text-stone-500">
                      SMS payment link to customer
                    </p>
                  </div>
                </button>
              )}
              <button
                onClick={handleSendInvoice}
                disabled={!customerEmail || payLoading}
                className="flex w-full items-center gap-3 border-t border-slate-700 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
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

      {/* ── Completion Photo (if exists) ─────────────────────────────── */}
      {uploadedPhotoUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <img
            src={uploadedPhotoUrl}
            alt="Completed installation"
            className="w-full object-cover"
            style={{ maxHeight: 240 }}
          />
          <div className="bg-slate-900 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Proof of Completion
          </div>
        </div>
      )}

      {/* ── Contact Buttons ───────────────────────────────────────────── */}
      {!isPaid && (
        <div className="grid grid-cols-3 gap-2">
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-blue-400/50 hover:text-blue-400"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          )}
          {customerPhone && (
            <a
              href={`sms:${customerPhone}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-400"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Text
            </a>
          )}
          {scheduledAt && (
            <button
              onClick={() => setShowRescheduleModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-yellow-400/50 hover:text-yellow-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              Reschedule
            </button>
          )}
        </div>
      )}

      {/* ── Scheduled Date Display ─────────────────────────────────────── */}
      {scheduledAt && (
        <div className="rounded-lg bg-slate-800 px-3 py-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Scheduled{" "}
          </span>
          <span className="text-xs font-bold text-yellow-400">
            {new Date(scheduledAt + (scheduledAt.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
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

      {/* ── Photo Completion Modal ───────────────────────────────────── */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Complete Job</h3>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Step A: Photo */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                  Step 1 — Proof of Work
                </p>
                {uploadedPhotoUrl ? (
                  <div className="overflow-hidden rounded-xl border border-emerald-600/40">
                    <img
                      src={uploadedPhotoUrl}
                      alt="Completion photo"
                      className="w-full object-cover"
                      style={{ maxHeight: 200 }}
                    />
                    <div className="flex items-center justify-center gap-1 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Photo uploaded
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 py-8 text-stone-400 transition-colors hover:border-yellow-400/50 hover:text-yellow-400 disabled:opacity-50"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8" />
                        <span className="text-sm font-semibold">Snap Photo</span>
                        <span className="text-[11px] text-stone-600">
                          Opens camera on mobile
                        </span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {!uploadedPhotoUrl && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-stone-400 transition-colors hover:text-white disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    Or upload from gallery
                  </button>
                )}
              </div>

              {/* Step B: Payment (visible once photo is uploaded) */}
              {uploadedPhotoUrl ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                    Step 2 — Collect Payment
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        await handleCompleteJob();
                        handleMarkPaid();
                      }}
                      disabled={payLoading}
                      className="flex w-full items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3.5 text-left transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <DollarSign className="h-5 w-5 text-white" />
                      <div>
                        <p className="text-sm font-bold text-white">Cash / Check</p>
                        <p className="text-[11px] text-emerald-200/70">
                          Mark as paid — received {fmt(profit.amountToCollect)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        await handleCompleteJob();
                        handlePayNow();
                      }}
                      disabled={payLoading}
                      className="flex w-full items-center gap-3 rounded-xl bg-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      <CreditCard className="h-5 w-5 text-yellow-400" />
                      <div>
                        <p className="text-sm font-bold text-white">Card Payment</p>
                        <p className="text-[11px] text-stone-500">
                          Open Stripe Checkout for {fmt(profit.amountToCollect)}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-stone-600">
                  Upload a photo to unlock payment options
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ───────────────────────────────────────────── */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Reschedule Job</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleDate || rescheduling}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-slate-900 transition-all hover:bg-yellow-400 disabled:opacity-50"
              >
                {rescheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Confirm Reschedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
