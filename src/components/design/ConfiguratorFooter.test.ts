import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/diy-plan-checkout", () => ({ checkDIYPlanAccess: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
import { designerPlanTranslation } from "./ConfiguratorFooter";
import { encodeTotePlanDesign } from "@/lib/tote-plans";
import type { ConfiguratorSidebarProps } from "./configurator-types";

const code = (orderItems: unknown[]) => {
  const { design } = designerPlanTranslation({ orderItems } as unknown as ConfiguratorSidebarProps);
  return design ? `${encodeTotePlanDesign(design)}${design.name ? ` "${design.name}"` : ""}` : null;
};

describe("designer → DIY plans", () => {
  it("offers nothing until the order has something in it", () => {
    expect(code([])).toBeNull();
  });

  it("translates the whole order, repeating quantities and skipping non-tote products", () => {
    expect(
      code([
        { cols: 4, rows: 4, toteType: "GM", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: false, desc: "Standard: 4W × 4H", quantity: 2 },
        { cols: 0, rows: 0, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false, desc: "Shelf", shelvingConfigId: "shelf-48" },
      ]),
    ).toBe("G4x4w.G4x4w");
  });

  it("keeps a lone bestseller's name and per-unit options", () => {
    expect(
      code([
        {
          cols: 6,
          rows: 4,
          toteType: "HDX",
          unitType: "standard",
          orientation: "standard",
          hasWheels: false,
          hasTop: true,
          desc: "The Long Ranger (2x4 + 4x2)",
          presetUnits: [
            { cols: 2, rows: 4, totalW: 44, totalH: 69.5, hasTop: true, hasWheels: false },
            { cols: 4, rows: 2, totalW: 86.5, totalH: 37.5, hasTop: true, hasWheels: false },
          ],
        },
      ]),
    ).toBe('H2x4t_lr.H4x2t_lr "The Long Ranger"');
  });
});
