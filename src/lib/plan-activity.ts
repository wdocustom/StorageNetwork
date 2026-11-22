// ═══════════════════════════════════════════════════════════════════════════
// DIY plan buyer activity: what a buyer does with their plan after paying
// (plan_buyer_activity, migration 161).
//
// SERVER events are recorded where access is decided (tote-plan-access,
// plan-device, the library, jig and gift pages), so they can't be faked.
// BROWSER events (the 3D guide, PDF, checklists…) come from trackPlanActivity
// → /api/analytics/plan-activity, which only accepts the events marked
// `client` and only for a real purchase token.
//
// The catalog doubles as the admin timeline's labels.
// ═══════════════════════════════════════════════════════════════════════════

export const PLAN_ACTIVITY = {
  // ── Access (server) ────────────────────────────────────────────────────
  open: { label: "Opened their plan", client: false },
  open_needs_code: { label: "Opened on a new device: asked for a code", client: false },
  code_sent: { label: "Emailed a new-device code", client: false },
  code_verified: { label: "Confirmed a new device", client: false },
  code_rejected: { label: "Entered a wrong or expired code", client: false },
  library_open: { label: "Opened My Builds", client: false },
  included_plan: { label: "Built another plan (included)", client: false },
  jig_open: { label: "Opened ladder jig plans", client: false },
  gift_open: { label: "Opened their gift page", client: false },
  review_submitted: { label: "Left a review", client: false },
  // ── Using the plan (browser) ───────────────────────────────────────────
  guide_open: { label: "Opened the 3D build guide", client: true },
  guide_section: { label: "Moved to a guide section", client: true },
  guide_step: { label: "Reached a build step", client: true },
  guide_section_done: { label: "Reached the last step of a section", client: true },
  guide_close: { label: "Closed the 3D guide", client: true },
  pdf_start: { label: "Started the PDF download", client: true },
  pdf_download: { label: "Downloaded the PDF", client: true },
  pdf_error: { label: "PDF download failed", client: true },
  shop_progress: { label: "Ticked off the shopping list", client: true },
  tools_progress: { label: "Ticked off the tools list", client: true },
  buy_link: { label: "Tapped a buy link", client: true },
  build_another: { label: "Tapped build another plan", client: true },
  review_prompt: { label: "Saw the review prompt", client: true },
} as const;

export type PlanActivityEvent = keyof typeof PLAN_ACTIVITY;

export function isPlanActivityEvent(v: unknown): v is PlanActivityEvent {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PLAN_ACTIVITY, v);
}

export function isClientPlanActivity(v: unknown): v is PlanActivityEvent {
  return isPlanActivityEvent(v) && PLAN_ACTIVITY[v].client;
}

export const planActivityLabel = (event: string) =>
  isPlanActivityEvent(event) ? PLAN_ACTIVITY[event].label : event.replace(/_/g, " ");

/** How a plan was opened (the `detail` of an `open` event). */
export type PlanOpenVia = "checkout" | "link" | "checkout_reload" | "after_code";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isAccessToken = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export interface PlanActivityPayload {
  detail?: string | null;
  value?: number | null;
  total?: number | null;
}

/** Clamp a payload to what the table stores. */
export function cleanActivityPayload(p: { detail?: unknown; value?: unknown; total?: unknown }): {
  detail: string | null;
  value: number | null;
  total: number | null;
} {
  const int = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(-1_000_000, Math.min(1_000_000, Math.round(v))) : null;
  const detail =
    typeof p.detail === "string" && p.detail.trim()
      ? p.detail
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 120)
      : null;
  return { detail, value: int(p.value), total: int(p.total) };
}

// ── Browser side ─────────────────────────────────────────────────────────────

const sentThisPage = new Set<string>();

/**
 * Record what a buyer did with their plan. Best effort: never throws, never
 * blocks. The same event+detail+value is sent once per page load, so a step
 * revisited or a re-render doesn't count twice.
 */
export function trackPlanActivity(token: string | null | undefined, event: PlanActivityEvent, payload: PlanActivityPayload = {}): void {
  if (typeof window === "undefined" || !isAccessToken(token) || !PLAN_ACTIVITY[event]?.client) return;
  const key = `${token}:${event}:${payload.detail ?? ""}:${payload.value ?? ""}`;
  if (sentThisPage.has(key)) return;
  sentThisPage.add(key);
  try {
    let sessionId: string | null = null;
    try {
      sessionId = sessionStorage.getItem("sn_sid");
    } catch {
      /* storage blocked */
    }
    const body = JSON.stringify({
      token,
      event,
      detail: payload.detail ?? null,
      value: payload.value ?? null,
      total: payload.total ?? null,
      sessionId,
      automated: navigator.webdriver === true,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/plan-activity", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics/plan-activity", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* best effort */
  }
}

/** For tests: forget what this page already sent. */
export function _resetPlanActivityDedupe(): void {
  sentThisPage.clear();
}
