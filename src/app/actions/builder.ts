"use server";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — everything the builder asks the server for
//
// MEMBERSHIP   getBuilderAccess · createBuilderSubscriptionCheckout ·
//              activateBuilderSubscription · openBillingPortal ·
//              requestBuilderCode · confirmBuilderCode
// DESIGNS      listDesigns · loadDesign · saveDesign · deleteDesign
// PLANS        openBuilderPlan (a member's own design)
// SHARING      shareDesign · getSharedDesign · listMarketplace
// BUYING       createPlanPurchaseCheckout · openPurchasedPlan
//
// Rules that hold everywhere here:
//   • Nothing is trusted from the browser. A member is resolved from their
//     token on every call (resolveMember); a scene is re-validated with
//     parseScene; prices and designs for a sale are read from the database
//     and from Stripe, never from the request.
//   • A design belongs to its owner's email; every design query filters on
//     it.
//   • The plan is the paid product, so it is generated here, after the
//     access check, and never in the browser.
//   • A listing for sale never sends its scene to the browser: buyers see a
//     picture and the numbers in `stats`, and get the scene with the plan
//     once they've paid.
// ═══════════════════════════════════════════════════════════════════════════

import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { generateCustomPlan, type CustomPlan } from "@/lib/builder/plan";
import { parseScene, type Scene } from "@/lib/builder/scene";
import {
  BUILDER_SUBSCRIPTION,
  DESIGN_LIMITS,
  LISTING_PRICE,
  designStats,
  readDesignStats,
  splitSale,
  type DesignStats,
} from "@/lib/builder/store";
import { sendBuilderPlanPurchaseEmail, sendBuilderSaleEmail, sendBuilderWelcomeEmail } from "@/lib/emails/builderTemplates";
import { RateLimitError, enforceActionRateLimit, type RateLimitWindow } from "@/lib/server/action-rate-limit";
import {
  SUBSCRIPTION_COLUMNS,
  builderStripe,
  emailForBuilderToken,
  isUuid,
  maskEmail,
  resolveMember,
  subscriptionFields,
  type Member,
  type SubscriptionRow,
} from "@/lib/server/builder-access";
import {
  checkPlanDevice,
  sendPlanDeviceCode,
  verifyPlanDeviceCode,
  type SendCodeResult,
  type VerifyCodeResult,
} from "@/lib/server/plan-device";
import { FINAL_SALE_TEXT, createEmbeddedCheckoutSession } from "@/lib/stripe/embedded-checkout";
import { getServiceClient } from "@/lib/supabase-server";

// ── Shared ───────────────────────────────────────────────────────────────

type Verify = { token: string; emailHint: string };
type Fail = { ok: false; error: string; reason?: "none" | "inactive" | "verify"; verify?: Verify };

const GENERIC = "Something went wrong. Please try again.";
const SLUG_RE = /^[A-Za-z0-9_-]{8,32}$/;

/** Returns an error message when the caller is over the limit, else null. */
async function limited(action: string, limit: number, window: RateLimitWindow): Promise<string | null> {
  try {
    await enforceActionRateLimit({ action: `builder-${action}`, limit, window, identify: "user-or-ip" });
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) return err.message;
    throw err;
  }
}

async function requireMember(token: string | null | undefined): Promise<{ member: Member } | Fail> {
  const result = await resolveMember(token);
  if (result.ok) return { member: result.member };
  return { ok: false, error: result.error, reason: result.reason, verify: result.verify };
}

const firstNameOf = (name: string | null | undefined) => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// Membership
// ═══════════════════════════════════════════════════════════════════════════

