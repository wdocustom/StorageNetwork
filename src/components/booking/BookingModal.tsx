"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  Calendar,
  CreditCard,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import NativeScheduler from "./NativeScheduler";
import { createDepositIntent } from "@/app/actions/payments";
import { formatCurrency } from "@/utils/paymentHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// BookingModal — Inline Stripe Payment + Native Scheduling
//
// Flow:
//   1. Customer picks a date (NativeScheduler)
//   2. Clicks "Pay Deposit ($X) & Book"
//   3. Modal expands to show Stripe Payment Element inline
//   4. On success → creates DB record, shows success state (no page reload)
// ═══════════════════════════════════════════════════════════════════════════

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  depositAmount: number;
  totalPrice: number;
  installerStripeId: string;
  customerEmail?: string;
  customerName?: string;
  installerLeadTime?: number;
  installerWorkingDays?: string[];
  onSuccess?: (scheduledDate: string) => void;
}

export default function BookingModal({
  isOpen,
  onClose,
  leadId,
  depositAmount,
  totalPrice,
  installerStripeId,
  customerEmail,
  customerName,
  installerLeadTime = 5,
  installerWorkingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  onSuccess,
}: BookingModalProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState("");

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
      amount: depositAmount,
      installerStripeId,
      customerEmail,
      scheduledAt: selectedDate,
    });

    setInitLoading(false);

    if (result.success && result.clientSecret) {
      setClientSecret(result.clientSecret);
    } else {
      setError(result.error || "Failed to initialize payment.");
    }
  }, [selectedDate, leadId, depositAmount, installerStripeId, customerEmail]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-bold text-white">
            {paymentSuccess ? "Booking Confirmed" : "Book Installation"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {paymentSuccess ? (
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
          ) : clientSecret ? (
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
                depositAmount={depositAmount}
                onSuccess={() => {
                  setPaymentSuccess(true);
                  if (selectedDate) onSuccess?.(selectedDate);
                }}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          ) : (
            /* ── Date Selection + Pay Button ─────────────────────────── */
            <div className="space-y-4">
              {/* Price summary */}
              <div className="rounded-xl bg-slate-800 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Total Price
                </p>
                <p className="text-2xl font-black text-white">
                  {formatCurrency(totalPrice)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Deposit due today:{" "}
                  <span className="font-bold text-yellow-400">
                    {formatCurrency(depositAmount)}
                  </span>
                </p>
              </div>

              {/* Calendar */}
              <NativeScheduler
                leadTimeDays={installerLeadTime}
                workingDays={installerWorkingDays}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              {error && (
                <p className="text-center text-xs font-medium text-red-400">
                  {error}
                </p>
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
                    Pay Deposit ({formatCurrency(depositAmount)}) &amp; Book
                  </>
                )}
              </button>

              {!selectedDate && (
                <p className="text-center text-[11px] text-stone-600">
                  Select a date above to continue
                </p>
              )}
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
  depositAmount,
  onSuccess,
  onError,
}: {
  depositAmount: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    setProcessing(false);

    if (error) {
      onError(error.message || "Payment failed. Please try again.");
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-yellow-400/10 px-4 py-3 text-center">
        <span className="text-sm font-bold text-yellow-400">
          Deposit: {formatCurrency(depositAmount)}
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
            Complete Payment
          </>
        )}
      </button>
    </form>
  );
}
