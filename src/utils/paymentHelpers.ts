// ═══════════════════════════════════════════════════════════════════════════
// Payment Helpers — Client-safe formatting utilities ONLY
//
// All fee calculations, rate constants, tax lookups, and profit math have
// been moved to src/app/actions/fee-engine.ts (server action, black box).
// This file contains only display formatting — zero business logic.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format currency for display (always shows 2 decimal places).
 * Pass the installer's currency to get "CA$" for Canadian jobs; USD (the
 * default) keeps the plain "$" used everywhere else.
 */
export function formatCurrency(n: number, currency?: string | null): string {
  const symbol = currency?.toLowerCase() === "cad" ? "CA$" : "$";
  return symbol + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format tax rate as percentage string.
 */
export function formatTaxRate(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}