export interface MemberInfo {
  via: "subscription" | "admin";
  emailHint: string;
  /** Subscribers only: the token to keep on this device */
  token?: string;
  status?: string;
  renewsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export type BuilderAccessResult = { ok: true; member: MemberInfo } | Fail;

function memberInfo(member: Member): MemberInfo {
  return {
    via: member.via,
    emailHint: maskEmail(member.email),
    token: member.token,
    status: member.status,
    renewsAt: member.renewsAt,
    cancelAtPeriodEnd: member.cancelAtPeriodEnd,
  };
}

/** Is this visitor a member? Called when the builder opens. */
export async function getBuilderAccess(token?: string | null): Promise<BuilderAccessResult> {
  try {
    const found = await requireMember(token);
    return "member" in found ? { ok: true, member: memberInfo(found.member) } : found;
  } catch (err) {
    console.error("[Builder] getBuilderAccess:", err);
    return { ok: false, error: GENERIC };
  }
}

/** Start the subscription checkout (Stripe Embedded Checkout, inside the builder page). */
export async function createBuilderSubscriptionCheckout(): Promise<{ ok: true; clientSecret: string } | Fail> {
  const slow = await limited("subscribe", 10, "60 s");
  if (slow) return { ok: false, error: slow };
  try {
    const session = await createEmbeddedCheckoutSession(builderStripe(), {
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: BUILDER_SUBSCRIPTION.interval },
            product_data: { name: BUILDER_SUBSCRIPTION.name, description: BUILDER_SUBSCRIPTION.tagline },
            unit_amount: BUILDER_SUBSCRIPTION.price,
          },
          quantity: 1,
        },
      ],
      return_url: `${siteConfig.baseUrl}/plans/builder?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { type: "builder_subscription" },
      // No userId here on purpose: the site's webhook treats a subscription
      // with metadata.userId as an installer's Pro plan.
      subscription_data: { metadata: { type: "builder_subscription" } },
    });
    if (!session.client_secret) return { ok: false, error: "Couldn't start checkout. Please try again." };
    return { ok: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[Builder] subscription checkout:", err);
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }
}

/**
 * The subscriber's return from checkout: confirm the session with Stripe,
 * record (or revive) their subscription, remember this device and email
 * their permanent link. Safe to call again for the same session.
 */
export async function activateBuilderSubscription(
  sessionId: string,
): Promise<{ ok: true; member: MemberInfo; emailSentTo?: string } | Fail> {
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return { ok: false, error: "We couldn't confirm that payment." };
  try {
    const db = getServiceClient();

    // A reload of the return URL: the row is already there.
    const { data: existing } = await db.from("builder_subscriptions").select("access_token").eq("stripe_session_id", sessionId).maybeSingle();
    if (existing) {
      const again = await resolveMember(existing.access_token as string);
      return again.ok ? { ok: true, member: memberInfo(again.member) } : { ok: false, error: again.error, reason: again.reason, verify: again.verify };
    }

    const stripe = builderStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (session.mode !== "subscription" || session.metadata?.type !== "builder_subscription" || session.status !== "complete" || !paid) {
      return { ok: false, error: "We couldn't confirm that payment." };
    }
    const subscription = session.subscription as Stripe.Subscription | null;
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
    if (!subscription || typeof subscription === "string" || !email) {
      console.error("[Builder] Paid subscription session missing subscription or email:", sessionId);
      return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };
    }

    const now = new Date().toISOString();
    const fields = {
      email,
      customer_name: session.customer_details?.name?.trim() || null,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripe_subscription_id: subscription.id,
      stripe_session_id: sessionId,
      ...subscriptionFields(subscription),
      checked_at: now,
      updated_at: now,
    };
    // One row per email: someone coming back after cancelling keeps their
    // link and their designs.
    const { data: row, error } = await db
      .from("builder_subscriptions")
      .upsert(fields, { onConflict: "email" })
      .select(SUBSCRIPTION_COLUMNS)
      .single();
    if (error || !row) {
      console.error("[Builder] subscription save failed:", error);
      return { ok: false, error: "We couldn't record your subscription. Please refresh the page." };
    }
    const saved = row as SubscriptionRow;

    // They just paid on this device: remember it without a code.
    const resolved = await resolveMember(saved.access_token, { trusted: true });
    const sent = await sendBuilderWelcomeEmail(email, saved.access_token).catch((err) => {
      console.error("[Builder] welcome email error:", err);
      return null;
    });
    if (sent?.success) await db.from("builder_subscriptions").update({ email_sent: true }).eq("id", saved.id);

    if (!resolved.ok) return { ok: false, error: resolved.error, reason: resolved.reason, verify: resolved.verify };
    return { ok: true, member: memberInfo(resolved.member), emailSentTo: email };
  } catch (err) {
    console.error("[Builder] activateBuilderSubscription:", err);
    return { ok: false, error: "We couldn't confirm your subscription. Please refresh the page." };
  }
}

/** A link to Stripe's billing page, where the subscriber updates their card or cancels. */
export async function openBillingPortal(token: string): Promise<{ ok: true; url: string } | Fail> {
  const slow = await limited("portal", 10, "10 m");
  if (slow) return { ok: false, error: slow };
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    if (found.member.via !== "subscription") return { ok: false, error: "This account has no subscription to manage." };
    const { data } = await getServiceClient().from("builder_subscriptions").select("stripe_customer_id").eq("access_token", token).maybeSingle();
    const customer = data?.stripe_customer_id as string | undefined;
    if (!customer) return { ok: false, error: "We couldn't find your billing details. Email us and we'll help." };
    const portal = await builderStripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteConfig.baseUrl}/plans/builder?token=${token}`,
    });
    return { ok: true, url: portal.url };
  } catch (err) {
    console.error("[Builder] billing portal:", err);
    return { ok: false, error: "We couldn't open billing just now. Please try again, or email us to make a change." };
  }
}

