// ═══════════════════════════════════════════════════════════════════════════
// Reviews — shared by installer reviews (/review/[token], /p/[slug]) and
// DIY plan reviews (/plans, /plans/build). Client-safe: no server imports.
// ═══════════════════════════════════════════════════════════════════════════

export interface ReviewTag {
  id: string;
  label: string;
  emoji: string;
}

/** What DIY plan buyers can say stood out. */
export const PLAN_REVIEW_TAGS: readonly ReviewTag[] = [
  { id: "easy_to_follow", label: "Easy to follow", emoji: "\u{1F4D0}" },
  { id: "accurate_cut_list", label: "Accurate cut list", emoji: "\u{1FA9A}" },
  { id: "guide_helped", label: "3D guide helped", emoji: "\u{1F9CA}" },
  { id: "first_build", label: "Great first build", emoji: "\u{1F528}" },
  { id: "saved_money", label: "Saved money", emoji: "\u{1F4B0}" },
  { id: "fits_perfectly", label: "Totes fit perfectly", emoji: "\u{2705}" },
  { id: "sturdy", label: "Rock solid", emoji: "\u{1F9F1}" },
  { id: "would_recommend", label: "Would recommend", emoji: "\u{2B50}" },
] as const;

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"] as const;

export const SKILL_LEVELS = [
  { id: "first", label: "First build" },
  { id: "some", label: "Some experience" },
  { id: "experienced", label: "Experienced" },
] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number]["id"];

export const REVIEW_LIMITS = {
  headline: 100,
  comment: 1500,
  reply: 1000,
  photos: 4,
  /** Per photo after client-side resizing (the server re-checks) */
  photoBytes: 4 * 1024 * 1024,
} as const;

/** Reviews at or under this many stars wait for admin approval. */
export const HOLD_AT_OR_BELOW = 3;

export interface RatingSummary {
  average: number;
  total: number;
  distribution: { stars: number; count: number; pct: number }[];
  topTags: { tag: string; count: number }[];
}

/** Average, 5→1 distribution and most-used tags over EVERY rating given. */
export function summarizeRatings(rows: { rating: number; tags?: string[] | null }[]): RatingSummary {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tagCounts: Record<string, number> = {};
  let sum = 0;
  let total = 0;
  for (const r of rows) {
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) continue;
    counts[r.rating]++;
    sum += r.rating;
    total++;
    for (const t of r.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  return {
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars],
      pct: total ? Math.round((counts[stars] / total) * 100) : 0,
    })),
    topTags: Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

/** "Judy Smith" → "Judy S." ; "judy" → "Judy" ; "" → "Verified buyer" */
export function publicName(name: string | null | undefined, fallback = "Verified buyer"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts[1] ? `${first} ${parts[1].charAt(0).toUpperCase()}.` : first;
}

/** "3 weeks ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? "" : "s"} ago`;
}

/** Trim, collapse whitespace runs inside lines, cap length; empty → null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
  return text || null;
}

/** Keep only known tag ids, once each. */
export function cleanTags(value: unknown, allowed: readonly ReviewTag[]): string[] {
  if (!Array.isArray(value)) return [];
  const ok = new Set(allowed.map((t) => t.id));
  return [...new Set(value.filter((t): t is string => typeof t === "string" && ok.has(t)))];
}

/** schema.org AggregateRating, or nothing until there's a rating to show. */
export function aggregateRatingJsonLd(summary: Pick<RatingSummary, "average" | "total">) {
  if (!summary.total) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: summary.average,
    reviewCount: summary.total,
    bestRating: 5,
    worstRating: 1,
  };
}
