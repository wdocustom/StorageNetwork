import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { priceDesignForInstaller } from "./plan-build-quote";
import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { decodeTotePlanDesign } from "@/lib/tote-plans";

describe("priceDesignForInstaller", () => {
  it("prices a plain unit exactly like the design configurator", async () => {
    const quote = await priceDesignForInstaller(decodeTotePlanDesign("H4x4wt")!, undefined, false);
    const direct = await calculateBuild({
      cols: 4,
      rows: 4,
      toteModel: "HDX",
      unitType: "standard",
      orientation: "standard",
      addOns: { totes: false, wheels: true, top: true },
      mode: "manual",
    });
    expect(direct.success).toBe(true);
    expect(quote?.total).toBe(direct.success ? direct.price : -1);
    expect(quote?.units).toHaveLength(1);
    expect(quote?.units[0]).toMatchObject({ cols: 4, rows: 4, hasWheels: true, hasTop: true, hasTotes: false, desc: "Standard: 4W × 4H" });
  });

  it("prices a bestseller at the installer's bestseller price and expands it like the configurator", async () => {
    const quote = await priceDesignForInstaller(decodeTotePlanDesign("H2x4t_ij.H2x2t_ij.H2x4t_ij")!, undefined, false);
    const preset = await calculateCompoundBuild({ presetId: "indiana-joe", hasTotes: false });
    expect(preset.success).toBe(true);
    expect(quote?.total).toBe(preset.success ? preset.totalPrice : -1);
    expect(quote?.units.map((u) => u.desc)).toEqual([
      "Indiana Joe (2x4 + 2x2 + 2x4) — 2x4",
      "Indiana Joe (2x4 + 2x2 + 2x4) — 2x2",
      "Indiana Joe (2x4 + 2x2 + 2x4) — 2x4",
    ]);
  });

  it("prices a bestseller the installer switched off as plain units", async () => {
    const quote = await priceDesignForInstaller(
      decodeTotePlanDesign("H2x4t_ij.H2x2t_ij.H2x4t_ij")!,
      { bestseller_indiana_joe_disabled: true } as never,
      false,
    );
    expect(quote?.units.map((u) => u.desc)).toEqual(["Standard: 2W × 4H", "Standard: 2W × 2H", "Standard: 2W × 4H"]);
  });

  it("adds totes only when asked and the installer sells them", async () => {
    const design = decodeTotePlanDesign("H4x4")!;
    const without = await priceDesignForInstaller(design, undefined, false);
    const withTotes = await priceDesignForInstaller(design, undefined, true);
    expect(withTotes!.total).toBeGreaterThan(without!.total);
    expect(withTotes!.totes).toBe(true);
    const disabled = await priceDesignForInstaller(design, { totes_disabled: true } as never, true);
    expect(disabled!.totes).toBe(false);
    expect(disabled!.total).toBe(without!.total);
  });
});
