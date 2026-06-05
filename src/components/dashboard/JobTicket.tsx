"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import {
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Ruler,
  Link,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  X,
  PenLine,
  Zap,
} from "lucide-react";
import type { MaterialConfig, MaterialBreakdown, MaterialPrices } from "@/utils/calculateMaterials";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import type { BuildManifest } from "@/lib/buildEngine.types";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import {
  calculateNetPurchaseList,
  normalizeInventory,
  type MaterialInventory,
  type NetPurchaseResult,
} from "@/utils/inventoryManager";
import { toFraction } from "@/lib/utils";
import { formatCurrency } from "@/utils/paymentHelpers";
import { getNetProfit, getSalesTax, type NetProfitResult } from "@/app/actions/fee-engine";
import { createPaymentSession, sendPaymentInvoice, chargeBalanceOffSession } from "@/app/actions/payments";
import { validateDiscountCode, type DiscountValidationResult } from "@/app/actions/discount-codes";
import ModuleDiagram, { getBuildOrderColors } from "@/components/dashboard/ModuleDiagram";
import { createRacksForJob, getRacksForJob, emailRackLink, type InventoryRack } from "@/app/actions/tote-inventory";
import LockedBlueprintsTeaser from "@/components/dashboard/LockedBlueprintsTeaser";
import { uploadJobPhoto } from "@/app/actions/photo-upload";
import { roundMoney } from "@/utils/mathHelpers";
import { rescheduleJob, scheduleJob, completeJob, completeJobWithProof, markJobPaidManual, deleteUnpaidQuote } from "@/app/actions/jobs";

// ═══════════════════════════════════════════════════════════════════════════
// JobTicket — Hybrid POS Payment Flow
//
// Flow:
//   1. COMPLETE JOB → Snap Photo → PAYMENT_PENDING (no auto-email)
//   2. Payment Collection: Enter Card / Email Customer / Copy Link / Mark Paid (Manual)
//   3. Job moves to "Past Jobs" ONLY when paid
// ═══════════════════════════════════════════════════════════════════════════

