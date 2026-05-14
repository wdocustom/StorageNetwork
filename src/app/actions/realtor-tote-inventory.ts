"use server";

import Stripe from "stripe";

import { siteConfig } from "@/config/site";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Tote Inventory — bulk-pack purchase + balance accounting
//
// Companion to realtor-gifts.ts. This module is the inventory-mode path:
//   1. Realtor opens "Buy Totes" modal, picks pack_50 / pack_100 / pack_250
//      or enters a 1–49 custom top-up qty
//   2. createTotePackCheckout() inserts a pending purchase ledger row +
//      Stripe Session
//   3. Stripe success → finalizeTotePackPurchase() (idempotent) atomically
//      flips ledger row to 'paid' AND credits profiles.realtor_tote_balance
//      via the Postgres function credit_realtor_tote_purchase (migration 114)
//
// Pricing rules (centralised here, NOT in the DB, so adjustments don't need
// a migration):
//   • $6.50 flat per paid tote
//   • pack_50  → +5 bonus  (10%)
//   • pack_100 → +10 bonus (10%)
//   • pack_250 → +38 bonus (15% of 250, ceil)
//   • custom (1–49) → 0 bonus
// ═══════════════════════════════════════════════════════════════════════════

// Lazy Stripe init — mirrors the pattern in realtor-gifts.ts. /gift/[token]
// transitively imports the action surface at build time, when env vars are
// absent. Eager `new Stripe(...)` would throw there.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover",
  });
  return _stripe;
}

// ── Catalog (frozen constants) ────────────────────────────────────────────

// $6.50 per tote. Internal-only (not exported) — Next.js "use server" files
// can only export async functions; constants must reach the client via the
// listTotePackOptions() return value.
const TOTE_UNIT_PRICE_CENTS = 650;

export type PackSku = "pack_50" | "pack_100" | "pack_250" | "custom";

export interface PackOption {
  sku: PackSku;
  label: string;
  paidCount: number;     // For fixed packs; 0 for 'custom' (qty supplied by user)
  bonusCount: number;    // For fixed packs; computed for 'custom'
  totalCredited: number; // paid + bonus
  amountCents: number;   // paidCount × $6.50
  bonusBlurb: string;    // UI copy explaining the bonus
}

const FIXED_PACKS: Record<Exclude<PackSku, "custom">, PackOption> = {
  pack_50: {
    sku: "pack_50",
    label: "50-pack",
    paidCount: 50,
    bonusCount: 5,
    totalCredited: 55,
    amountCents: 50 * TOTE_UNIT_PRICE_CENTS,
    bonusBlurb: "5 bonus totes (10%) — pay for 50, get 55.",
  },
  pack_100: {
    sku: "pack_100",
    label: "100-pack",
    paidCount: 100,
    bonusCount: 10,
    totalCredited: 110,
    amountCents: 100 * TOTE_UNIT_PRICE_CENTS,
    bonusBlurb: "10 bonus totes (10%) — pay for 100, get 110.",
  },
  pack_250: {
    sku: "pack_250",
    label: "Pro 250-pack",
    paidCount: 250,
    bonusCount: 38, // ceil(250 × 0.15) = 38
    totalCredited: 288,
    amountCents: 250 * TOTE_UNIT_PRICE_CENTS,
    bonusBlurb: "38 bonus totes (15%) — pay for 250, get 288.",
  },
};

const CUSTOM_MIN = 1;
const CUSTOM_MAX = 49;

/** Public catalog for the Buy Totes modal. */
export async function listTotePackOptions(): Promise<{
  packs: PackOption[];
  custom: { unitPriceCents: number; min: number; max: number };
}> {
  return {
    packs: [FIXED_PACKS.pack_50, FIXED_PACKS.pack_100, FIXED_PACKS.pack_250],
    custom: {
      unitPriceCents: TOTE_UNIT_PRICE_CENTS,
      min: CUSTOM_MIN,
      max: CUSTOM_MAX,
    },
  };
}

