// ═══════════════════════════════════════════════════════════════════════════
// Post-deposit add-ons — DB helpers (see migration 139)
//
// Deliberately NOT a "use server" module: recordAddonDepositPaid and
// settlePendingAddons mutate money state and must only be reachable from
// trusted server code (payment actions, the Stripe webhook) — never as a
// client-callable server action.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { computeBalanceDue } from "@/lib/lead-money";
import { roundMoney } from "@/utils/mathHelpers";

export type AddonStatus = "pending" | "paid" | "collected_with_balance" | "invoiced";

export interface LeadAddon {
  id: string;
  lead_id: string;
  description: string | null;
  amount: number;
  deposit_amount: number;
  platform_fee: number;
  sales_tax_amount: number;
  status: AddonStatus;
  paid_at: string | null;
  created_at: string;
}

const ADDON_COLUMNS =
  "id, lead_id, description, amount, deposit_amount, platform_fee, sales_tax_amount, status, paid_at, created_at";

function toAddon(row: Record<string, unknown>): LeadAddon {
  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    description: (row.description as string | null) ?? null,
    amount: Number(row.amount) || 0,
    deposit_amount: Number(row.deposit_amount) || 0,
    platform_fee: Number(row.platform_fee) || 0,
    sales_tax_amount: Number(row.sales_tax_amount) || 0,
    status: row.status as AddonStatus,
    paid_at: (row.paid_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

/** All add-ons on a lead, oldest first. Empty on error (e.g. table missing). */
export async function listAddons(leadId: string): Promise<LeadAddon[]> {
  const { data, error } = await getServiceClient()
    .from("lead_addons")
    .select(ADDON_COLUMNS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[Addons] list failed:", error.message);
    return [];
  }
  return (data ?? []).map(toAddon);
}

/** Add-ons whose deposit hasn't been collected (their fee is still owed). */
export async function listPendingAddons(leadId: string): Promise<LeadAddon[]> {
  return (await listAddons(leadId)).filter((a) => a.status === "pending");
}

/** Sum of pending add-ons' platform fees, in cents. */
export function pendingAddonFeeCents(addons: LeadAddon[]): number {
  return addons
    .filter((a) => a.status === "pending")
    .reduce((sum, a) => sum + Math.round(a.platform_fee * 100), 0);
}

/** Parse the comma-separated addon_ids Stripe metadata value. */
export function parseAddonIds(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Webhook: add-on deposit paid ─────────────────────────────────────────
// Flips the given add-ons pending → paid (the conditional update is the
// idempotency guard: a Stripe retry finds nothing pending and no-ops), then
// credits their deposits onto leads.deposit_amount so every balance
// calculation stops counting them as owed.
export async function recordAddonDepositPaid(params: {
  leadId: string;
  addonIds: string[];
  paymentIntentId: string | null;
}): Promise<{ recorded: number; depositCredited: number; error?: string }> {
  const { leadId, addonIds, paymentIntentId } = params;
  if (addonIds.length === 0) return { recorded: 0, depositCredited: 0 };
  const db = getServiceClient();

  const { data: flipped, error } = await db
    .from("lead_addons")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("lead_id", leadId)
    .in("id", addonIds)
    .eq("status", "pending")
    .select("deposit_amount");

  if (error) return { recorded: 0, depositCredited: 0, error: error.message };
  if (!flipped || flipped.length === 0) return { recorded: 0, depositCredited: 0 };

  const credit = roundMoney(flipped.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0));

  // Optimistic-lock increment: retry if another writer changed deposit_amount
  // between our read and write (e.g. two add-on payments landing together).
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: lead } = await db
      .from("leads")
      .select("estimated_price, deposit_amount, deposit_paid, discount_amount, sales_tax_amount")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return { recorded: flipped.length, depositCredited: 0, error: "Lead not found." };

    const newDeposit = roundMoney((Number(lead.deposit_amount) || 0) + credit);
    const { data: updated, error: upErr } = await db
      .from("leads")
      .update({
        deposit_amount: newDeposit,
        balance_due: computeBalanceDue({ ...lead, deposit_amount: newDeposit }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("deposit_amount", lead.deposit_amount)
      .select("id")
      .maybeSingle();
    if (upErr) return { recorded: flipped.length, depositCredited: 0, error: upErr.message };
    if (updated) return { recorded: flipped.length, depositCredited: credit };
  }
  return { recorded: flipped.length, depositCredited: 0, error: "deposit_amount changed concurrently." };
}

// ── Final payment / manual mark-paid: settle what's still pending ────────
// Called when the job is paid in full while some add-on deposits were never
// collected separately. Their platform fee was taken from the balance charge
// ("collected_with_balance") or invoiced to the installer ("invoiced").
export async function settlePendingAddons(params: {
  leadId: string;
  addonIds: string[];
  status: "collected_with_balance" | "invoiced";
}): Promise<void> {
  const { leadId, addonIds, status } = params;
  if (addonIds.length === 0) return;
  const { error } = await getServiceClient()
    .from("lead_addons")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .in("id", addonIds)
    .eq("status", "pending");
  if (error) console.error("[Addons] settle failed:", leadId, error.message);
}
