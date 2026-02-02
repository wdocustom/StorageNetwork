// ═══════════════════════════════════════════════════════════════════════════
// Payment Helpers — Client-side financial calculations
// Used by JobTicket and Booking components for display math.
// Server-side Stripe logic remains in src/app/actions/payments.ts.
// ═══════════════════════════════════════════════════════════════════════════

const NETWORK_FEE_RATE = 0.15;   // 15% — all network/search leads
const DIRECT_FREE_FEE_RATE = 0.15; // 15% — direct leads on Free plan
const DIRECT_PRO_FEE_RATE = 0.05;  // 5%  — direct leads on Pro plan

export type LeadSource = "network" | "search" | "partner_link" | string;

export interface NetProfitInput {
  totalPrice: number;
  materialCost: number;
  feeStatus: "standard" | "waived";
  source?: LeadSource;
  isPro?: boolean;
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
  feeLabel: string;
}

/**
 * Fee decision tree:
 *   Network lead (source: network/search)  → Always 15%
 *   Direct lead  (source: partner_link)     → Free plan: 15%, Pro plan: 5%
 */
function resolveFeeRate(source?: string, isPro?: boolean): { rate: number; label: string } {
  const isDirectLead = source === "partner_link";

  if (!isDirectLead) {
    // Network / search / unknown → always 15%
    return { rate: NETWORK_FEE_RATE, label: "Network Lead Fee (15%)" };
  }

  // Direct lead
  if (isPro) {
    return { rate: DIRECT_PRO_FEE_RATE, label: "Platform Fee (5%)" };
  }
  return { rate: DIRECT_FREE_FEE_RATE, label: "Network Lead Fee (15%)" };
}

/**
 * Calculate the installer's true net profit after fees and materials.
 *
 * Network lead:          Fee 15% always
 * Direct lead (Free):    Fee 15%
 * Direct lead (Pro):     Fee 5%
 */
export function calculateNetProfit(input: NetProfitInput): NetProfitResult {
  const { totalPrice, materialCost, feeStatus, source, isPro: isProInput } = input;
  // Backward compat: feeStatus="waived" + partner_link → Pro
  const isPro = isProInput ?? feeStatus === "waived";
  const { rate: feeRate, label: feeLabel } = resolveFeeRate(source, isPro);

  const depositAmount = Math.round(totalPrice * feeRate * 100) / 100;
  const amountToCollect = Math.round((totalPrice - depositAmount) * 100) / 100;
  const netProfit = Math.max(0, Math.round((amountToCollect - materialCost) * 100) / 100);

  return {
    totalPrice,
    depositAmount,
    amountToCollect,
    estMaterials: materialCost,
    netProfit,
    feeWaived: isPro && source === "partner_link",
    feeRate,
    feeLabel,
  };
}

/**
 * Format currency for display (no decimals for round numbers).
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
