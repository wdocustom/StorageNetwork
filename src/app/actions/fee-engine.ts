"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Fee Engine — Black Box
//
// All fee calculations, deposit math, tax lookups, and profit calculations
// happen here. The client NEVER sees fee formulas, rate constants, or
// pricing decision trees. It only receives computed display values.
//
// This is the single source of truth for:
//   - Deposit rate
//   - Platform fee rates (network, direct-free, direct-pro)
//   - State sales tax rates
//   - Net profit calculations
//   - Pro vs Free fee comparison
//   - Build page profit breakdown
//
// The browser bundle contains zero knowledge of how any of these are derived.
// ═══════════════════════════════════════════════════════════════════════════

// ── Fee Constants (server-only, never shipped to client) ─────────────────
const DEPOSIT_RATE = 0.15;
const NETWORK_FEE_RATE = 0.15;
const DIRECT_FREE_FEE_RATE = 0.15;
const DIRECT_PRO_FEE_RATE = 0.03;

// ── Pricing Constants (server-only) ─────────────────────────────────────
const PRICE_PER_SLOT = 30;
const TOTE_PRICE = 12;
const WHEELS_PRICE = 65;
const PRO_MONTHLY_COST = 49;
const PRO_ORIGINAL_PRICE = 99;

// ── State Tax Rates (server-only) ────────────────────────────────────────
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

// ── Shared Types (safe to export — these are just shapes, no values) ────

export interface SalesTaxResult {
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  stateName: string;
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

export interface ProFeeComparison {
  jobPrice: number;
  freeFee: number;
  proFee: number;
  savings: number;
  jobsToBreakEven: number;
  monthlyPrice: number;
  originalPrice: number;
}

export interface BuildFeeBreakdown {
  networkFeePercent: string;
  networkFeeAmount: number;
  networkCollect: number;
  networkNetProfit: number;
  directFeePercent: string;
  directFeeAmount: number;
  directCollect: number;
  directNetProfit: number;
  depositAmount: number;
  proSavingsOnDirect: number; // How much a Free user would save per job by upgrading
}

// ── Server Actions ───────────────────────────────────────────────────────

/**
 * Calculate the deposit amount for a given grand total.
 * Client never sees the deposit rate constant.
 */
export async function getDepositAmount(grandTotal: number): Promise<number> {
  return Math.round(grandTotal * DEPOSIT_RATE * 100) / 100;
}

/**
 * Calculate sales tax for a given subtotal and state.
 * All 50 state tax rates stay server-side.
 */
export async function getSalesTax(
  subtotal: number,
  stateCode: string
): Promise<SalesTaxResult> {
  const state = stateCode.toUpperCase().trim();
  const taxRate = STATE_TAX_RATES[state] ?? 0;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { taxRate, taxAmount, subtotal, total, stateName: state };
}

/**
 * Calculate the installer's true net profit after fees and materials.
 * Fee decision tree stays server-side — client only gets final numbers.
 */
export async function getNetProfit(input: {
  totalPrice: number;
  materialCost: number;
  feeStatus: "standard" | "waived";
  source?: string;
  isPro?: boolean;
}): Promise<NetProfitResult> {
  const { totalPrice, materialCost, feeStatus, source, isPro: isProInput } = input;
  const isPro = isProInput ?? feeStatus === "waived";

  const isDirectLead = source === "partner_link" || source === "installer_manual";
  let feeRate: number;
  let feeLabel: string;

  if (!isDirectLead) {
    feeRate = NETWORK_FEE_RATE;
    feeLabel = "Network Lead Fee (15%)";
  } else if (isPro) {
    feeRate = DIRECT_PRO_FEE_RATE;
    feeLabel = "Platform Fee (3%)";
  } else {
    feeRate = DIRECT_FREE_FEE_RATE;
    feeLabel = "Network Lead Fee (15%)";
  }

  const depositAmount = Math.round(totalPrice * feeRate * 100) / 100;
  const amountToCollect = Math.round((totalPrice - depositAmount) * 100) / 100;
  const netProfit = Math.max(0, Math.round((amountToCollect - materialCost) * 100) / 100);

  return {
    totalPrice,
    depositAmount,
    amountToCollect,
    estMaterials: materialCost,
    netProfit,
    feeWaived: isPro && isDirectLead,
    feeRate,
    feeLabel,
  };
}

/**
 * Interactive fee comparison for the Pro upgrade calculator.
 * All pricing constants and fee math stay server-side.
 */
export async function getProFeeComparison(slots: number): Promise<ProFeeComparison> {
  const clampedSlots = Math.max(1, Math.min(36, slots));
  const jobPrice = clampedSlots * PRICE_PER_SLOT + clampedSlots * TOTE_PRICE + WHEELS_PRICE;

  const freeFee = Math.round(jobPrice * DIRECT_FREE_FEE_RATE);
  const proFee = Math.round(jobPrice * DIRECT_PRO_FEE_RATE);
  const savings = freeFee - proFee;
  const jobsToBreakEven = savings > 0 ? Math.ceil(PRO_MONTHLY_COST / savings) : 0;

  return {
    jobPrice,
    freeFee,
    proFee,
    savings,
    jobsToBreakEven,
    monthlyPrice: PRO_MONTHLY_COST,
    originalPrice: PRO_ORIGINAL_PRICE,
  };
}

/**
 * Fee breakdown for the build page profit calculator.
 * Returns display-ready values — no fee constants exposed to the client.
 */
export async function getBuildFeeBreakdown(
  jobPrice: number,
  materialsCost: number,
  isPro: boolean
): Promise<BuildFeeBreakdown> {
  const networkFee = Math.round(jobPrice * NETWORK_FEE_RATE);
  const directFeeRate = isPro ? DIRECT_PRO_FEE_RATE : DIRECT_FREE_FEE_RATE;
  const directFee = Math.round(jobPrice * directFeeRate);

  // Pro savings: difference between Free direct fee and Pro direct fee
  const freeDirect = Math.round(jobPrice * DIRECT_FREE_FEE_RATE);
  const proDirect = Math.round(jobPrice * DIRECT_PRO_FEE_RATE);

  return {
    networkFeePercent: "15%",
    networkFeeAmount: networkFee,
    networkCollect: Math.round(jobPrice * (1 - NETWORK_FEE_RATE)),
    networkNetProfit: Math.max(0, Math.round(jobPrice * (1 - NETWORK_FEE_RATE) - materialsCost)),
    directFeePercent: isPro ? "3%" : "15%",
    directFeeAmount: directFee,
    directCollect: Math.round(jobPrice * (1 - directFeeRate)),
    directNetProfit: Math.max(0, Math.round(jobPrice * (1 - directFeeRate) - materialsCost)),
    depositAmount: Math.round(jobPrice * DEPOSIT_RATE),
    proSavingsOnDirect: freeDirect - proDirect,
  };
}

/**
 * Marketing fee comparison for the features page calculator.
 * Given a job price and materials cost, returns Free vs Pro profit comparison.
 */
export async function getMarketingComparison(
  price: number,
  materials: number
): Promise<{
  freeProfit: number;
  proProfit: number;
  freeFee: number;
  proFee: number;
  savings: number;
  monthlyPrice: number;
}> {
  const freeFee = price * DIRECT_FREE_FEE_RATE;
  const proFee = price * DIRECT_PRO_FEE_RATE;
  const freeProfit = price - freeFee - materials;
  const proProfit = price - proFee - materials;
  return {
    freeProfit,
    proProfit,
    freeFee,
    proFee,
    savings: proProfit - freeProfit,
    monthlyPrice: PRO_MONTHLY_COST,
  };
}
