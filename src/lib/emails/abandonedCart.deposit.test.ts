import { vi, describe, it, expect, beforeEach } from "vitest";

let sentHtml = "";
vi.mock("./core", () => ({
  sendTransactionalEmail: vi.fn(async (p: { html: string }) => {
    sentHtml = p.html;
    return { success: true };
  }),
}));

const { sendAbandonedCartEmail } = await import("./customerTemplates");

const base = { customerName: "Dan Smith", resumeUrl: "https://x/pay/1", installerName: "WDO Custom" };

describe("abandoned-cart email deposit wording", () => {
  beforeEach(() => {
    sentHtml = "";
  });

  it("shows the installer's real percentage, not a hardcoded 15%", async () => {
    await sendAbandonedCartEmail("d@example.com", { ...base, totalPrice: 400, depositAmount: 160 });
    expect(sentHtml).toContain("Secure Deposit (40%)");
    expect(sentHtml).toContain("40% Deposit");
    expect(sentHtml).not.toContain("15%");
    expect(sentHtml).toContain("$160.00");
    expect(sentHtml).toContain("$240.00");
  });

  it("still says 15% when 15% is genuinely the deposit", async () => {
    await sendAbandonedCartEmail("d@example.com", { ...base, totalPrice: 1000, depositAmount: 150 });
    expect(sentHtml).toContain("Secure Deposit (15%)");
  });

  it("drops the percentage for a flat deposit that isn't a whole percent", async () => {
    await sendAbandonedCartEmail("d@example.com", { ...base, totalPrice: 1050, depositAmount: 200 });
    expect(sentHtml).toContain("Secure Deposit");
    expect(sentHtml).not.toMatch(/Secure Deposit \(\d+%\)/);
    expect(sentHtml).toContain("Deposit Only");
    expect(sentHtml).toContain("$200.00");
  });
});
