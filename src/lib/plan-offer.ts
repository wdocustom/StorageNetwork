// ═══════════════════════════════════════════════════════════════════════════
// The retention ("exit") offer, remembered in this browser (client only)
//
// Once shown (or opened from an "email me my design" link, ?offer=save3 —
// or a retired code like save5 on an older link, still honored),
// the offer price holds for TOTE_PLAN_EXIT_OFFER.hours so a visitor who
// comes back later still sees it. "Seen" is remembered separately so the
// lightbox shows at most once per browser.
// ═══════════════════════════════════════════════════════════════════════════

import { TOTE_PLAN_EXIT_OFFER, isRetentionOffer } from "@/lib/tote-plans";

const ACTIVE_KEY = "sn_plan_offer";
const SEEN_KEY = "sn_plan_offer_seen";

export interface ActiveOffer {
  code: string;
  expiresAt: number;
}

export function readOffer(now = Date.now()): ActiveOffer | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as ActiveOffer;
    if (!isRetentionOffer(o.code) || !(o.expiresAt > now)) return null;
    return o;
  } catch {
    return null;
  }
}

/** Start (or restart) a retention offer: the current one unless a link carried an older code. */
export function activateOffer(code: string = TOTE_PLAN_EXIT_OFFER.code, now = Date.now()): ActiveOffer {
  const o = { code: isRetentionOffer(code) ? code : TOTE_PLAN_EXIT_OFFER.code, expiresAt: now + TOTE_PLAN_EXIT_OFFER.hours * 3600_000 };
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(o));
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: the offer still applies on this page */
  }
  return o;
}

// The last-chance offer (after "No thanks" on the first): at most once per browser.
const LAST_CHANCE_SEEN_KEY = "sn_plan_last_chance_seen";

export function lastChanceSeen(): boolean {
  try {
    return localStorage.getItem(LAST_CHANCE_SEEN_KEY) === "1";
  } catch {
    // Can't remember it: don't show it, rather than risk showing it every visit.
    return true;
  }
}

export function markLastChanceSeen(): void {
  try {
    localStorage.setItem(LAST_CHANCE_SEEN_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

export function offerAlreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// ── Promo code (FRIDAY), kept for this tab only ───────────────────────────────
// What the server confirmed for the code + email. Checked again on reload
// and at checkout; the browser's copy never sets a price.

const PROMO_KEY = "sn_plan_promo";

export interface AppliedPromo {
  code: string;
  display: string;
  label: string;
  price: number;
  email: string;
}

export function rememberPromo(p: AppliedPromo): AppliedPromo {
  const kept = { code: p.code, display: p.display, label: p.label, price: p.price, email: p.email };
  try {
    sessionStorage.setItem(PROMO_KEY, JSON.stringify(kept));
  } catch {
    /* storage blocked: the code still applies on this page */
  }
  return kept;
}

export function readPromo(): Pick<AppliedPromo, "code" | "email"> | null {
  try {
    const raw = sessionStorage.getItem(PROMO_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AppliedPromo>;
    return typeof p.code === "string" && typeof p.email === "string" ? { code: p.code, email: p.email } : null;
  } catch {
    return null;
  }
}

export function forgetPromo(): void {
  try {
    sessionStorage.removeItem(PROMO_KEY);
  } catch {
    /* nothing kept */
  }
}
