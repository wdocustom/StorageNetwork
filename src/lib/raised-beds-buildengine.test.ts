import {
  buildRaisedBedPlan,
  buildRaisedBedPlanById,
  buildAllRaisedBedPlans,
} from "@/lib/raised-beds-buildengine";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";

// The user's hand-build reference is a 24" × 24" × 16-1/2" ground-level box.
// It's not a catalog item, so we hand-construct the size for the test.
const REF_24x24x16_5 = {
  id: "test_24x24x16",
  label: "24\" × 24\" × 16.5\" Ground (reference)",
  style: "without_legs" as const,
  widthIn: 24,
  lengthIn: 24,
  heightIn: 16.5,
  internalW: 23,
  internalL: 23,
  internalH: 16,
  groundClearance: 0,
  depthIncreaseAvailable: false,
  bottomShelfAvailable: false,
  pestCoverCategory: "none" as const,
};

describe("buildRaisedBedPlan — 24x24x16.5 reference", () => {
  const plan = buildRaisedBedPlan(REF_24x24x16_5);

  it("uses 3 pickets per side wall (16.5\" ÷ 5.5\")", () => {
    expect(plan.picketsPerSide).toBe(3);
  });

  it("cuts A/C pickets to 22-3/4\" and B/D to 21-1/2\"", () => {
    expect(plan.sideLengths.ac).toBeCloseTo(22.75);
    expect(plan.sideLengths.bd).toBeCloseTo(21.5);
  });

  it("emits 6 A/C + 6 B/D side pickets, full width (5-1/2\")", () => {
    const ac = plan.cuts.find((c) => c.name === "Side picket A/C");
    const bd = plan.cuts.find((c) => c.name === "Side picket B/D");
    expect(ac?.qty).toBe(6);
    expect(bd?.qty).toBe(6);
    expect(ac?.widthIn).toBe(5.5);
    expect(bd?.widthIn).toBe(5.5);
  });

  it("emits 4 legs of each face type, 16-1/2\" tall (ground-level = wall height)", () => {
    const long = plan.cuts.find((c) => c.name === "Leg long face");
    const short = plan.cuts.find((c) => c.name === "Leg short face");
    expect(long?.qty).toBe(4);
    expect(short?.qty).toBe(4);
    expect(long?.lengthIn).toBe(16.5);
    expect(short?.lengthIn).toBe(16.5);
  });

  it("emits rim as 2 × 24\" + 2 × 18-1/2\", 2-3/4\" wide", () => {
    const long = plan.cuts.find((c) => c.name === "Long rim");
    const short = plan.cuts.find((c) => c.name === "Short rim");
    expect(long?.lengthIn).toBe(24);
    expect(short?.lengthIn).toBe(18.5);
    expect(long?.widthIn).toBe(2.75);
    expect(long?.qty).toBe(2);
    expect(short?.qty).toBe(2);
  });

  it("matches the hand-counted fastener totals: 20 × 1-1/4\" (legs) + 144 × 1\" (sides)", () => {
    const legBrads = plan.fasteners.find((f) => f.where.startsWith("Corner legs"));
    const sideBrads = plan.fasteners.find((f) => f.where.startsWith("Side pickets"));
    expect(legBrads?.qty).toBe(20);
    expect(legBrads?.size).toBe('1-1/4"');
    expect(sideBrads?.qty).toBe(144);
    expect(sideBrads?.size).toBe('1"');
  });

  it("adds rim brads: 16 corner-cluster + field nails at ~4\" OC", () => {
    const rim = plan.fasteners.find((f) => f.where.startsWith("Rim"));
    expect(rim?.size).toBe('1-1/4"');
    expect(rim?.qty).toBeGreaterThan(16); // at least the corner clusters
    expect(rim?.where).toContain("16 corner-cluster");
  });

  it("does not flag this fully-specified case as unspecified", () => {
    expect(plan.unspecified).toHaveLength(0);
  });
});

describe("buildRaisedBedPlan — catalog coverage", () => {
  it("returns a plan for every catalog size", () => {
    const plans = buildAllRaisedBedPlans();
    expect(plans).toHaveLength(RAISED_BED_SIZES.length);
  });

  it("flags elevated (with_legs) sizes as unspecified pending leg geometry", () => {
    const elevated = buildRaisedBedPlanById("legs_24x48x16");
    expect(elevated?.unspecified.length ?? 0).toBeGreaterThan(0);
    expect(elevated?.unspecified.some((u) => u.toLowerCase().includes("leg"))).toBe(true);
  });

  it("flags non-multiple-of-5.5 heights as unspecified pending top rip", () => {
    // ground_24x72x11 → 11.5" height, 2 pickets = 11" wall (0.5" gap)
    const odd = buildRaisedBedPlanById("ground_24x72x11");
    expect(odd?.unspecified.some((u) => u.toLowerCase().includes("top-course"))).toBe(true);
  });

  it("returns null for an unknown size id", () => {
    expect(buildRaisedBedPlanById("nope")).toBeNull();
  });
});

describe("buildRaisedBedPlan — rectangular box length math", () => {
  it("A/C uses widthIn reduction; B/D uses lengthIn reduction", () => {
    const plan = buildRaisedBedPlanById("ground_24x72x22");
    expect(plan?.sideLengths.ac).toBeCloseTo(24 - 1.25); // 22.75
    expect(plan?.sideLengths.bd).toBeCloseTo(72 - 2.5);  // 69.5
  });

  it("scales picketsPerSide with heightIn", () => {
    const tall = buildRaisedBedPlanById("ground_24x72x22");
    const short = buildRaisedBedPlanById("ground_24x72x11");
    expect(tall?.picketsPerSide).toBe(4);   // 22.5 → round(4.09) = 4
    expect(short?.picketsPerSide).toBe(2);  // 11.5 → round(2.09) = 2
  });
});
