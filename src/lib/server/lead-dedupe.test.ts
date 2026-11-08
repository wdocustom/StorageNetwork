import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFingerprint, findDuplicateLead, ilikeLiteral } from "./lead-dedupe";

describe("buildFingerprint", () => {
  it("ignores key order (JSONB doesn't keep it) and undefined fields", () => {
    const a = [{ cols: 4, rows: 3, opts: { wheels: true, top: false } }];
    const b = [{ opts: { top: false, wheels: true }, rows: 3, cols: 4, note: undefined }];
    expect(buildFingerprint(a, 758)).toBe(buildFingerprint(b, 758));
  });
  it("differs when the units or the total differ", () => {
    const a = [{ cols: 4, rows: 3 }];
    expect(buildFingerprint(a, 758)).not.toBe(buildFingerprint([{ cols: 4, rows: 4 }], 758));
    expect(buildFingerprint(a, 758)).not.toBe(buildFingerprint(a, 729));
    expect(buildFingerprint(a, 758)).toBe(buildFingerprint(a, 758.001)); // cents
  });
});

describe("ilikeLiteral", () => {
  it("escapes LIKE wildcards in emails", () => {
    expect(ilikeLiteral("joe_smith%x@y.com")).toBe("joe\\_smith\\%x@y.com");
  });
});

describe("findDuplicateLead", () => {
  const rows = [
    { id: "same", created_at: "2026-11-06T16:02:00Z", quote_data: [{ rows: 4, cols: 4 }], estimated_price: "300.00" },
    { id: "other", created_at: "2026-11-06T15:00:00Z", quote_data: [{ cols: 2, rows: 4 }], estimated_price: "180.00" },
  ];
  const fakeDb = (data: unknown[]) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "ilike", "eq", "in", "gte", "order", "limit"]) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    return { from: () => b } as unknown as SupabaseClient;
  };
  const params = { email: "maria@example.com", installerId: "inst-1", statuses: ["pending_payment"], withinHours: 72 };

  it("finds the identical pending build (numeric price stored as text)", async () => {
    const hit = await findDuplicateLead(fakeDb(rows), { ...params, quoteData: [{ cols: 4, rows: 4 }], total: 300 });
    expect(hit?.id).toBe("same");
  });
  it("returns null for a changed build, or without an email / installer", async () => {
    expect(await findDuplicateLead(fakeDb(rows), { ...params, quoteData: [{ cols: 4, rows: 5 }], total: 340 })).toBeNull();
    expect(await findDuplicateLead(fakeDb(rows), { ...params, email: "", quoteData: [], total: 0 })).toBeNull();
    expect(await findDuplicateLead(fakeDb(rows), { ...params, installerId: null, quoteData: [], total: 0 })).toBeNull();
  });
});
