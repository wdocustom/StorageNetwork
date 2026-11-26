import { beforeEach, describe, expect, it, vi } from "vitest";

// The payout pass (processDueCommissions) against an in-memory database and a
// mocked Stripe. See referral-partners.test.ts for attribution + settlement.

const env = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  return {};
});
void env;

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  constructor(private table: string, private op: "select" | "update", private payload?: Row) {}
  select() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  in(k: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[k]));
    return this;
  }
  lte(k: string, v: string) {
    this.filters.push((r) => String(r[k]) <= v);
    return this;
  }
  gte(k: string, v: string) {
    this.filters.push((r) => String(r[k]) >= v);
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run(true));
  }
  then<T>(res: (v: { data: unknown; error: null }) => T) {
    return Promise.resolve(this.run(false)).then(res);
  }
  private run(single: boolean) {
    const match = (tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") match.forEach((r) => Object.assign(r, this.payload));
    return { data: single ? (match[0] ?? null) : match, error: null };
  }
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (t: string) => ({
      select: () => new Query(t, "select"),
      update: (p: Row) => new Query(t, "update", p),
    }),
  }),
}));
vi.mock("@/lib/emails/referralPartnerTemplates", () => ({ sendPartnerCommissionEmail: vi.fn() }));
vi.mock("@/lib/stripe/cross-border", () => ({ checkTransferEligibility: vi.fn(async () => ({ ok: true })) }));

const stripeMock = vi.hoisted(() => ({
  charge: {} as Record<string, unknown>,
  transfers: [] as unknown[],
  feeRefunds: [] as unknown[],
}));
vi.mock("stripe", () => ({
  default: class {
    paymentIntents = { retrieve: vi.fn(async () => ({ latest_charge: stripeMock.charge })) };
    transfers = {
      create: vi.fn(async (params: unknown) => {
        stripeMock.transfers.push(params);
        return { id: `tr_${stripeMock.transfers.length}` };
      }),
    };
    applicationFees = {
      createRefund: vi.fn(async (...args: unknown[]) => {
        stripeMock.feeRefunds.push(args);
        return { id: "fr_1" };
      }),
    };
  },
}));

import { processDueCommissions } from "./referral-partners";

const NOW = new Date("2026-12-10T16:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function seed(opts: { status?: string; ageDays?: number; leadStatus?: string; partnerReady?: boolean } = {}) {
  for (const k of Object.keys(tables)) delete tables[k];
  stripeMock.transfers.length = 0;
  stripeMock.feeRefunds.length = 0;
  stripeMock.charge = { amount_refunded: 0, disputed: false, application_fee: "fee_1" };
  tables.profiles = [{ id: "inst", stripe_account_id: "acct_installer" }];
  tables.leads = [{ id: "lead-1", status: opts.leadStatus ?? "booked" }];
  tables.referral_partners = [{ id: "p1", user_id: "partner-user", name: "Acme" }];
  tables.referral_partner_accounts = [{ user_id: "partner-user", stripe_account_id: "acct_partner", payouts_ready: opts.partnerReady ?? true }];
  tables.referral_commissions = [
    {
      id: "c1",
      partner_id: "p1",
      lead_id: "lead-1",
      installer_id: "inst",
      status: opts.status ?? "held",
      collected_cents: 9_000,
      amount_cents: 9_000,
      currency: "usd",
      payment_intent_id: "pi_1",
      created_at: daysAgo(opts.ageDays ?? 4),
    },
  ];
}
const commission = () => tables.referral_commissions[0];

describe("processDueCommissions", () => {
  beforeEach(() => seed());

  it("pays a held cut once its deposit has cleared", async () => {
    const r = await processDueCommissions({ now: NOW });
    expect(r.paid).toBe(1);
    expect(commission().status).toBe("paid");
    expect(stripeMock.transfers[0]).toMatchObject({ amount: 9_000, destination: "acct_partner", transfer_group: "pi_1" });
  });

  it("leaves a cut alone until the clearing window has passed", async () => {
    seed({ ageDays: 1 });
    const r = await processDueCommissions({ now: NOW });
    expect(r).toMatchObject({ paid: 0, checked: 0 });
    expect(commission().status).toBe("held");
    expect(stripeMock.transfers).toHaveLength(0);
  });

  it("voids a refunded deposit's cut and hands it back to the installer", async () => {
    stripeMock.charge = { amount_refunded: 15_000, disputed: false, application_fee: "fee_1" };
    const r = await processDueCommissions({ now: NOW });
    expect(r.voided).toBe(1);
    expect(commission()).toMatchObject({ status: "void", last_error: "deposit refunded" });
    const [feeId, params, options] = stripeMock.feeRefunds[0] as [string, { amount: number }, { idempotencyKey: string }];
    expect(feeId).toBe("fee_1");
    expect(params.amount).toBe(9_000);
    expect(options.idempotencyKey).toBe("referral-commission-void-c1");
    expect(stripeMock.transfers).toHaveLength(0);
  });

  it("voids the cut on a cancelled job", async () => {
    seed({ leadStatus: "cancelled" });
    await processDueCommissions({ now: NOW });
    expect(commission()).toMatchObject({ status: "void", last_error: "job cancelled" });
    expect(stripeMock.feeRefunds).toHaveLength(1);
  });

  it("holds a disputed deposit's cut instead of paying it", async () => {
    stripeMock.charge = { amount_refunded: 0, disputed: true, application_fee: "fee_1" };
    await processDueCommissions({ now: NOW });
    expect(commission().status).toBe("held");
    expect(String(commission().last_error)).toMatch(/disputed/);
    expect(stripeMock.transfers).toHaveLength(0);
  });

  it("keeps waiting when the partner hasn't finished Stripe", async () => {
    seed({ partnerReady: false });
    const r = await processDueCommissions({ now: NOW });
    expect(r.paid).toBe(0);
    expect(commission()).toMatchObject({ status: "held", last_error: "partner has not finished Stripe setup" });
  });

  it("stops an owed cut on a cancelled job, with nothing to hand back", async () => {
    seed({ status: "owed", ageDays: 10, leadStatus: "cancelled" });
    await processDueCommissions({ now: NOW });
    expect(commission().status).toBe("void");
    expect(stripeMock.feeRefunds).toHaveLength(0);
  });

  it("never pays an owed cut — the installer pays those directly", async () => {
    seed({ status: "owed", ageDays: 10 });
    await processDueCommissions({ now: NOW });
    expect(commission().status).toBe("owed");
    expect(stripeMock.transfers).toHaveLength(0);
  });
});
