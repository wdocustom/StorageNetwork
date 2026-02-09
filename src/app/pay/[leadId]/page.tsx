"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { fetchPendingLead, type PendingLeadDetails } from "@/app/actions/abandoned-cart";
import { createDepositIntent, type LeadSource } from "@/app/actions/payments";

// ═══════════════════════════════════════════════════════════════════════════
// Resume Payment Page — /pay/[leadId]
//
// Allows customers to complete abandoned orders
// ═══════════════════════════════════════════════════════════════════════════

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function ResumePaymentPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<PendingLeadDetails | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch lead details on mount
  useEffect(() => {
    async function loadLead() {
      if (!leadId) {
        setError("Invalid order link.");
        setLoading(false);
        return;
      }

      const result = await fetchPendingLead(leadId);
      if (!result.success || !result.lead) {
        setError(result.error || "Order not found.");
        setLoading(false);
        return;
      }

      setLead(result.lead);
      setLoading(false);
    }

    loadLead();
  }, [leadId]);

  // Initialize Stripe payment
  const initializePayment = useCallback(async () => {
    if (!lead) return;

    setInitializingPayment(true);
    setError(null);

    try {
      const result = await createDepositIntent({
        leadId: lead.id,
        depositAmount: lead.deposit_amount,
        totalPrice: lead.estimated_price,
        installerId: lead.installer_id || undefined,
        customerEmail: lead.customer_email,
        customerName: lead.customer_name,
        source: (lead.source as LeadSource) || "platform",
      });

      if (!result.success || !result.clientSecret) {
        setError(result.error || "Failed to initialize payment.");
        setInitializingPayment(false);
        return;
      }

      setClientSecret(result.clientSecret);
    } catch (err) {
      setError("Failed to initialize payment. Please try again.");
      console.error("Payment init error:", err);
    } finally {
      setInitializingPayment(false);
    }
  }, [lead]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Loading State
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-400" />
          <p className="mt-4 text-sm text-stone-400">Loading your order...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Error State
  // ═══════════════════════════════════════════════════════════════════════════

  if (error && !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Order Not Found</h1>
          <p className="mb-6 text-sm text-stone-400">{error}</p>
          <a
            href="/design"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Start a New Order
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Success State
  // ═══════════════════════════════════════════════════════════════════════════

  if (paymentSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-emerald-800 bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Payment Complete!</h1>
          <p className="mb-6 text-sm text-stone-400">
            Your order has been confirmed. You&apos;ll receive a confirmation email shortly
            with your installation details.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Main Payment Page
  // ═══════════════════════════════════════════════════════════════════════════

  if (!lead) return null;

  // Parse quote data for display
  const units = Array.isArray(lead.quote_data) ? lead.quote_data : [];
  const unitCount = units.length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 py-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Complete Your Order</h1>
          {lead.installer_name && (
            <p className="mt-1 text-sm text-stone-400">
              with <span className="font-semibold text-yellow-400">{lead.installer_name}</span>
            </p>
          )}
        </div>

        {/* Order Summary Card */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Order Summary
            </h2>
          </div>

          {/* Units */}
          <div className="mb-4 space-y-2">
            {units.map((unit: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    Unit #{idx + 1}: {unit.desc || `${unit.cols}W × ${unit.rows}H`}
                  </p>
                  <p className="text-xs text-stone-400">
                    {[
                      unit.hasTotes && "Totes",
                      unit.hasWheels && "Wheels",
                      unit.hasTop && "Top",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Frame Only"}
                  </p>
                </div>
                <span className="text-sm font-bold text-white">
                  ${(unit.price || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-400">Total ({unitCount} unit{unitCount !== 1 ? "s" : ""})</span>
              <span className="text-lg font-bold text-white">${lead.estimated_price.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-stone-400">Deposit Due (15%)</span>
              <span className="text-xl font-black text-yellow-400">
                ${lead.deposit_amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            Customer Details
          </h3>
          <div className="space-y-1 text-sm">
            <p className="text-white">{lead.customer_name}</p>
            <p className="text-stone-400">{lead.customer_email}</p>
            {lead.customer_phone && (
              <p className="text-stone-400">{lead.customer_phone}</p>
            )}
            {lead.address && (
              <p className="text-stone-400">{lead.address}</p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Payment Section */}
        {!clientSecret ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Payment
              </h2>
            </div>

            <p className="mb-4 text-sm text-stone-400">
              Click below to securely pay your deposit and confirm your order.
            </p>

            <button
              onClick={initializePayment}
              disabled={initializingPayment}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
            >
              {initializingPayment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {initializingPayment ? "Initializing..." : `Pay $${lead.deposit_amount.toLocaleString()} Deposit`}
            </button>

            {/* Trust Badges */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Secure Checkout
              </span>
              <span>•</span>
              <span>Powered by Stripe</span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Enter Payment Details
              </h2>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#facc15",
                    colorBackground: "#1e293b",
                    colorText: "#f8fafc",
                    colorDanger: "#ef4444",
                    fontFamily: "system-ui, sans-serif",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <PaymentForm
                depositAmount={lead.deposit_amount}
                onSuccess={() => setPaymentSuccess(true)}
                onError={setError}
              />
            </Elements>
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Payment Form Component (uses Stripe Elements context)
// ═══════════════════════════════════════════════════════════════════════════

function PaymentForm({
  depositAmount,
  onSuccess,
  onError,
}: {
  depositAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "Payment validation failed.");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      onError(confirmError.message || "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    // Payment succeeded
    onSuccess();
    setProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {processing ? "Processing..." : `Pay $${depositAmount.toLocaleString()}`}
      </button>

      <p className="mt-3 text-center text-xs text-stone-500">
        Your card will be charged ${depositAmount.toLocaleString()}. The remaining balance
        is due upon installation.
      </p>
    </form>
  );
}