/** "Confirm it's you" on a new device: email the code. Works for subscriber and plan-buyer links. */
export async function requestBuilderCode(token: string): Promise<SendCodeResult> {
  const slow = await limited("device-code", 10, "10 m");
  if (slow) return { ok: false, error: slow };
  const email = await emailForBuilderToken(token);
  if (!email) return { ok: false, error: "This link is invalid or has expired." };
  return sendPlanDeviceCode(email);
}

export async function confirmBuilderCode(token: string, code: string): Promise<VerifyCodeResult> {
  const slow = await limited("device-verify", 20, "10 m");
  if (slow) return { ok: false, error: slow };
  const email = await emailForBuilderToken(token);
  if (!email) return { ok: false, error: "This link is invalid or has expired." };
  return verifyPlanDeviceCode(email, code);
}

// ═══════════════════════════════════════════════════════════════════════════
// Designs
// ═══════════════════════════════════════════════════════════════════════════

export type ShareMode = "private" | "view" | "sale";

export interface DesignSummary {
  id: string;
  name: string;
  pieceCount: number;
  thumbnail: string | null;
  shareMode: ShareMode;
  shareSlug: string | null;
  priceCents: number | null;
  description: string | null;
  updatedAt: string;
  /** Marketplace sales of this design */
  sales: number;
  /** What those sales earned the creator, cents */
  earningsCents: number;
}

export interface DesignLibrary {
  designs: DesignSummary[];
  /** Earned and not yet paid out, cents */
  owedCents: number;
  /** Already paid out, cents */
  paidCents: number;
}

const DESIGN_COLUMNS = "id, name, piece_count, thumbnail, share_mode, share_slug, price_cents, description, updated_at";

interface DesignRow {
  id: string;
  name: string;
  piece_count: number;
  thumbnail: string | null;
  share_mode: ShareMode;
  share_slug: string | null;
  price_cents: number | null;
  description: string | null;
  updated_at: string;
}

function summarize(row: DesignRow, sales = 0, earningsCents = 0): DesignSummary {
  return {
    id: row.id,
    name: row.name,
    pieceCount: row.piece_count,
    thumbnail: row.thumbnail,
    shareMode: row.share_mode,
    shareSlug: row.share_slug,
    priceCents: row.price_cents,
    description: row.description,
    updatedAt: row.updated_at,
    sales,
    earningsCents,
  };
}

/** A member's saved designs, newest first, with what each has sold. */
export async function listDesigns(token: string | null): Promise<({ ok: true } & DesignLibrary) | Fail> {
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    const db = getServiceClient();
    const [{ data: rows, error }, { data: sold }] = await Promise.all([
      db
        .from("builder_designs")
        .select(DESIGN_COLUMNS)
        .eq("owner_email", found.member.email)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(DESIGN_LIMITS.maxDesigns),
      db.from("builder_plan_purchases").select("design_id, creator_earnings_cents, payout_status").eq("creator_email", found.member.email),
    ]);
    if (error) throw error;

    const perDesign = new Map<string, { sales: number; earnings: number }>();
    let owedCents = 0;
    let paidCents = 0;
    for (const sale of (sold ?? []) as { design_id: string; creator_earnings_cents: number; payout_status: string }[]) {
      if (sale.payout_status === "void") continue;
      const entry = perDesign.get(sale.design_id) ?? { sales: 0, earnings: 0 };
      entry.sales += 1;
      entry.earnings += sale.creator_earnings_cents;
      perDesign.set(sale.design_id, entry);
      if (sale.payout_status === "paid") paidCents += sale.creator_earnings_cents;
      else owedCents += sale.creator_earnings_cents;
    }
    return {
      ok: true,
      designs: ((rows ?? []) as DesignRow[]).map((row) => summarize(row, perDesign.get(row.id)?.sales, perDesign.get(row.id)?.earnings)),
      owedCents,
      paidCents,
    };
  } catch (err) {
    console.error("[Builder] listDesigns:", err);
    return { ok: false, error: "We couldn't load your designs. Please try again." };
  }
}

