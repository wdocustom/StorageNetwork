import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase-server", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/lib/emails/sidewaysBrandTemplates", () => ({ sendSidewaysBrandNotice: vi.fn() }));
import { groupNoticeRecipients, needsSidewaysNotice } from "./sideways-brand-notice";

const unit = (over: Record<string, unknown> = {}) => ({ cols: 4, rows: 4, toteType: "HDX", hasWheels: false, hasTop: false, ...over });
const row = (id: string, email: string, units: unknown[], name: string | null = null) => ({
  id,
  email,
  customer_name: name,
  access_token: `tok-${id}`,
  build_config: { units },
});

describe("sideways brand notice", () => {
  it("only targets plans with a sideways HDX unit", () => {
    expect(needsSidewaysNotice({ units: [unit({ sideways: true })] })).toBe(true);
    expect(needsSidewaysNotice({ units: [unit()] })).toBe(false);
    expect(needsSidewaysNotice({ units: [unit({ sideways: true, toteType: "GM" })] })).toBe(false);
    expect(needsSidewaysNotice({ units: [unit(), unit({ sideways: true })] })).toBe(true);
    expect(needsSidewaysNotice(null)).toBe(false);
  });

  it("sends one email per person, listing each of their sideways plans", () => {
    const recipients = groupNoticeRecipients([
      row("a", "Nick@Example.com", [unit({ sideways: true })], "NICHOLAS W"),
      row("b", "nick@example.com", [unit({ sideways: true, cols: 6 })]),
      row("c", "nick@example.com", [unit()]),
      row("d", "don@example.com", [unit({ sideways: true })], "Don"),
      row("e", "gm@example.com", [unit({ sideways: true, toteType: "GM" })]),
    ]);
    expect(recipients.map((r) => [r.email, r.rowIds, r.firstName])).toEqual([
      ["nick@example.com", ["a", "b"], "NICHOLAS"],
      ["don@example.com", ["d"], "Don"],
    ]);
    expect(recipients[0].plans.map((p) => p.accessToken)).toEqual(["tok-a", "tok-b"]);
  });
});
