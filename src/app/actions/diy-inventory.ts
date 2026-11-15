"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Smart Inventory for DIY plan buyers (see src/lib/diy-inventory.ts)
//
// The hub (/plans/inventory) is reached with a plan link (?token=, device-
// gated like every plan page), from a DIY rack's page with that rack's own
// link (?rack=, which already opens the buyer's racks), or signed in
// (?account=1): admins and paid Pro installers, for whom it's included like
// their plans are. Buying the $5
// add-on and adding racks both need the buyer's email behind one of those.
// Racks are ordinary inventory_racks (source 'diy') with the buyer's email,
// so the existing rack pages link them, search across them and move totes.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { siteConfig } from "@/config/site";
import { stripeConfig } from "@/lib/stripe/http";
import { FINAL_SALE_TEXT, createEmbeddedCheckoutSession } from "@/lib/stripe/embedded-checkout";
import { getServiceClient } from "@/lib/supabase-server";
import { checkPlanDevice } from "@/lib/server/plan-device";
import { grantDiyInventory, hasDiyInventory } from "@/lib/server/diy-inventory";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { DIY_INVENTORY, DIY_RACK_LIMITS } from "@/lib/diy-inventory";
import { TOTE_PLAN_ID, parseTotePlanDesign } from "@/lib/tote-plans";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { ...stripeConfig(), apiVersion: "2025-12-15.clover" });
  return _stripe;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RACK_TOKEN_RE = /^[0-9a-f]{16,64}$/i;