export async function loadDesign(token: string | null, id: string): Promise<{ ok: true; id: string; scene: Scene } | Fail> {
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    if (!isUuid(id)) return { ok: false, error: "That design couldn't be found." };
    const { data } = await getServiceClient()
      .from("builder_designs")
      .select("id, scene")
      .eq("id", id)
      .eq("owner_email", found.member.email)
      .is("deleted_at", null)
      .maybeSingle();
    const scene = data ? parseScene(data.scene) : null;
    if (!data || !scene) return { ok: false, error: "That design couldn't be found." };
    return { ok: true, id: data.id as string, scene };
  } catch (err) {
    console.error("[Builder] loadDesign:", err);
    return { ok: false, error: "We couldn't open that design. Please try again." };
  }
}

/** Read a thumbnail from the browser: a small JPEG data URL, or nothing. */
function cleanThumbnail(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > DESIGN_LIMITS.maxThumbnail) return null;
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : null;
}

/**
 * Save a design. With `id` it updates that design (the caller's own);
 * without, it creates one. `forkedFrom` is the share slug of the design a
 * new one was copied from, kept for attribution.
 */
export async function saveDesign(
  token: string | null,
  input: { id?: string | null; scene: unknown; thumbnail?: unknown; forkedFrom?: string | null },
): Promise<{ ok: true; id: string; savedAt: string } | Fail> {
  const slow = await limited("save", 120, "10 m");
  if (slow) return { ok: false, error: slow };
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    const scene = parseScene(input.scene);
    if (!scene) return { ok: false, error: "This design couldn't be read, so it wasn't saved." };

    const db = getServiceClient();
    const savedAt = new Date().toISOString();
    const thumbnail = cleanThumbnail(input.thumbnail);
    const fields = {
      name: scene.name,
      scene,
      scene_version: scene.version,
      piece_count: scene.pieces.length,
      stats: designStats(scene),
      updated_at: savedAt,
      // Keep the old picture if this save didn't bring one
      ...(thumbnail ? { thumbnail } : {}),
    };

    if (input.id) {
      if (!isUuid(input.id)) return { ok: false, error: "That design couldn't be found." };
      const { data, error } = await db
        .from("builder_designs")
        .update(fields)
        .eq("id", input.id)
        .eq("owner_email", found.member.email)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, error: "That design couldn't be found. It may have been deleted on another device." };
      return { ok: true, id: data.id as string, savedAt };
    }

    const { count } = await db
      .from("builder_designs")
      .select("id", { count: "exact", head: true })
      .eq("owner_email", found.member.email)
      .is("deleted_at", null);
    if ((count ?? 0) >= DESIGN_LIMITS.maxDesigns) {
      return { ok: false, error: `You have ${DESIGN_LIMITS.maxDesigns} saved designs, the most one account holds. Delete one you no longer need.` };
    }
    let forkedFrom: string | null = null;
    if (typeof input.forkedFrom === "string" && SLUG_RE.test(input.forkedFrom)) {
      const { data: source } = await db.from("builder_designs").select("id").eq("share_slug", input.forkedFrom).maybeSingle();
      forkedFrom = (source?.id as string | undefined) ?? null;
    }
    const { data, error } = await db
      .from("builder_designs")
      .insert({ ...fields, owner_email: found.member.email, forked_from: forkedFrom })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("insert returned nothing");
    return { ok: true, id: data.id as string, savedAt };
  } catch (err) {
    console.error("[Builder] saveDesign:", err);
    return { ok: false, error: "We couldn't save your design. It is still on this device; please try again." };
  }
}

