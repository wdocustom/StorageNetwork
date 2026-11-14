// ═══════════════════════════════════════════════════════════════════════════
// Plans designer events — what visitors do between opening the designer and
// paying (plan_events). Sent once per event+detail per page load, with the
// same anonymous ids as page views. Best effort: never throws, never blocks.
// ═══════════════════════════════════════════════════════════════════════════

import { detectInAppBrowser } from "@/lib/in-app-browser";
import { metaTrack } from "@/lib/meta-pixel";

/** Plan events Meta should optimize ads for (no-ops without a pixel). */
const META_EVENTS: Partial<Record<string, string>> = {
  buy_click: "InitiateCheckout",
  wallet_escape: "InitiateCheckout",
  exit_offer_email: "Lead",
  offer_seen: "AddToCart",
};

/** Every event the designer may send; the API drops anything else. */
export const PLAN_EVENTS = {
  edit_size: "Changed the size",
  edit_option: "Changed an option",
  add_unit: "Added a unit",
  bestsellers: "Opened bestsellers",
  wall_fit: "Used fit-to-wall",
  materials: "Opened material costs",
  sample: "Opened a sample",
  offer_seen: "Saw the $19 offer",
  buy_click: "Tapped buy",
  checkout_closed: "Closed payment without paying",
  wallet_escape: "Tapped Apple / Google Pay (left the app)",
  wallet_fallback: "Needed the manual open-in-browser steps",
  autopay: "Arrived in Safari / Chrome to pay",
  build_for_me: "Opened “have a pro build it”",
  exit_offer_shown: "Saw the $5-off offer",
  exit_offer_buy: "Tapped buy on the $5-off offer",
  exit_offer_email: "Emailed themselves their design",
  exit_offer_dismiss: "Said no thanks to the offer",
  save_home: "Buyer tapped save to home screen / bookmark",
  save_home_added: "Buyer added plans to home screen",
} as const;

export type PlanEvent = keyof typeof PLAN_EVENTS;

export function isPlanEvent(value: unknown): value is PlanEvent {
  return typeof value === "string" && value in PLAN_EVENTS;
}

const sent = new Set<string>();

export function trackPlanEvent(event: PlanEvent, detail?: string): void {
  if (typeof window === "undefined") return;
  const key = `${event}:${detail ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);
  const metaEvent = META_EVENTS[event];
  if (metaEvent && !sent.has(`meta:${metaEvent}`)) {
    sent.add(`meta:${metaEvent}`);
    metaTrack(metaEvent, { content_name: "Tote rack plans", currency: "USD", value: 19 });
  }
  try {
    let visitorId: string | null = null;
    let sessionId: string | null = null;
    try {
      visitorId = localStorage.getItem("sn_vid");
      sessionId = sessionStorage.getItem("sn_sid");
    } catch {
      /* storage blocked */
    }
    const inApp = detectInAppBrowser(navigator.userAgent);
    const body = JSON.stringify({
      event,
      detail: detail?.slice(0, 80),
      visitorId,
      sessionId,
      inApp: inApp ? `${inApp.app}-${inApp.os}` : null,
      automated: navigator.webdriver === true,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/plan-event", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics/plan-event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    /* best effort */
  }
}
