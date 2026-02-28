// ═══════════════════════════════════════════════════════════════════════════
// Payment Helpers — Client-safe formatting utilities ONLY
//
// All fee calculations, rate constants, tax lookups, and profit math have
// been moved to src/app/actions/fee-engine.ts (server action, black box).
// This file contains only display formatting — zero business logic.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format currency for display (always shows 2 decimal places).
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format tax rate as percentage string.
 */
export function formatTaxRate(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}
