import type Stripe from "stripe";
import { onAccount } from "./direct-charges";
import { depositUpdatePayload, isSafeLeadId, type ReconcileDb } from "./reconcile-deposits";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe-first sweep — the backfill for a webhook outage
//
// WHY THIS EXISTS SEPARATELY FROM reconcileDeposits
// ─────────────────────────────────────────────────────────────────────────
// reconcileDeposits walks DB-first: it takes leads that still look unpaid and
// asks Stripe about each one. That is cheap enough to run daily, but it can
// only find leads it thinks to look at — and a lead does not sit still while
// its payment goes unrecorded:
//
//   • cleanupExpiredLeads flips pending_payment → expired after 7 days of no
//     activity, and an unrecorded payment IS no activity. Every lead paid in
//     the first days of an outage ages out of the "unpaid" statuses before
//     anyone notices, which is exactly the set Stripe will no longer redeliver
//     (it retries for about three days, then stops).
//   • the status vocabulary is wide — new, quoted, accepted, payment_pending,
//     waitlisted, expired — so any hand-written list of "unpaid" statuses is a
//     guess, and a wrong guess silently skips someone's money.
//
// So this pass travels the other way: ask STRIPE what was paid in a window,
// then check each payment against the database. A payment cannot hide from it,
// whatever state its lead ended up in. That makes it the right tool for
// cleaning up after an outage, and the wrong one for a daily cron — it reads
// every connected account.
//
// It covers both halves of a job, because both went through the same broken
// endpoint: deposits (PaymentIntents from the booking/pay page carrying
// metadata.lead_id) and balance payments (off-session PaymentIntents, and
// Checkout Sessions, which carry the lead on the SESSION rather than on the
// PaymentIntent it creates).
//
// It never resurrects a cancelled or archived job. A payment against one is
// reported for a human to look at instead — that combination means something
// happened that a backfill should not decide on its own.
// ═══════════════════════════════════════════════════════════════════════════

export type PaymentKind = "deposit" | "final_payment";

export interface SweptPayment {
  leadId: string;
  kind: PaymentKind;
  /** PaymentIntent or Checkout Session id. */
  sourceId: string;
  amount: number;
  accountId: string | null;
  createdUnix: number;
  /** Saved card, so a repaired deposit can still back a later balance charge. */
  customerId: string | null;
  paymentMethodId: string | null;
}

export type SweepOutcome =
  | "repaired"
  | "already_recorded"
  | "needs_review"
  | "orphan"
  | "failed";

export interface SweepResult {
  leadId: string;
  kind: PaymentKind;
  sourceId: string;
  amount: number;
  accountId: string | null;
  outcome: SweepOutcome;
  detail?: string;
}

export interface SweepReport {
  accountsScanned: number;
  accountsRemaining: number;
  paymentsSeen: number;
  repaired: number;
  alreadyRecorded: number;
  needsReview: number;
  orphans: number;
  failed: number;
  dryRun: boolean;
  results: SweepResult[];
  errors: string[];
}

export interface SweepOptions {
  /** Start of the window, as a unix timestamp. Required — sweeps are bounded. */
  sinceUnix: number;
  untilUnix?: number;
  dryRun?: boolean;
  /** Skip this many accounts, to continue a sweep that ran out of time. */
  offset?: number;
  /** Pages of 100 objects to pull per account, per object type. Default 5. */
  maxPagesPerAccount?: number;
  /** Accounts examined at once. Default 3. */
  concurrency?: number;
  /** Stop starting new accounts after this long. Default 45s. */
  deadlineMs?: number;
}

export interface SweepDeps {
  stripe: Stripe;
  db: ReconcileDb;
  onRepaired?: (leadId: string, kind: PaymentKind) => Promise<void>;
}

/** Statuses a backfill must not write over — a human decides these. */
export const UNTOUCHABLE_STATUSES = ["cancelled", "archived"] as const;

// ── Pure helpers ───────────────────────────────────────────────────────────

/**
 * A Checkout Session records the lead on itself; the PaymentIntent it creates
 * does not inherit that metadata. Both spellings of the key are in use, and
 * Checkout also carries client_reference_id.
 */
export function leadIdFrom(
  object: { metadata?: Stripe.Metadata | null; client_reference_id?: string | null }
): string | null {
  const meta = object.metadata || {};
  const id = object.client_reference_id || meta.lead_id || meta.leadId || null;
  return id && isSafeLeadId(id) ? id : null;
}

/**
 * `deposit` is the default because it is the safer wrong answer: recording a
 * deposit on a job that was fully paid leaves a balance owing, which someone
 * will notice and correct. The reverse closes a job that still owes money.
 */
export function kindFrom(object: { metadata?: Stripe.Metadata | null }): PaymentKind {
  return object.metadata?.type === "final_payment" ? "final_payment" : "deposit";
}

/**
 * One lead can have both halves in the window. The balance payment supersedes
 * the deposit: it sets the job fully paid, which is the stronger statement.
 */
