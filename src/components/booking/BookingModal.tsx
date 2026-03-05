"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  Calendar,
  CreditCard,
  MapPin,
  ChevronRight,
  Tag,
  Truck,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import NativeScheduler from "./NativeScheduler";
import { createDepositIntent, type LeadSource } from "@/app/actions/payments";
import { formatCurrency, formatTaxRate } from "@/utils/paymentHelpers";
import { getDepositAmount, getSalesTax, type SalesTaxResult } from "@/app/actions/fee-engine";
import { getBlackoutDates } from "@/app/actions/blackout-dates";
import { validateDiscountCode } from "@/app/actions/discount-codes";
import { calculateDeliveryFee, type DeliveryFeeResult } from "@/app/actions/delivery-fee";

// ═══════════════════════════════════════════════════════════════════════════
// BookingModal — Multi-Step: Address → Schedule → Pay
//
// Flow:
//   1. Customer enters installation address
//   2. Picks a date (capacity-aware NativeScheduler)
//   3. Clicks "Pay Deposit ($X) & Book"
//   4. Modal shows Stripe Payment Element inline
//   5. On success → creates DB record, shows success state
// ═══════════════════════════════════════════════════════════════════════════

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

type Step = "address" | "schedule" | "payment" | "success";

export interface BookingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  depositAmount: number;
  totalPrice: number;
  installerId: string;               // Supabase user ID (not Stripe account)
  source: LeadSource;                // "platform" | "partner_link"
  customerEmail?: string;
  customerName?: string;
  installerLeadTime?: number;
  installerWorkingDays?: string[];
  hasWheels?: boolean;
  totalCols?: number;
  initialAddress?: Partial<BookingAddress>;
  initialScheduledDate?: string | null;
  initialDiscount?: { code: string; amount: number } | null;
  onSuccess?: (scheduledDate: string, address: BookingAddress) => void;
}

