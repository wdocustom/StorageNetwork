// ═══════════════════════════════════════════════════════════════════════════
// The $5-off exit offer, remembered in this browser (client only)
//
// Once shown (or opened from an "email me my design" link, ?offer=save5),
// the offer price holds for TOTE_PLAN_EXIT_OFFER.hours so a visitor who
// comes back later still sees it. "Seen" is remembered separately so the
// lightbox shows at most once per browser.
// ═══════════════════════════════════════════════════════════════════════════

import { TOTE_PLAN_EXIT_OFFER } from "@/lib/tote-plans";

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
    if (o.code !== TOTE_PLAN_EXIT_OFFER.code || !(o.expiresAt > now)) return null;
    return o;
  } catch {
    return null;
  }
}

export function activateOffer(now = Date.now()): ActiveOffer {
  const o = { code: TOTE_PLAN_EXIT_OFFER.code, expiresAt: now + TOTE_PLAN_EXIT_OFFER.hours * 3600_000 };
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(o));
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: the offer still applies on this page */
  }
  return o;
}

export function offerAlreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
