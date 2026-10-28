// What a quote/job is, in plain words, from leads.quote_data — for follow-up
// messages and real-job posts. Prices are stripped (unit descs carry
// "(total $5907)" / "(custom $0.02)" suffixes).
//
//   [{desc:"4×2 Work Bench w/ Totes (custom $0.02)"} ×2] → "2 × 4×2 Work Bench w/ Totes"

export function describeQuote(quoteData: unknown, maxParts = 3): string {
  if (!Array.isArray(quoteData)) return "";
  const counts = new Map<string, number>();
  for (const unit of quoteData) {
    const desc = typeof unit?.desc === "string" ? unit.desc : "";
    const clean = desc
      .replace(/\s*\((?:total|custom)[^)]*\)\s*/gi, " ")
      .replace(/\s*\$\s?[\d,.]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  const parts = Array.from(counts, ([desc, n]) => (n > 1 && !/^\d+ × /.test(desc) ? `${n} × ${desc}` : desc));
  if (parts.length > maxParts) return `${parts.slice(0, maxParts).join(" + ")} + more`;
  return parts.join(" + ");
}