export default function BookingModal({
  isOpen,
  onClose,
  leadId,
  depositAmount,
  totalPrice,
  installerId,
  source,
  customerEmail,
  customerName,
  installerLeadTime = 5,
  installerWorkingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  hasWheels = false,
  totalCols = 1,
  initialAddress,
  initialScheduledDate,
  initialDiscount,
  onSuccess,
}: BookingModalProps) {
  // Pre-fill address from lead flow data if available
  const prefilled = !!(initialAddress?.line1 && initialAddress?.city && initialAddress?.state && initialAddress?.zip);
  // If both address and date are pre-filled from sidebar, skip directly to payment init
  const hasPrefilledDate = !!initialScheduledDate;
  const [step, setStep] = useState<Step>(
    prefilled && hasPrefilledDate ? "payment" : prefilled ? "schedule" : "address"
  );
  const [address, setAddress] = useState<BookingAddress>({
    line1: initialAddress?.line1 || "",
    line2: initialAddress?.line2 || "",
    city: initialAddress?.city || "",
    state: initialAddress?.state || "",
    zip: initialAddress?.zip || "",
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(initialScheduledDate || null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [error, setError] = useState("");
  const [blackoutDates, setBlackoutDates] = useState<{ start_date: string; end_date: string }[]>([]);
  const [discountInput, setDiscountInput] = useState(initialDiscount?.code || "");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number } | null>(initialDiscount || null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  // Delivery fee state
  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeResult | null>(null);
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);

  // Fetch blackout dates when modal opens
  useEffect(() => {
    if (!isOpen || !installerId) return;
    getBlackoutDates(installerId).then((result) => {
      if (result.success) {
        setBlackoutDates(result.dates.map(d => ({ start_date: d.start_date, end_date: d.end_date })));
      }
    });
  }, [isOpen, installerId]);

  // Wheel Rule: 3 business day minimum for casters
  const effectiveLeadTime = hasWheels
    ? Math.max(installerLeadTime, 3)
    : installerLeadTime;

  // Delivery fee (not taxed, but included in total for platform fee)
  const deliveryFeeAmount = (deliveryFee?.applicable && deliveryFee.fee > 0) ? deliveryFee.fee : 0;

  // Grand total = build price + delivery fee
  const grandTotalWithDelivery = totalPrice + deliveryFeeAmount;

  // Deposit — computed server-side using installer's custom config (min 15% enforced)
  const [effectiveDeposit, setEffectiveDeposit] = useState(0);
  useEffect(() => {
    if (grandTotalWithDelivery > 0) {
      getDepositAmount(grandTotalWithDelivery, installerId).then(setEffectiveDeposit);
    }
  }, [grandTotalWithDelivery, installerId]);

  // Sales tax — computed server-side (tax rates stay in the black box)
  const [taxInfo, setTaxInfo] = useState<SalesTaxResult | null>(null);
  useEffect(() => {
    if (!address.state || address.state.length !== 2) {
      setTaxInfo(null);
      return;
    }
    getSalesTax(totalPrice, address.state).then(setTaxInfo);
  }, [totalPrice, address.state]);

  // Discount only reduces balance, not deposit. Installer absorbs their own discounts.
  const discountAmount = discountApplied?.amount || 0;

  // Balance at installation = grand total - deposit - discount + sales tax (tax only on build price)
  const balanceAtInstall = (grandTotalWithDelivery - effectiveDeposit - discountAmount) + (taxInfo?.taxAmount || 0);

  // Apply discount code
  async function handleApplyDiscount() {
    if (!discountInput.trim() || !installerId) return;
    setDiscountLoading(true);
    setDiscountError("");
    const result = await validateDiscountCode(discountInput.trim(), installerId, totalPrice);
    setDiscountLoading(false);
    if (result.valid) {
      setDiscountApplied({ code: result.code!, amount: result.discountAmount });
      setDiscountError("");
    } else {
      setDiscountApplied(null);
      setDiscountError(result.error || "Invalid code.");
    }
  }

  function handleRemoveDiscount() {
    setDiscountApplied(null);
    setDiscountInput("");
    setDiscountError("");
  }

  // Address validation — also calculates delivery fee
  async function handleAddressNext() {
    if (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError("Please fill in all required address fields.");
      return;
    }
    setError("");

    // Calculate delivery fee based on distance
    if (installerId && address.zip) {
      setDeliveryFeeLoading(true);
      try {
        const result = await calculateDeliveryFee(installerId, address.zip);
        setDeliveryFee(result);
      } catch {
        setDeliveryFee(null);
      }
      setDeliveryFeeLoading(false);
    }

    setStep("schedule");
  }

  // Initialize payment intent when user clicks "Pay & Book"
  const handleInitPayment = useCallback(async () => {
    if (!selectedDate) {
      setError("Please select a date first.");
      return;
    }

    setError("");
    setInitLoading(true);

    const result = await createDepositIntent({
      leadId,
      amount: effectiveDeposit, // Deposit = installer's custom rate of grand total (build + delivery)
      totalPrice: grandTotalWithDelivery, // Grand total includes delivery fee
      installerId,
      source,
      customerEmail,
      customerName,
      scheduledAt: selectedDate,
      // Tax info for installer records (collected at installation — on build price only)
      salesTaxAmount: taxInfo?.taxAmount || 0,
      billingState: address.state,
      // Discount code (reduces balance at installation, not deposit)
      discountCode: discountApplied?.code,
      discountCodeAmount: discountApplied?.amount,
      // Delivery fee (tax-exempt, but included in fee basis)
      deliveryFeeAmount: deliveryFeeAmount || undefined,
    });

    setInitLoading(false);

    if (result.success && result.clientSecret) {
      setClientSecret(result.clientSecret);
      setStep("payment");
    } else {
      setError(result.error || "Failed to initialize payment.");
    }
  }, [selectedDate, leadId, effectiveDeposit, grandTotalWithDelivery, installerId, source, customerEmail, customerName, taxInfo, address.state, discountApplied, deliveryFeeAmount]);

  // Auto-init payment when both address and date are pre-filled from sidebar
  const autoInitRef = useRef(false);
  useEffect(() => {
    if (isOpen && prefilled && hasPrefilledDate && selectedDate && effectiveDeposit > 0 && !clientSecret && !autoInitRef.current) {
      autoInitRef.current = true;
      handleInitPayment();
    }
  }, [isOpen, prefilled, hasPrefilledDate, selectedDate, effectiveDeposit, clientSecret, handleInitPayment]);

  // Reset auto-init flag when modal closes
  useEffect(() => {
    if (!isOpen) autoInitRef.current = false;
  }, [isOpen]);

  if (!isOpen) return null;

  const stepTitle: Record<Step, string> = {
    address: "Installation Address",
    schedule: "Pick a Date",
    payment: "Pay Deposit",
    success: "Booking Confirmed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-bold text-white">
            {stepTitle[step]}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="shrink-0 flex items-center gap-1 border-b border-slate-800/50 px-5 py-2">
          {(["address", "schedule", "payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === s
                    ? "bg-yellow-400 text-slate-900"
                    : step === "success" || (["address", "schedule", "payment"].indexOf(step) > i)
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-stone-600"
                }`}
              >
                {step === "success" || (["address", "schedule", "payment"].indexOf(step) > i) ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div className="h-px w-6 bg-slate-800" />
              )}
            </div>
          ))}
        </div>

        <div className="scrollbar-dark flex-1 overflow-y-auto p-5 pb-8">
          {step === "success" ? (
            /* ── Success State ───────────────────────────────────────── */
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h4 className="mb-2 text-xl font-black text-white">
                You&apos;re Booked!
              </h4>
              <p className="mb-1 text-sm text-stone-400">
                Deposit of {formatCurrency(effectiveDeposit)} received.{discountAmount > 0 && ` Discount of ${formatCurrency(discountAmount)} applied to balance.`}{deliveryFeeAmount > 0 && ` Delivery fee of ${formatCurrency(deliveryFeeAmount)} included.`}
              </p>
              {selectedDate && (
                <p className="text-sm font-semibold text-yellow-400">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              {address.line1 && (
                <p className="mt-2 text-xs text-stone-500">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {address.line1}, {address.city}, {address.state} {address.zip}
                </p>
              )}
              <p className="mt-4 text-xs text-stone-600">
                Your installer has been notified and will reach out to confirm.
              </p>
              <button
                onClick={onClose}
                className="mt-6 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          ) : step === "payment" && clientSecret ? (
            /* ── Stripe Payment Element ──────────────────────────────── */
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#facc15",
                    colorBackground: "#1e293b",
                    colorText: "#ffffff",
                    colorDanger: "#ef4444",
                    borderRadius: "10px",
                    fontFamily: "system-ui, sans-serif",
                  },
                },
              }}
            >
              <InlinePaymentForm
                totalAmount={effectiveDeposit}
                leadId={leadId}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          ) : step === "schedule" ? (
            /* ── Date Selection ─────────────────────────────────────── */
            <div className="space-y-4">
              {/* Price summary */}
              <div className="rounded-xl bg-slate-800 p-4">
                <div className="text-center mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    {deliveryFeeAmount > 0 ? "Build Price" : "Total Price"}
                  </p>
                  <p className="text-2xl font-black text-white">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>
                {/* Delivery fee line item (tax-exempt) */}
                {deliveryFeeAmount > 0 && deliveryFee && (
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-yellow-400/5 border border-yellow-400/10 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400">
                      <Truck className="h-3 w-3" />
                      Delivery Fee ({deliveryFee.distance} mi)
                    </span>
                    <span className="text-xs font-bold text-yellow-400">{formatCurrency(deliveryFeeAmount)}</span>
                  </div>
                )}
                {deliveryFeeAmount > 0 && (
                  <div className="mb-3 text-center border-t border-slate-700 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Grand Total</p>
                    <p className="text-lg font-black text-white">{formatCurrency(grandTotalWithDelivery)}</p>
                  </div>
                )}
                <div className="border-t border-slate-700 pt-3 space-y-1">
                  {/* Due Today = Deposit (installer-configured rate, min 15%) */}
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="font-bold text-stone-400">Due Today (Deposit)</span>
                    <span className="font-black text-yellow-400">
                      {formatCurrency(effectiveDeposit)}
                    </span>
                  </div>
                  {/* Balance at installation = remaining - discount + tax */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/50 mt-2">
                    <span className="text-stone-500">Remaining Balance</span>
                    <span className="text-stone-400">{formatCurrency(grandTotalWithDelivery - effectiveDeposit)}</span>
                  </div>
                  {discountApplied && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <Tag className="h-3 w-3" />
                        Code: {discountApplied.code}
                      </span>
                      <span className="text-emerald-400 font-bold">-{formatCurrency(discountApplied.amount)}</span>
                    </div>
                  )}
                  {taxInfo && taxInfo.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500">Sales Tax ({formatTaxRate(taxInfo.taxRate)})</span>
                      <span className="text-stone-400">{formatCurrency(taxInfo.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                    <span className="text-stone-400 font-medium">Total at Installation</span>
                    <span className="text-stone-300 font-semibold">{formatCurrency(balanceAtInstall)}</span>
                  </div>
                </div>
              </div>

              {hasWheels && (
                <div className="rounded-lg bg-yellow-400/10 px-3 py-2 text-center text-[11px] font-semibold text-yellow-400">
                  Caster add-on: 3 business day lead time applies
                </div>
              )}

              {/* Calendar */}
              <NativeScheduler
                leadTimeDays={effectiveLeadTime}
                workingDays={installerWorkingDays}
                blackoutDates={blackoutDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {error && (
                <p className="text-center text-xs font-medium text-red-400">
                  {error}
                </p>
              )}

              {/* Discount Code Input */}
              {!discountApplied ? (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Discount Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => { setDiscountInput(e.target.value.toUpperCase()); setDiscountError(""); }}
                      placeholder="Enter code"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") handleApplyDiscount(); }}
                    />
                    <button
                      onClick={handleApplyDiscount}
                      disabled={!discountInput.trim() || discountLoading}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                    >
                      {discountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                  {discountError && (
                    <p className="mt-1 text-xs text-red-400">{discountError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <Tag className="h-4 w-4 text-emerald-400" />
                  <span className="flex-1 text-sm font-semibold text-emerald-400">
                    {discountApplied.code} — {formatCurrency(discountApplied.amount)} off
                  </span>
                  <button onClick={handleRemoveDiscount} className="text-stone-500 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Pay & Book button */}
              <button
                onClick={handleInitPayment}
                disabled={!selectedDate || initLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-4 text-base font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 disabled:opacity-50"
              >
                {initLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Pay {formatCurrency(effectiveDeposit)} &amp; Book
                  </>
                )}
              </button>

              {!selectedDate && (
                <p className="text-center text-[11px] text-stone-600">
                  Select a date above to continue
                </p>
              )}
            </div>
          ) : (
            /* ── Address Capture (Step 1) ──────────────────────────── */
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  placeholder="123 Main St"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Apt / Suite
                </label>
                <input
                  type="text"
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  placeholder="Apt 4B"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    City *
                  </label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Austin"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    State *
                  </label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="TX"
                    maxLength={2}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Zip *
                  </label>
                  <input
                    type="text"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    placeholder="78701"
                    maxLength={5}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-center text-xs font-medium text-red-400">
                  {error}
                </p>
              )}

              <button
                onClick={handleAddressNext}
                disabled={deliveryFeeLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-4 text-base font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 disabled:opacity-50"
              >
                {deliveryFeeLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <MapPin className="h-5 w-5" />
                    Continue to Scheduling
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// InlinePaymentForm — Wraps the Stripe Payment Element
// Must be inside an <Elements> provider.
// ═══════════════════════════════════════════════════════════════════════════

function InlinePaymentForm({
  totalAmount,
  leadId,
  onError,
}: {
  totalAmount: number;
  leadId: string;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    // Stripe-native redirect — Stripe handles navigation to /success
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success?jobId=${leadId}`,
      },
    });

    // Only reaches here if there was an immediate error (card declined etc.)
    setProcessing(false);

    if (error) {
      onError(error.message || "Payment failed. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-yellow-400/10 px-4 py-3 text-center">
        <span className="text-sm font-bold text-yellow-400">
          Deposit: {formatCurrency(totalAmount)}
        </span>
        <span className="block text-[10px] text-stone-500 mt-0.5">
          Sales tax collected at installation
        </span>
      </div>

      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      <button
        type="submit"
        disabled={!stripe || processing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-4 text-base font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 disabled:opacity-50"
      >
        {processing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            Pay {formatCurrency(totalAmount)}
          </>
        )}
      </button>

      <p className="mt-2 text-center text-xs text-stone-500">
        By booking, you agree to the{" "}
        <a href="/legal/terms" target="_blank" className="underline hover:text-stone-300">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/legal/terms#installation" target="_blank" className="underline hover:text-stone-300">
          Installation Agreement
        </a>.
      </p>
    </form>
  );
}