export type DiyInventoryKey = { token: string } | { rack: string } | { account: true };

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 2)}•••@${domain}` : "your email";
}

type Buyer =
  | { ok: true; email: string; planToken: string | null; /** Admin / paid Pro: included, no purchase */ included?: boolean }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

/** Who's asking: the email behind a plan link (device-gated) or a DIY rack link. */
async function resolveBuyer(key: DiyInventoryKey): Promise<Buyer> {
  const db = getServiceClient();
  if ("account" in key) {
    const user = await getAuthenticatedUser();
    if (!user) return { ok: false, error: "Sign in to use Smart Inventory." };
    const access = await checkDIYPlanAccess();
    if (!access.hasFreeAccess) return { ok: false, error: "Smart Inventory is included for Pro installers. Plan buyers get it from their plan page." };
    const { data: profile } = await db.from("profiles").select("email").eq("id", user.id).maybeSingle();
    const email = ((profile?.email as string | null) ?? user.email ?? "").toLowerCase();
    if (!email) return { ok: false, error: "Your account has no email address." };
    return { ok: true, email, planToken: null, included: true };
  }
  if ("token" in key) {
    if (!UUID_RE.test(key.token ?? "")) return { ok: false, error: "This link is invalid or has expired." };
    const { data } = await db.from("public_plan_purchases").select("email").eq("access_token", key.token).maybeSingle();
    if (!data?.email) return { ok: false, error: "This link is invalid or has expired." };
    const device = await checkPlanDevice(data.email as string);
    if (!device.ok) return { ok: false, error: "Confirm it's you on this device.", verify: { token: key.token, emailHint: device.emailHint } };
    return { ok: true, email: (data.email as string).toLowerCase(), planToken: key.token };
  }
  if (!RACK_TOKEN_RE.test(key.rack ?? "")) return { ok: false, error: "This link is invalid or has expired." };
  const { data } = await db
    .from("inventory_racks")
    .select("customer_email, source")
    .eq("access_token", key.rack)
    .maybeSingle();
  if (!data?.customer_email || data.source !== "diy") return { ok: false, error: "This link is invalid or has expired." };
  return { ok: true, email: (data.customer_email as string).toLowerCase(), planToken: null };
}

export interface DiyRackSummary {
  token: string;
  label: string;
  cols: number;
  rows: number;
  hasWheels: boolean;
  /** Totes with at least one item */
  filled: number;
  items: number;
}

export interface DiyRackSuggestion {
  label: string;
  cols: number;
  rows: number;
  hasWheels: boolean;
  hasTop: boolean;
  sideways: boolean;
}

export type DiyInventoryResult =
  | {
      ok: true;
      emailHint: string;
      hasAccess: boolean;
      /** Included with an admin / Pro account (nothing to buy) */
      included?: boolean;
      racks: DiyRackSummary[];
      /** Units from the buyer's plans that aren't in the inventory yet */
      suggestions: DiyRackSuggestion[];
    }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

export async function getDiyInventory(key: DiyInventoryKey): Promise<DiyInventoryResult> {
  try {
    const buyer = await resolveBuyer(key);
    if (!buyer.ok) return buyer;
    const db = getServiceClient();
    const [access, racksRes, plansRes] = await Promise.all([
      buyer.included ? Promise.resolve(true) : hasDiyInventory(buyer.email),
      db
        .from("inventory_racks")
        .select("id, access_token, label, cols, rows, has_wheels, created_at")
        .eq("customer_email", buyer.email)
        .order("created_at", { ascending: true }),
      db.from("public_plan_purchases").select("build_config, purchased_at").eq("email", buyer.email).eq("plan_id", TOTE_PLAN_ID),
    ]);
    const rackRows = racksRes.data ?? [];

    // Totes and items in use per rack
    const filledByRack = new Map<string, { filled: number; items: number }>();
    if (rackRows.length) {
      const { data: slots } = await db
        .from("inventory_slots")
        .select("rack_id, inventory_items!inner(id)")
        .in("rack_id", rackRows.map((r) => r.id as string));
      for (const s of slots ?? []) {
        const row = filledByRack.get(s.rack_id as string) ?? { filled: 0, items: 0 };
        row.filled++;
        row.items += (s.inventory_items as unknown[] | null)?.length ?? 0;
        filledByRack.set(s.rack_id as string, row);
      }
    }
    const racks: DiyRackSummary[] = rackRows.map((r) => ({
      token: r.access_token as string,
      label: r.label as string,
      cols: r.cols as number,
      rows: r.rows as number,
      hasWheels: r.has_wheels === true,
      filled: filledByRack.get(r.id as string)?.filled ?? 0,
      items: filledByRack.get(r.id as string)?.items ?? 0,
    }));

    // Every unit they've got a plan for, minus sizes already in the inventory
    const have = new Map<string, number>();
    for (const r of racks) have.set(`${r.cols}x${r.rows}`, (have.get(`${r.cols}x${r.rows}`) ?? 0) + 1);
    const suggestions: DiyRackSuggestion[] = [];
    const seen = new Map<string, number>();
    for (const p of (plansRes.data ?? []).sort((a, b) => String(a.purchased_at).localeCompare(String(b.purchased_at)))) {
      const design = parseTotePlanDesign(p.build_config);
      if (!design) continue;
      for (const u of design.units) {
        const k = `${u.cols}x${u.rows}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
        if ((seen.get(k) ?? 0) <= (have.get(k) ?? 0)) continue;
        if (suggestions.some((s) => s.cols === u.cols && s.rows === u.rows)) continue;
        suggestions.push({
          label: `${u.cols}×${u.rows}${u.sideways ? " sideways" : ""} rack`,
          cols: u.cols,
          rows: u.rows,
          hasWheels: u.hasWheels,
          hasTop: u.hasTop,
          sideways: u.sideways === true,
        });
      }
    }

    return {
      ok: true,
      emailHint: maskEmail(buyer.email),
      hasAccess: access,
      included: buyer.included === true,
      racks,
      suggestions: suggestions.slice(0, 6),
    };
  } catch (err) {
    console.error("[DiyInventory] load failed:", err);
    return { ok: false, error: "We couldn't load your inventory. Please try again." };
  }
}

