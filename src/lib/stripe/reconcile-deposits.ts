import type Stripe from "stripe";
import { roundMoney } from "@/utils/mathHelpers";
import { onAccount } from "./direct-charges";

// ═══════════════════════════════════════════════════════════════════════════
// Deposit reconciliation — the safety net under the Stripe webhook
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────
// A deposit only becomes visible to the installer when a webhook lands:
// `payment_intent.succeeded` flips leads.deposit_paid and moves the job out
// of the UNPAID tab. If that event never arrives, the money is genuinely in
// the installer's Stripe balance while the app still shows "Unpaid Quote" —
// silently, with nothing in the database to say a payment was ever attempted.
//
// Since customer charges became DIRECT charges (see ./direct-charges), those
// events are delivered to Stripe's CONNECT endpoint, signed with its own
// secret and carrying `event.account`. That adds three new ways for delivery
// to stop without anything erroring on our side:
//   • STRIPE_CONNECT_WEBHOOK_SECRET unset  → every Connect delivery 400s
//   • the Connect endpoint never registered → Stripe sends nothing at all
//   • the endpoint not subscribed to payment_intent.succeeded
//
// In all three cases Stripe does NOT backfill once the endpoint is fixed, so
// a repair pass is the only way those jobs ever show as paid.
//
// This module is that pass: for every lead still sitting unpaid, ask Stripe
// whether a deposit actually succeeded for it, and if so record it. It reads
// the same truth the webhook would have, so running it is safe whether the
// webhook is healthy (finds nothing), broken (repairs), or intermittently
// dropping events (repairs the gaps).
//
// IDEMPOTENCY: the DB write is guarded on `deposit_paid = false` and the
// emails on `booking_email_sent`, exactly as the webhook's deposit branch is.
// A repaired lead is therefore inert on every later pass, and a webhook that
// lands mid-pass wins the race harmlessly — only one of the two updates can
// match the guard.
//
// This deliberately does NOT reach into the webhook route. That route is the
// live payment path, and the point of this module is to add a recovery path
// without touching it. The state transition below mirrors the deposit branch
// of src/app/api/webhooks/stripe/route.ts — change them together.
// ═══════════════════════════════════════════════════════════════════════════

/** Statuses a quote sits in while it is still waiting to be paid. */
export const UNPAID_LEAD_STATUSES = ["pending_payment", "waitlisted"] as const;

export interface ReconcileOptions {
  /** How far back to look for unpaid quotes. Default 30 days. */
  lookbackDays?: number;
  /** Cap on leads examined in one pass. Default 200. */
  limit?: number;
  /** Report what would be repaired without writing anything. */
  dryRun?: boolean;
  /** Stripe searches to run at once. Default 5. */
  concurrency?: number;
  /**
   * Stop starting new work after this long, in ms. Default 45s, inside the
   * route's 60s maxDuration — one Stripe search per lead adds up, and a pass
   * that gets killed mid-flight reports nothing at all. Whatever is left over
   * is reported as `truncated` and picked up by the next run.
   */
  deadlineMs?: number;
}

export interface CandidateLead {
  id: string;
  installer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  estimated_price: number | null;
  discount_amount: number | null;
  created_at: string;
  referring_installer_id?: string | null;
  bounty_status?: string | null;
}

export interface ReconcileFinding {
  leadId: string;
  installerId: string | null;
  /** Connected account the PaymentIntent lives on; null = platform. */
  accountId: string | null;
  paymentIntentId: string;
  /** Deposit amount in dollars. */
  amount: number;
  /** When the customer actually paid. */
  paidAt: string;
  /** How long the payment sat unrecorded, in hours. */
  unrecordedForHours: number;
  repaired: boolean;
  /**
   * True when this lead also has an unpaid referral bounty. The webhook pays
   * those; this pass does not (the transfer logic lives in the route), so
   * these need a look by hand.
   */
  bountyPending: boolean;
  error?: string;
}

