// ═══════════════════════════════════════════════════════════════════════════
// Share-with-a-friend: every DIY plan buyer has one short link,
// storage-network.app/plans/friend/<code>. Friends who buy through it get
// FRIEND_DISCOUNT_CENTS off (27-gal or Mini plans). The referrer gets nothing
// paid; purchases through a buyer's link pay no bestseller split.
// Client-safe. Server side: @/lib/server/plan-friend.
// ═══════════════════════════════════════════════════════════════════════════

export const FRIEND_DISCOUNT_CENTS = 300;

/** Kept in the browser so the discount survives designing and coming back. */
export const FRIEND_STORAGE_KEY = "sn_plan_friend";
export const FRIEND_KEEP_DAYS = 30;

const CODE_RE = /^[a-z0-9]{6,12}$/;

/** "AbC123xy " → "abc123xy"; anything else → null. */
export function cleanFriendCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

export function friendPath(code: string): string {
  return `/plans/friend/${code}`;
}

/** The checkout price with a friend's link: $3 off, never below the floor. */
export function friendPrice(regularCents: number): number {
  return Math.max(0, regularCents - FRIEND_DISCOUNT_CENTS);
}

// ── Browser memory (best effort) ─────────────────────────────────────────

export function rememberFriendCode(code: string): void {
  try {
    localStorage.setItem(FRIEND_STORAGE_KEY, JSON.stringify({ code, until: Date.now() + FRIEND_KEEP_DAYS * 86400000 }));
  } catch {
    /* storage blocked: the link's ?friend= still works on this page */
  }
}

export function readFriendCode(): string | null {
  try {
    const raw = localStorage.getItem(FRIEND_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: unknown; until?: unknown };
    if (typeof v.until !== "number" || v.until < Date.now()) {
      localStorage.removeItem(FRIEND_STORAGE_KEY);
      return null;
    }
    return cleanFriendCode(v.code);
  } catch {
    return null;
  }
}

export function forgetFriendCode(): void {
  try {
    localStorage.removeItem(FRIEND_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
