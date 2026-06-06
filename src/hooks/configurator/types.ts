import type { UnitType, Orientation } from "@/app/actions/calculator";
import type { SectionAddon, PaintColorId } from "@/types/viewModels";
import type { RaisedBedConfig } from "@/lib/raised-beds";

export type ToteType = "HDX" | "GM";
export type ToteColor = "black" | "clear";

export interface UnitConfig {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  desc: string;
  addons: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  shelvingConfigId?: string;
  overheadStorageConfig?: import("@/lib/overhead-storage").OverheadStorageConfig;
  presetUnits?: import("@/lib/buildEngine.types").PresetSubUnitConfig[];
  raisedBedConfig?: RaisedBedConfig;
  drawerSlideRows?: number;
  drawerSlideColumns?: number[];
  quantity?: number;
  indoorDelivery?: boolean;
  indoorDeliveryFee?: number;
}

export interface ServerBuild {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  slots: number;
  unitType: UnitType;
  orientation: Orientation;
}

export interface SavedSignalData {
  quoteData: unknown[] | null;
  sourceInstallerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

export interface DesignConfiguratorProps {
  initialData: import("@/types/viewModels").DesignPageViewModel | null;
  initialZip: string;
  mode: string;
  isDemo?: boolean;
  leadSource?: "platform" | "partner_link" | "facebook_referral";
  parentLeadId?: string;
  savedSignal?: SavedSignalData;
  initialInstallerAtCapacity?: boolean;
  initialConfig?: Record<string, unknown> | null;
}
