"use client";

// ═══════════════════════════════════════════════════════════════════════════
// StatusBadge — Unified status badge used across all dashboard pages
// ═══════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  status: string;
  depositPaid: boolean;
}

export default function StatusBadge({ status, depositPaid }: StatusBadgeProps) {
  const isFullyPaid = status === "paid" || status === "completed";
  const isPaymentPending = status === "payment_pending";
  const isDepositPaid = depositPaid || status === "deposit_paid";
  const isExpired = status === "expired";
  const isPendingPayment = status === "pending_payment";

  if (isExpired) {
    return (
      <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-[10px] font-bold text-gray-400">
        Expired
      </span>
    );
  }

  if (isPendingPayment) {
    return (
      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
        Unpaid Quote
      </span>
    );
  }

  if (isFullyPaid) {
    return (
      <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
        Completed
      </span>
    );
  }

  if (isPaymentPending) {
    return (
      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
        Awaiting Payment
      </span>
    );
  }

  if (isDepositPaid) {
    return (
      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
        Pending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
      Awaiting Deposit
    </span>
  );
}
