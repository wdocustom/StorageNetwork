/**
 * Install tracking — manual steps (built → loaded → on the way), the
 * customer's tracking page, and the day-before reminder.
 */
import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";

let authedUser: { id: string } | null = { id: "installer-1" };
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: vi.fn(async () => authedUser) }));
const sendTransactionalEmail = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/email", () => ({ sendTransactionalEmail, emailShell: (_t: string, b: string) => b }));

type Row = Record<string, unknown>;
let leadRow: Row | null;
let reminderLeads: Row[];
let updates: Array<{ payload: Row; filters: Array<[string, unknown]> }>;
let claimWins: boolean;

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: "inst@example.com" } } })) } },
    from: (table: string) => {
      let op = "select";
      let list = false;
      const filters: Array<[string, unknown]> = [];
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "profiles") return { data: { business_name: "Rack City Totes", phone: "402-555-0100", email: "inst@example.com" } };
        if (op === "update") return { data: claimWins ? { id: "x" } : null, error: null };
        if (list) return { data: reminderLeads, error: null };
        return { data: leadRow, error: null };
      };
      chain.select = vi.fn().mockReturnValue(chain);
      for (const m of ["is", "lt", "not"]) chain[m] = vi.fn().mockReturnValue(chain);
      chain.gte = vi.fn(() => {
        list = true;
        return chain;
      });
      chain.eq = vi.fn((k: string, v: unknown) => {
        filters.push([k, v]);
        return chain;
      });
      chain.update = vi.fn((p: Row) => {
        op = "update";
        updates.push({ payload: p, filters });
        return chain;
      });
      chain.maybeSingle = vi.fn(async () => result());
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result());
      return chain;
    },
  }),
}));

const LEAD = "3f2b7c1e-8a4d-4c6b-9e1f-0a2b3c4d5e6f";
let actions: typeof import("./install-tracking");
let processInstallReminders: typeof import("@/lib/server/install-tracking").processInstallReminders;
let signTrackToken: (id: string) => string;

beforeAll(async () => {
  process.env.REQUEST_LINK_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T15:00:00Z") });
  actions = await import("./install-tracking");
  ({ processInstallReminders } = await import("@/lib/server/install-tracking"));
  ({ signTrackToken } = await import("@/lib/server/request-link"));
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  authedUser = { id: "installer-1" };
  leadRow = {
    id: LEAD,
    installer_id: "installer-1",
    status: "open",
    deposit_paid: true,
    customer_name: "Joseph Francescon",
    customer_email: "joe@example.com",
    scheduled_at: "2026-10-08",
    install_stage: null,
    time_preference: "morning",
    estimated_price: 1200,
    deposit_amount: 180,
    discount_amount: 0,
    sales_tax_amount: 0,
    completed_at: null,
    delivery_address_line1: "12 Elm St",
    delivery_address_city: "Omaha",
    delivery_address_state: "NE",
  };
  reminderLeads = [];
  updates = [];
  claimWins = true;
  sendTransactionalEmail.mockClear();
});