export interface ReconcileReport {
  scanned: number;
  found: number;
  repaired: number;
  /** Leads the pass ran out of time for. They are picked up by the next run. */
  truncated: number;
  dryRun: boolean;
  findings: ReconcileFinding[];
  errors: string[];
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/**
 * A lead id goes into a Stripe search query as a quoted literal, so it must
 * not be able to carry quote characters out of that literal. Our ids are
 * UUIDs; anything else is refused rather than escaped.
 */
export function isSafeLeadId(leadId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
}

/** Stripe search query for a succeeded deposit belonging to one lead. */
export function depositSearchQuery(leadId: string): string {
  // `lead_id` (not `leadId`) — createDepositIntent writes both spellings, and
  // Stripe's search treats metadata keys case-sensitively.
  return `status:'succeeded' AND metadata['lead_id']:'${leadId}'`;
}

/**
 * The deposit is the source of truth for what was collected; balance is what
 * is left of the quote after it and any discount.
 *
 * Mirrors the webhook's deposit branch, including that the discount comes off
 * the balance rather than the deposit.
 */
export function depositUpdatePayload(
  lead: Pick<CandidateLead, "estimated_price" | "discount_amount">,
  paymentIntent: Pick<Stripe.PaymentIntent, "amount" | "customer" | "payment_method" | "metadata">,
  accountId: string | null,
  now: Date = new Date()
): Record<string, unknown> {
  const amountPaid = (paymentIntent.amount || 0) / 100;
  const payload: Record<string, unknown> = {
    deposit_paid: true,
    deposit_amount: amountPaid,
    balance_due: roundMoney(
      (lead.estimated_price ?? 0) - amountPaid - (lead.discount_amount ?? 0)
    ),
    payout_status: "deposit_collected",
    status: "open",
    updated_at: now.toISOString(),
  };

  // Saved card, so the balance can be charged off-session later. Customers and
  // PaymentMethods are account-scoped under direct charges, so the account
  // they live on has to be recorded alongside them (migration 137).
  if (typeof paymentIntent.customer === "string") {
    payload.stripe_customer_id = paymentIntent.customer;
  }
  if (typeof paymentIntent.payment_method === "string") {
    payload.stripe_payment_method_id = paymentIntent.payment_method;
  }
  if (payload.stripe_customer_id || payload.stripe_payment_method_id) {
    payload.stripe_customer_account_id = accountId;
  }

  const metadata = paymentIntent.metadata || {};
  if (metadata.customer_email) payload.customer_email = metadata.customer_email;
  if (metadata.customer_name) payload.customer_name = metadata.customer_name;
  if (metadata.scheduled_at) payload.scheduled_at = metadata.scheduled_at;

  return payload;
}

/** Hours between a PaymentIntent's creation and now — how long it went unseen. */
export function hoursUnrecorded(piCreatedUnix: number, now: Date = new Date()): number {
  return Math.round(((now.getTime() - piCreatedUnix * 1000) / 3_600_000) * 10) / 10;
}

// ── I/O ────────────────────────────────────────────────────────────────────

/** Minimal shape of the Supabase client this module needs, for testing. */
export interface ReconcileDb {
  from: (table: string) => any;
}

export interface ReconcileDeps {
  stripe: Stripe;
  db: ReconcileDb;
  /** Sends booking confirmation + installer alert for a repaired lead. */
  onRepaired?: (leadId: string) => Promise<void>;
}

/**
 * Find deposits that cleared in Stripe but were never recorded, and record
 * them. Returns a report of everything it found, repaired or not.
 */
export async function reconcileDeposits(
  deps: ReconcileDeps,
  options: ReconcileOptions = {}
): Promise<ReconcileReport> {
  const { stripe, db, onRepaired } = deps;
  const lookbackDays = options.lookbackDays ?? 30;
  const limit = options.limit ?? 200;
  const dryRun = options.dryRun ?? false;

  const concurrency = Math.max(1, options.concurrency ?? 5);
  const deadlineMs = options.deadlineMs ?? 45_000;
  const startedAt = Date.now();

  const report: ReconcileReport = {
    scanned: 0,
    found: 0,
    repaired: 0,
    truncated: 0,
    dryRun,
    findings: [],
    errors: [],
  };

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error: leadsErr } = await db
    .from("leads")
    .select(
      "id, installer_id, customer_name, customer_email, estimated_price, discount_amount, created_at, referring_installer_id, bounty_status"
    )
    .eq("deposit_paid", false)
    .in("status", UNPAID_LEAD_STATUSES)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (leadsErr) {
    report.errors.push(`Lead query failed: ${JSON.stringify(leadsErr)}`);
    return report;
  }

