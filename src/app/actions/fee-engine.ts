"use server";

import { getServiceClient } from "@/lib/supabase-server";
import zipcodes from "zipcodes";

// ═══════════════════════════════════════════════════════════════════════════
// Fee Engine — Black Box
//
// All fee calculations, deposit math, tax lookups, and profit calculations
// happen here. The client NEVER sees fee formulas, rate constants, or
// pricing decision trees. It only receives computed display values.
//
// This is the single source of truth for:
//   - Deposit rate (default 15%, installer-configurable)
//   - Fee rates (network 15%, maintenance 3%)
//   - State sales tax rates
//   - Net profit calculations
//   - Build page profit breakdown
//
// The browser bundle contains zero knowledge of how any of these are derived.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

// ── Fee Constants (server-only, never shipped to client) ─────────────────
const DEPOSIT_RATE = 0.15;
const NETWORK_FEE_RATE = 0.15;
const MAINTENANCE_FEE_RATE = 0.03;

// ── Pricing Constants (server-only) ─────────────────────────────────────
const PRICE_PER_SLOT = 30;
const TOTE_PRICE = 12;
const WHEELS_PRICE = 65;

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

// ── Deposit Config Types ─────────────────────────────────────────────────

export interface DepositConfig {
  type: "percentage" | "flat";
  value: number; // percentage (e.g. 25 = 25%) or flat dollar amount
}

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
  depositAmount: number;      // the customer deposit (installer-configurable, min 15%)
  feeAmount: number;          // platform fee (15% network or 3% maintenance)
  customerBalance: number;    // what customer owes at install (totalPrice - deposit)
  installerTakeHome: number;  // installer's total after fees (totalPrice - fee)
  estMaterials: number;
  netProfit: number;
  feeRate: number;
  feeLabel: string;
  // Legacy aliases (kept for backward compat with build page)
  amountToCollect: number;    // = installerTakeHome
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
  depositLabel: string;        // e.g. "15%", "25%", "$200"
}

// ── Deposit Helpers (server-only) ────────────────────────────────────────

/**
 * Fetch the installer's custom deposit config from the database.
 * Returns null if no custom config is set (use default 15%).
 */
async function getInstallerDepositConfig(installerId: string): Promise<DepositConfig | null> {
  const { data } = await supabase
    .from("profiles")
    .select("deposit_config")
    .eq("id", installerId)
    .single();

  if (!data?.deposit_config) return null;

  const config = data.deposit_config as DepositConfig;
  if (config.type && typeof config.value === "number" && config.value > 0) {
    return config;
  }
  return null;
}

/**
 * Calculate deposit from config, enforcing the 15% minimum floor.
 * The deposit must always be at least 15% of the total to cover
 * the platform's network lead fee.
 */
function computeDeposit(grandTotal: number, config: DepositConfig | null): number {
  const minimumDeposit = Math.round(grandTotal * DEPOSIT_RATE * 100) / 100;

  if (!config) return minimumDeposit;

  let customDeposit: number;
  if (config.type === "flat") {
    customDeposit = Math.round(config.value * 100) / 100;
  } else {
    // percentage — stored as whole number (e.g. 25 = 25%)
    const rate = config.value / 100;
    customDeposit = Math.round(grandTotal * rate * 100) / 100;
  }

  // Floor: deposit must cover the platform's 15% network fee
  return Math.max(customDeposit, minimumDeposit);
}

/**
 * Build a human-readable label for the deposit (e.g. "15%", "25%", "$200").
 * Used for UI display — never reveals the rate constant itself.
 */
function depositLabel(config: DepositConfig | null): string {
  if (!config) return "15%";
  if (config.type === "flat") return `$${config.value}`;
  return `${config.value}%`;
}

// ── Server Actions ───────────────────────────────────────────────────────

/**
 * Calculate the deposit amount for a given grand total.
 * If installerId is provided, uses the installer's custom deposit config.
 * Deposit is always at least 15% of the total (to cover platform fees).
 * Client never sees the deposit rate constant.
 */
export async function getDepositAmount(grandTotal: number, installerId?: string): Promise<number> {
  if (!installerId) {
    return Math.round(grandTotal * DEPOSIT_RATE * 100) / 100;
  }

  const config = await getInstallerDepositConfig(installerId);
  return computeDeposit(grandTotal, config);
}

/**
 * Get the deposit display label for an installer (e.g. "15%", "25%", "$200").
 * Used by UI components to show what the deposit rate is.
 */