interface JobTicketProps {
  leadId: string;
  totalPrice: number;
  depositAmount: number;
  depositPaid: boolean;
  payoutStatus: string | null;
  status: string;
  photoUrl: string | null;
  quoteData: MaterialConfig[] | null;
  customerEmail: string | null;
  customerName: string;
  customerPhone?: string | null;
  scheduledAt?: string | null;
  timePreference?: string | null;
  installerStripeId?: string | null; // Deprecated — server actions look up Stripe account directly
  source?: string | null;
  inventory?: MaterialInventory | null;
  customMaterialPrices?: MaterialPrices;
  salesTaxAmount?: number | null;
  addressState?: string | null;
  installerId?: string | null;
  reviewToken?: string | null;
  reviewSubmitted?: boolean;
  use2x4Rails?: boolean;
  /** Discount code saved at quote creation (auto-populated in UI) */
  savedDiscountCode?: string | null;
  /** Discount amount already applied at quote creation */
  savedDiscountAmount?: number | null;
  /** True when the deposit was taken with setup_future_usage and a card is on file. */
  hasSavedCard?: boolean;
  /** Card brand from Stripe (e.g. "visa", "mastercard") for installer-side display. */
  savedCardBrand?: string | null;
  /** Last 4 digits of the saved card. */
  savedCardLast4?: string | null;
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
  photoUrl,
  quoteData,
  customerEmail,
  customerName,
  customerPhone,
  scheduledAt,
  timePreference,
  installerStripeId,
  source,
  inventory,
  customMaterialPrices,
  salesTaxAmount,
  addressState,
  installerId,
  reviewToken,
  reviewSubmitted,
  use2x4Rails,
  savedDiscountCode,
  savedDiscountAmount,
  hasSavedCard = false,
  savedCardBrand,
  savedCardLast4,
  onRefresh,
  onStatusChange,
}: JobTicketProps) {
  // Pretty card label, e.g. "Visa •••• 4242". Falls back to "Card on file"
  // when Stripe didn't return brand/last4 (legacy deposits, fetch failure).
  const savedCardLabel = (() => {
    if (!savedCardLast4) return "Card on file";
    const brand = savedCardBrand
      ? savedCardBrand.charAt(0).toUpperCase() + savedCardBrand.slice(1).replace(/_/g, " ")
      : "Card";
    return `${brand} •••• ${savedCardLast4}`;
  })();
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showManualPayModal, setShowManualPayModal] = useState(false);
  const [showChargeCardConfirm, setShowChargeCardConfirm] = useState(false);
  // When off-session charge needs 3DS or the card is missing, the server
  // returns a fallback Checkout URL the installer can hand to the customer.
  const [chargeCardFallbackUrl, setChargeCardFallbackUrl] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(photoUrl);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [manualPayMethod, setManualPayMethod] = useState("cash");
  const [showGetPaidMenu, setShowGetPaidMenu] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Review State ─────────────────────────────────────────────────────
  const [reviewEmailing, setReviewEmailing] = useState(false);
  const [reviewCopying, setReviewCopying] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(!!reviewToken);
  const [reviewDone, setReviewDone] = useState(!!reviewSubmitted);
  const [reviewSendSuccess, setReviewSendSuccess] = useState(false);
  const [reviewLink, setReviewLink] = useState(reviewToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/review/${reviewToken}` : "");
  const [reviewLinkCopied, setReviewLinkCopied] = useState(false);

  // ── Inventory QR State ────────────────────────────────────────────────
  const [inventoryRacks, setInventoryRacks] = useState<InventoryRack[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryCreating, setInventoryCreating] = useState(false);
  const [inventoryEmailing, setInventoryEmailing] = useState<string | null>(null);
  const [inventoryEmailSent, setInventoryEmailSent] = useState<string | null>(null);

  // ── Discount Code State ─────────────────────────────────────────────────
  const [discountInput, setDiscountInput] = useState(savedDiscountCode || "");
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountResult, setDiscountResult] = useState<DiscountValidationResult | null>(
    savedDiscountAmount && savedDiscountAmount > 0 && savedDiscountCode
      ? { valid: true, discountAmount: savedDiscountAmount, code: savedDiscountCode }
      : null
  );
  const appliedDiscount = discountResult?.valid ? discountResult.discountAmount : 0;

  // Auto-validate discount codes from old quotes where discount_amount wasn't calculated
  useEffect(() => {
    if (savedDiscountCode && (!savedDiscountAmount || savedDiscountAmount <= 0) && installerId && !discountResult) {
      validateDiscountCode(savedDiscountCode, installerId, totalPrice, { noDepositCap: !depositPaid })
        .then((result) => {
          if (result.valid) setDiscountResult(result);
        });
    }
  }, [savedDiscountCode, savedDiscountAmount, installerId, totalPrice, depositPaid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On-the-fly sales tax for unpaid quotes (salesTaxAmount is null) ─────
  const [computedTax, setComputedTax] = useState<number>(0);
  useEffect(() => {
    if (salesTaxAmount == null && addressState && totalPrice > 0) {
      getSalesTax(totalPrice, addressState, installerId || undefined).then((r) => setComputedTax(r.taxAmount));
    }
  }, [salesTaxAmount, addressState, totalPrice, installerId]);

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

  // ── Material calculation (server action) — uses custom pricing + inventory ──
  const [materialBreakdown, setMaterialBreakdown] = useState<MaterialBreakdown | null>(null);
  useEffect(() => {
    if (!quoteData || quoteData.length === 0) { setMaterialBreakdown(null); return; }
    calculateMaterialCostServer(quoteData, customMaterialPrices, inventory).then(setMaterialBreakdown).catch(() => {});
  }, [quoteData, customMaterialPrices, inventory]);

  // ── Build manifest (shopping list + cut plans) ─────────────────────
  const [buildManifest, setBuildManifest] = useState<BuildManifest | null>(null);
  useEffect(() => {
    if (!quoteData || quoteData.length === 0) { setBuildManifest(null); return; }
    generateBuildManifestServer(quoteData as import("@/lib/buildEngine.types").QuoteUnit[])
      .then(setBuildManifest)
      .catch(() => setBuildManifest(null));
  }, [quoteData]);

  // ── Net purchase list (inventory-aware) ──────────────────────────────
  const netPurchase: NetPurchaseResult | null = useMemo(() => {
    if (!materialBreakdown?.rawCounts) return null;
    const inv = normalizeInventory(inventory);
    return calculateNetPurchaseList(materialBreakdown.rawCounts, inv);
  }, [materialBreakdown, inventory]);

  const estMaterials = materialBreakdown?.totalCost ?? 0;

  // Indoor delivery total from quote units
  const indoorDeliveryTotal = useMemo(() => {
    if (!quoteData) return 0;
    return (quoteData as any[]).reduce((sum, u) =>
      sum + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee * (u.quantity || 1) : 0), 0);
  }, [quoteData]);

  // ── True Profit Calculation (server-side, black box) ─────────────────
  const [profit, setProfit] = useState<NetProfitResult>({
    totalPrice, depositAmount: 0, feeAmount: 0,
    customerBalance: totalPrice, installerTakeHome: totalPrice,
    amountToCollect: totalPrice,
    estMaterials, netProfit: 0, feeRate: 0, feeLabel: "",
  });
  useEffect(() => {
    getNetProfit({
      totalPrice,
      materialCost: estMaterials,
      source: source ?? undefined,
      installerId: installerId ?? undefined,
      actualDepositAmount: depositAmount > 0 ? depositAmount : undefined,
    }).then(setProfit);
  }, [totalPrice, estMaterials, source, installerId, depositAmount]);

  // Amount the customer actually owes = balance + sales tax - discount
  // When deposit was never paid, collect the FULL price (not just balance)
  // Use computedTax for unpaid quotes where salesTaxAmount wasn't stored
  const tax = salesTaxAmount ?? computedTax;
  const collectFromCustomer = depositPaid
    ? roundMoney(profit.customerBalance + tax - appliedDiscount)
    : roundMoney(totalPrice + tax - appliedDiscount);

  const isPaid = status === "paid";
  // Show GET PAID panel if status is payment_pending OR if proof photo exists (fallback)
  const isPaymentPending = status === "payment_pending" || (!!uploadedPhotoUrl && status !== "paid");
  // Unpaid quote: deposit never paid, allow collecting full payment on delivery
  const isUnpaidQuote = !depositPaid && status === "pending_payment";
  const isActive = !isPaid && !isPaymentPending && !isUnpaidQuote && status !== "completed";
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

        // Mark job complete with proof — no auto-email
        setPayLoading(true);
        await completeJobWithProof(
          leadId,
          result.publicUrl,
          customerEmail,
          customerName,
          collectFromCustomer
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

  // ── Complete job with proof → payment_pending (no auto-email) ──
  async function handleCompleteWithProof() {
    if (!uploadedPhotoUrl) return;
    setPayLoading(true);

    await completeJobWithProof(
      leadId,
      uploadedPhotoUrl,
      customerEmail,
      customerName,
      collectFromCustomer
    );

    setPayLoading(false);
    setShowCompletionModal(false);
    onStatusChange?.("payment_pending");
    onRefresh();
  }

  // ── Payment Collection: Enter Card (opens Stripe in new tab) ──────────
  async function handleEnterCard() {
    setPayError(null);
    setPayLoading(true);
    try {
      const result = await createPaymentSession({
        leadId,
        amount: collectFromCustomer,
        customerEmail: customerEmail || undefined,
      });
      if (result.success && result.url) {
        window.open(result.url, "_blank");
      } else {
        setPayError(result.error || "Failed to create payment session.");
      }
    } catch (err) {
      console.error("[JobTicket] handleEnterCard error:", err);
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  // ── Payment Collection: Resend Invoice Email ──────────────────────────
  async function handleResendInvoice() {
    if (!customerEmail) return;
    setPayError(null);
    setPayLoading(true);
    try {
      const result = await sendPaymentInvoice({
        leadId,
        amount: collectFromCustomer,
        customerEmail,
        customerName,
      });
      if (!result.success) {
        setPayError(result.error || "Failed to send invoice email.");
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error("[JobTicket] handleResendInvoice error:", err);
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  // ── Payment Collection: Charge Saved Card (off-session) ───────────────
  // Uses the PaymentMethod tokenized at deposit. Customer authorized this
  // when paying the deposit (see /legal/terms § Saved Payment Method).
  async function handleConfirmChargeSavedCard() {
    setPayError(null);
    setChargeCardFallbackUrl(null);
    setPayLoading(true);
    try {
      const result = await chargeBalanceOffSession(leadId);
      if (result.success) {
        setShowChargeCardConfirm(false);
        onStatusChange?.("paid");
        onRefresh();
        return;
      }
      if (result.alreadyPaid) {
        setShowChargeCardConfirm(false);
        onRefresh();
        return;
      }
      // 3DS required or no card on file — surface the fallback so the
      // installer can hand the customer the redirect-Checkout link.
      if (result.fallbackUrl) {
        setChargeCardFallbackUrl(result.fallbackUrl);
      }
      setPayError(result.error || "Could not charge card. Try the payment link instead.");
    } catch (err) {
      console.error("[JobTicket] handleConfirmChargeSavedCard error:", err);
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  // ── Payment Collection: Mark Paid Manually (cash/venmo/check) ─────────
  async function handleMarkPaidManual() {
    setPayError(null);
    setPayLoading(true);
    try {
      const result = await markJobPaidManual(leadId, manualPayMethod);
      if (result && "error" in result && result.error) {
        setPayError(result.error);
        return;
      }
      setShowManualPayModal(false);
      onStatusChange?.("paid");
      onRefresh();
    } catch (err) {
      console.error("[JobTicket] handleMarkPaidManual error:", err);
      setPayError("Something went wrong. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  // ── Payment Collection: Copy Payment Link ────────────────────────────────
  // Uses permanent app URL — never expires (unlike Stripe session URLs)
  async function handleCopyPaymentLink() {
    setPayError(null);
    const paymentUrl = `${window.location.origin}/payment/collect/${leadId}`;
    let copied = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Payment Link", url: paymentUrl });
        copied = true;
      } catch {
        // User cancelled share sheet — fall through to clipboard
      }
    }
    if (!copied) {
      try {
        await navigator.clipboard.writeText(paymentUrl);
        copied = true;
      } catch {
        window.prompt("Copy this payment link:", paymentUrl);
        copied = true;
      }
    }
    if (copied) {
      setCopyLinkSuccess(true);
      setTimeout(() => setCopyLinkSuccess(false), 2000);
    }
  }

  // ── Inventory QR Handlers ───────────────────────────────────────────────
  async function loadInventoryRacks() {
    setInventoryLoading(true);
    const racks = await getRacksForJob(leadId);
    setInventoryRacks(racks);
    setInventoryLoading(false);
  }

  async function handleCreateInventoryRacks() {
    if (!quoteData || quoteData.length === 0 || !installerId) return;
    setInventoryCreating(true);
    const configs = quoteData.map((q: any) => ({
      cols: q.cols ?? q.width ?? 4,
      rows: q.rows ?? q.height ?? 3,
      hasWheels: q.hasWheels ?? q.wheels ?? false,
      topType: q.topType ?? q.top ?? "none",
      layout: q.layout ?? "standard",
    }));
    const result = await createRacksForJob({
      leadId,
      installerId,
      customerName,
      customerEmail: customerEmail || "",
      shelfConfigs: configs,
    });
    if (result.racks.length > 0) {
      setInventoryRacks(result.racks);
    }
    setInventoryCreating(false);
  }

  async function handleEmailRackLink(rackId: string) {
    if (!customerEmail) return;
    setInventoryEmailing(rackId);
    const result = await emailRackLink({
      rackId,
      customerEmail,
      customerName,
    });
    setInventoryEmailing(null);
    if (result.success) {
      setInventoryEmailSent(rackId);
      setTimeout(() => setInventoryEmailSent(null), 4000);
    }
  }

  // Load inventory racks when job is paid
  useEffect(() => {
    if (status === "paid") {
      loadInventoryRacks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, leadId]);

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

  // ── Schedule (manual date assignment) ─────────────────────────────────
  async function handleSchedule() {
    if (!scheduleDate) return;
    setScheduling(true);
    const result = await scheduleJob(leadId, scheduleDate, customerEmail || "", customerName);
    setScheduling(false);
    if (result.success) {
      setShowScheduleModal(false);
      setScheduleDate("");
      onRefresh();
    }
  }

  // ── Apply Discount Code ──────────────────────────────────────────────
  async function handleApplyDiscount() {
    if (!discountInput.trim() || !installerId) return;
    setDiscountLoading(true);
    const result = await validateDiscountCode(
      discountInput,
      installerId,
      totalPrice,
      { noDepositCap: !depositPaid }
    );
    setDiscountResult(result);
    setDiscountLoading(false);
  }

  function handleRemoveDiscount() {
    setDiscountResult(null);
    setDiscountInput("");
  }

  // ── Delete unpaid quote ─────────────────────────────────────────────
  async function handleDeleteQuote() {
    setDeleting(true);
    const result = await deleteUnpaidQuote(leadId);
    setDeleting(false);
    if (result.success) {
      setShowDeleteConfirm(false);
      // Navigate back to leads list
      window.location.href = "/dashboard/leads";
    }
  }

  return (
    <section className="space-y-4">
      {/* ── Source + Fee Badge ────────────────────────────────────── */}
      {(source === "partner_link" || source === "installer_manual") ? (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            DIRECT LEAD — 3% MAINTENANCE FEE
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
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            <Package className="h-3 w-3" />
            Materials
          </div>
          <div className="text-base font-black text-stone-300 sm:text-lg">
            {fmt(profit.estMaterials)}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">estimated cost</div>
        </div>

        {/* Box 2: Balance Due — what customer owes at install */}
        <div className={`rounded-xl border-2 p-3 text-center ${
          depositPaid
            ? "border-yellow-400 bg-yellow-400/5"
            : "border-orange-400 bg-orange-400/5"
        }`}>
          <div className={`mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
            depositPaid ? "text-yellow-400" : "text-orange-400"
          }`}>
            <DollarSign className="h-3 w-3" />
            {depositPaid ? "Balance Due" : "Full Amount"}
          </div>
          <div className="text-lg font-black text-white sm:text-xl">
            {fmt(collectFromCustomer)}
          </div>
          <div className="mt-1 text-[10px] text-stone-500">
            collect from customer
          </div>
        </div>

        {/* Box 3: Net Profit (green) — subtract discount (installer absorbs it) */}
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/5 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            Net Profit
          </div>
          <div className="text-base font-black text-emerald-400 sm:text-lg">
            {fmt(Math.max(0, profit.netProfit - appliedDiscount))}
          </div>
          <div className="mt-1 text-[10px] text-stone-600">after materials & fees</div>
        </div>
      </div>

      {/* ── Breakdown row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <span>
          Total:{" "}
          <span className="font-bold text-white">{fmt(profit.totalPrice)}</span>
        </span>
        {depositPaid ? (
          <span>
            Deposit Paid:{" "}
            <span className="font-bold text-emerald-400">
              -{fmt(profit.depositAmount)}
            </span>
          </span>
        ) : (
          <span>
            Deposit:{" "}
            <span className="font-bold text-orange-400">
              None
            </span>
          </span>
        )}
        {indoorDeliveryTotal > 0 && (
          <span>
            Indoor Delivery:{" "}
            <span className="font-bold text-stone-300">
              {fmt(indoorDeliveryTotal)}
            </span>
          </span>
        )}
        {appliedDiscount > 0 && (
          <span>
            Discount ({discountResult?.code}):{" "}
            <span className="font-bold text-emerald-400">
              -{fmt(appliedDiscount)}
            </span>
          </span>
        )}
        {tax > 0 && (
          <span>
            Tax:{" "}
            <span className="font-bold text-stone-300">
              +{fmt(tax)}
            </span>
          </span>
        )}
        <span>
          {profit.feeLabel}:{" "}
          <span className="font-bold text-stone-400">
            -{fmt(profit.feeAmount)}
          </span>
        </span>
      </div>

      {/* ── Action Button Area ────────────────────────────────────────── */}
      {isPaid ? (
        /* ── PAID badge ───────────────────────────────────────────── */
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <span className="text-lg font-black uppercase tracking-wider text-emerald-400">
              PAID
            </span>
          </div>

          {/* ── Inventory QR Section ──────────────────────────────── */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-yellow-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                Customer Inventory
              </span>
            </div>

            {inventoryLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-stone-500" />
              </div>
            ) : inventoryRacks.length === 0 ? (
              <div>
                <p className="text-xs text-stone-400 mb-3">
                  Create a digital inventory tracker for this customer&apos;s rack.
                  They&apos;ll get a QR code link to catalog what&apos;s in each tote.
                </p>
                <button
                  onClick={handleCreateInventoryRacks}
                  disabled={inventoryCreating || !quoteData || quoteData.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-900 hover:bg-yellow-300 disabled:opacity-50 transition-colors"
                >
                  {inventoryCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  {inventoryCreating ? "Creating..." : "Create Inventory QR"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {inventoryRacks.map((rack) => {
                  const rackUrl = `${window.location.origin}/rack/${rack.access_token}`;
                  return (
                    <div
                      key={rack.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">
                          {rack.label}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {rack.cols}&times;{rack.rows}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Copy Link */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(rackUrl);
                            setCopyLinkSuccess(true);
                            setTimeout(() => setCopyLinkSuccess(false), 2000);
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-zinc-700 transition-colors"
                        >
                          <Link className="h-3 w-3" />
                          {copyLinkSuccess ? "Copied!" : "Copy Link"}
                        </button>

                        {/* Open QR Page */}
                        <a
                          href={rackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-zinc-700 transition-colors"
                        >
                          <Package className="h-3 w-3" />
                          Open
                        </a>

                        {/* Print QR */}
                        <button
                          onClick={() => {
                            const printUrl = `${window.location.origin}/rack/${rack.access_token}/qr`;
                            window.open(printUrl, "_blank");
                          }}
                          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-zinc-700 transition-colors"
                        >
                          <Camera className="h-3 w-3" />
                          Print QR
                        </button>

                        {/* Email to Customer */}
                        {customerEmail && (
                          <button
                            onClick={() => handleEmailRackLink(rack.id)}
                            disabled={inventoryEmailing === rack.id || inventoryEmailSent === rack.id}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-70 ${
                              inventoryEmailSent === rack.id
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30"
                            }`}
                          >
                            {inventoryEmailing === rack.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : inventoryEmailSent === rack.id ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            {inventoryEmailSent === rack.id ? "Sent!" : "Email Customer"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Customer Review Section ─────────────────────────────── */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                Customer Review
              </span>
            </div>

            {reviewDone ? (
              /* Review submitted */
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">Review Received</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    This customer has submitted a verified review. It will appear on your portfolio page.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Status badge */}
                {reviewSendSuccess ? (
                  <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Review Request Sent!</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {customerName.split(" ")[0]} will receive an email with a link to leave their review.
                      </p>
                    </div>
                  </div>
                ) : reviewRequested ? (
                  <div className="flex items-center gap-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 px-4 py-3">
                    <Mail className="h-5 w-5 text-yellow-400/70 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-yellow-400/80">Review Pending</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        Waiting for {customerName.split(" ")[0]} to submit their review.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">
                    Ask {customerName.split(" ")[0]} to leave a review. Verified reviews build trust and help you win more jobs.
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {/* Send via Email (or Reminder) */}
                  {customerEmail && (
                    <button
                      onClick={async () => {
                        if (!installerId) return;
                        setReviewEmailing(true);
                        try {
                          const { requestReview } = await import("@/app/actions/reviews");
                          const result = await requestReview({ leadId, installerId });
                          if (result.success) {
                            setReviewRequested(true);
                            setReviewSendSuccess(true);
                            setTimeout(() => setReviewSendSuccess(false), 5000);
                          }
                        } catch (err) {
                          console.error("[Review] Failed to send:", err);
                        }
                        setReviewEmailing(false);
                      }}
                      disabled={reviewEmailing}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                        reviewRequested
                          ? "bg-zinc-800 border border-zinc-700 text-stone-400 hover:bg-zinc-700 hover:text-white"
                          : "bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/30"
                      }`}
                    >
                      {reviewEmailing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : reviewRequested ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <Star className="h-3.5 w-3.5" />
                      )}
                      {reviewRequested ? "Send Reminder" : "Send via Email"}
                    </button>
                  )}

                  {/* Copy Link — generate token on first click if needed */}
                  <button
                    onClick={async () => {
                      if (reviewLink) {
                        navigator.clipboard.writeText(reviewLink);
                        setReviewLinkCopied(true);
                        setTimeout(() => setReviewLinkCopied(false), 3000);
                        return;
                      }
                      // Generate token first
                      setReviewCopying(true);
                      try {
                        const { generateReviewToken } = await import("@/app/actions/reviews");
                        const token = await generateReviewToken(leadId);
                        if (token) {
                          const url = `${window.location.origin}/review/${token}`;
                          setReviewLink(url);
                          setReviewRequested(true);
                          navigator.clipboard.writeText(url);
                          setReviewLinkCopied(true);
                          setTimeout(() => setReviewLinkCopied(false), 3000);
                        }
                      } catch (err) {
                        console.error("[Review] Failed to generate link:", err);
                      }
                      setReviewCopying(false);
                    }}
                    disabled={reviewCopying}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      reviewLinkCopied
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-zinc-800 border-zinc-700 text-stone-400 hover:bg-zinc-700 hover:text-white"
                    }`}
                  >
                    {reviewCopying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : reviewLinkCopied ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Link className="h-3.5 w-3.5" />
                    )}
                    {reviewCopying ? "Generating..." : reviewLinkCopied ? "Link Copied!" : "Copy Link"}
                  </button>
                </div>

                {/* Show the link text for easy copying on mobile */}
                {reviewLink && !reviewLinkCopied && (
                  <div
                    onClick={() => {
                      navigator.clipboard.writeText(reviewLink);
                      setReviewLinkCopied(true);
                      setTimeout(() => setReviewLinkCopied(false), 3000);
                    }}
                    className="cursor-pointer rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                  >
                    <p className="text-[9px] text-stone-600 uppercase font-bold tracking-wider mb-0.5">Review Link</p>
                    <p className="text-[10px] text-stone-500 font-mono break-all select-all">{reviewLink}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : isUnpaidQuote ? (
        /* ── UNPAID QUOTE — Collect Full Payment on Delivery ────────── */
        <div className="relative space-y-3">
          {/* No deposit badge */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-orange-500/15 px-4 py-2">
            <DollarSign className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              No Deposit Paid — Collect Full Amount
            </span>
          </div>

          {/* Tax + Discount Breakdown */}
          {(tax > 0 || appliedDiscount > 0) && (
            <div className="space-y-1 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Subtotal</span>
                <span className="font-bold text-white">{fmt(totalPrice)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-stone-400">
                  <span>Sales Tax ({addressState})</span>
                  <span className="font-bold text-stone-300">+{fmt(tax)}</span>
                </div>
              )}
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-stone-400">
                  <span>
                    Discount ({discountResult?.code})
                  </span>
                  <span className="font-bold text-emerald-400">-{fmt(appliedDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-700 pt-1 text-stone-300">
                <span className="font-bold">Total to Collect</span>
                <span className="font-black text-orange-400">{fmt(collectFromCustomer)}</span>
              </div>
            </div>
          )}

          {/* Discount Code Input */}
          {installerId && (
            <div className="space-y-2">
              {appliedDiscount > 0 ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <div className="text-xs">
                    <span className="font-bold text-emerald-400">{discountResult?.code}</span>
                    <span className="ml-2 text-stone-400">
                      {discountResult?.discountType === "percentage"
                        ? `${discountResult.discountValue}% off`
                        : `$${discountResult?.discountValue} off`}
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveDiscount}
                    className="rounded p-1 text-stone-500 transition-colors hover:bg-zinc-700 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyDiscount()}
                    placeholder="Discount code"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-stone-600 focus:border-orange-400 focus:outline-none"
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={!discountInput.trim() || discountLoading}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-bold text-stone-300 transition-colors hover:bg-zinc-600 hover:text-white disabled:opacity-40"
                  >
                    {discountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {discountResult && !discountResult.valid && (
                <p className="text-[11px] font-semibold text-red-400">{discountResult.error}</p>
              )}
            </div>
          )}

          {/* COLLECT FULL PAYMENT button */}
          <button
            onClick={() => setShowGetPaidMenu(!showGetPaidMenu)}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-orange-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-400 hover:shadow-orange-400/30 active:scale-[0.98]"
          >
            <DollarSign className="h-6 w-6" />
            COLLECT FULL PAYMENT — {fmt(collectFromCustomer)}
            <ChevronDown className={`h-5 w-5 transition-transform ${showGetPaidMenu ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu — same options as payment_pending */}
          {showGetPaidMenu && (
            <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
              {payError && (
                <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                  {payError}
                </div>
              )}

              {/* Charge Card on File — saved at deposit, off-session */}
              {hasSavedCard && (
                <button
                  onClick={() => { setShowGetPaidMenu(false); setShowChargeCardConfirm(true); }}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-left transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Zap className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Charge Card on File</p>
                    <p className="text-[11px] text-emerald-300/80">
                      {savedCardLabel} — auto-charge {customerName.split(" ")[0] || "customer"}
                    </p>
                  </div>
                </button>
              )}

              {/* Enter Card Details */}
              <button
                onClick={handleEnterCard}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                ) : (
                  <CreditCard className="h-5 w-5 text-orange-400" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">Manual Card Entry</p>
                  <p className="text-[11px] text-stone-500">
                    Open Stripe — type in customer&apos;s card
                  </p>
                </div>
              </button>

              {/* Send Email */}
              {customerEmail && (
                <button
                  onClick={handleResendInvoice}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  <Mail className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Send Email</p>
                    <p className="text-[11px] text-stone-500">
                      Email payment link to {customerEmail}
                    </p>
                  </div>
                </button>
              )}

              {/* Copy Payment Link */}
              <button
                onClick={handleCopyPaymentLink}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                ) : (
                  <Link className="h-5 w-5 text-violet-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {copyLinkSuccess ? "Copied!" : "Copy Payment Link"}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Generate link to share via any channel
                  </p>
                </div>
              </button>

              {/* Mark Paid (Manual) */}
              <button
                onClick={() => { setShowGetPaidMenu(false); setShowManualPayModal(true); }}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Mark Paid (Cash/Venmo/Check)</p>
                  <p className="text-[11px] text-stone-500">
                    Customer paid in person — close the job
                  </p>
                </div>
              </button>

              {/* Delete Quote */}
              <div className="border-t border-zinc-700 pt-2">
                <button
                  onClick={() => { setShowGetPaidMenu(false); setShowDeleteConfirm(true); }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-red-500/10"
                >
                  <Trash2 className="h-5 w-5 text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Delete Quote</p>
                    <p className="text-[11px] text-stone-500">
                      Permanently remove this unpaid quote
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isPaymentPending ? (
        /* ── PAYMENT PENDING — GET PAID button + dropdown ─────────── */
        <div className="relative space-y-3">
          {/* Pending badge */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2">
            <DollarSign className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Pending
            </span>
          </div>

          {/* GET PAID button */}
          <button
            onClick={() => setShowGetPaidMenu(!showGetPaidMenu)}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-zinc-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98]"
          >
            <DollarSign className="h-6 w-6" />
            GET PAID — {fmt(collectFromCustomer)}
            <ChevronDown className={`h-5 w-5 transition-transform ${showGetPaidMenu ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          {showGetPaidMenu && (
            <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
              {/* Payment error banner */}
              {payError && (
                <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                  {payError}
                </div>
              )}

              {/* Charge Card on File — saved at deposit, off-session */}
              {hasSavedCard && (
                <button
                  onClick={() => { setShowGetPaidMenu(false); setShowChargeCardConfirm(true); }}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-left transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Zap className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Charge Card on File</p>
                    <p className="text-[11px] text-emerald-300/80">
                      {savedCardLabel} — auto-charge {customerName.split(" ")[0] || "customer"}
                    </p>
                  </div>
                </button>
              )}

              {/* Enter Card Details — opens Stripe Checkout in new tab */}
              <button
                onClick={handleEnterCard}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
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

              {/* Email Customer for Payment — only if email is on file */}
              {customerEmail && (
                <button
                  onClick={handleResendInvoice}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  <Mail className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Email Customer for Payment</p>
                    <p className="text-[11px] text-stone-500">
                      Send payment link to {customerEmail}
                    </p>
                  </div>
                </button>
              )}

              {/* Copy Payment Link */}
              <button
                onClick={handleCopyPaymentLink}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                ) : (
                  <Link className="h-5 w-5 text-violet-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {copyLinkSuccess ? "Copied!" : "Copy Payment Link"}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Generate link to share via any channel
                  </p>
                </div>
              </button>

              {/* Mark Paid (Manual) */}
              <button
                onClick={() => { setShowGetPaidMenu(false); setShowManualPayModal(true); }}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
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
        /* ── ACTIVE JOB — GET PAID button (completes job + opens payment) ──── */
        <div className="relative space-y-3">
          <button
            onClick={() => {
              // Auto-complete the job when installer taps Get Paid
              if (status !== "payment_pending") {
                handleCompleteJob();
              }
              setShowGetPaidMenu(!showGetPaidMenu);
            }}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-500 px-6 py-5 text-lg font-black uppercase tracking-wider text-zinc-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 hover:shadow-yellow-400/30 active:scale-[0.98] disabled:opacity-50"
            disabled={payLoading}
          >
            {payLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <DollarSign className="h-6 w-6" />
                GET PAID — {fmt(collectFromCustomer)}
                <ChevronDown className={`h-5 w-5 transition-transform ${showGetPaidMenu ? "rotate-180" : ""}`} />
              </>
            )}
          </button>

          {/* Dropdown menu (same as payment_pending) */}
          {showGetPaidMenu && (
            <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
              {payError && (
                <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                  {payError}
                </div>
              )}

              {/* Charge Card on File — saved at deposit, off-session */}
              {hasSavedCard && (
                <button
                  onClick={() => { setShowGetPaidMenu(false); setShowChargeCardConfirm(true); }}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-left transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Zap className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Charge Card on File</p>
                    <p className="text-[11px] text-emerald-300/80">
                      {savedCardLabel} — auto-charge {customerName.split(" ")[0] || "customer"}
                    </p>
                  </div>
                </button>
              )}

              <button
                onClick={handleEnterCard}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                ) : (
                  <CreditCard className="h-5 w-5 text-yellow-400" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">Manual Card Entry</p>
                  <p className="text-[11px] text-stone-500">Open Stripe — type in customer&apos;s card</p>
                </div>
              </button>

              {customerEmail && (
                <button
                  onClick={handleResendInvoice}
                  disabled={payLoading}
                  className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  <Mail className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Email Customer for Payment</p>
                    <p className="text-[11px] text-stone-500">Send payment link to {customerEmail}</p>
                  </div>
                </button>
              )}

              <button
                onClick={handleCopyPaymentLink}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                ) : (
                  <Link className="h-5 w-5 text-violet-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {copyLinkSuccess ? "Copied!" : "Copy Payment Link"}
                  </p>
                  <p className="text-[11px] text-stone-500">Generate link to share via any channel</p>
                </div>
              </button>

              <button
                onClick={() => { setShowGetPaidMenu(false); setShowManualPayModal(true); }}
                disabled={payLoading}
                className="flex w-full items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3.5 text-left transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Mark Paid (Cash/Venmo/Check)</p>
                  <p className="text-[11px] text-stone-500">Manual confirmation — close the job</p>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Completion Photo (if exists) ─────────────────────────────── */}
      {uploadedPhotoUrl && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <NextImage
            src={uploadedPhotoUrl}
            alt="Completed installation"
            width={400}
            height={240}
            className="w-full object-cover"
            style={{ maxHeight: 240 }}
          />
          <div className="bg-zinc-900 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
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
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-blue-400/50 hover:text-blue-400"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          )}
          {customerPhone && (
            <a
              href={`sms:${customerPhone}`}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-400"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Text
            </a>
          )}
          {scheduledAt ? (
            <button
              onClick={() => setShowRescheduleModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-yellow-400/50 hover:text-yellow-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              Reschedule
            </button>
          ) : (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-stone-300 transition-colors hover:border-yellow-400/50 hover:text-yellow-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </button>
          )}
        </div>
      )}

      {/* ── Scheduled Date Display ─────────────────────────────────────── */}
      {scheduledAt && (
        <div className="rounded-lg bg-zinc-800 px-3 py-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Scheduled{" "}
          </span>
          <span className="text-xs font-bold text-yellow-400">
            {new Date(scheduledAt + (scheduledAt.includes("T") ? "" : "T12:00:00")).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {timePreference && (
              <span className="ml-1 text-stone-400">
                ({timePreference === "morning" ? "Morning" : "Afternoon"})
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Unit Summary (directly above purchase list) ───────────── */}
      {quoteData && quoteData.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Ruler className="h-4 w-4 text-yellow-400" />
              Unit Summary
            </h2>
            {!depositPaid && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`/dashboard/build?edit=${leadId}`}
                  className="flex items-center gap-1 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-400 transition-colors hover:bg-yellow-400/20"
                >
                  <PenLine className="h-3 w-3" />
                  Edit
                </a>
                <button
                  onClick={handleCopyPaymentLink}
                  className="flex items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-300 transition-colors hover:bg-zinc-700 hover:text-white"
                >
                  <Link className="h-3 w-3" />
                  {copyLinkSuccess ? "Copied!" : depositPaid ? "Balance Link" : "Full Pay Link"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {quoteData.map((unit, i) => {
              const u = unit as MaterialConfig & { desc?: string; price?: number; addons?: import("@/types/viewModels").SectionAddon[]; paintFrameColor?: string | null; paintDoorColor?: string | null; paintSidePanelColor?: string | null };
              const featureList: string[] = [
                u.hasTotes ? "Totes" : "No Totes",
                u.hasWheels ? "Wheels" : "No Wheels",
                u.hasTop ? "Top" : "No Top",
              ];
              // Addon summary
              const unitAddons = u.addons ?? [];
              const doorCount = unitAddons.filter((a) => a.type === "plywood_door").reduce((n, a) => n + (a.target === "doors_on" ? (u.cols || 1) : 1), 0);
              const panelCount = unitAddons.filter((a) => a.type === "side_panel").length;
              const railRemovedCount = unitAddons.filter((a) => a.type === "rail_removed").length;
              const shelfCount = unitAddons.filter((a) => a.type === "shelf").length;
              if (doorCount > 0) featureList.push(`${doorCount} Door${doorCount > 1 ? "s" : ""}`);
              if (panelCount > 0) featureList.push(`${panelCount} Panel${panelCount > 1 ? "s" : ""}`);
              if (railRemovedCount > 0) featureList.push(`${railRemovedCount} Rail${railRemovedCount > 1 ? "s" : ""} Removed`);
              if (shelfCount > 0) featureList.push(`${shelfCount} Shelf Insert${shelfCount > 1 ? "s" : ""}`);
              // Paint summary
              const paintParts: string[] = [];
              if (u.paintFrameColor) paintParts.push(`Frame: ${u.paintFrameColor}`);
              if (u.paintDoorColor) paintParts.push(`Doors: ${u.paintDoorColor}`);
              if (u.paintSidePanelColor) paintParts.push(`Panels: ${u.paintSidePanelColor}`);
              if (paintParts.length > 0) featureList.push(`Paint (${paintParts.join(", ")})`);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Unit {i + 1}: {u.desc || `${u.cols}x${u.rows}`}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {u.toteType || "HDX"} &bull; {featureList.join(", ")}
                    </p>
                  </div>
                  {u.price != null && (
                    <span className="text-sm font-bold text-yellow-400">
                      ${u.price.toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Blueprints Gate — only show when deposit is paid ────────── */}
      {!depositPaid ? (
        <LockedBlueprintsTeaser />
      ) : (<>

      {/* ── Purchase List (inventory-aware material list) ────────────── */}
      {netPurchase && netPurchase.items.length > 0 && (() => {
        // Affiliate links for specific materials
        const productLinks: Record<string, string> = {
          "Caster Kit (4pk)": "https://amzn.to/4rPMxf6",
          '1⅝" #8 Screws': "https://amzn.to/46xZ664",
          '3" Screws': "https://amzn.to/3OEWiho",
          '1" Screws': "https://www.menards.com/main/hardware/fasteners-connectors/bolts/lag-screws/grip-fast-reg-premium-1-4-x-1-star-drive-tan-washer-head-structural-screw-95-count/30783-12/p-1553840877420-c-8742.htm",
        };

        return (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-900" open={!isPaid}>
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Purchase List
            {Object.values(checkedItems).filter(Boolean).length > 0 && (
              <span className="ml-2 text-emerald-400">
                ({Object.values(checkedItems).filter(Boolean).length}/{netPurchase.items.filter((i) => !i.covered).length})
              </span>
            )}
            {netPurchase.coveredCount > 0 && (
              <span className="ml-2 text-[10px] font-semibold normal-case text-emerald-400/70">
                {netPurchase.coveredCount} in stock
              </span>
            )}
          </summary>
          <div className="border-t border-zinc-800">
            {netPurchase.items
              .filter((item) => !item.covered)
              .map((item, i) => {
                const key = `shop-${item.name}`;
                const isChecked = !!checkedItems[key];
                const orderLink = productLinks[item.name];
                return (
                  <div
                    key={i}
                    className={`flex w-full items-center gap-3 border-b border-zinc-800/50 px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isChecked ? "bg-zinc-800/30" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    {/* Checkbox — tappable */}
                    <button
                      type="button"
                      onClick={() => toggleItem(key)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isChecked
                          ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                          : "border-zinc-600 text-transparent"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>

                    {/* Item details — tappable for checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleItem(key)}
                      className={`min-w-0 flex-1 text-left ${isChecked ? "opacity-40" : ""}`}
                    >
                      <p className={`text-xs font-semibold ${isChecked ? "text-stone-500 line-through" : "text-stone-300"}`}>
                        {item.name}
                      </p>
                      {item.detail && (
                        <p className={`text-[10px] ${isChecked ? "text-stone-600 line-through" : "text-stone-500"}`}>
                          {item.detail}
                        </p>
                      )}
                    </button>

                    {/* Order link (when available) */}
                    {orderLink && !isChecked && (
                      <a
                        href={orderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-md bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
                      >
                        Order
                      </a>
                    )}

                    {/* Qty */}
                    <span className={`shrink-0 rounded bg-zinc-700 px-2 py-0.5 font-mono text-xs font-bold ${isChecked ? "text-stone-600 line-through opacity-40" : "text-yellow-400"}`}>
                      {item.qty}
                    </span>
                  </div>
                );
              })}

            {/* In-stock summary (collapsed, shows what's covered by inventory) */}
            {netPurchase.coveredCount > 0 && (
              <details className="border-t border-zinc-800/50">
                <summary className="cursor-pointer px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400/60 hover:text-emerald-400">
                  {netPurchase.coveredCount} item{netPurchase.coveredCount > 1 ? "s" : ""} covered by inventory
                </summary>
                <div className="px-4 pb-2">
                  {netPurchase.items
                    .filter((item) => item.covered)
                    .map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 text-[11px] text-stone-500"
                      >
                        <span>{item.name}</span>
                        <span className="text-emerald-400/60">{item.detail}</span>
                      </div>
                    ))}
                </div>
              </details>
            )}

            {/* Total cost row */}
            {materialBreakdown && (
              <div className="flex items-center justify-between border-t border-zinc-700 px-4 py-3">
                <span className="text-xs font-bold text-stone-400">Est. Material Cost</span>
                <span className="text-xs font-mono font-black text-yellow-400">
                  ${materialBreakdown.totalCost.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </details>
        );
      })()}

      {/* ── Chair Materials & Build Plans ───────────────────────────── */}
      {(() => {
        const chairUnits = (quoteData as (MaterialConfig & { chairId?: string; quantity?: number })[] | null)?.filter((u) => u.chairId) ?? [];
        if (chairUnits.length === 0) return null;
        const totalChairs = chairUnits.reduce((sum, u) => sum + (u.quantity ?? 1), 0);
        return (
          <section className="rounded-xl border border-amber-500/20 bg-zinc-900 overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500" />
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10">
                  <FileText className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Low Boy Adirondack Chair{totalChairs > 1 ? ` (×${totalChairs})` : ""}
                  </p>
                  <p className="text-[10px] text-amber-400/70">Materials per chair — see plans for cuts</p>
                </div>
              </div>

              <div className="mb-3 space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
                {[
                  { qty: `${totalChairs * 5}×`, name: "2×6 × 8′ dimensional lumber" },
                  { qty: `${totalChairs}×`, name: "2×8 × 8′ dimensional lumber" },
                  { qty: "—", name: "2-1/2″ outdoor pocket hole screws" },
                  { qty: "—", name: "2″ & 3″ exterior deck screws, 2″ lag screws" },
                  { qty: "—", name: "Titebond III outdoor wood glue" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span className="w-8 text-right text-[11px] font-bold text-amber-400/80">{item.qty}</span>
                    <span className="text-[11px] text-stone-400">{item.name}</span>
                  </div>
                ))}
              </div>

              <a
                href="/dashboard/guides#chair-plans"
                className="flex w-full items-center justify-between rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-gray-950 transition-all hover:bg-amber-300 active:scale-[0.98]"
              >
                <span>Open Build Plans</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-2 text-center text-[10px] text-stone-600">
                Opens in Guides &amp; Training · Purchase plans if not already unlocked
              </p>
            </div>
          </section>
        );
      })()}

      {/* ── Module Diagram (visual overview) ──────────────────────────── */}
      {buildManifest && buildManifest.cut_plan_visuals.length > 1 && quoteData && (
        <ModuleDiagram
          units={quoteData.map((u) => ({ cols: u.cols, rows: u.rows, toteType: u.toteType }))}
          cutPlanModules={buildManifest.cut_plan_visuals}
          scrollIdPrefix="jt-cut-module"
          use2x4Rails={use2x4Rails}
        />
      )}

      {/* ── Cut Plan (expandable — fractions, plywood, posts) ──────────── */}
      {buildManifest && buildManifest.cut_plan_visuals.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-900" open={!isPaid}>
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Cut Plan
          </summary>
          <div className="border-t border-zinc-800 p-4 space-y-6">
            {(() => { const _bo = getBuildOrderColors(buildManifest.cut_plan_visuals); return buildManifest.cut_plan_visuals.map((mod, mi) => {
              const _mc = _bo[mi]?.color ?? "#f59e0b";
              const _bn = _bo[mi]?.buildOrder ?? mi + 1;
              return (
              <div key={mi} id={`jt-cut-module-${mi}`} className="rounded-lg border-l-[3px] pl-3 transition-all" style={{ borderLeftColor: _mc }}>
                <h3 className="mb-1 text-sm font-bold" style={{ color: _mc }}>
                  Module {_bn}
                  {mod.heightTier ? ` — Tier ${mod.heightTier}/${mod.heightTierTotal}` : ""} ({mod.cols}x{mod.rows})
                  {mod.heightTier === 1 && <span className="ml-2 text-[10px] font-semibold text-blue-400">(Bottom)</span>}
                  {mod.heightTier && mod.heightTier > 1 && mod.heightTier === mod.heightTierTotal && <span className="ml-2 text-[10px] font-semibold text-purple-400">(Top)</span>}
                  {mod.heightTier && mod.heightTier > 1 && mod.heightTier < (mod.heightTierTotal || 0) && <span className="ml-2 text-[10px] font-semibold text-cyan-400">(Middle)</span>}
                </h3>
                <p className="mb-3 text-[11px] text-stone-500">
                  {mod.stripCount} plywood sliders @ 1.875&quot; (Rails: {mod.railStrips}, Back
                  Supports: {mod.backSupports})
                </p>

                {/* Board cut visuals */}
                <div className="space-y-2.5">
                  {mod.boards.map((board, bi) => (
                    <div
                      key={bi}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2 shadow-sm"
                    >
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="font-semibold text-stone-400">
                          Board {bi + 1}
                          <span className="ml-1.5 text-stone-600">{board.priorUsed ? "offcut" : "96\" stock"}</span>
                        </span>
                        <span className="font-mono font-bold text-red-400/70">
                          {toFraction(board.rem)}&quot; waste
                        </span>
                      </div>
                      <div className="flex h-8 overflow-hidden rounded-md bg-zinc-700">
                        {board.priorUsed != null && board.priorUsed > 0 && (
                          <div
                            className="flex items-center justify-center border-r border-zinc-900/60 font-mono text-[9px] font-semibold text-stone-500"
                            style={{
                              width: `${(board.priorUsed / 96) * 100}%`,
                              background: "repeating-linear-gradient(45deg, rgba(100,116,139,0.25), rgba(100,116,139,0.25) 3px, rgba(71,85,105,0.15) 3px, rgba(71,85,105,0.15) 6px)",
                              minWidth: "30px",
                            }}
                            title={`Prior module — ${toFraction(board.priorUsed)}"`}
                          >
                            {toFraction(board.priorUsed)}&quot; used
                          </div>
                        )}
                        {board.cuts.map((cut, ci) => {
                          const pct = (cut.len / 96) * 100;
                          const color =
                            cut.type === "rail" ? "#f59e0b" : "#3b82f6";
                          return (
                            <div
                              key={ci}
                              className="flex items-center justify-center border-r border-zinc-900/60 text-[10px] font-extrabold text-white"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: color,
                                minWidth: "24px",
                                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                              }}
                              title={`${cut.name} — ${toFraction(cut.len)}"`}
                            >
                              <span className="font-semibold opacity-80 mr-1">{cut.name}</span>
                              <span className="font-mono">{toFraction(cut.len)}&quot;</span>
                            </div>
                          );
                        })}
                        {board.laterUsed != null && board.laterUsed > 0 && (
                          <div
                            className="flex items-center justify-center border-r border-zinc-900/60 font-mono text-[9px] font-semibold text-emerald-400/80"
                            style={{
                              width: `${(board.laterUsed / 96) * 100}%`,
                              background: "repeating-linear-gradient(45deg, rgba(16,185,129,0.15), rgba(16,185,129,0.15) 3px, rgba(5,150,105,0.08) 3px, rgba(5,150,105,0.08) 6px)",
                              minWidth: "40px",
                            }}
                            title={`Offcut ${board.laterLabel || ""} — ${toFraction(board.laterUsed)}"`}
                          >
                            {board.laterLabel} {toFraction(board.laterUsed)}&quot;
                          </div>
                        )}
                        {board.rem > 0 && (
                          <div
                            className="flex-1"
                            style={{
                              background:
                                "repeating-linear-gradient(45deg, rgba(239,68,68,0.18), rgba(239,68,68,0.18) 4px, rgba(220,38,38,0.08) 4px, rgba(220,38,38,0.08) 8px)",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Plywood Rails & Post Spacing */}
                <div className="mt-2 space-y-1 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Plywood Rails
                  </p>
                  <p className="text-xs text-stone-400">
                    {mod.railStrips} tote rail strips + {mod.backSupports} back supports = <span className="font-bold text-yellow-400">{mod.stripCount} total strips</span> from 3/4&quot; plywood
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 pt-1">
                    Post Spacing
                  </p>
                  <p className="text-xs text-stone-400">
                    {mod.cols + 1} posts across {toFraction(mod.moduleWidth)}&quot; width — <span className="font-bold text-blue-400">{toFraction((mod.moduleWidth - (mod.cols + 1) * 1.5) / mod.cols)}&quot;</span> opening between posts (inside face to inside face)
                  </p>
                </div>
              </div>
              );
            }); })()}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-3 text-[10px] font-semibold text-stone-400">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                Vertical Posts
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-amber-500" />
                Plates / Framing
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, rgba(239,68,68,0.3), rgba(239,68,68,0.3) 2px, rgba(220,38,38,0.1) 2px, rgba(220,38,38,0.1) 4px)",
                  }}
                />
                Scrap
              </div>
            </div>
          </div>
        </details>
      )}

      {/* ── Shelving Cut Plan (open shelving units) ────────────────────── */}
      {buildManifest && buildManifest.shelving_cut_plans && buildManifest.shelving_cut_plans.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-900" open={!isPaid}>
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Shelving Cut Plan
          </summary>
          <div className="border-t border-zinc-800 p-4 space-y-6">
            {buildManifest.shelving_cut_plans.map((mod, mi) => (
              <div key={mi} className="rounded-lg border-l-[3px] border-l-emerald-500 pl-3">
                <h3 className="mb-1 text-sm font-bold text-emerald-400">
                  Open Shelving — {mod.shelvingLabel}
                </h3>
                <p className="mb-3 text-[11px] text-stone-500">
                  {mod.widthIn}&quot;W × {mod.frameH}&quot;H × {mod.depth}&quot;D — {mod.shelves} {mod.shelves === 1 ? "shelf" : "shelves"} + top — {mod.plywoodSurfaces} plywood surface{mod.plywoodSurfaces > 1 ? "s" : ""} ({mod.plywoodSqFtPerSurface.toFixed(1)} sq ft each)
                </p>

                {/* Board cut visuals */}
                <div className="space-y-2.5">
                  {mod.boards.map((board, bi) => (
                    <div
                      key={bi}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2 shadow-sm"
                    >
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="font-semibold text-stone-400">
                          Board {bi + 1}
                          <span className="ml-1.5 text-stone-600">{board.priorUsed ? "offcut" : "96\" stock"}</span>
                        </span>
                        <span className="font-mono font-bold text-red-400/70">
                          {toFraction(board.rem)}&quot; waste
                        </span>
                      </div>
                      <div className="flex h-8 overflow-hidden rounded-md bg-zinc-700">
                        {board.priorUsed != null && board.priorUsed > 0 && (
                          <div
                            className="flex items-center justify-center border-r border-zinc-900/60 font-mono text-[9px] font-semibold text-stone-500"
                            style={{
                              width: `${(board.priorUsed / 96) * 100}%`,
                              background: "repeating-linear-gradient(45deg, rgba(100,116,139,0.25), rgba(100,116,139,0.25) 3px, rgba(71,85,105,0.15) 3px, rgba(71,85,105,0.15) 6px)",
                              minWidth: "30px",
                            }}
                            title={`Other unit — ${toFraction(board.priorUsed)}"`}
                          >
                            {toFraction(board.priorUsed)}&quot; used
                          </div>
                        )}
                        {board.cuts.map((cut, ci) => {
                          const pct = (cut.len / 96) * 100;
                          const color =
                            cut.type === "rail" ? "#10b981" : "#3b82f6";
                          return (
                            <div
                              key={ci}
                              className="flex items-center justify-center border-r border-zinc-900/60 text-[10px] font-extrabold text-white"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: color,
                                minWidth: "24px",
                                textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                              }}
                              title={`${cut.name} — ${toFraction(cut.len)}"`}
                            >
                              <span className="font-semibold opacity-80 mr-1">{cut.name}</span>
                              <span className="font-mono">{toFraction(cut.len)}&quot;</span>
                            </div>
                          );
                        })}
                        {board.rem > 0 && (
                          <div
                            className="flex-1"
                            style={{
                              background:
                                "repeating-linear-gradient(45deg, rgba(239,68,68,0.18), rgba(239,68,68,0.18) 4px, rgba(220,38,38,0.08) 4px, rgba(220,38,38,0.08) 8px)",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shelving dimensions summary */}
                <div className="mt-2 space-y-1 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Frame
                  </p>
                  <p className="text-xs text-stone-400">
                    4 corner posts @ <span className="font-bold text-blue-400">{toFraction(mod.frameH)}&quot;</span> — rails @ <span className="font-bold text-emerald-400">{mod.widthIn}&quot;</span> — depth braces @ <span className="font-bold text-emerald-400">{mod.depth}&quot;</span>
                  </p>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-3 text-[10px] font-semibold text-stone-400">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                Vertical Posts
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                Rails / Braces
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, rgba(239,68,68,0.3), rgba(239,68,68,0.3) 2px, rgba(220,38,38,0.1) 2px, rgba(220,38,38,0.1) 4px)",
                  }}
                />
                Scrap
              </div>
            </div>
          </div>
        </details>
      )}

      {/* ── Overhead Cut Plan (ceiling storage units) ─────────────────── */}
      {buildManifest && buildManifest.overhead_cut_plans && buildManifest.overhead_cut_plans.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-zinc-900" open={!isPaid}>
          <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300">
            Overhead Ceiling Storage — Purchase List
          </summary>
          <div className="border-t border-zinc-800 p-4 space-y-6">
            {buildManifest.overhead_cut_plans.map((mod, mi) => (
              <div key={mi} className="rounded-lg border-l-[3px] border-l-yellow-500 pl-3">
                <h3 className="mb-1 text-sm font-bold text-yellow-400">
                  {mod.overheadLabel}
                </h3>
                <p className="mb-3 text-[11px] text-stone-500">
                  {mod.slotsWide} wide × {mod.slotsDeep} deep — {mod.toteCount} totes — {mod.toteType} — {Math.round(mod.systemWidthIn)}&quot;W × {Math.round(mod.systemDepthIn)}&quot;D
                </p>

                {/* Materials list */}
                <div className="space-y-1 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Materials
                  </p>
                  {mod.materials.map((mat, matIdx) => (
                    <div key={matIdx} className="flex justify-between text-xs text-stone-400">
                      <span>{mat.name}</span>
                      <span className="font-mono font-bold text-yellow-400">{mat.qty} {mat.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      </>)}
      {/* End of blueprints gate */}

      {/* ── Photo Completion Modal ───────────────────────────────────── */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Complete Job</h3>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
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
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-600 bg-zinc-800/50 py-8 text-stone-400 transition-colors hover:border-yellow-400/50 hover:text-yellow-400 disabled:opacity-50"
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
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[11px] font-semibold text-stone-400 transition-colors hover:text-white disabled:opacity-50"
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

      {/* ── Charge Card on File Confirmation Modal ───────────────────── */}
      {showChargeCardConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Charge Saved Card</h3>
              <button
                onClick={() => { setShowChargeCardConfirm(false); setChargeCardFallbackUrl(null); setPayError(null); }}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-stone-300">
                Charge <span className="font-bold text-white">{fmt(collectFromCustomer)}</span> to{" "}
                <span className="font-bold text-white">{customerName}</span>&apos;s card on file?
              </p>
              <div className="flex items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5">
                <CreditCard className="h-4 w-4 shrink-0 text-stone-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Card on file
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{savedCardLabel}</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-amber-200">
                  Make sure {customerName.split(" ")[0] || "the customer"} hasn&apos;t already paid in cash, check, or another method. This will run a real charge.
                </p>
              </div>
              {payError && (
                <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                  {payError}
                </div>
              )}
              {chargeCardFallbackUrl && (
                <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
                  <p className="text-[11px] text-blue-200">
                    Send the customer this link to complete payment themselves:
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(chargeCardFallbackUrl);
                      } catch {
                        // best-effort
                      }
                    }}
                    className="w-full truncate rounded bg-zinc-800 px-2 py-1.5 text-left text-[11px] font-mono text-blue-300 hover:bg-zinc-700"
                  >
                    {chargeCardFallbackUrl}
                  </button>
                </div>
              )}
              <button
                onClick={handleConfirmChargeSavedCard}
                disabled={payLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
              >
                {payLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Charge {fmt(collectFromCustomer)}
                  </>
                )}
              </button>
              <p className="text-center text-[10px] leading-relaxed text-stone-500">
                Customer authorized this charge by paying the deposit (see{" "}
                <a href="/legal/terms#payment-method-on-file" target="_blank" className="underline hover:text-stone-300">
                  Terms § Saved Payment Method
                </a>
                ). Receipt is emailed automatically on success.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Pay Confirmation Modal ─────────────────────────────── */}
      {showManualPayModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Confirm Payment</h3>
              <button
                onClick={() => setShowManualPayModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-stone-400">
                Mark this job as paid for <span className="font-bold text-white">{fmt(collectFromCustomer)}</span>?
              </p>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Payment Method
                </label>
                <select
                  value={manualPayMethod}
                  onChange={(e) => setManualPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="check">Check</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {payError && (
                <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-400">
                  {payError}
                </div>
              )}
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
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Reschedule Job</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleDate || rescheduling}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-900 transition-all hover:bg-yellow-400 disabled:opacity-50"
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

      {/* ── Schedule Modal (manual date assignment) ─────────────────────── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">Schedule Install Date</h3>
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleDate(""); }}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-xs text-stone-400">
                Assign an install date for this job. This locks the date on your schedule so no other orders can be booked for the same slot.
              </p>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Install Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate || scheduling}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-900 transition-all hover:bg-yellow-400 disabled:opacity-50"
              >
                {scheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Confirm Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/30 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h3 className="text-base font-bold text-red-400">Delete Quote</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-stone-300">
                Are you sure you want to delete this quote for <span className="font-bold text-white">{customerName}</span>?
              </p>
              {totalPrice > 0 && (
                <div className="rounded-lg bg-zinc-800 px-3 py-2 text-center">
                  <span className="text-xs text-stone-500">Quote total: </span>
                  <span className="text-sm font-bold text-white">{fmt(totalPrice)}</span>
                </div>
              )}
              <p className="text-xs text-stone-500">
                This action cannot be undone. The quote will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-bold text-stone-300 transition-colors hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteQuote}
                  disabled={deleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-red-400 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