describe("setInstallStage", () => {
  it("saves the step and emails the customer a tracking link", async () => {
    const r = await actions.setInstallStage(LEAD, "on_the_way");
    expect(r).toEqual({ success: true, emailed: true });
    expect(updates[0].payload).toMatchObject({ install_stage: "on_the_way" });
    const email = sendTransactionalEmail.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(email.to).toBe("joe@example.com");
    expect(email.subject).toBe("Rack City Totes is on the way!");
    expect(email.html).toContain(`/track/${signTrackToken(LEAD)}`);
  });

  it("doesn't email again when the same step is tapped twice", async () => {
    leadRow = { ...leadRow!, install_stage: "built" };
    const r = await actions.setInstallStage(LEAD, "built");
    expect(r.emailed).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("resets without emailing", async () => {
    leadRow = { ...leadRow!, install_stage: "loaded" };
    await actions.setInstallStage(LEAD, null);
    expect(updates[0].payload).toEqual({ install_stage: null, install_stage_at: null });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("refuses another installer's job, closed jobs and jobs without a deposit", async () => {
    authedUser = { id: "installer-2" };
    expect((await actions.setInstallStage(LEAD, "built")).success).toBe(false);
    authedUser = { id: "installer-1" };
    leadRow = { ...leadRow!, status: "paid" };
    expect((await actions.setInstallStage(LEAD, "built")).success).toBe(false);
    leadRow = { ...leadRow!, status: "pending_payment", deposit_paid: false };
    expect((await actions.setInstallStage(LEAD, "built")).success).toBe(false);
    expect(updates).toHaveLength(0);
  });
});

describe("getTrackingPage", () => {
  it("shows the date, step, address and balance, and records the view", async () => {
    leadRow = { ...leadRow!, install_stage: "loaded", install_stage_at: "2026-10-08T13:00:00Z" };
    const r = await actions.getTrackingPage(signTrackToken(LEAD));
    expect(r.data).toMatchObject({
      installerName: "Rack City Totes",
      scheduledDate: "2026-10-08",
      timePreference: "morning",
      stage: "loaded",
      installed: false,
      address: "12 Elm St, Omaha, NE",
      balanceDue: 1020,
    });
    expect(r.data?.scheduleUrl).toContain("/schedule/");
    expect(updates.some((u) => "tracking_viewed_at" in u.payload)).toBe(true);
  });

  it("hides the change-date link inside 48 hours", async () => {
    leadRow = { ...leadRow!, scheduled_at: "2026-10-02" };
    const r = await actions.getTrackingPage(signTrackToken(LEAD));
    expect(r.data?.scheduleUrl).toBeNull();
  });

  it("shows installed once the job is paid", async () => {
    leadRow = { ...leadRow!, status: "paid" };
    const r = await actions.getTrackingPage(signTrackToken(LEAD));
    expect(r.data).toMatchObject({ installed: true, balanceDue: 0, scheduleUrl: null });
  });

  it("rejects a schedule link used as a tracking link", async () => {
    const { signScheduleToken } = await import("@/lib/server/request-link");
    expect((await actions.getTrackingPage(signScheduleToken(LEAD))).data).toBeUndefined();
  });
});

describe("processInstallReminders", () => {
  const due = (over: Row = {}): Row => ({
    id: LEAD,
    installer_id: "installer-1",
    customer_name: "Joseph Francescon",
    customer_email: "joe@example.com",
    scheduled_at: "2026-10-02",
    time_preference: "afternoon",
    status: "open",
    deposit_paid: true,
    install_reminder_for: null,
    estimated_price: 1200,
    deposit_amount: 180,
    discount_amount: 0,
    sales_tax_amount: 0,
    ...over,
  });

  it("emails tomorrow's installs once and stamps the date", async () => {
    reminderLeads = [due()];
    const r = await processInstallReminders(new Date("2026-10-01T14:00:00Z"));
    expect(r).toMatchObject({ processed: 1, sent: 1 });
    expect(updates[0].payload).toEqual({ install_reminder_for: "2026-10-02" });
    const email = sendTransactionalEmail.mock.calls[0][0] as { subject: string; html: string };
    expect(email.subject).toBe("Reminder: your install with Rack City Totes is tomorrow");
    expect(email.html).toContain("Friday, October 2 (afternoon)");
    expect(email.html).toContain("$1,020.00");
  });

  it("skips jobs already reminded for that date, and closed jobs", async () => {
    reminderLeads = [due({ install_reminder_for: "2026-10-02" }), due({ id: "b", status: "paid" })];
    const r = await processInstallReminders(new Date("2026-10-01T14:00:00Z"));
    expect(r).toMatchObject({ processed: 0, sent: 0 });
  });

  it("re-reminds after a reschedule", async () => {
    reminderLeads = [due({ install_reminder_for: "2026-09-30" })];
    const r = await processInstallReminders(new Date("2026-10-01T14:00:00Z"));
    expect(r.sent).toBe(1);
  });

  it("doesn't send when another run already claimed the job", async () => {
    reminderLeads = [due()];
    claimWins = false;
    const r = await processInstallReminders(new Date("2026-10-01T14:00:00Z"));
    expect(r.sent).toBe(0);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