/** The $5 lifetime add-on: an embedded Stripe checkout for this buyer. */
export async function createDiyInventoryCheckout(
  key: DiyInventoryKey,
): Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> {
  try {
    await enforceActionRateLimit({ action: "diy-inventory-checkout", limit: 6, window: "60 s", identify: "user-or-ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const buyer = await resolveBuyer(key);
  if (!buyer.ok) return { ok: false, error: buyer.error };
  if (buyer.included || (await hasDiyInventory(buyer.email))) return { ok: false, error: "You already have Smart Inventory." };

  const back =
    "token" in key ? `token=${encodeURIComponent(key.token)}` : "rack" in key ? `rack=${encodeURIComponent(key.rack)}` : "account=1";
  try {
    const session = await createEmbeddedCheckoutSession(getStripe(), {
      mode: "payment",
      custom_text: FINAL_SALE_TEXT,
      customer_email: buyer.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${DIY_INVENTORY.name} — lifetime`,
              description: "Track what's in every tote on every rack you build: photos, search, printable QR labels. One payment, for life.",
            },
            unit_amount: DIY_INVENTORY.price,
          },
          quantity: 1,
        },
      ],
      return_url: `${siteConfig.baseUrl}/plans/inventory?${back}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { type: "diy_inventory", email: buyer.email },
    });
    if (!session.client_secret) return { ok: false, error: "We couldn't open checkout. Please try again." };
    return { ok: true, clientSecret: session.client_secret };
  } catch (err) {
    console.error("[DiyInventory] checkout failed:", err);
    return { ok: false, error: "We couldn't open checkout. Please try again." };
  }
}

/** Back from checkout: record the add-on once Stripe confirms payment. */
export async function confirmDiyInventory(key: DiyInventoryKey, sessionId: string): Promise<{ ok: boolean }> {
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId ?? "")) return { ok: false };
  const buyer = await resolveBuyer(key);
  if (!buyer.ok) return { ok: false };
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const email = (session.metadata?.email ?? "").toLowerCase();
    if (session.payment_status !== "paid" || session.metadata?.type !== "diy_inventory" || email !== buyer.email) return { ok: false };
    await grantDiyInventory(email, session.id, session.amount_total ?? DIY_INVENTORY.price);
    return { ok: true };
  } catch (err) {
    console.error("[DiyInventory] confirm failed:", err);
    return { ok: false };
  }
}

/** Add one rack the buyer built (any size; they can add more any time). */
export async function addDiyRack(
  key: DiyInventoryKey,
  input: { label: string; cols: number; rows: number; hasWheels?: boolean; hasTop?: boolean; sideways?: boolean },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    await enforceActionRateLimit({ action: "diy-inventory-rack", limit: 10, window: "60 s", identify: "user-or-ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const buyer = await resolveBuyer(key);
  if (!buyer.ok) return { ok: false, error: buyer.error };
  if (!buyer.included && !(await hasDiyInventory(buyer.email))) return { ok: false, error: "Add Smart Inventory first." };

  const cols = Math.round(Number(input.cols));
  const rows = Math.round(Number(input.rows));
  if (!(cols >= DIY_RACK_LIMITS.minCols && cols <= DIY_RACK_LIMITS.maxCols && rows >= DIY_RACK_LIMITS.minRows && rows <= DIY_RACK_LIMITS.maxRows)) {
    return { ok: false, error: `Racks can be ${DIY_RACK_LIMITS.minCols}–${DIY_RACK_LIMITS.maxCols} totes wide and ${DIY_RACK_LIMITS.minRows}–${DIY_RACK_LIMITS.maxRows} tall.` };
  }
  const label = (input.label ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || `${cols}×${rows} rack`;

  const db = getServiceClient();
  const { count } = await db.from("inventory_racks").select("id", { count: "exact", head: true }).eq("customer_email", buyer.email);
  if ((count ?? 0) >= DIY_RACK_LIMITS.maxRacks) return { ok: false, error: `You can have up to ${DIY_RACK_LIMITS.maxRacks} racks.` };

  const { data, error } = await db
    .from("inventory_racks")
    .insert({
      customer_email: buyer.email,
      label,
      cols,
      rows,
      has_wheels: input.hasWheels === true,
      top_type: input.hasTop ? "plywood" : "none",
      layout: input.sideways ? "sideways" : "standard",
      source: "diy",
    })
    .select("access_token")
    .single();
  if (error || !data) {
    console.error("[DiyInventory] add rack failed:", error?.message);
    return { ok: false, error: "We couldn't add that rack. Please try again." };
  }
  return { ok: true, token: data.access_token as string };
}
