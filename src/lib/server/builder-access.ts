import "server-only";

import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkPlanDevice, maskEmail } from "@/lib/server/plan-device";
import { stripeConfig } from "@/lib/stripe/http";
import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Who may use the paid side of the Custom Builder
//
// A MEMBER is whoever may save designs and generate plans:
//   • a subscriber — identified by the access token from their email, on a
//     device that has passed the plan device gate, whose Stripe
//     subscription is active
//   • an admin — signed in to the site; lets the team use and test the
//     builder without a subscription
//
// Subscription status is read from Stripe, not pushed by webhooks: the row
// remembers the last answer, and it is asked again when that answer is more
// than STATUS_MAX_AGE old or wasn't "active". So a cancellation takes
// effect within the hour, and a renewal that just went through is seen on
// the next visit, without touching the site's Stripe webhook.
// ═══════════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_MAX_AGE_MS = 60 * 60 * 1000;
/** Stripe statuses that keep the builder open. past_due is Stripe retrying the card. */
const OPEN_STATUSES = new Set(["active", "trialing", "past_due"]);

let _stripe: Stripe | null = null;
export function builderStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, stripeConfig());
  return _stripe;
}

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export interface SubscriptionRow {
  id: string;
  email: string;
  access_token: string;
  customer_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  checked_at: string | null;
}

export const SUBSCRIPTION_COLUMNS =
  "id, email, access_token, customer_name, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, checked_at";

export interface Member {
  /** Lower-cased; owns the designs */
  email: string;
  via: "subscription" | "admin";
  /** Subscribers only */
  token?: string;
  status?: string;
  renewsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export type MemberResult =
  | { ok: true; member: Member }
  | {
      ok: false;
      /** none: not a member · inactive: subscription ended · verify: new device */
      reason: "none" | "inactive" | "verify";
      error: string;
      verify?: { token: string; emailHint: string };
    };

/** What Stripe says about a subscription, in the shape the row stores. */
export function subscriptionFields(sub: Stripe.Subscription): {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} {
  // Newer API versions report the period on the subscription's items.
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  const end = legacy ?? fromItem;
  return {
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
  };
}

/** Ask Stripe again if the remembered status is old or not open. Never throws: a Stripe hiccup keeps the last answer. */
async function freshStatus(row: SubscriptionRow): Promise<SubscriptionRow> {
  const age = row.checked_at ? Date.now() - new Date(row.checked_at).getTime() : Infinity;
  if (!row.stripe_subscription_id || (OPEN_STATUSES.has(row.status) && age < STATUS_MAX_AGE_MS)) return row;
  try {
    const sub = await builderStripe().subscriptions.retrieve(row.stripe_subscription_id);
    const fields = { ...subscriptionFields(sub), checked_at: new Date().toISOString() };
    const { error } = await getServiceClient()
      .from("builder_subscriptions")
      .update({ ...fields, updated_at: fields.checked_at })
      .eq("id", row.id);
    if (error) console.error("[BuilderAccess] status save failed:", error.message);
    return { ...row, ...fields };
  } catch (err) {
    console.error("[BuilderAccess] Stripe status check failed (keeping last known):", err);
    return row;
  }
}

async function adminMember(): Promise<Member | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const { data: profile } = await getServiceClient()
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .maybeSingle();
  const email = ((profile?.email as string | undefined) ?? user.email ?? "").trim().toLowerCase();
  return profile?.is_admin && email ? { email, via: "admin" } : null;
}

/**
 * Who is asking? `token` is the subscriber's access token (from their link
 * or remembered on the device); without one, only a signed-in admin is a
 * member. `trusted` is for the subscriber's own return from checkout: that
 * device is remembered without a code.
 */
export async function resolveMember(token?: string | null, opts: { trusted?: boolean } = {}): Promise<MemberResult> {
  if (isUuid(token)) {
    const { data } = await getServiceClient()
      .from("builder_subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .eq("access_token", token)
      .maybeSingle();
    if (data) {
      const row = await freshStatus(data as SubscriptionRow);
      if (!OPEN_STATUSES.has(row.status)) {
        return { ok: false, reason: "inactive", error: "Your Custom Builder subscription has ended. Subscribe again to save designs and get plans; your saved designs are still here." };
      }
      const device = await checkPlanDevice(row.email, opts);
      if (!device.ok) {
        return {
          ok: false,
          reason: "verify",
          error: "Confirm it's you to use the builder on this device.",
          verify: { token: row.access_token, emailHint: device.emailHint },
        };
      }
      return {
        ok: true,
        member: {
          email: row.email,
          via: "subscription",
          token: row.access_token,
          status: row.status,
          renewsAt: row.current_period_end,
          cancelAtPeriodEnd: row.cancel_at_period_end,
        },
      };
    }
  }
  const admin = await adminMember();
  if (admin) return { ok: true, member: admin };
  return { ok: false, reason: "none", error: "Subscribe to the Custom Builder to save designs and get build plans." };
}

/** The email behind an access token of either kind (subscriber or plan buyer), for the device-code gate. */
export async function emailForBuilderToken(token: string): Promise<string | null> {
  if (!isUuid(token)) return null;
  const db = getServiceClient();
  const { data: sub } = await db.from("builder_subscriptions").select("email").eq("access_token", token).maybeSingle();
  if (sub?.email) return sub.email as string;
  const { data: purchase } = await db.from("builder_plan_purchases").select("buyer_email").eq("access_token", token).maybeSingle();
  return (purchase?.buyer_email as string | undefined) ?? null;
}

export { maskEmail };
