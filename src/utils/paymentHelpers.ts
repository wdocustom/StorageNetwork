// ═══════════════════════════════════════════════════════════════════════════
// Payment Helpers — Client-side financial calculations
// Used by JobTicket and Booking components for display math.
// Server-side Stripe logic remains in src/app/actions/payments.ts.
// ═══════════════════════════════════════════════════════════════════════════

const STANDARD_FEE_RATE = 0.15; // 15% platform fee for network leads
const PRO_FEE_RATE = 0.01;      // 1% infrastructure fee for Pro partner leads

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
  feeRate: number;
}

/**
 * Calculate the installer's true net profit after fees and materials.
 *
 * Standard flow (Network Lead):
 *   Total: $877  →  Fee (15%): -$132  →  Collect: $745
 *   Materials: -$332  →  Net Profit: $413
 *
 * Pro flow (Partner Lead):
 *   Total: $877  →  Fee (1%): -$9  →  Collect: $868
 *   Materials: -$332  →  Net Profit: $536
 */
export function calculateNetProfit(input: NetProfitInput): NetProfitResult {
  const { totalPrice, materialCost, feeStatus } = input;
  const isPro = feeStatus === "waived";
  const feeRate = isPro ? PRO_FEE_RATE : STANDARD_FEE_RATE;

  const depositAmount = Math.round(totalPrice * feeRate * 100) / 100;
  const amountToCollect = Math.round((totalPrice - depositAmount) * 100) / 100;
  const netProfit = Math.max(0, Math.round((amountToCollect - materialCost) * 100) / 100);

  return {
    totalPrice,
    depositAmount,
    amountToCollect,
    estMaterials: materialCost,
    netProfit,
    feeWaived: isPro,
    feeRate,
  };
}

/**
 * Format currency for display (no decimals for round numbers).
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
