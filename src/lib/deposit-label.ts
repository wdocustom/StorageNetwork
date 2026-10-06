// Customer-facing deposit wording. Installers set their own deposit (a
// percentage or a flat $, never below 15%), so an email must never say "15%"
// by default — derive the label from the amounts actually being charged.

/**
 * "40%" when the deposit is a whole percentage of the total (a 25% setting, or
 * a flat amount that happens to land on one); null otherwise (e.g. a flat $200
 * on $1,050 is 19.05% — better to show just the dollar amount than "19%").
 */
export function depositPercentLabel(deposit: number, total: number): string | null {
  if (!Number.isFinite(deposit) || !Number.isFinite(total) || total <= 0 || deposit <= 0) return null;
  const rounded = Math.round((deposit / total) * 100);
  // A whole percentage only if it reproduces the charged amount to the cent
  // (15% of $349 = $52.35 qualifies; $200 on $1,050 ≈ 19.05% does not).
  return Math.abs((total * rounded) / 100 - deposit) <= 0.011 ? `${rounded}%` : null;
}
