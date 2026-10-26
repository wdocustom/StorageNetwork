import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/diy-plan-checkout", () => ({ checkDIYPlanAccess: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
import { designerPlanTranslation } from "./ConfiguratorFooter";
import { encodeTotePlanDesign } from "@/lib/tote-plans";
import type { ConfiguratorSidebarProps } from "./configurator-types";

// Only the fields designerPlanTranslation reads
const base = {
  orderItems: [],
  chairSelected: false,
  shelvingConfigId: undefined,
  raisedBedPreviewPrice: null,
  activePreset: null,
  compoundBuild: null,
  activePresetObj: null,
  presetOptions: [],
  build: { cols: 6, rows: 6 },
  toteType: "HDX",
  unitType: "standard",
  orientation: "standard",
  hasWheels: false,
  effectiveHasTop: true,
} as unknown as ConfiguratorSidebarProps;

const code = (props: Partial<ConfiguratorSidebarProps>, step = 3) => {
  const { design } = designerPlanTranslation({ ...base, ...props } as ConfiguratorSidebarProps, step);
  return design ? `${encodeTotePlanDesign(design)}${design.name ? ` "${design.name}"` : ""}` : null;
};

describe("designer → DIY plans", () => {
  it("translates the unit on screen when the cart is empty", () => {
    expect(code({})).toBe("H6x6t");
  });

  it("translates the bestseller on screen with its name and per-unit options", () => {
    expect(
      code({
        activePreset: "long-ranger",
        presetOptions: [{ id: "long-ranger", name: "The Long Ranger", units: [], toteModel: "HDX" }],
        compoundBuild: {
          totalPrice: 900,
          presetName: "The Long Ranger",
          subUnits: [
            { cols: 2, rows: 4, slots: 8, totalW: 44, totalH: 69.5 },
            { cols: 4, rows: 2, slots: 8, totalW: 86.5, totalH: 37.5 },
          ],
        },
        activePresetObj: {
          name: "The Long Ranger",
          toteColor: "black",
          units: [
            { hasTop: true, hasWheels: false },
            { hasTop: true, hasWheels: false },
          ],
        },
      } as Partial<ConfiguratorSidebarProps>),
    ).toBe('H2x4t_lr.H4x2t_lr "The Long Ranger"');
  });

  it("translates the whole cart once there is one", () => {
    expect(
      code(
        {
          orderItems: [
            { cols: 4, rows: 4, toteType: "GM", unitType: "standard", orientation: "standard", hasWheels: true, hasTop: false, desc: "Standard: 4W × 4H", quantity: 2 },
            { cols: 0, rows: 0, toteType: "HDX", unitType: "standard", orientation: "standard", hasWheels: false, hasTop: false, desc: "Shelf", shelvingConfigId: "shelf-48" },
          ],
        } as unknown as Partial<ConfiguratorSidebarProps>,
        4,
      ),
    ).toBe("G4x4w.G4x4w");
  });

  it("offers nothing for a chair", () => {
    expect(code({ chairSelected: true })).toBeNull();
  });
});
