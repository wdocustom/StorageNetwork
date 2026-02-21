"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  Calendar,
  CreditCard,
  MapPin,
  ChevronRight,
  Gift,
  Tag,
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
import { formatCurrency, calculateSalesTax, formatTaxRate } from "@/utils/paymentHelpers";
import { getBlackoutDates } from "@/app/actions/blackout-dates";
import { checkFirstOrderDiscount } from "@/app/actions/analytics";
import { validateDiscountCode } from "@/app/actions/discount-codes";

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
  onSuccess,
}: BookingModalProps) {
  // Pre-fill address from lead flow data if available
  const prefilled = !!(initialAddress?.line1 && initialAddress?.city && initialAddress?.state && initialAddress?.zip);
  const [step, setStep] = useState<Step>(prefilled ? "schedule" : "address");
  const [address, setAddress] = useState<BookingAddress>({
    line1: initialAddress?.line1 || "",
    line2: initialAddress?.line2 || "",
    city: initialAddress?.city || "",
    state: initialAddress?.state || "",
    zip: initialAddress?.zip || "",
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [error, setError] = useState("");
  const [blackoutDates, setBlackoutDates] = useState<{ start_date: string; end_date: string }[]>([]);
  const [firstOrderDiscount, setFirstOrderDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  // Fetch blackout dates and check first-order discount when modal opens
  useEffect(() => {
    if (!isOpen || !installerId) return;
    getBlackoutDates(installerId).then((result) => {
      if (result.success) {
        setBlackoutDates(result.dates.map(d => ({ start_date: d.start_date, end_date: d.end_date })));
      }
    });
    // Check first-order discount eligibility
    if (customerEmail) {
      checkFirstOrderDiscount(customerEmail).then((result) => {
        setFirstOrderDiscount(result.discountAmount);
      });
    }
  }, [isOpen, installerId, customerEmail]);

  // Wheel Rule: 3 business day minimum for casters
  const effectiveLeadTime = hasWheels
    ? Math.max(installerLeadTime, 3)
    : installerLeadTime;

  // Calculate sales tax based on state (for display purposes)
  // Tax is assessed on the FULL BUILD AMOUNT and collected at installation
  const taxInfo = useMemo(() => {
    if (!address.state || address.state.length !== 2) return null;
    return calculateSalesTax(totalPrice, address.state);
  }, [totalPrice, address.state]);

  // Balance at installation = remaining build cost + sales tax
  const balanceAtInstall = (totalPrice - depositAmount) + (taxInfo?.taxAmount || 0);

  // Effective deposit after all discounts
  const effectiveDeposit = depositAmount - firstOrderDiscount - (discountApplied?.amount || 0);

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

  // Address validation
  function handleAddressNext() {
    if (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError("Please fill in all required address fields.");
      return;
    }
    setError("");
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
      amount: depositAmount, // Deposit only — tax collected at installation
      totalPrice,
      installerId,
      source,
      customerEmail,
      customerName,
      scheduledAt: selectedDate,
      // Tax info for installer records (collected at installation)
      salesTaxAmount: taxInfo?.taxAmount || 0,
      billingState: address.state,
      // First-order discount (deducted from platform fee, not installer)
      firstOrderDiscount: firstOrderDiscount,
      // Discount code
      discountCode: discountApplied?.code,
      discountCodeAmount: discountApplied?.amount,
    });

    setInitLoading(false);

    if (result.success && result.clientSecret) {
      setClientSecret(result.clientSecret);
      setStep("payment");
    } else {
      setError(result.error || "Failed to initialize payment.");
    }
  }, [selectedDate, leadId, depositAmount, totalPrice, installerId, source, customerEmail, customerName, taxInfo, address.state, firstOrderDiscount, discountApplied]);

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

        <div className="flex-1 overflow-y-auto p-5 pb-8">
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
                Deposit of {formatCurrency(depositAmount)} received.
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
                    Total Price
                  </p>
                  <p className="text-2xl font-black text-white">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>
                <div className="border-t border-slate-700 pt-3 space-y-1">
                  {/* Due Today = Deposit only */}
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="font-bold text-stone-400">Due Today (Deposit)</span>
                    <span className="font-black text-yellow-400">
                      {(firstOrderDiscount > 0 || discountApplied) ? (
                        <>
                          <span className="line-through text-stone-500 text-xs mr-1">{formatCurrency(depositAmount)}</span>
                          {formatCurrency(effectiveDeposit)}
                        </>
                      ) : (
                        formatCurrency(depositAmount)
                      )}
                    </span>
                  </div>
                  {firstOrderDiscount > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-medium">First-order discount</span>
                      <span className="text-emerald-400 font-bold">-{formatCurrency(firstOrderDiscount)}</span>
                    </div>
                  )}
                  {discountApplied && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <Tag className="h-3 w-3" />
                        Code: {discountApplied.code}
                      </span>
                      <span className="text-emerald-400 font-bold">-{formatCurrency(discountApplied.amount)}</span>
                    </div>
                  )}
                  {/* Balance at installation = remaining + tax */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/50 mt-2">
                    <span className="text-stone-500">Balance at Installation</span>
                    <span className="text-stone-400">{formatCurrency(totalPrice - depositAmount)}</span>
                  </div>
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

              {/* First-order discount ribbon */}
              {firstOrderDiscount > 0 && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Gift className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-400">
                      First-Time Customer — Save ${firstOrderDiscount}!
                    </p>
                    <p className="text-[10px] text-emerald-400/70">
                      Discount applied automatically at checkout
                    </p>
                  </div>
                </div>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-4 text-base font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400"
              >
                <MapPin className="h-5 w-5" />
                Continue to Scheduling
                <ChevronRight className="h-5 w-5" />
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
