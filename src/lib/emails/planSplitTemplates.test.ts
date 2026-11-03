import { describe, expect, it } from "vitest";
import { planSplitEmailContent } from "./planSplitTemplates";

describe("plan split earnings email", () => {
  it("explains a referral split: amount, why, and a link to the plans", () => {
    const { subject, html } = planSplitEmailContent({
      name: "Pat",
      cents: 500,
      reason: "referral",
      bestsellerNames: [],
      productName: "Interactive Build Guide",
    });
    expect(subject).toBe("You just earned $5 from a DIY plan sale");
    expect(html).toContain("Nice work, Pat.");
    expect(html).toContain("$5");
    expect(html).toContain("from an Interactive Build Guide sale");
    expect(html).toContain("every DIY plan sale from your link pays you $5 &mdash; $6.50 when the plan includes your own bestseller");
    expect(html).toMatch(/href="[^"]+\/plans"/);
    expect(html).toContain("/dashboard/profile?tab=account");
  });

  it("names the bestseller and mentions sharing when the split was shared", () => {
    const { subject, html } = planSplitEmailContent({
      name: "Elite",
      cents: 250,
      reason: "bestseller",
      bestsellerNames: ["Indiana Joe", "The Long Ranger"],
      shared: true,
    });
    expect(subject).toBe("Your Indiana Joe and The Long Ranger designs just earned you $2.50");
    expect(html).toContain("Indiana Joe and The Long Ranger");
    expect(html).toContain("$2.50");
    expect(html).toContain("shared when the plan includes other installers");
  });

  it("escapes names", () => {
    const { html } = planSplitEmailContent({ name: "<b>x</b>", cents: 500, reason: "referral", bestsellerNames: [] });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
