import {
  collectibleCutCents,
  computePartnerCutCents,
  jobTotalAfterDiscountCents,
  normalizePartnerCode,
  privateName,
  suggestPartnerCode,
} from "./referral-partners";

describe("computePartnerCutCents", () => {
  it("takes a percent of the job total", () => {
    expect(computePartnerCutCents({ cutType: "percent", cutValue: 10, jobTotalCents: 120_000 })).toBe(12_000);
  });
  it("pays a flat amount", () => {
    expect(computePartnerCutCents({ cutType: "flat", cutValue: 75, jobTotalCents: 120_000 })).toBe(7_500);
  });
  it("caps percent at 50% and flat at the job total", () => {
    expect(computePartnerCutCents({ cutType: "percent", cutValue: 90, jobTotalCents: 10_000 })).toBe(5_000);
    expect(computePartnerCutCents({ cutType: "flat", cutValue: 500, jobTotalCents: 10_000 })).toBe(10_000);
  });
  it("is zero with no cut or no job", () => {
    expect(computePartnerCutCents({ cutType: "percent", cutValue: 0, jobTotalCents: 10_000 })).toBe(0);
    expect(computePartnerCutCents({ cutType: "flat", cutValue: 50, jobTotalCents: 0 })).toBe(0);
  });
});

describe("collectibleCutCents", () => {
  // $1,000 job, 15% deposit = $150, direct-lead platform fee 3% = $30
  it("collects the whole cut when fee + cut fit in the deposit", () => {
    expect(collectibleCutCents({ depositCents: 15_000, platformFeeCents: 3_000, cutCents: 10_000 })).toBe(10_000);
    expect(collectibleCutCents({ depositCents: 15_000, platformFeeCents: 3_000, cutCents: 12_000 })).toBe(12_000);
  });
  it("collects nothing (owed by installer) when it doesn't fit — never a partial", () => {
    expect(collectibleCutCents({ depositCents: 15_000, platformFeeCents: 3_000, cutCents: 12_001 })).toBe(0);
    // network lead: the 15% fee already uses the whole deposit
    expect(collectibleCutCents({ depositCents: 15_000, platformFeeCents: 15_000, cutCents: 1 })).toBe(0);
  });
  it("collects nothing for a zero cut", () => {
    expect(collectibleCutCents({ depositCents: 15_000, platformFeeCents: 0, cutCents: 0 })).toBe(0);
  });
});

describe("codes and names", () => {
  it("normalizes share codes", () => {
    expect(normalizePartnerCode(" acme-move 24 ")).toBe("ACMEMOVE24");
    expect(normalizePartnerCode("ab")).toBeNull();
    expect(normalizePartnerCode(null)).toBeNull();
  });
  it("suggests a readable code from the business name", () => {
    expect(suggestPartnerCode("Acme Moving & Storage", "7k")).toBe("ACMEMOVING7K");
    expect(normalizePartnerCode(suggestPartnerCode("A", "Q2"))).not.toBeNull();
  });
  it("figures the cut on the total after discount", () => {
    expect(jobTotalAfterDiscountCents(100_000, 10_000)).toBe(90_000);
    expect(jobTotalAfterDiscountCents(100_000, -5)).toBe(100_000);
  });
  it("shows partners first name + last initial only", () => {
    expect(privateName("Jane Q Doe")).toBe("Jane D.");
    expect(privateName("Cher")).toBe("Cher");
    expect(privateName("")).toBe("Customer");
  });
});
