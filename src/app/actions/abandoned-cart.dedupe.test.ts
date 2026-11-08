/**
 * Duplicate "your saved build is ready" emails (Nov 2026).
 *
 * A customer who submitted the same build twice had two pending leads, and
 * the nightly job emailed each one — and kept emailing after the customer
 * paid on another lead with the same installer. processAbandonedCarts must
 * send at most one reminder per customer per installer, and none to a
 * customer who has already booked.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

type Row = Record<string, unknown>;
let leads: Row[];

// Minimal in-memory query builder for the calls processAbandonedCarts makes.
function table(name: string) {
  const rows = name === "leads" ? leads : [];
  let patch: Row | null = null;
  let limitN = Infinity;
  const filters: ((r: Row) => boolean)[] = [];
  const hits = () => rows.filter((r) => filters.every((f) => f(r)));
  const b: Record<string, unknown> = {
    select: () => b,
    update: (p: Row) => ((patch = p), b),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
    in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
    lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), b),
    gt: (c: string, v: string) => (filters.push((r) => String(r[c]) > v), b),
    ilike: (c: string, v: string) => (filters.push((r) => String(r[c] ?? "").toLowerCase() === v.toLowerCase()), b),
    or: (expr: string) => {
      if (expr.startsWith("abandoned_email_sent")) filters.push((r) => !r.abandoned_email_sent);
      else filters.push((r) => r.deposit_paid === true || r.status === "paid" || r.status === "completed");
      return b;
    },
    order: () => {
      rows.sort((a, z) => String(z.created_at).localeCompare(String(a.created_at)));
      return b;
    },
    limit: (n: number) => ((limitN = n), b),
    single: async () => ({ data: name === "profiles" ? { business_name: "Elite", is_suspended: false } : hits()[0] ?? null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (patch) {
        hits().forEach((r) => Object.assign(r, patch));
        return resolve({ error: null });
      }
      return resolve({ data: hits().slice(0, limitN), error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({ from: table }) }));
vi.mock("@/lib/email", () => ({ sendAbandonedCartEmail: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/emails/plansTemplates", () => ({ diyPlansEmailUrl: () => null }));
vi.mock("@/lib/server/currency-lookup", () => ({ currencyForInstaller: async () => "usd" }));

const { processAbandonedCarts } = await import("./abandoned-cart");
const { sendAbandonedCartEmail } = await import("@/lib/email");
const sent = vi.mocked(sendAbandonedCartEmail);

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const lead = (over: Row): Row => ({
  installer_id: "inst-1",
  status: "pending_payment",
  deposit_paid: false,
  abandoned_email_sent: false,
  customer_name: "Maria",
  estimated_price: 758,
  deposit_amount: 114,
  quote_data: [{ cols: 4, rows: 4 }],
  ...over,
});

beforeEach(() => {
  sent.mockClear();
});

describe("processAbandonedCarts — no duplicate reminders", () => {
  it("sends one email for a customer's duplicate pending leads, about the newest", async () => {
    leads = [
      lead({ id: "older", customer_email: "maria@example.com", created_at: hoursAgo(30) }),
      lead({ id: "newer", customer_email: "Maria@Example.com", created_at: hoursAgo(29.9) }),
    ];
    await processAbandonedCarts();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][1]).toMatchObject({ resumeUrl: expect.stringContaining("/pay/newer") });
    expect(leads.every((l) => l.abandoned_email_sent)).toBe(true); // both handled
  });

  it("sends nothing to a customer who already paid on another lead with the same installer", async () => {
    leads = [
      lead({ id: "pending", customer_email: "joseph@example.com", created_at: hoursAgo(20) }),
      lead({ id: "booked", customer_email: "joseph@example.com", created_at: hoursAgo(19.9), status: "open", deposit_paid: true }),
    ];
    await processAbandonedCarts();
    expect(sent).not.toHaveBeenCalled();
    expect(leads.find((l) => l.id === "pending")?.abandoned_email_sent).toBe(true); // never retried
  });

  it("doesn't re-send in a later run to a customer reminded this week", async () => {
    leads = [
      lead({ id: "first", customer_email: "sam@example.com", created_at: hoursAgo(60), abandoned_email_sent: true }),
      lead({ id: "second", customer_email: "sam@example.com", created_at: hoursAgo(20) }),
    ];
    await processAbandonedCarts();
    expect(sent).not.toHaveBeenCalled();
  });

  it("still emails different customers, and the same customer with a different installer", async () => {
    leads = [
      lead({ id: "a", customer_email: "a@example.com", created_at: hoursAgo(20) }),
      lead({ id: "b", customer_email: "b@example.com", created_at: hoursAgo(20) }),
      lead({ id: "a2", customer_email: "a@example.com", created_at: hoursAgo(21), installer_id: "inst-2" }),
    ];
    await processAbandonedCarts();
    expect(sent).toHaveBeenCalledTimes(3);
  });
});