/** Remove a design from the member's library (and from the marketplace). Plans already sold keep working. */
export async function deleteDesign(token: string | null, id: string): Promise<{ ok: true } | Fail> {
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    if (!isUuid(id)) return { ok: false, error: "That design couldn't be found." };
    const now = new Date().toISOString();
    const { error } = await getServiceClient()
      .from("builder_designs")
      .update({ deleted_at: now, share_mode: "private", updated_at: now })
      .eq("id", id)
      .eq("owner_email", found.member.email);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[Builder] deleteDesign:", err);
    return { ok: false, error: "We couldn't delete that design. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Plans for a member's own design
// ═══════════════════════════════════════════════════════════════════════════

/** The build plan for the design the member is working on. */
export async function openBuilderPlan(token: string | null, rawScene: unknown): Promise<{ ok: true; plan: CustomPlan } | Fail> {
  const slow = await limited("plan", 60, "10 m");
  if (slow) return { ok: false, error: slow };
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    const scene = parseScene(rawScene);
    if (!scene) return { ok: false, error: "This design couldn't be read." };
    return { ok: true, plan: generateCustomPlan(scene) };
  } catch (err) {
    console.error("[Builder] openBuilderPlan:", err);
    return { ok: false, error: "We couldn't build the plan. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sharing and the marketplace
// ═══════════════════════════════════════════════════════════════════════════

/** URL-safe and unguessable: 96 bits. */
const newSlug = () => randomBytes(12).toString("base64url");

/**
 * Change how a design is shared: private, a view-only link, or listed for
 * sale at a price. The share link is made the first time and then stays
 * the same, so a link someone already has keeps working (or stops, if the
 * design goes back to private).
 */
export async function shareDesign(
  token: string | null,
  id: string,
  input: { mode: ShareMode; priceCents?: number | null; description?: string | null },
): Promise<{ ok: true; design: DesignSummary } | Fail> {
  const slow = await limited("share", 30, "10 m");
  if (slow) return { ok: false, error: slow };
  try {
    const found = await requireMember(token);
    if (!("member" in found)) return found;
    if (!isUuid(id) || !["private", "view", "sale"].includes(input.mode)) return { ok: false, error: "That design couldn't be found." };

    const db = getServiceClient();
    const { data: current } = await db
      .from("builder_designs")
      .select("id, share_slug, piece_count, listed_at")
      .eq("id", id)
      .eq("owner_email", found.member.email)
      .is("deleted_at", null)
      .maybeSingle();
    if (!current) return { ok: false, error: "That design couldn't be found." };
    if (input.mode !== "private" && (current.piece_count as number) === 0) return { ok: false, error: "Add at least one piece before sharing this design." };

    let priceCents: number | null = null;
    if (input.mode === "sale") {
      priceCents = Number.isInteger(input.priceCents) ? (input.priceCents as number) : NaN;
      if (!(priceCents >= LISTING_PRICE.min && priceCents <= LISTING_PRICE.max)) {
        return { ok: false, error: `Set a price between $${LISTING_PRICE.min / 100} and $${LISTING_PRICE.max / 100}.` };
      }
    }
    const description =
      typeof input.description === "string"
        ? input.description.replace(/\s+\n/g, "\n").trim().slice(0, DESIGN_LIMITS.maxDescription) || null
        : null;
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("builder_designs")
      .update({
        share_mode: input.mode,
        share_slug: (current.share_slug as string | null) ?? (input.mode === "private" ? null : newSlug()),
        price_cents: input.mode === "sale" ? priceCents : null,
        description,
        listed_at: input.mode === "sale" ? ((current.listed_at as string | null) ?? now) : null,
        updated_at: now,
      })
      .eq("id", id)
      .eq("owner_email", found.member.email)
      .select(DESIGN_COLUMNS)
      .single();
    if (error || !data) throw error ?? new Error("update returned nothing");
    return { ok: true, design: summarize(data as DesignRow) };
  } catch (err) {
    console.error("[Builder] shareDesign:", err);
    return { ok: false, error: "We couldn't update sharing. Please try again." };
  }
}

export interface Listing {
  slug: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  stats: DesignStats;
  priceCents: number;
}

export type SharedDesign =
  | { ok: true; mode: "view"; slug: string; name: string; description: string | null; stats: DesignStats; scene: Scene }
  | ({ ok: true; mode: "sale" } & Listing)
  | { ok: false; error: string };

/** What a share link shows. View-only links include the design; listings for sale don't. */
export async function getSharedDesign(slug: string): Promise<SharedDesign> {
  const missing = { ok: false as const, error: "This design isn't shared any more, or the link is wrong." };
  try {
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) return missing;
    const { data } = await getServiceClient()
      .from("builder_designs")
      .select("name, description, thumbnail, stats, share_mode, price_cents, scene")
      .eq("share_slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data || data.share_mode === "private") return missing;
    const stats = readDesignStats(data.stats);
    if (data.share_mode === "sale") {
      return {
        ok: true,
        mode: "sale",
        slug,
        name: data.name as string,
        description: data.description as string | null,
        thumbnail: data.thumbnail as string | null,
        stats,
        priceCents: data.price_cents as number,
      };
    }
    const scene = parseScene(data.scene);
    if (!scene) return missing;
    return { ok: true, mode: "view", slug, name: data.name as string, description: data.description as string | null, stats, scene };
  } catch (err) {
    console.error("[Builder] getSharedDesign:", err);
    return { ok: false, error: "We couldn't load this design. Please try again." };
  }
}

/** Plans listed for sale, newest first. */
export async function listMarketplace(): Promise<{ ok: true; listings: Listing[] } | { ok: false; error: string }> {
  try {
    const { data, error } = await getServiceClient()
      .from("builder_designs")
      .select("share_slug, name, description, thumbnail, stats, price_cents")
      .eq("share_mode", "sale")
      .is("deleted_at", null)
      .not("share_slug", "is", null)
      .order("listed_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return {
      ok: true,
      listings: (data ?? []).map((row) => ({
        slug: row.share_slug as string,
        name: row.name as string,
        description: row.description as string | null,
        thumbnail: row.thumbnail as string | null,
        stats: readDesignStats(row.stats),
        priceCents: row.price_cents as number,
      })),
    };
  } catch (err) {
    console.error("[Builder] listMarketplace:", err);
    return { ok: false, error: "We couldn't load the marketplace. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Buying a listed plan
// ═══════════════════════════════════════════════════════════════════════════

/** Start checkout for a listed plan. Open to anyone; the price comes from the listing. */
export async function createPlanPurchaseCheckout(slug: string): Promise<{ ok: true; clientSecret: string } | Fail> {
  const slow = await limited("buy", 10, "60 s");
  if (slow) return { ok: false, error: slow };
  try {
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) return { ok: false, error: "This plan isn't for sale any more." };
    const { data: design } = await getServiceClient()
      .from("builder_designs")
      .select("id, name, price_cents, share_mode, stats")
      .eq("share_slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!design || design.share_mode !== "sale" || !design.price_cents) return { ok: false, error: "This plan isn't for sale any more." };
    const stats = readDesignStats(design.stats);
    const session = await createEmbeddedCheckoutSession(builderStripe(), {
      mode: "payment",
      custom_text: FINAL_SALE_TEXT,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${design.name} — Build Plan`,
              description: `${stats.pieceCount} pieces. Cut list, shopping list, interactive 3D guide and printable PDF.`,
            },
            unit_amount: design.price_cents as number,
          },
          quantity: 1,
        },
      ],
      return_url: `${siteConfig.baseUrl}/plans/builder/plan?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { type: "builder_plan", design_id: design.id as string },
    });
    if (!session.client_secret) return { ok: false, error: "Couldn't start checkout. Please try again." };
    return { ok: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[Builder] plan checkout:", err);
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }
}

export type PurchasedPlanResult =
  | {
      ok: true;
      name: string;
      scene: Scene;
      plan: CustomPlan;
      token: string;
      /** Set on the first visit, so the page can say where the link went */
      emailSentTo?: string;
      firstName?: string;
      license: string;
    }
  | Fail;

interface PurchaseRow {
  access_token: string;
  buyer_email: string;
  customer_name: string | null;
  design_name: string;
  scene_snapshot: unknown;
}

const PURCHASE_COLUMNS = "access_token, buyer_email, customer_name, design_name, scene_snapshot";

function planFromPurchase(row: PurchaseRow, extras: { emailSentTo?: string } = {}): PurchasedPlanResult {
  const scene = parseScene(row.scene_snapshot);
  if (!scene) return { ok: false, error: "This plan couldn't be read. Email us and we'll put it right." };
  return {
    ok: true,
    name: row.design_name,
    scene,
    plan: generateCustomPlan(scene),
    token: row.access_token,
    firstName: firstNameOf(row.customer_name),
    license: `Licensed to ${row.buyer_email} · Order SN-${row.access_token.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    ...extras,
  };
}

async function gatedPurchase(row: PurchaseRow): Promise<PurchasedPlanResult> {
  const device = await checkPlanDevice(row.buyer_email);
  if (!device.ok) {
    return {
      ok: false,
      reason: "verify",
      error: "Confirm it's you to open this plan on this device.",
      verify: { token: row.access_token, emailHint: device.emailHint },
    };
  }
  return planFromPurchase(row);
}

/**
 * Open a plan bought from the marketplace.
 *   sessionId  first visit, straight from Stripe: verifies the payment,
 *              records the sale (and the creator's share of it), emails the
 *              buyer's permanent link and tells the creator
 *   token      return visits from that link
 */
export async function openPurchasedPlan(input: { sessionId: string } | { token: string }): Promise<PurchasedPlanResult> {
  try {
    const db = getServiceClient();
    if ("token" in input) {
      if (!isUuid(input.token)) return { ok: false, error: "This link is invalid or has expired." };
      const { data } = await db.from("builder_plan_purchases").select(PURCHASE_COLUMNS).eq("access_token", input.token).maybeSingle();
      return data ? gatedPurchase(data as PurchaseRow) : { ok: false, error: "This link is invalid or has expired." };
    }

    const { sessionId } = input;
    if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return { ok: false, error: "We couldn't confirm that payment." };
    // A reload of the return URL: only the first load is trusted.
    const { data: existing } = await db.from("builder_plan_purchases").select(PURCHASE_COLUMNS).eq("stripe_session_id", sessionId).maybeSingle();
    if (existing) return gatedPurchase(existing as PurchaseRow);

    const session = await builderStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" || session.metadata?.type !== "builder_plan" || !isUuid(session.metadata?.design_id)) {
      return { ok: false, error: "We couldn't confirm that payment." };
    }
    const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
    // The design as it is now, even if it has since been unlisted or deleted: they paid for it.
    const { data: design } = await db.from("builder_designs").select("id, name, scene, owner_email").eq("id", session.metadata.design_id).maybeSingle();
    if (!design || !email || !parseScene(design.scene)) {
      console.error("[Builder] Paid plan session missing design or email:", sessionId);
      return { ok: false, error: "Your payment went through but the order is incomplete. Reply to your receipt and we'll sort it out." };
    }

    const amountCents = session.amount_total ?? 0;
    const { platformFeeCents, creatorEarningsCents } = splitSale(amountCents);
    const { data: inserted, error } = await db
      .from("builder_plan_purchases")
      .insert({
        design_id: design.id,
        buyer_email: email,
        customer_name: session.customer_details?.name?.trim() || null,
        stripe_session_id: sessionId,
        design_name: design.name,
        scene_snapshot: design.scene,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        creator_earnings_cents: creatorEarningsCents,
        creator_email: design.owner_email,
      })
      .select(PURCHASE_COLUMNS)
      .single();
    if (error || !inserted) {
      // Lost a race with another load of the same session: use its row.
      if ((error as { code?: string } | null)?.code === "23505") {
        const { data: winner } = await db.from("builder_plan_purchases").select(PURCHASE_COLUMNS).eq("stripe_session_id", sessionId).single();
        if (winner) return gatedPurchase(winner as PurchaseRow);
      }
      console.error("[Builder] purchase insert failed:", error);
      return { ok: false, error: "We couldn't record your purchase. Please refresh the page." };
    }
    const row = inserted as PurchaseRow;

    await checkPlanDevice(email, { trusted: true });
    const sent = await sendBuilderPlanPurchaseEmail(email, row.design_name, row.access_token).catch((err) => {
      console.error("[Builder] purchase email error:", err);
      return null;
    });
    if (sent?.success) await db.from("builder_plan_purchases").update({ email_sent: true }).eq("access_token", row.access_token);
    // Tell the creator. A failed notice never affects the sale.
    await sendBuilderSaleEmail(design.owner_email as string, {
      designName: row.design_name,
      amountCents,
      earningsCents: creatorEarningsCents,
    }).catch((err) => console.error("[Builder] sale email error (sale unaffected):", err));

    return planFromPurchase(row, { emailSentTo: email });
  } catch (err) {
    console.error("[Builder] openPurchasedPlan:", err);
    return { ok: false, error: "We couldn't load your plan. Please try again." };
  }
}
