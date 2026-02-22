"use client";

import { useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
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
import { createPaymentSession, sendPaymentInvoice } from "@/app/actions/payments";
import { uploadJobPhoto } from "@/app/actions/photo-upload";
import { rescheduleJob, completeJob, completeJobWithProof, markJobPaidManual } from "@/app/actions/jobs";

// ═══════════════════════════════════════════════════════════════════════════
// JobTicket — Hybrid POS Payment Flow
//
// Flow:
//   1. COMPLETE JOB → Snap Photo → triggers invoice email → PAYMENT_PENDING
//   2. Payment Collection: Enter Card / Resend Invoice / Mark Paid (Manual)
//   3. Job moves to "Past Jobs" ONLY when paid
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
  source?: string | null;
  isPro?: boolean;
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
  source,
  isPro,
  onRefresh,
  onStatusChange,
}: JobTicketProps) {
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showManualPayModal, setShowManualPayModal] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(photoUrl);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [manualPayMethod, setManualPayMethod] = useState("cash");
  const [showGetPaidMenu, setShowGetPaidMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Cut List Checkbox State (persisted to localStorage) ────────────────
  const storageKey = `cutlist-${leadId}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function toggleItem(itemName: string) {
    setCheckedItems((prev) => {
      const next = { ...prev, [itemName]: !prev[itemName] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

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
        source: source ?? undefined,
        isPro,
      }),
    [totalPrice, estMaterials, feeStatus, source, isPro]
  );

  const isPaid = status === "paid";
  // Show GET PAID panel if status is payment_pending OR if proof photo exists (fallback)
  const isPaymentPending = status === "payment_pending" || (!!uploadedPhotoUrl && status !== "paid");
  const isActive = !isPaid && !isPaymentPending && status !== "completed";
  const fmt = formatCurrency;

  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Client-side image compression (max 1920px, JPEG 0.8) ──────────────
  async function compressImage(file: File): Promise<File> {
    const MAX_DIM = 1920;
    const QUALITY = 0.8;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= MAX_DIM && height <= MAX_DIM) {
          resolve(file);
          return;
        }
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          QUALITY
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  // ── Photo upload handler ──────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setUploadError(null);

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("photo", compressed);

      const result = await uploadJobPhoto(leadId, formData);

      if (result.success && result.publicUrl) {
        setUploadedPhotoUrl(result.publicUrl);

        // ── AUTO-SEND: Immediately trigger invoice email & set payment_pending ──
        setPayLoading(true);
        let paymentUrl: string | undefined;
        if (installerStripeId) {
          const session = await createPaymentSession({
            leadId,
            amount: profit.amountToCollect,
            installerStripeId,
            customerEmail: customerEmail || undefined,
          });
          if (session.success && session.url) {
            paymentUrl = session.url;
          }
        }
        await completeJobWithProof(
          leadId,
          result.publicUrl,
          customerEmail,
          customerName,
          profit.amountToCollect,
          paymentUrl
        );
        setPayLoading(false);
        setShowCompletionModal(false);
        onStatusChange?.("payment_pending");
        onRefresh();
      } else {
        setUploadError(result.error || "Photo too large or network error. Please retry.");
        console.error("[JobTicket] Photo upload error:", result.error);
      }
    } catch (err) {
      setUploadError("Photo too large or network error. Please retry.");
      console.error("[JobTicket] Photo upload exception:", err);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Complete job with proof → triggers invoice email → payment_pending ──
  async function handleCompleteWithProof() {
    if (!uploadedPhotoUrl) return;
    setPayLoading(true);

    // Optionally create a Stripe payment URL for the invoice email
    let paymentUrl: string | undefined;
    if (installerStripeId) {
      const session = await createPaymentSession({
        leadId,
        amount: profit.amountToCollect,
        installerStripeId,
        customerEmail: customerEmail || undefined,
      });
      if (session.success && session.url) {
        paymentUrl = session.url;
      }
    }

    await completeJobWithProof(
      leadId,
      uploadedPhotoUrl,
      customerEmail,
      customerName,
      profit.amountToCollect,
      paymentUrl
    );

    setPayLoading(false);
    setShowCompletionModal(false);
    onStatusChange?.("payment_pending");
    onRefresh();
  }

  // ── Payment Collection: Enter Card (opens Stripe in new tab) ──────────
  async function handleEnterCard() {
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
  }

  // ── Payment Collection: Resend Invoice Email ──────────────────────────
  async function handleResendInvoice() {
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
    onRefresh();
  }

  // ── Payment Collection: Mark Paid Manually (cash/venmo/check) ─────────
  async function handleMarkPaidManual() {
    setPayLoading(true);
    await markJobPaidManual(leadId, manualPayMethod);
    setPayLoading(false);
    setShowManualPayModal(false);
    onStatusChange?.("paid");
    onRefresh();
  }

  // ── Send payment link via SMS ─────────────────────────────────────────
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
      const smsBody = encodeURIComponent(
        `Your payment of ${fmt(profit.amountToCollect)} is ready: ${result.url}`
      );
      window.open(`sms:${customerPhone}?body=${smsBody}`, "_self");
    }
  }

  // ── Simple Complete Job (no photo required) ─────────────────────────────
  async function handleCompleteJob() {
    setPayLoading(true);
    await completeJob(leadId);
    setPayLoading(false);
    onStatusChange?.("payment_pending");
    onRefresh();
  }

  // ── Reschedule ────────────────────────────────────────────────────────
  async function handleReschedule() {
    if (!rescheduleDate) return;
    setRescheduling(true);
    await rescheduleJob(leadId, rescheduleDate, customerEmail || "", customerName);
    setRescheduling(false);
    setShowRescheduleModal(false);
    setRescheduleDate("");
    onRefresh();
  }

  return (
    <section className="space-y-4">
      {/* ── Source + Fee Badge ────────────────────────────────────── */}
      {(source === "partner_link" || source === "installer_manual") && isPro ? (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            DIRECT LEAD — 5% PRO FEE
          </span>
        </div>
      ) : (source === "partner_link" || source === "installer_manual") ? (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-400/15 px-3 py-1 text-[11px] font-bold text-purple-400">
            Direct Lead — 15% Fee
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/15 px-3 py-1 text-[11px] font-bold text-blue-400">
            Network Lead — 15% Fee
          </span>
        </div>
      )}

      {/* ── 3-Box Layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Box 1: Est. Materials (slate) */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            <Package className="h-3 w-3" />
            Materials
          </div>
          <div className="text-base font-black text-stone-300 sm:text-lg">
            {fmt(profit.estMaterials)}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">estimated cost</div>
        </div>

        {/* Box 2: Amount to Collect (yellow — THE BIG NUMBER) */}
        <div className="rounded-xl border-2 border-yellow-400 bg-yellow-400/5 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
            <DollarSign className="h-3 w-3" />
            Collect
          </div>
          <div className="text-lg font-black text-white sm:text-xl">
            {fmt(profit.amountToCollect)}
          </div>
          <div className="mt-1 text-[10px] text-stone-500">
            {profit.feeWaived ? "after 5% fee (Pro)" : "after deposit"}
          </div>
        </div>

        {/* Box 3: Net Profit (green) */}
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/5 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            Net Profit
          </div>
          <div className="text-base font-black text-emerald-400 sm:text-lg">
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
        <span>
          {profit.feeLabel}:{" "}
          <span className="font-bold text-emerald-400">
            -{fmt(profit.depositAmount)}
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
      ) : isPaymentPending ? (
        /* ── PAYMENT PENDING — GET PAID button + dropdown ─────────── */
        <div className="relative space-y-3">
          {/* Invoice sent badge */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2">
            <Mail className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Invoice Sent — Awaiting Payment
            </span>
          </div>

          {/* GET PAID button */}
          <button
            onClick={() => setShowGetPaidMenu(!showGetPaidMenu)}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98]"
          >
            <DollarSign className="h-6 w-6" />
            GET PAID — {fmt(profit.amountToCollect)}
            <ChevronDown className={`h-5 w-5 transition-transform ${showGetPaidMenu ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          {showGetPaidMenu && (
            <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
              {/* Enter Card Details — opens Stripe Checkout in new tab */}
              <button
                onClick={handleEnterCard}
                disabled={payLoading || !installerStripeId}
                className="flex w-full items-center gap-3 rounded-lg bg-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                ) : (
                  <CreditCard className="h-5 w-5 text-yellow-400" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">Manual Card Entry</p>
                  <p className="text-[11px] text-stone-500">
                    Open Stripe — type in customer&apos;s card
                  </p>
                </div>
              </button>

              {/* Resend Invoice Email */}
              <button
                onClick={handleResendInvoice}
                disabled={payLoading || !customerEmail}
                className="flex w-full items-center gap-3 rounded-lg bg-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                <Mail className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Resend Invoice Email</p>
                  <p className="text-[11px] text-stone-500">
                    Re-send payment link to {customerEmail || "customer"}
                  </p>
                </div>
              </button>

              {/* Send to Phone */}
              {customerPhone && (
                <button
                  onClick={handleSendToPhone}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg bg-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
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

              {/* Mark Paid (Manual) */}
              <button
                onClick={() => { setShowGetPaidMenu(false); setShowManualPayModal(true); }}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Mark Paid (Cash/Venmo/Check)</p>
                  <p className="text-[11px] text-stone-500">
                    Manual confirmation — close the job
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : isActive ? (
        /* ── COMPLETE JOB button (transitions directly to payment) ──────────────── */
        <button
          onClick={handleCompleteJob}
          disabled={payLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98] disabled:opacity-50"
        >
          {payLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="h-6 w-6" />
              COMPLETE JOB
            </>
          )}
        </button>
      ) : null}

      {/* ── Completion Photo (if exists) ─────────────────────────────── */}
      {uploadedPhotoUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <NextImage
            src={uploadedPhotoUrl}
            alt="Completed installation"
            width={400}
            height={240}
            className="w-full object-cover"
            style={{ maxHeight: 240 }}
            unoptimized
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

      {/* ── Interactive Cut List (expandable) ──────────────────────────── */}
      {materialBreakdown && materialBreakdown.items.length > 0 && (
        <details className="group rounded-xl border border-slate-800 bg-slate-900" open={!isPaid}>
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Cut List &amp; Materials
            {Object.values(checkedItems).filter(Boolean).length > 0 && (
              <span className="ml-2 text-emerald-400">
                ({Object.values(checkedItems).filter(Boolean).length}/{materialBreakdown.items.length})
              </span>
            )}
          </summary>
          <div className="border-t border-slate-800">
            {materialBreakdown.items.map((item) => {
              const isChecked = !!checkedItems[item.name];
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => toggleItem(item.name)}
                  className={`flex w-full items-center gap-3 border-b border-slate-800/50 px-4 py-3 text-left transition-colors last:border-b-0 ${
                    isChecked ? "bg-slate-800/30" : "hover:bg-slate-800/50"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      isChecked
                        ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                        : "border-slate-600 text-transparent"
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>

                  {/* Item details */}
                  <div className={`min-w-0 flex-1 ${isChecked ? "opacity-40" : ""}`}>
                    <span className={`text-xs font-semibold ${isChecked ? "text-stone-500 line-through" : "text-stone-300"}`}>
                      {item.name}
                    </span>
                  </div>

                  {/* Qty */}
                  <span className={`rounded-md px-2 py-0.5 text-xs font-mono font-bold ${isChecked ? "bg-transparent text-stone-600 line-through opacity-40" : "bg-yellow-400/15 text-yellow-400"}`}>
                    x{item.qty}
                  </span>

                  {/* Price */}
                  <span className={`text-xs font-mono font-bold ${isChecked ? "text-stone-600 line-through opacity-40" : "text-white"}`}>
                    ${item.subtotal.toFixed(2)}
                  </span>
                </button>
              );
            })}

            {/* Total row */}
            <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
              <span className="text-xs font-bold text-stone-400">Total Materials</span>
              <span className="text-xs font-mono font-black text-yellow-400">
                ${materialBreakdown.totalCost.toFixed(2)}
              </span>
            </div>
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
                    <NextImage
                      src={uploadedPhotoUrl}
                      alt="Completion photo"
                      width={400}
                      height={200}
                      className="w-full object-cover"
                      style={{ maxHeight: 200 }}
                      unoptimized
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
                {uploadError && (
                  <p className="mt-2 text-center text-xs font-semibold text-red-400">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Auto-send note */}
              {!uploadedPhotoUrl && !uploadingPhoto && !payLoading && (
                <p className="text-center text-xs text-stone-600">
                  Upload a photo to auto-send the invoice
                </p>
              )}
              {payLoading && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                  <p className="text-xs font-semibold text-yellow-400">Sending invoice...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Pay Confirmation Modal ─────────────────────────────── */}
      {showManualPayModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Confirm Payment</h3>
              <button
                onClick={() => setShowManualPayModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-stone-400">
                Mark this job as paid for <span className="font-bold text-white">{fmt(profit.amountToCollect)}</span>?
              </p>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Payment Method
                </label>
                <select
                  value={manualPayMethod}
                  onChange={(e) => setManualPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="check">Check</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                onClick={handleMarkPaidManual}
                disabled={payLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
              >
                {payLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Paid
                  </>
                )}
              </button>
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
