/**
 * Quote requests — a returning customer asks their installer for a new quote
 * from a signed link; the installer sees it in Jobs / Leads → Requests.
 */
import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest";

let authedUser: { id: string } | null = { id: "installer-1" };
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn(async () => authedUser) }));
vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: vi.fn(async () => {}),
  RateLimitError: class extends Error {},
}));
const sendTransactionalEmail = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail, emailShell: (_t: string, b: string) => b }));

type Row = Record<string, unknown>;
let leadRow: Row | null;
let recentOpen: Row | null;
let inserted: Row | undefined;
let updated: { table: string; payload: Row; filters: Array<[string, unknown]> }[];

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "inst@example.com" } } })) } },
    from: (table: string) => {
      let op = "select";
      let payload: Row = {};
      const filters: Array<[string, unknown]> = [];
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "profiles") return { data: { business_name: "Rack City Totes", email: "inst@example.com" } };
        if (table === "leads") return { data: leadRow };
        if (table === "quote_requests") {
          if (op === "insert") return { data: { id: "req-1" }, error: null };
          if (op === "update") {
            const owner = filters.find(([k]) => k === "installer_id");
            return { data: owner && owner[1] !== "installer-1" ? null : { id: "req-1" }, error: null };
          }
          return { data: recentOpen, error: null };
        }
        return { data: null };
      };
      for (const m of ["select", "gte", "order", "limit", "in"]) chain[m] = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn((k: string, v: unknown) => {
        filters.push([k, v]);
        return chain;
      });
      chain.insert = vi.fn((p: Row) => {
        op = "insert";
        inserted = p;
        return chain;
      });
      chain.update = vi.fn((p: Row) => {
        op = "update";
        payload = p;
        updated.push({ table, payload, filters });
        return chain;
      });
      chain.single = vi.fn(async () => result());
      chain.maybeSingle = vi.fn(async () => result());
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
      return chain;
    },
  }),
}));

let signRequestToken: (id: string) => string;
let submitQuoteRequest: typeof import("./quote-requests").submitQuoteRequest;
let dismissQuoteRequest: typeof import("./quote-requests").dismissQuoteRequest;

const LEAD = "3f2b7c1e-8a4d-4c6b-9e1f-0a2b3c4d5e6f";

beforeAll(async () => {
  process.env.REQUEST_LINK_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  ({ signRequestToken } = await import("@/lib/server/request-link"));
  ({ submitQuoteRequest, dismissQuoteRequest } = await import("./quote-requests"));
});

beforeEach(() => {
  authedUser = { id: "installer-1" };
  leadRow = { installer_id: "installer-1", customer_id: "cust-1", status: "paid" };
  recentOpen = null;
  inserted = undefined;
  updated = [];
  sendTransactionalEmail.mockClear();
});

const valid = () => ({
  token: signRequestToken(LEAD),
  origin: "receipt",
  name: "Patricia Hawkins",
  email: "p@example.com",
  wants: ["rack", "bogus"],
  notes: "Another 4x4 for the basement",
});

describe("submitQuoteRequest", () => {
  it("records the request for the job's installer and emails them", async () => {
    const r = await submitQuoteRequest(valid());
    expect(r.success).toBe(true);
    expect(inserted).toMatchObject({
      installer_id: "installer-1",
      source_lead_id: LEAD,
      customer_id: "cust-1",
      customer_name: "Patricia Hawkins",
      wants: ["rack"], // unknown picks dropped
      origin: "receipt",
    });
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const email = sendTransactionalEmail.mock.calls[0][0] as { to: string; html: string };
    expect(email.to).toBe("inst@example.com");
    expect(email.html).toContain(`/dashboard/build?from=${LEAD}&request=req-1`);
  });

  it("rejects a forged link", async () => {
    const r = await submitQuoteRequest({ ...valid(), token: `${LEAD}.forgedsignature000000000` });
    expect(r.success).toBe(false);
    expect(inserted).toBeUndefined();
  });

  it("requires a way to reach them and something to quote", async () => {
    expect((await submitQuoteRequest({ ...valid(), email: "", phone: "" })).success).toBe(false);
    expect((await submitQuoteRequest({ ...valid(), wants: [], notes: "" })).success).toBe(false);
    expect(inserted).toBeUndefined();
  });

  it("folds a repeat submission into the open request instead of emailing again", async () => {
    recentOpen = { id: "req-0", notes: "First note", wants: ["addons"] };
    const r = await submitQuoteRequest(valid());
    expect(r.success).toBe(true);
    expect(inserted).toBeUndefined();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    const merge = updated.find((u) => u.table === "quote_requests");
    expect(merge?.payload.wants).toEqual(["addons", "rack"]);
    expect(merge?.payload.notes).toBe("First note\n\nAnother 4x4 for the basement");
  });

  it("won't take requests for a waitlisted job", async () => {
    leadRow = { installer_id: "installer-1", customer_id: null, status: "waitlisted" };
    expect((await submitQuoteRequest(valid())).success).toBe(false);
  });
});

describe("dismissQuoteRequest", () => {
  it("scopes the delete to the signed-in installer", async () => {
    const r = await dismissQuoteRequest("req-1");
    expect(r.success).toBe(true);
    expect(updated[0].payload).toMatchObject({ status: "dismissed" });
    expect(updated[0].filters).toContainEqual(["installer_id", "installer-1"]);
  });

  it("refuses when not signed in", async () => {
    authedUser = null;
    expect((await dismissQuoteRequest("req-1")).success).toBe(false);
  });
});
