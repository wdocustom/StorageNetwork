import type { RaisedBedConfig } from "@/lib/raised-beds";
import type { SectionAddon, PaintColorId } from "@/types/viewModels";

export type ToteType = "HDX" | "GM";
export type UnitTypeOption = "standard" | "mini";
export type InputMode = "wallFit" | "custom";

/**
 * Unit configuration for multi-unit quotes on the build page.
 *
 * NOTE: This is intentionally distinct from the `UnitConfig` in
 * `@/components/design/configurator-types` — the build page carries
 * its own shape (id, presetName, presetGroup, slots, overheadGridPresetId).
 */
export interface UnitConfig {
  id: string;
  cols: number;
  rows: number;
  toteType: ToteType;
  unitType: UnitTypeOption;
  orientation?: "standard" | "sideways";
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price?: number;
  totalW?: number;
  totalH?: number;
  depth?: number;
  slots?: number;
  presetName?: string;
  desc?: string;
  presetGroup?: string;
  shelvingConfigId?: string;
  overheadGridPresetId?: string;
  raisedBedConfig?: RaisedBedConfig;
  quantity?: number;
  addons?: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  indoorDelivery?: boolean;
  indoorDeliveryFee?: number;
}

export interface BuildResultData {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  slots: number;
  unitType: "standard" | "mini";
  orientation: "standard" | "sideways";
}
