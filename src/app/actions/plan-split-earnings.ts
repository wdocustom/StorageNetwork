"use server";

// ═══════════════════════════════════════════════════════════════════════════
// DIY plan-sale splits — what installers see and what the owner manages
//
//   getMyPlanEarnings()   → the signed-in installer's own split earnings
//                           (null when they've never received one, so the
//                           card stays hidden for everyone else)
//   getPlanSplitsAdmin()  → every split, by installer — OWNER ONLY
//   retryPlanSplit(id)    → retry a failed transfer — OWNER ONLY
//
// "Owner" = the platform owner account (OWNER_EMAIL) with is_admin, checked
// on the server for every call; other admins and partners get nothing.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { OWNER_EMAIL } from "@/lib/demo-constants";
import { retryPlanSplitPayout } from "@/lib/server/plan-split-payouts";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

type SplitStatus = "pending" | "paid" | "failed";

interface SplitRow {
  id: string;
  stripe_session_id: string;
  recipient_id: string;
  amount_cents: number;
  reason: "referral" | "bestseller";
  bestsellers: string[] | null;
  plan_tier: string | null;
  design: string | null;
  status: SplitStatus;
  stripe_transfer_id: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

const ROW_COLUMNS =
  "id, stripe_session_id, recipient_id, amount_cents, reason, bestsellers, plan_tier, design, status, stripe_transfer_id, failure_reason, paid_at, created_at";

function sums(rows: Pick<SplitRow, "amount_cents" | "status">[]) {
  return {
    paidCents: rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount_cents, 0),
    owedCents: rows.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount_cents, 0),
    sales: rows.length,
  };
}

async function isOwner(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  if (!user?.email || user.email.trim().toLowerCase() !== OWNER_EMAIL) return false;
  const { data } = await getServiceClient().from("profiles").select("is_admin").eq("id", user.id).single();
  return data?.is_admin === true;
}

// ── Installer: own earnings ──────────────────────────────────────────────

export interface MyPlanEarnings {
  paidCents: number;
  /** Pending or failed — owed, being paid */
  owedCents: number;
  sales: number;
  recent: {
    id: string;
    date: string;
    cents: number;
    reason: "referral" | "bestseller";
    bestsellers: string[];
    tier: string | null;
    status: SplitStatus;
  }[];
}

export async function getMyPlanEarnings(): Promise<MyPlanEarnings | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const { data } = await getServiceClient()
    .from("plan_split_payouts")
    .select(ROW_COLUMNS)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as SplitRow[];
  if (rows.length === 0) return null;
  return {
    ...sums(rows),
    recent: rows.slice(0, 20).map((r) => ({
      id: r.id,
      date: r.created_at,
      cents: r.amount_cents,
      reason: r.reason,
      bestsellers: r.bestsellers ?? [],
      tier: r.plan_tier,
      status: r.status,
    })),
  };
}

// ── Owner: every split ───────────────────────────────────────────────────

export interface PlanSplitsAdmin {
  totals: { paidCents: number; owedCents: number; sales: number; failed: number };
  byInstaller: { id: string; name: string; paidCents: number; owedCents: number; sales: number }[];
  rows: (Omit<SplitRow, "bestsellers"> & { bestsellers: string[]; recipientName: string })[];
}

export async function getPlanSplitsAdmin(): Promise<PlanSplitsAdmin | null> {
  if (!(await isOwner())) return null;
  const db = getServiceClient();
  const { data } = await db
    .from("plan_split_payouts")
    .select(ROW_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as SplitRow[];

  const ids = [...new Set(rows.map((r) => r.recipient_id))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, business_name, trade_name, first_name, last_name")
      .in("id", ids);
    for (const p of profiles ?? []) {
      names.set(
        p.id,
        p.business_name || p.trade_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Installer",
      );
    }
  }

  const byInstaller = ids
    .map((id) => {
      const mine = rows.filter((r) => r.recipient_id === id);
      return { id, name: names.get(id) ?? "Installer", ...sums(mine) };
    })
    .sort((a, b) => b.paidCents + b.owedCents - (a.paidCents + a.owedCents));

  return {
    totals: { ...sums(rows), sales: new Set(rows.map((r) => r.stripe_session_id)).size, failed: rows.filter((r) => r.status === "failed").length },
    byInstaller,
    rows: rows.slice(0, 200).map((r) => ({ ...r, bestsellers: r.bestsellers ?? [], recipientName: names.get(r.recipient_id) ?? "Installer" })),
  };
}

export async function retryPlanSplit(rowId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isOwner())) return { ok: false, error: "Not allowed." };
  if (typeof rowId !== "string" || !/^[0-9a-f-]{36}$/i.test(rowId)) return { ok: false, error: "Bad payout id." };
  const result = await retryPlanSplitPayout(rowId, { stripe: getStripe(), db: getServiceClient() });
  return { ok: result.ok, error: result.error };
}
