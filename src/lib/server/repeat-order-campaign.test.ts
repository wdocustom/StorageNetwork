import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/lib/emails/marketingTemplates", () => ({ sendRepeatOrderEmail: vi.fn() }));

const { selectRecipients } = await import("./repeat-order-campaign");

const inst = (id: string, over: Partial<{ is_pro: boolean; is_suspended: boolean }> = {}) => ({
  id,
  name: `Installer ${id}`,
  is_pro: true,
  is_suspended: false,
  ...over,
});
const installers = new Map([
  ["i1", inst("i1")],
  ["i2", inst("i2")],
  ["free", inst("free", { is_pro: false })],
  ["susp", inst("susp", { is_suspended: true })],
]);
const lead = (id: string, email: string | null, installer: string | null, created: string) => ({
  id,
  customer_name: "Pat Smith",
  customer_email: email,
  installer_id: installer,
  created_at: created,
});
const none = new Set<string>();

describe("selectRecipients", () => {
  it("emails each customer once, pointed at their most recent installer", () => {
    const out = selectRecipients(
      [
        lead("a", "Pat@Example.com", "i1", "2026-01-01"),
        lead("b", "pat@example.com", "i2", "2026-06-01"),
      ],
      installers,
      none,
      none
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ email: "pat@example.com", installerId: "i2", sourceLeadId: "b" });
  });

  it("skips opted-out and already-sent addresses (case-insensitive)", () => {
    const out = selectRecipients(
      [lead("a", "out@example.com", "i1", "2026-01-01"), lead("b", "sent@example.com", "i1", "2026-01-02")],
      installers,
      new Set(["out@example.com"]),
      new Set(["sent@example.com"])
    );
    expect(out).toEqual([]);
  });

  it("does not fall back to an older order when the newest one's installer is ineligible", () => {
    const out = selectRecipients(
      [lead("old", "pat@example.com", "i1", "2026-01-01"), lead("new", "pat@example.com", "susp", "2026-06-01")],
      installers,
      none,
      none
    );
    expect(out).toEqual([]);
  });

  it("skips non-Pro installers, missing emails, bad emails and unknown installers", () => {
    const out = selectRecipients(
      [
        lead("1", "a@example.com", "free", "2026-01-01"),
        lead("2", null, "i1", "2026-01-01"),
        lead("3", "not-an-email", "i1", "2026-01-01"),
        lead("4", "b@example.com", "ghost", "2026-01-01"),
        lead("5", "ok@example.com", "i1", "2026-01-01"),
      ],
      installers,
      none,
      none
    );
    expect(out.map((r) => r.email)).toEqual(["ok@example.com"]);
  });
});
