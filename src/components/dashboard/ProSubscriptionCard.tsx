"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Calendar,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import {
  getProSubscriptionStatus,
  cancelProSubscription,
  reactivateProSubscription,
  createCustomerPortalSession,
} from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Pro Subscription Card — Shows subscription status and management options
// ═══════════════════════════════════════════════════════════════════════════

interface ProSubscriptionCardProps {
  userId: string;
  slug: string | null;
}

export default function ProSubscriptionCard({
  userId,
  slug,
}: ProSubscriptionCardProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<{
    status?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      const result = await getProSubscriptionStatus(userId);
      if (result.success) {
        setStatus({
          status: result.status,
          cancelAtPeriodEnd: result.cancelAtPeriodEnd,
          currentPeriodEnd: result.currentPeriodEnd,
        });
      }
      setLoading(false);
    }
    fetchStatus();
  }, [userId]);

  async function handleManageSubscription() {
    setActionLoading(true);
    setError("");

    const result = await createCustomerPortalSession(userId);

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Failed to open billing portal");
      setActionLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setActionLoading(true);
    setError("");

    const result = await cancelProSubscription(userId);

    if (result.success) {
      setStatus((prev) => ({
        ...prev,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: result.cancelDate,
      }));
      setShowCancelConfirm(false);
    } else {
      setError(result.error || "Failed to cancel subscription");
    }
    setActionLoading(false);
  }

  async function handleReactivate() {
    setActionLoading(true);
    setError("");

    const result = await reactivateProSubscription(userId);

    if (result.success) {
      setStatus((prev) => ({
        ...prev,
        cancelAtPeriodEnd: false,
      }));
    } else {
      setError(result.error || "Failed to reactivate subscription");
    }
    setActionLoading(false);
  }

  function formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900 p-5">
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
          <span className="text-sm text-stone-400">Loading subscription...</span>
        </div>
      </section>
    );
  }

  const isCanceling = status?.cancelAtPeriodEnd === true;

  return (
    <section className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-slate-900 to-slate-900 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400">
          <Zap className="h-5 w-5 text-gray-950" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-yellow-400">
            Pro Subscription {isCanceling ? "(Canceling)" : "Active"}
          </h2>
          <p className="text-xs text-stone-500">
            {isCanceling
              ? `Access until ${formatDate(status?.currentPeriodEnd || "")}`
              : "Enjoying 5% platform fees and custom branding"}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isCanceling
              ? "bg-amber-500/20 text-amber-400"
              : "bg-emerald-500/20 text-emerald-400"
          }`}
        >
          {isCanceling ? "Canceling" : "Active"}
        </span>
      </div>

      {/* Canceling Warning */}
      {isCanceling && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-400">
                Subscription ending soon
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Your Pro benefits will end on{" "}
                <span className="font-semibold text-white">
                  {formatDate(status?.currentPeriodEnd || "")}
                </span>
                . After that, you'll revert to the Free plan with 15% fees.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Link */}
      {slug && (
        <div className="mb-4 rounded-lg bg-slate-800/50 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
            Your Custom Link
          </p>
          <p className="text-sm font-medium text-blue-400">
            storage-network.app/design?installer={slug}
          </p>
        </div>
      )}

      {/* Next Billing */}
      {!isCanceling && status?.currentPeriodEnd && (
        <div className="mb-4 flex items-center gap-2 text-xs text-stone-500">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            Next billing: {formatDate(status.currentPeriodEnd)} · $99.00
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 p-2 text-center text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {isCanceling ? (
          <button
            onClick={handleReactivate}
            disabled={actionLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Keep My Pro Subscription
          </button>
        ) : (
          <>
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Manage Billing
              <ExternalLink className="h-3 w-3" />
            </button>

            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full py-2 text-center text-xs text-stone-500 transition-colors hover:text-red-400"
              >
                Cancel subscription
              </button>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="mb-3 text-xs text-stone-400">
                  Are you sure? You'll keep Pro benefits until the end of your
                  billing period, then revert to Free with 15% fees.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-xs font-medium text-white hover:bg-slate-700"
                  >
                    Keep Pro
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={actionLoading}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-500 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {actionLoading && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Yes, Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
