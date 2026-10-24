/**
 * Linked racks on the customer inventory page.
 *
 * Bug: racks were linked only by customer_email. Kash's job (#4eca414f) had
 * 22 racks and no email on file, so each rack's page showed just that rack
 * with no switcher to the other 21. Racks on the same job must link too.
 *
 * And an installer's own email on a customer's ticket must not link racks
 * across customers.
 */

import { vi, describe, it, expect } from "vitest";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;

// Minimal PostgREST stand-in: eq/ilike/in filters, order/maybeSingle, awaitable.
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const filters: Array<(r: Row) => boolean> = [];
      const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return chain; },
        ilike: (k: string, v: string) => { filters.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()); return chain; },
        in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return chain; },
        order: () => chain,
        maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: rows(), error: null }),
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/server/request-link", () => ({ requestQuoteUrl: () => null }));

const { getRackByToken } = await import("./tote-inventory");

function rack(n: number, extra: Row): Row {
  return {
    id: `rack-${n}`,
    access_token: `token-${n}-xxxxxxxxxxxxxxxx`,
    label: `Rack ${n}`,
    installer_id: null,
    cols: 4,
    rows: 2,
    created_at: `2026-10-24T17:33:${String(n).padStart(2, "0")}Z`,
    ...extra,
  };
}

describe("getRackByToken linkedRacks", () => {
  it("links every rack on the same job when the customer has no email", async () => {
    tables = {
      inventory_racks: Array.from({ length: 22 }, (_, i) => rack(i + 1, { lead_id: "lead-kash", customer_email: null })),
    };

    const result = await getRackByToken("token-1-xxxxxxxxxxxxxxxx");

    expect(result.linkedRacks).toHaveLength(21);
    expect(result.linkedRacks.map((r) => r.label)).toEqual(
      Array.from({ length: 21 }, (_, i) => `Rack ${i + 2}`)
    );
  });

  it("still links racks from other jobs by email, without duplicates", async () => {
    tables = {
      inventory_racks: [
        rack(1, { lead_id: "lead-a", customer_email: "c@x.com" }),
        rack(2, { lead_id: "lead-a", customer_email: "c@x.com" }),
        rack(3, { lead_id: "lead-b", customer_email: "c@x.com" }),
        rack(4, { lead_id: "lead-c", customer_email: "someone-else@x.com" }),
      ],
    };

    const result = await getRackByToken("token-1-xxxxxxxxxxxxxxxx");

    expect(result.linkedRacks.map((r) => r.id)).toEqual(["rack-2", "rack-3"]);
  });

  it("does not link a standalone rack to anything", async () => {
    tables = {
      inventory_racks: [
        rack(1, { lead_id: null, customer_email: null }),
        rack(2, { lead_id: null, customer_email: null }),
      ],
    };

    const result = await getRackByToken("token-1-xxxxxxxxxxxxxxxx");

    expect(result.linkedRacks).toEqual([]);
  });

  it("does not link other customers' racks through an installer's own email", async () => {
    tables = {
      profiles: [{ email: "Installer@Shop.com" }],
      inventory_racks: [
        rack(1, { lead_id: "lead-a", customer_email: "installer@shop.com" }),
        rack(2, { lead_id: "lead-a", customer_email: "installer@shop.com" }),
        rack(3, { lead_id: "lead-b", customer_email: "installer@shop.com" }),
      ],
    };

    const result = await getRackByToken("token-1-xxxxxxxxxxxxxxxx");

    // Same job still links; the other customer's job does not
    expect(result.linkedRacks.map((r) => r.id)).toEqual(["rack-2"]);
  });

  it("totals the other racks' totes for customer-wide fullness", async () => {
    tables = {
      inventory_racks: Array.from({ length: 22 }, (_, i) => rack(i + 1, { lead_id: "lead-kash", customer_email: null })),
      // Only filled slots come back from the !inner join
      inventory_slots: [
        { id: "s-2-1", rack_id: "rack-2" },
        { id: "s-2-2", rack_id: "rack-2" },
        { id: "s-9-1", rack_id: "rack-9" },
      ],
    };

    const result = await getRackByToken("token-1-xxxxxxxxxxxxxxxx");

    expect(result.otherRacksTotals).toEqual({ slots: 21 * 8, filledSlots: 3 });
  });
});