  const candidates = (leads ?? []) as CandidateLead[];
  report.scanned = candidates.length;
  if (!candidates.length) return report;

  // Which connected account to ask about each lead. Installers with no Stripe
  // connected still charge on the platform, so a null account is not an error.
  const installerIds = Array.from(
    new Set(candidates.map((l) => l.installer_id).filter(Boolean) as string[])
  );
  const accountByInstaller = new Map<string, string | null>();
  if (installerIds.length) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, stripe_account_id")
      .in("id", installerIds);
    for (const p of (profiles ?? []) as { id: string; stripe_account_id: string | null }[]) {
      accountByInstaller.set(p.id, p.stripe_account_id || null);
    }
  }

  // One Stripe search per lead, so this is latency-bound rather than CPU-bound
  // — run them in small batches. Results are merged in candidate order so the
  // report doesn't shuffle between runs.
  type Outcome = { finding?: ReconcileFinding; error?: string };

  async function examine(lead: CandidateLead): Promise<Outcome> {
    if (!isSafeLeadId(lead.id)) {
      return { error: `Skipped lead with unexpected id format: ${lead.id}` };
    }

    const accountId = lead.installer_id
      ? accountByInstaller.get(lead.installer_id) ?? null
      : null;

    let paymentIntent: Stripe.PaymentIntent | undefined;
    try {
      const search = await stripe.paymentIntents.search(
        { query: depositSearchQuery(lead.id), limit: 1 },
        accountId ? onAccount(accountId) : undefined
      );
      paymentIntent = search.data[0];
    } catch (err) {
      return {
        error: `Stripe search failed for lead ${lead.id} on ${accountId ?? "platform"}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }

    if (!paymentIntent) return {}; // Genuinely unpaid — nothing to repair.

    const finding: ReconcileFinding = {
      leadId: lead.id,
      installerId: lead.installer_id,
      accountId,
      paymentIntentId: paymentIntent.id,
      amount: (paymentIntent.amount || 0) / 100,
      paidAt: new Date((paymentIntent.created || 0) * 1000).toISOString(),
      unrecordedForHours: hoursUnrecorded(paymentIntent.created || 0),
      repaired: false,
      bountyPending: Boolean(lead.referring_installer_id) && lead.bounty_status === "pending",
    };

    if (dryRun) return { finding };

    try {
      const { data: updated, error: updateErr } = await db
        .from("leads")
        .update(depositUpdatePayload(lead, paymentIntent, accountId))
        .eq("id", lead.id)
        .eq("deposit_paid", false)
        .select("id")
        .maybeSingle();

      if (updateErr) {
        finding.error = `DB update failed: ${JSON.stringify(updateErr)}`;
      } else if (!updated) {
        // The webhook landed between the search and the write. Nothing to do.
        finding.error = "Already recorded by the time we wrote — skipped.";
      } else {
        finding.repaired = true;
        if (onRepaired) {
          try {
            await onRepaired(lead.id);
          } catch (emailErr) {
            // The money is recorded; a failed notification must not undo that.
            finding.error = `Recorded, but notification failed: ${
              emailErr instanceof Error ? emailErr.message : String(emailErr)
            }`;
          }
        }
      }
    } catch (err) {
      finding.error = err instanceof Error ? err.message : String(err);
    }

    return { finding };
  }

  for (let i = 0; i < candidates.length; i += concurrency) {
    if (Date.now() - startedAt > deadlineMs) {
      report.truncated = candidates.length - i;
      report.errors.push(
        `Stopped after ${i} of ${candidates.length} leads — time budget reached.` +
          ` The remaining ${report.truncated} are picked up by the next run.`
      );
      break;
    }

    const batch = candidates.slice(i, i + concurrency);
    const outcomes = await Promise.all(batch.map(examine));

    for (const outcome of outcomes) {
      if (outcome.error) report.errors.push(outcome.error);
      if (!outcome.finding) continue;
      report.found += 1;
      if (outcome.finding.repaired) report.repaired += 1;
      report.findings.push(outcome.finding);
    }
  }

  return report;
}
