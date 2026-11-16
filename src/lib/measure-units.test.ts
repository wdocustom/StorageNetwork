import { describe, expect, it } from "vitest";
import { formatLengthIn, metricText } from "./measure-units";

describe("metricText", () => {
  it.each([
    ['Cut all 2×4×8\' studs to 69-1/4".', "Cut all 2×4 (2.44 m) studs to 1759 mm."],
    ['1-1/2" × 1-9/16" × 30" long', "38 mm × 40 mm × 762 mm long"],
    ["8 ft studs — uprights and plates", "2.44 m studs — uprights and plates"],
    ['3/4" sheets — worktops (each sheet rips into two 20" strips)', "19 mm sheets — worktops (each sheet rips into two 508 mm strips)"],
    ["8' 6\" wall", "2591 mm wall"],
    ['about every 12" along', "about every 305 mm along"],
    ['Full 96" — no cut', "Full 2438 mm — no cut"],
    ["16 totes · 4×4 · build 2", "16 totes · 4×4 · build 2"],
    ["Don't over-tighten; it's fine", "Don't over-tighten; it's fine"],
    ["$19 for 2 plans", "$19 for 2 plans"],
    ['studs 12–16" apart', "studs 305–406 mm apart"],
  ])("%s", (input, expected) => {
    expect(metricText(input)).toBe(expected);
  });

  it("keeps the store size in brackets, without converting it twice", () => {
    expect(metricText('3/4" Plywood', { keep: true })).toBe("19 mm (3/4 in) Plywood");
    expect(metricText('#9 × 1-5/8" Screws', { keep: true })).toBe("#9 × 41 mm (1-5/8 in) Screws");
    const once = metricText('5" Swivel Casters', { keep: true });
    expect(metricText(once)).toBe(once);
  });

  it("formats a length either way", () => {
    expect(formatLengthIn(34.5, "imperial")).toBe('34-1/2"');
    expect(formatLengthIn(34.5, "metric")).toBe("876 mm");
  });
});