export function strongestPerLead(payments: SweptPayment[]): Map<string, SweptPayment> {
  const byLead = new Map<string, SweptPayment>();
  for (const payment of payments) {
    const existing = byLead.get(payment.leadId);
    if (!existing) {
      byLead.set(payment.leadId, payment);
      continue;
    }
    if (existing.kind === "deposit" && payment.kind === "final_payment") {
      byLead.set(payment.leadId, payment);
    } else if (existing.kind === payment.kind && payment.createdUnix > existing.createdUnix) {
      byLead.set(payment.leadId, payment);
    }
  }
  return byLead;
}

/** The webhook's final-payment transition: job closed and fully settled. */
export function finalPaymentUpdatePayload(now: Date = new Date()): Record<string, unknown> {
  const iso = now.toISOString();
  return {
    status: "paid",
    deposit_paid: true,
    payout_status: "paid",
    paid_at: iso,
    completed_at: iso,
    updated_at: iso,
  };
}

// ── I/O ────────────────────────────────────────────────────────────────────

async function collectFromAccount(
  stripe: Stripe,
  accountId: string | null,
  options: SweepOptions
): Promise<{ payments: SweptPayment[]; errors: string[] }> {
  const payments: SweptPayment[] = [];
  const errors: string[] = [];
  const opts = accountId ? onAccount(accountId) : undefined;
  const maxPages = options.maxPagesPerAccount ?? 5;
  const created: Stripe.RangeQueryParam = { gte: options.sinceUnix };
  if (options.untilUnix) created.lte = options.untilUnix;

  // PaymentIntents — deposits from the booking/pay page and off-session
  // balance charges. These carry the lead in their own metadata.
  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const batch: Stripe.ApiList<Stripe.PaymentIntent> = await stripe.paymentIntents.list(
        { created, limit: 100, ...(startingAfter && { starting_after: startingAfter }) },
        opts
      );
      for (const pi of batch.data) {
        if (pi.status !== "succeeded") continue;
        const leadId = leadIdFrom(pi);
        if (!leadId) continue; // Checkout-born, or not a job payment at all.
        payments.push({
          leadId,
          kind: kindFrom(pi),
          sourceId: pi.id,
          amount: (pi.amount || 0) / 100,
          accountId,
          createdUnix: pi.created || 0,
          customerId: typeof pi.customer === "string" ? pi.customer : null,
          paymentMethodId: typeof pi.payment_method === "string" ? pi.payment_method : null,
        });
      }
      if (!batch.has_more || !batch.data.length) break;
      startingAfter = batch.data[batch.data.length - 1].id;
    }
  } catch (err) {
    errors.push(
      `PaymentIntent list failed on ${accountId ?? "platform"}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Checkout Sessions — the redirect flows (payment links, balance collection,
  // cleanout upsell). The PaymentIntent these create does NOT inherit the
  // session's metadata, so the session is the only place the lead is named.
  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const batch: Stripe.ApiList<Stripe.Checkout.Session> = await stripe.checkout.sessions.list(
        { created, limit: 100, ...(startingAfter && { starting_after: startingAfter }) },
        opts
      );
      for (const session of batch.data) {
        if (session.payment_status !== "paid") continue;
        const leadId = leadIdFrom(session);
        if (!leadId) continue;
        payments.push({
          leadId,
          kind: kindFrom(session),
          sourceId: session.id,
          amount: (session.amount_total || 0) / 100,
          accountId,
          createdUnix: session.created || 0,
          // The session names a Customer but not the PaymentMethod; the
          // webhook reads that off the PaymentIntent, which we don't expand
          // here. A later balance charge falls back to the payment link.
          customerId: typeof session.customer === "string" ? session.customer : null,
          paymentMethodId: null,
        });
      }
      if (!batch.has_more || !batch.data.length) break;
      startingAfter = batch.data[batch.data.length - 1].id;
    }
  } catch (err) {
    errors.push(
      `Checkout Session list failed on ${accountId ?? "platform"}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return { payments, errors };
}

/**
 * Ask Stripe what was paid in a window, then make the database agree.
 */
export async function sweepUnrecordedPayments(
  deps: SweepDeps,
  options: SweepOptions
): Promise<SweepReport> {
  const { stripe, db, onRepaired } = deps;
  const dryRun = options.dryRun ?? false;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const deadlineMs = options.deadlineMs ?? 45_000;
  const startedAt = Date.now();

  const report: SweepReport = {
    accountsScanned: 0,
    accountsRemaining: 0,
    paymentsSeen: 0,
    repaired: 0,
    alreadyRecorded: 0,
    needsReview: 0,
    orphans: 0,
    failed: 0,
    dryRun,
    results: [],
    errors: [],
  };

  // Every account that could hold a direct charge, plus the platform for
  // installers who never connected Stripe.
  const { data: profiles, error: profileErr } = await db
    .from("profiles")
    .select("stripe_account_id")
    .not("stripe_account_id", "is", null);

  if (profileErr) {
    report.errors.push(`Profile query failed: ${JSON.stringify(profileErr)}`);
    return report;
  }

  const accounts: (string | null)[] = [
    null,
    ...Array.from(
      new Set(
        ((profiles ?? []) as { stripe_account_id: string | null }[])
          .map((p) => p.stripe_account_id)
          .filter(Boolean) as string[]
      )
    ),
  ];

  const queue = accounts.slice(options.offset ?? 0);
  const collected: SweptPayment[] = [];

  for (let i = 0; i < queue.length; i += concurrency) {
    if (Date.now() - startedAt > deadlineMs) {
      report.accountsRemaining = queue.length - i;
      report.errors.push(
        `Stopped after ${i} of ${queue.length} accounts — time budget reached.` +
          ` Re-run with offset=${(options.offset ?? 0) + i} to continue.`
      );
      break;
    }

    const batch = queue.slice(i, i + concurrency);
    const outcomes = await Promise.all(
      batch.map((accountId) => collectFromAccount(stripe, accountId, options))
    );
    for (const outcome of outcomes) {
      collected.push(...outcome.payments);
      report.errors.push(...outcome.errors);
      report.accountsScanned += 1;
    }
  }

  const byLead = strongestPerLead(collected);
  report.paymentsSeen = byLead.size;
  if (!byLead.size) return report;

  // One read for every lead named by a payment, in chunks Postgres is happy
  // with, then decide each case against what the database actually says.
  const leadIds = Array.from(byLead.keys());
  const leadRows = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data, error } = await db
      .from("leads")
      .select("id, status, payout_status, deposit_paid, estimated_price, discount_amount")
      .in("id", leadIds.slice(i, i + 200));
    if (error) {
      report.errors.push(`Lead lookup failed: ${JSON.stringify(error)}`);
      return report;
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      leadRows.set(row.id as string, row);
    }
  }

  for (const leadId of leadIds) {
    const payment = byLead.get(leadId)!;
    const lead = leadRows.get(leadId);
    const base = {
      leadId,
      kind: payment.kind,
      sourceId: payment.sourceId,
      amount: payment.amount,
      accountId: payment.accountId,
    };

    if (!lead) {
      report.orphans += 1;
      report.results.push({
        ...base,
        outcome: "orphan",
        detail: "Stripe has this payment but no lead row exists for it.",
      });
      continue;
    }

    const status = (lead.status as string) || "";
    if ((UNTOUCHABLE_STATUSES as readonly string[]).includes(status)) {
      report.needsReview += 1;
      report.results.push({
        ...base,
        outcome: "needs_review",
        detail: `Paid, but the job is '${status}'. Not touched — decide this one by hand.`,
      });
      continue;
    }

    const settled =
      payment.kind === "final_payment"
        ? status === "paid" || lead.payout_status === "paid"
        : lead.deposit_paid === true;

    if (settled) {
      report.alreadyRecorded += 1;
      report.results.push({ ...base, outcome: "already_recorded" });
      continue;
    }

    if (dryRun) {
      report.repaired += 1; // What a real run would repair.
      report.results.push({ ...base, outcome: "repaired", detail: "dry run — not written" });
      continue;
    }

    try {
      const payload =
        payment.kind === "final_payment"
          ? finalPaymentUpdatePayload()
          : depositUpdatePayload(
              {
                estimated_price: (lead.estimated_price as number) ?? 0,
                discount_amount: (lead.discount_amount as number) ?? 0,
              },
              {
                amount: Math.round(payment.amount * 100),
                customer: payment.customerId,
                payment_method: payment.paymentMethodId,
                metadata: {},
              },
              payment.accountId
            );

      // Guarded on the same field the read checked, so a webhook that lands
      // in between wins the race rather than being written over.
      let query = db.from("leads").update(payload).eq("id", leadId);
      query =
        payment.kind === "final_payment"
          ? query.not("status", "in", '("paid","cancelled","archived")')
          : query.eq("deposit_paid", false);

      const { data: updated, error } = await query.select("id").maybeSingle();

      if (error) {
        report.failed += 1;
        report.results.push({
          ...base,
          outcome: "failed",
          detail: `DB update failed: ${JSON.stringify(error)}`,
        });
        continue;
      }
      if (!updated) {
        report.alreadyRecorded += 1;
        report.results.push({
          ...base,
          outcome: "already_recorded",
          detail: "Recorded by something else mid-sweep.",
        });
        continue;
      }

      report.repaired += 1;
      const result: SweepResult = { ...base, outcome: "repaired" };
      if (onRepaired) {
        try {
          await onRepaired(leadId, payment.kind);
        } catch (err) {
          result.detail = `Recorded, but notification failed: ${
            err instanceof Error ? err.message : String(err)
          }`;
        }
      }
      report.results.push(result);
    } catch (err) {
      report.failed += 1;
      report.results.push({
        ...base,
        outcome: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}
