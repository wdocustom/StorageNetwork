/**
 * Customer self-scheduling — the customer picks their install date after
 * paying the deposit, and it's booked immediately.
 */
import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";

vi.mock("@/lib/server/action-rate-limit", () => ({
  enforceActionRateLimit: vi.fn(async () => {}),
  RateLimitError: class extends Error {},
}));
const sendTransactionalEmail = vi.fn(async () => ({ success: true }));
const sendInstallScheduledNotice = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/email", () => ({
  sendTransactionalEmail,
  sendInstallScheduledNotice,
  emailShell: (_t: string, b: string) => b,
}));

type Row = Record<string, unknown>;
let leadRow: Row | null;
let profileRow: Row;
let blackouts: Row[];
let overrides: Row[];
let casMatches: boolean;
let leadUpdates: Row[];

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "inst@example.com" } } })) } },
    from: (table: string) => {
      let op = "select";
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "profiles") return { data: profileRow };
        if (table === "installer_blackout_dates") return { data: blackouts };
        if (table === "installer_schedule_overrides") return { data: overrides };
        if (op === "update") return { data: casMatches ? { id: "lead-1" } : null, error: null };
        return { data: leadRow };
      };
      for (const m of ["select", "eq", "is", "gte", "lte"]) chain[m] = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn((p: Row) => {
        op = "update";
        leadUpdates.push(p);
        return chain;
      });
      chain.maybeSingle = vi.fn(async () => result());
      chain.single = vi.fn(async () => result());
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
      return chain;
    },
  }),
}));

const LEAD = "3f2b7c1e-8a4d-4c6b-9e1f-0a2b3c4d5e6f";
let token: string;
let setInstallDateFromCustomer: typeof import("./customer-schedule").setInstallDateFromCustomer;
let getSchedulePage: typeof import("./customer-schedule").getSchedulePage;

beforeAll(async () => {
  process.env.REQUEST_LINK_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  // Thursday 2026-10-01, 3pm UTC.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T15:00:00Z") });
  const link = await import("@/lib/server/request-link");
  token = link.signScheduleToken(LEAD);
  ({ setInstallDateFromCustomer, getSchedulePage } = await import("./customer-schedule"));
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  leadRow = {
    id: LEAD,
    installer_id: "installer-1",
    customer_name: "Joseph Francescon",
    customer_email: "joe@example.com",
    status: "open",
    deposit_paid: true,
    scheduled_at: null,
    quote_data: [{ hasWheels: false }],
    time_preference: null,
  };
  profileRow = {
    business_name: "Rack City Totes",
    email: "inst@example.com",
    lead_time_days: 5,
    working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    scheduling_enabled: true,
  };
  blackouts = [];
  overrides = [];
  casMatches = true;
  leadUpdates = [];
  sendTransactionalEmail.mockClear();
  sendInstallScheduledNotice.mockClear();
});

describe("setInstallDateFromCustomer", () => {
  it("books an open slot and notifies both sides", async () => {
    const r = await setInstallDateFromCustomer({ token, date: "2026-10-07", time: "morning" });
    expect(r).toEqual({ success: true });
    expect(leadUpdates[0]).toMatchObject({ scheduled_at: "2026-10-07" });
    expect(leadUpdates[1]).toEqual({ time_preference: "morning" });
    expect(sendInstallScheduledNotice).toHaveBeenCalledWith(
      "joe@example.com",
      expect.objectContaining({ scheduledDate: "2026-10-07", bookedByCustomer: true, isReschedule: false })
    );
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "inst@example.com" }));
  });

  it("rejects a forged link", async () => {
    const r = await setInstallDateFromCustomer({ token: `${LEAD}.forgedsignature000000000`, date: "2026-10-07" });
    expect(r.success).toBe(false);
    expect(leadUpdates).toHaveLength(0);
  });

  it("rejects a quote-request link used as a schedule link", async () => {
    const { signRequestToken } = await import("@/lib/server/request-link");
    const r = await setInstallDateFromCustomer({ token: signRequestToken(LEAD), date: "2026-10-07" });
    expect(r.success).toBe(false);
  });

  it("won't schedule before the deposit is paid", async () => {
    leadRow = { ...leadRow!, deposit_paid: false, status: "pending_payment" };
    expect((await setInstallDateFromCustomer({ token, date: "2026-10-07" })).success).toBe(false);
  });

  it("enforces the installer's calendar", async () => {
    blackouts = [{ start_date: "2026-10-07", end_date: "2026-10-09" }];
    const r = await setInstallDateFromCustomer({ token, date: "2026-10-08" });
    expect(r.success).toBe(false);
    expect(leadUpdates).toHaveLength(0);
  });

  it("leaves scheduling to installers who turned it off", async () => {
    profileRow.scheduling_enabled = false;
    expect((await setInstallDateFromCustomer({ token, date: "2026-10-07" })).success).toBe(false);
  });

  it("lets the customer change a date more than 48 hours out", async () => {
    leadRow = { ...leadRow!, scheduled_at: "2026-10-09" };
    const r = await setInstallDateFromCustomer({ token, date: "2026-10-12", time: "afternoon" });
    expect(r.success).toBe(true);
    expect(sendInstallScheduledNotice).toHaveBeenCalledWith(
      "joe@example.com",
      expect.objectContaining({ isReschedule: true })
    );
  });

  it("blocks customer changes inside 48 hours", async () => {
    leadRow = { ...leadRow!, scheduled_at: "2026-10-02" };
    const r = await setInstallDateFromCustomer({ token, date: "2026-10-12" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/48 hours/);
  });

  it("doesn't overwrite a date the installer just changed", async () => {
    casMatches = false;
    const r = await setInstallDateFromCustomer({ token, date: "2026-10-07" });
    expect(r.success).toBe(false);
    expect(sendInstallScheduledNotice).not.toHaveBeenCalled();
  });
});

describe("getSchedulePage", () => {
  it("returns the installer's calendar rules with the wheels minimum", async () => {
    profileRow.lead_time_days = 1;
    leadRow = { ...leadRow!, quote_data: [{ hasWheels: true }] };
    const r = await getSchedulePage(token);
    expect(r.data).toMatchObject({
      installerName: "Rack City Totes",
      schedulingEnabled: true,
      leadTimeDays: 3,
      hasWheels: true,
      canChange: true,
      currentDate: null,
    });
  });

  it("says a closed job can't be scheduled", async () => {
    leadRow = { ...leadRow!, status: "paid" };
    const r = await getSchedulePage(token);
    expect(r.data).toBeUndefined();
    expect(r.closed).toBe(true);
  });
});
