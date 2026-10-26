import { describe, expect, it } from "vitest";
import { BESTSELLER_OWNERS, PLAN_SPLIT_TOTAL_CENTS, cleanReferralId, planSplitShares } from "./plan-splits";
import { decodeTotePlanDesign } from "./tote-plans";

const ELITE = BESTSELLER_OWNERS["indiana-joe"].profileId;
const RACK_CITY = BESTSELLER_OWNERS["rack-city-roller"].profileId;
const GASS = BESTSELLER_OWNERS["gas-station"].profileId;
const REFERRER = "11111111-2222-4333-8444-555555555555";

const design = (code: string) => decodeTotePlanDesign(code)!;
const total = (shares: { cents: number }[]) => shares.reduce((s, x) => s + x.cents, 0);

// Bestseller codes: ij Indiana Joe, lr Long Ranger, gs Gass Station,
// rcr Rack City Roller, mrc Mayor of Rack City
const JOE = "H2x4t_ij.H2x2t_ij.H2x4t_ij";
const RANGER = "H2x4t_lr.H4x2t_lr";
const ROLLER = "H3x2wt_rcr";
const MAYOR = "H4x2wt_mrc";
const GAS = "H1x4t_gs.H4x2t_gs.H1x4t_gs";

describe("planSplitShares", () => {
  it("gives a referring installer the full $5, whatever bestsellers are in the plan", () => {
    const shares = planSplitShares({ referralInstallerId: REFERRER, design: design(`${JOE}.${ROLLER}`) });
    expect(shares).toEqual([{ recipientId: REFERRER, cents: 500, reason: "referral", bestsellers: [] }]);
  });

  it("pays the bestseller's installer when there's no referral", () => {
    expect(planSplitShares({ design: design(JOE) }).map((s) => [s.recipientId, s.cents])).toEqual([[ELITE, 500]]);
    expect(planSplitShares({ design: design(MAYOR) }).map((s) => [s.recipientId, s.cents])).toEqual([[RACK_CITY, 500]]);
    expect(planSplitShares({ design: design(GAS) }).map((s) => [s.recipientId, s.cents])).toEqual([[GASS, 500]]);
  });

  it("splits 50/50 between two installers' bestsellers", () => {
    const shares = planSplitShares({ design: design(`${JOE}.${ROLLER}`) });
    expect(shares.map((s) => [s.recipientId, s.cents])).toEqual([
      [ELITE, 250],
      [RACK_CITY, 250],
    ]);
  });

  it("splits in thirds across three installers, never more than $5 in total", () => {
    const shares = planSplitShares({ design: design(`${GAS}.${JOE}.${ROLLER}`) });
    expect(shares.map((s) => [s.recipientId, s.cents])).toEqual([
      [GASS, 167],
      [ELITE, 167],
      [RACK_CITY, 166],
    ]);
    expect(total(shares)).toBe(PLAN_SPLIT_TOTAL_CENTS);
  });

  it("splits per installer, not per bestseller", () => {
    const shares = planSplitShares({ design: design(`${JOE}.${RANGER}.${ROLLER}`) });
    expect(shares.map((s) => [s.recipientId, s.cents, s.bestsellers])).toEqual([
      [ELITE, 250, ["indiana-joe", "long-ranger"]],
      [RACK_CITY, 250, ["rack-city-roller"]],
    ]);
  });

  it("pays nothing without a referral or an owned bestseller", () => {
    expect(planSplitShares({ design: design("H5x7wt") })).toEqual([]);
    // Track Norris has no assigned installer
    expect(planSplitShares({ design: design("H4x2t_tn") })).toEqual([]);
  });

  it("drops a bestseller whose sizes changed, but not for brand, casters or worktop", () => {
    // Indiana Joe with its middle unit resized is the customer's own design
    expect(planSplitShares({ design: design("H2x4t_ij.H3x2t_ij.H2x4t_ij") })).toEqual([]);
    // …but in Greenmade, on casters, without worktops it's still Indiana Joe
    expect(planSplitShares({ design: design("G2x4w_ij.G2x2w_ij.G2x4w_ij") }).map((s) => s.recipientId)).toEqual([ELITE]);
    // a bestseller missing one of its units doesn't count
    expect(planSplitShares({ design: design("H2x4t_ij.H2x2t_ij") })).toEqual([]);
  });

  it("ignores referral ids that aren't installer ids", () => {
    expect(cleanReferralId("not-an-id")).toBeNull();
    expect(cleanReferralId(REFERRER.toUpperCase())).toBe(REFERRER);
    expect(planSplitShares({ referralInstallerId: "x", design: design(JOE) }).map((s) => s.reason)).toEqual(["bestseller"]);
  });
});
