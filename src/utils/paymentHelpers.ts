// ═══════════════════════════════════════════════════════════════════════════
// Payment Helpers — Client-side financial calculations
// Used by JobTicket and Booking components for display math.
// Server-side Stripe logic remains in src/app/actions/payments.ts.
// ═══════════════════════════════════════════════════════════════════════════

const DEPOSIT_RATE = 0.15; // 15%

export interface NetProfitInput {
  totalPrice: number;
  materialCost: number;
  feeStatus: "standard" | "waived";
  depositPaid?: boolean;
}

export interface NetProfitResult {
  totalPrice: number;
  depositAmount: number;
  amountToCollect: number;
  estMaterials: number;
  netProfit: number;
  feeWaived: boolean;
}

/**
 * Calculate the installer's true net profit after deposit/commission and materials.
 *
 * Standard flow:
 *   Total: $877  →  Deposit/Commission (15%): -$132  →  Collect: $745
 *   Materials: -$332  →  Net Profit: $413
 *
 * Waived fee (Pro):
 *   Total: $877  →  Deposit: $0 (waived)  →  Collect: $877
 *   Materials: -$332  →  Net Profit: $545
 */
export function calculateNetProfit(input: NetProfitInput): NetProfitResult {
  const { totalPrice, materialCost, feeStatus } = input;
  const feeWaived = feeStatus === "waived";

  const depositAmount = feeWaived
    ? 0
    : Math.round(totalPrice * DEPOSIT_RATE * 100) / 100;

  const amountToCollect = Math.round((totalPrice - depositAmount) * 100) / 100;
  const netProfit = Math.max(0, Math.round((amountToCollect - materialCost) * 100) / 100);

  return {
    totalPrice,
    depositAmount,
    amountToCollect,
    estMaterials: materialCost,
    netProfit,
    feeWaived,
  };
}

/**
 * Format currency for display (no decimals for round numbers).
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