/** Compute the option (including bonus) for a custom top-up quantity. */
function buildCustomOption(paidCount: number): PackOption {
  return {
    sku: "custom",
    label: `${paidCount}-tote top-up`,
    paidCount,
    bonusCount: 0,
    totalCredited: paidCount,
    amountCents: paidCount * TOTE_UNIT_PRICE_CENTS,
    bonusBlurb: "No bonus on top-ups under 50 totes.",
  };
}

// ── Inventory read ────────────────────────────────────────────────────────

export interface RealtorToteInventory {
  balance: number;
  recentPurchases: Array<{
    id: string;
    packSku: PackSku;
    label: string;
    paidCount: number;
    bonusCount: number;
    totalCredited: number;
    amountCents: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
}

export async function getRealtorToteInventory(): Promise<RealtorToteInventory> {
  const user = await getAuthenticatedUser();
  if (!user) return { balance: 0, recentPurchases: [] };

  const db = getServiceClient();

  const [{ data: profile }, { data: purchases }] = await Promise.all([
    db
      .from("profiles")
      .select("realtor_tote_balance")
      .eq("id", user.id)
      .single(),
    db
      .from("realtor_tote_purchases")
      .select(
        "id, pack_sku, paid_count, bonus_count, total_credited, amount_cents, status, created_at, paid_at"
      )
      .eq("realtor_id", user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  return {
    balance: profile?.realtor_tote_balance ?? 0,
    recentPurchases: (purchases ?? []).map((p) => ({
      id: p.id as string,
      packSku: p.pack_sku as PackSku,
      label: labelFor(p.pack_sku as PackSku, p.paid_count as number),
      paidCount: p.paid_count as number,
      bonusCount: p.bonus_count as number,
      totalCredited: p.total_credited as number,
      amountCents: p.amount_cents as number,
      status: p.status as string,
      createdAt: p.created_at as string,
      paidAt: (p.paid_at as string | null) ?? null,
    })),
  };
}

function labelFor(sku: PackSku, paidCount: number): string {
  if (sku === "custom") return `${paidCount}-tote top-up`;
  return FIXED_PACKS[sku].label;
}

// ── Create checkout ───────────────────────────────────────────────────────

export interface CreateTotePackCheckoutInput {
  packSku: PackSku;
  /** Only meaningful when packSku === 'custom'. Ignored otherwise. */
  customQuantity?: number;
}

export interface CreateTotePackCheckoutResult {
  success: boolean;
  url?: string;
  purchaseId?: string;
  error?: string;
}

export async function createTotePackCheckout(
  input: CreateTotePackCheckoutInput
): Promise<CreateTotePackCheckoutResult> {
  try {
    await enforceActionRateLimit({
      action: "create-tote-pack-checkout",
      limit: 10,
      window: "5 m",
      identify: "user-or-ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const db = getServiceClient();

  // Confirm the caller is actually a realtor — same defense-in-depth pattern
  // as createGiftCheckout. Route is gated, but the action must not trust it.
  const { data: profile } = await db
    .from("profiles")
    .select("is_realtor")
    .eq("id", user.id)
    .single();

  if (!profile?.is_realtor) {
    return { success: false, error: "Only realtors can buy tote packs." };
  }

  // Resolve the option (server-side; never trust client-supplied prices).
  let option: PackOption;
  if (input.packSku === "custom") {
    const qty = Math.floor(input.customQuantity ?? 0);
    if (!Number.isFinite(qty) || qty < CUSTOM_MIN || qty > CUSTOM_MAX) {
      return {
        success: false,
        error: `Top-up quantity must be between ${CUSTOM_MIN} and ${CUSTOM_MAX} totes.`,
      };
    }
    option = buildCustomOption(qty);
  } else if (input.packSku in FIXED_PACKS) {
    option = FIXED_PACKS[input.packSku as Exclude<PackSku, "custom">];
  } else {
    return { success: false, error: "Unknown pack SKU." };
  }

  // Insert the ledger row in pending_payment state. Stripe session metadata
  // carries the purchase_id so the webhook can look it up.
  const { data: purchase, error: insertErr } = await db
    .from("realtor_tote_purchases")
    .insert({
      realtor_id: user.id,
      pack_sku: option.sku,
      paid_count: option.paidCount,
      bonus_count: option.bonusCount,
      unit_price_cents: TOTE_UNIT_PRICE_CENTS,
      amount_cents: option.amountCents,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (insertErr || !purchase) {
    console.error("[ToteInventory] insert pending purchase failed:", insertErr);
    return { success: false, error: "Could not start checkout. Please try again." };
  }

  try {
    const baseUrl = siteConfig.baseUrl;
    const productName = `Tote Inventory — ${option.label}`;
    const productDescription = option.bonusCount > 0
      ? `${option.paidCount} totes + ${option.bonusCount} bonus = ${option.totalCredited} totes credited to your inventory.`
      : `${option.paidCount} totes credited to your inventory.`;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: option.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/realtors/dashboard?tote_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/realtors/dashboard?tote_purchase=cancelled`,
      metadata: {
        type: "tote_pack_purchase",
        purchase_id: purchase.id,
        realtor_id: user.id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    await db
      .from("realtor_tote_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    return { success: true, url: session.url, purchaseId: purchase.id };
  } catch (err) {
    console.error("[ToteInventory] Stripe session error:", err);
    return { success: false, error: "Failed to create checkout. Please try again." };
  }
}

// ── Finalize (idempotent) ─────────────────────────────────────────────────

export interface FinalizeTotePackResult {
  ok: boolean;
  purchaseId?: string;
  totalCredited?: number;
  newBalance?: number;
  alreadyFinalized?: boolean;
  error?: string;
}

/**
 * Idempotent finalize for a tote-pack purchase. Called by both the Stripe
 * webhook (on checkout.session.completed) and the success-page poll.
 *
 * Delegates the actual status-flip + balance-credit to the
 * credit_realtor_tote_purchase Postgres function (migration 114) so the two
 * writes happen atomically and concurrent callers can't double-credit.
 */
export async function finalizeTotePackPurchase(opts: {
  sessionId: string;
}): Promise<FinalizeTotePackResult> {
  if (!opts.sessionId) return { ok: false, error: "Missing sessionId." };

  const db = getServiceClient();

  // 1. Confirm Stripe says it's paid before mutating anything.
  let paymentIntentId: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(opts.sessionId);
    if (session.payment_status !== "paid") {
      return { ok: false, error: "Payment not completed yet." };
    }
    if (session.metadata?.type !== "tote_pack_purchase") {
      return { ok: false, error: "Session is not a tote-pack purchase." };
    }
    paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;
  } catch (err) {
    console.error("[ToteInventory] finalize: stripe retrieve failed:", err);
    return { ok: false, error: "Could not verify payment." };
  }

  // 2. Atomic credit via the Postgres function. Idempotent — second call
  //    returns already_credited=true without re-crediting.
  const { data, error } = await db.rpc("credit_realtor_tote_purchase", {
    p_stripe_session_id: opts.sessionId,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    console.error("[ToteInventory] credit RPC failed:", error);
    return { ok: false, error: "Failed to credit purchase." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Credit RPC returned no row." };

  return {
    ok: true,
    purchaseId: row.purchase_id as string,
    totalCredited: row.total_credited as number,
    newBalance: row.new_balance as number,
    alreadyFinalized: row.already_credited as boolean,
  };
}

/** Called from the dashboard's `?session_id=` query param after Stripe redirect. */
export async function verifyTotePackPurchase(
  sessionId: string
): Promise<FinalizeTotePackResult> {
  return finalizeTotePackPurchase({ sessionId });
}
