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
 *   Network lead (source: network/search)           → Always 15%
 *   Direct lead  (source: partner_link/installer_manual) → Free plan: 15%, Pro plan: 5%
 */
function resolveFeeRate(source?: string, isPro?: boolean): { rate: number; label: string } {
  const isDirectLead = source === "partner_link" || source === "installer_manual";

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
    feeWaived: isPro && (source === "partner_link" || source === "installer_manual"),
    feeRate,
    feeLabel,
  };
}

/**
 * Format currency for display (always shows 2 decimal places).
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════════════════════════════════════════
// Sales Tax Calculation
//
// State-level sales tax rates for services. Note: Some states don't tax
// services (labor), but most tax the product portion. For simplicity, we
// apply the state rate to the total (materials + labor combined).
// The tax is passed to the installer for their tax compliance.
//
// IMPORTANT: Tax is assessed on the FULL BUILD AMOUNT before any discounts.
// Deposit is always 15% of the original price — discount codes do NOT change it.
// Discount codes only reduce the remaining balance (installer absorbs the discount).
//
// Example: $1000 build, 6% tax, 15% deposit, $50 discount
//   - Tax: $1000 × 6% = $60 (on full build, before discounts)
//   - Deposit: $1000 × 15% = $150 (unchanged by discount)
//   - Due today: $150 (deposit only, tax collected at installation)
//   - Balance due: $800 + $60 tax = $860 (remaining $850 - $50 discount + $60 tax)
// ═══════════════════════════════════════════════════════════════════════════

const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04, AK: 0.00, AZ: 0.056, AR: 0.065, CA: 0.0725,
  CO: 0.029, CT: 0.0635, DE: 0.00, FL: 0.06, GA: 0.04,
  HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06,
  KS: 0.065, KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06,
  MA: 0.0625, MI: 0.06, MN: 0.06875, MS: 0.07, MO: 0.04225,
  MT: 0.00, NE: 0.055, NV: 0.0685, NH: 0.00, NJ: 0.06625,
  NM: 0.05125, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575,
  OK: 0.045, OR: 0.00, PA: 0.06, RI: 0.07, SC: 0.06,
  SD: 0.045, TN: 0.07, TX: 0.0625, UT: 0.0485, VT: 0.06,
  VA: 0.053, WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04,
  DC: 0.06,
};

export interface SalesTaxResult {
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  stateName: string;
}

/**
 * Calculate sales tax based on state code.
 *
 * IMPORTANT: Pass the FULL BUILD AMOUNT as subtotal, not the deposit.
 * Tax is assessed on the entire build price upfront.
 *
 * @param subtotal - The full build/job price (NOT the deposit)
 * @param stateCode - 2-letter state code (e.g., "TX", "CA")
 * @returns Tax amount, rate, and total (subtotal + tax)
 */
export function calculateSalesTax(subtotal: number, stateCode: string): SalesTaxResult {
  const state = stateCode.toUpperCase().trim();
  const taxRate = STATE_TAX_RATES[state] ?? 0;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    taxRate,
    taxAmount,
    subtotal,
    total,
    stateName: state,
  };
}

/**
 * Get the tax rate for a state (for display before calculation).
 */
export function getTaxRateForState(stateCode: string): number {
  const state = stateCode.toUpperCase().trim();
  return STATE_TAX_RATES[state] ?? 0;
}

/**
 * Format tax rate as percentage string.
 */
export function formatTaxRate(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}