export async function getDepositLabel(installerId?: string): Promise<string> {
  if (!installerId) return "15%";

  const config = await getInstallerDepositConfig(installerId);
  return depositLabel(config);
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
 * Look up the US state code for a 5-digit ZIP. Returns null if invalid
 * or if the ZIP isn't in the dataset (e.g. typo, P.O. box prefix).
 */
export async function getStateFromZip(zip: string): Promise<string | null> {
  if (!zip || !/^\d{5}$/.test(zip.trim())) return null;
  const info = zipcodes.lookup(zip.trim());
  return info?.state ?? null;
}

/**
 * Estimate sales tax at quote-creation time, deriving the state from a ZIP.
 * Returns the same shape as getSalesTax, plus the resolved stateCode (or null
 * when the ZIP can't be mapped to a state).
 */
export async function getEstimatedSalesTax(
  taxableAmount: number,
  zip: string
): Promise<SalesTaxResult & { stateCode: string | null }> {
  const stateCode = await getStateFromZip(zip);
  if (!stateCode) {
    return {
      taxRate: 0,
      taxAmount: 0,
      subtotal: taxableAmount,
      total: taxableAmount,
      stateName: "",
      stateCode: null,
    };
  }
  const result = await getSalesTax(taxableAmount, stateCode);
  return { ...result, stateCode };
}

/**
 * Calculate the installer's true net profit after fees and materials.
 * Network leads: 15% fee. Direct leads: 3% maintenance fee.
 * Deposit uses installer's custom config (if set).
 */
export async function getNetProfit(input: {
  totalPrice: number;
  materialCost: number;
  source?: string;
  installerId?: string;
  /** When provided, use this deposit instead of re-computing from config */
  actualDepositAmount?: number;
}): Promise<NetProfitResult> {
  const { totalPrice, materialCost, source, installerId, actualDepositAmount } = input;

  const isDirectLead = source === "partner_link" || source === "installer_manual";
  let feeRate: number;
  let feeLabel: string;

  if (!isDirectLead) {
    feeRate = NETWORK_FEE_RATE;
    feeLabel = "Network Lead Fee (15%)";
  } else {
    feeRate = MAINTENANCE_FEE_RATE;
    feeLabel = "Maintenance Fee (3%)";
  }

  const feeAmount = Math.round(totalPrice * feeRate * 100) / 100;

  // Use actual deposit if provided, otherwise compute from installer's config
  let depositAmount: number;
  if (actualDepositAmount !== undefined && actualDepositAmount > 0) {
    depositAmount = actualDepositAmount;
  } else {
    const config = installerId ? await getInstallerDepositConfig(installerId) : null;
    depositAmount = computeDeposit(totalPrice, config);
  }

  const customerBalance = Math.round((totalPrice - depositAmount) * 100) / 100;
  const installerTakeHome = Math.round((totalPrice - feeAmount) * 100) / 100;
  const netProfit = Math.max(0, Math.round((installerTakeHome - materialCost) * 100) / 100);

  return {
    totalPrice,
    depositAmount,
    feeAmount,
    customerBalance,
    installerTakeHome,
    amountToCollect: installerTakeHome, // legacy alias
    estMaterials: materialCost,
    netProfit,
    feeRate,
    feeLabel,
  };
}

/**
 * Fee breakdown for the build page profit calculator.
 * Returns display-ready values — no fee constants exposed to the client.
 * Uses installer's custom deposit config if installerId provided.
 */
export async function getBuildFeeBreakdown(
  jobPrice: number,
  materialsCost: number,
  installerId?: string
): Promise<BuildFeeBreakdown> {
  const networkFee = Math.round(jobPrice * NETWORK_FEE_RATE * 100) / 100;
  const directFee = Math.round(jobPrice * MAINTENANCE_FEE_RATE * 100) / 100;

  // Use installer's custom deposit config
  const config = installerId ? await getInstallerDepositConfig(installerId) : null;
  const deposit = computeDeposit(jobPrice, config);

  return {
    networkFeePercent: "15%",
    networkFeeAmount: networkFee,
    networkCollect: Math.round(jobPrice * (1 - NETWORK_FEE_RATE)),
    networkNetProfit: Math.max(0, Math.round(jobPrice * (1 - NETWORK_FEE_RATE) - materialsCost)),
    directFeePercent: "3%",
    directFeeAmount: directFee,
    directCollect: Math.round(jobPrice * (1 - MAINTENANCE_FEE_RATE)),
    directNetProfit: Math.max(0, Math.round(jobPrice * (1 - MAINTENANCE_FEE_RATE) - materialsCost)),
    depositAmount: deposit,
    depositLabel: depositLabel(config),
  };
}

/**
 * Get pricing constants for build page calculations.
 * Constants stay server-side — client only gets the values it needs.
 */
export async function getPricingConstants(): Promise<{
  pricePerSlot: number;
  totePrice: number;
  wheelsPrice: number;
}> {
  return {
    pricePerSlot: PRICE_PER_SLOT,
    totePrice: TOTE_PRICE,
    wheelsPrice: WHEELS_PRICE,
  };
}
