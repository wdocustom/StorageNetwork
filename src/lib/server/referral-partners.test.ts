import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Tiny in-memory stand-in for the Supabase query builder ────────────────
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  constructor(
    private table: string,
    private op: "select" | "update" | "insert" | "upsert",
    private payload?: Row,
    private opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {}
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
  limit() {
    return this;
  }
  order() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run(true));
  }
  then<T>(res: (v: { data: unknown; error: null }) => T) {
    return Promise.resolve(this.run(false)).then(res);
  }
  private run(single: boolean) {
    const rows = (tables[this.table] ??= []);
    const match = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "select") return { data: single ? (match[0] ?? null) : match, error: null };
    if (this.op === "update") {
      match.forEach((r) => Object.assign(r, this.payload));
      return { data: single ? (match[0] ?? null) : match, error: null };
    }
    const key = this.opts?.onConflict;
    if (key && rows.some((r) => r[key] === this.payload![key])) {
      return { data: null, error: null }; // ignoreDuplicates: nothing returned
    }
    const row = { id: `${this.table}-${rows.length + 1}`, ...this.payload };
    rows.push(row);
    return { data: row, error: null };
  }
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (t: string) => ({
      select: () => new Query(t, "select"),
      update: (p: Row) => new Query(t, "update", p),
      insert: (p: Row) => new Query(t, "insert", p),
      upsert: (p: Row, o: { onConflict?: string }) => new Query(t, "upsert", p, o),
    }),
  }),
}));
const sentEmails: unknown[] = [];
vi.mock("@/lib/emails/referralPartnerTemplates", () => ({
  sendPartnerCommissionEmail: vi.fn(async (...args: unknown[]) => {
    sentEmails.push(args);
    return { success: true };
  }),
}));

import { attributeLeadToPartner, settleReferralCommission } from "./referral-partners";

const INSTALLER = "inst-1";
function seed(partner: Partial<Row> = {}) {
  for (const k of Object.keys(tables)) delete tables[k];
  sentEmails.length = 0;
  tables.profiles = [{ id: INSTALLER, currency: "usd", business_name: "Elite" }];
  tables.referral_partners = [
    {
      id: "p1",
      installer_id: INSTALLER,
      name: "Acme Moving",
      email: "acme@example.com",
      code: "ACMEMOVING7K",
      cut_type: "percent",
      cut_value: 10,
      user_id: "partner-user",
      portal_enabled: true,
      active: true,
      ...partner,
    },
  ];
  tables.leads = [{ id: "lead-1", installer_id: INSTALLER, deposit_paid: false, customer_email: "jane@example.com", customer_name: "Jane Doe" }];
  tables.referral_commissions = [];
}

const attribute = (over: Partial<Parameters<typeof attributeLeadToPartner>[0]> = {}) =>
  attributeLeadToPartner({
    leadId: "lead-1",
    installerId: INSTALLER,
    refCode: "acmemoving7k",
    totalPriceCents: 100_000,
    discountCents: 10_000,
    ...over,
  });

describe("attributeLeadToPartner", () => {
  beforeEach(() => seed());

  it("stamps the lead with the partner and a cut on the total after discount", async () => {
    expect(await attribute()).toEqual({ partnerId: "p1", cutCents: 9_000, collectCents: 9_000 });
    expect(tables.leads[0]).toMatchObject({ referral_partner_id: "p1", partner_cut_cents: 9_000 });
  });

  it("collects nothing from the deposit for a basic partner (no portal)", async () => {
    seed({ portal_enabled: false });
    expect(await attribute()).toMatchObject({ cutCents: 9_000, collectCents: 0 });
  });

  it("also attributes from the partner code typed as the discount code", async () => {
    expect(await attribute({ refCode: null, discountCode: "ACMEMOVING7K" })).toMatchObject({ partnerId: "p1" });
  });

  it("ignores another installer's partner, switched-off links and self-referrals", async () => {
    expect(await attribute({ installerId: "someone-else" })).toBeNull();
    seed({ active: false });
    expect(await attribute()).toBeNull();
    seed({ email: "jane@example.com" }); // customer is the partner
    expect(await attribute()).toBeNull();
    seed({ user_id: INSTALLER }); // partner login is the installer
    expect(await attribute()).toBeNull();
  });

  it("never touches a lead whose deposit is already paid", async () => {
    tables.leads[0].deposit_paid = true;
    expect(await attribute()).toBeNull();
  });
});

describe("settleReferralCommission", () => {
  beforeEach(async () => {
    seed();
    await attribute();
  });

  it("records a collected cut as held (waiting for Stripe) and emails the partner", async () => {
    await settleReferralCommission({ leadId: "lead-1", collectedCents: 9_000, paymentIntentId: "pi_1" });
    expect(tables.referral_commissions).toHaveLength(1);
    expect(tables.referral_commissions[0]).toMatchObject({ status: "held", amount_cents: 9_000, collected_cents: 9_000, partner_id: "p1" });
    await vi.waitFor(() => expect(sentEmails).toHaveLength(1));
  });

  it("records an uncollected cut as owed by the installer", async () => {
    await settleReferralCommission({ leadId: "lead-1", collectedCents: 0 });
    expect(tables.referral_commissions[0]).toMatchObject({ status: "owed", amount_cents: 9_000, collected_cents: 0 });
  });

  it("is idempotent across the webhook, the fallback and retries", async () => {
    await settleReferralCommission({ leadId: "lead-1", collectedCents: 9_000 });
    await settleReferralCommission({ leadId: "lead-1", collectedCents: 0 });
    await settleReferralCommission({ leadId: "lead-1", collectedCents: 9_000 });
    expect(tables.referral_commissions).toHaveLength(1);
    expect(tables.referral_commissions[0].status).toBe("held");
  });

  it("does nothing for a lead with no partner", async () => {
    tables.leads.push({ id: "lead-2", installer_id: INSTALLER });
    await settleReferralCommission({ leadId: "lead-2", collectedCents: 500 });
    expect(tables.referral_commissions).toHaveLength(0);
  });
});
