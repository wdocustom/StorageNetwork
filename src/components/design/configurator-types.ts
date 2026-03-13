import type { LucideIcon } from "lucide-react";
import { Ruler, Settings2, Palette, ShoppingCart } from "lucide-react";
import type { SectionAddon, AddonPricing, PaintColorId } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type ToteType = "HDX" | "GM";
export type ToteColor = "black" | "clear";
export type UnitType = "standard" | "mini";
export type Orientation = "standard" | "sideways";

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
  /** When set, this order item is an open shelving unit (not a tote organizer) */
  shelvingConfigId?: string;
  /** When set, this order item is an overhead ceiling storage unit */
  overheadStorageConfig?: import("@/lib/overhead-storage").OverheadStorageConfig;
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

// ═══════════════════════════════════════════════════════════════════════════
// Props — Everything the parent DesignConfigurator passes in
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfiguratorSidebarProps {
  // Step 1: Dimensions
  wallWidth: string;
  wallHeight: string;
  onWallWidthChange: (v: string) => void;
  onWallHeightChange: (v: string) => void;
  onWallFit: () => void;
  wallFitMsg: string;
  buildLoading: boolean;
  cols: number | string;
  rows: number | string;
  onColsChange: (v: number | string) => void;
  onRowsChange: (v: number | string) => void;

  // Step 2: Configuration
  unitType: UnitType;
  orientation: Orientation;
  onUnitTypeChange: (v: UnitType) => void;
  onOrientationChange: (v: Orientation) => void;
  toteType: ToteType;
  toteColor: ToteColor;
  onToteTypeChange: (v: ToteType) => void;
  onToteColorChange: (v: ToteColor) => void;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  onHasTotesChange: (v: boolean) => void;
  onHasWheelsChange: (v: boolean) => void;
  onHasTopChange: (v: boolean) => void;
  effectiveHasTop: boolean;
  miniDisabled?: boolean;

  // Pricing info for toggle labels
  pricing?: {
    standard_tote?: number;
    standard_tote_clear?: number;
    standard_wheels?: number;
    mini_tote?: number;
    mini_wheels?: number;
    plywood_top?: number;
    mini_disabled?: boolean;
  };
  platformDefaults: {
    standard_tote: number;
    standard_tote_clear: number;
    standard_wheels: number;
    mini_tote: number;
    mini_wheels: number;
    plywood_top: number;
  };

  // Build result
  build: ServerBuild;
  onAddUnit: () => void;

  // Preset
  activePreset: string | null;
  onPresetChange: (v: string | null) => void;
  presetOptions: Array<{
    id: string;
    name: string;
    units: Array<{ cols: number; rows: number; hasTop: boolean; hasWheels: boolean }>;
    toteColor?: string;
    toteModel?: string;
  }>;
  compoundBuild: {
    totalPrice: number;
    presetName: string;
    subUnits: Array<{ cols: number; rows: number; slots: number; totalW: number; totalH: number }>;
  } | null;
  presetLoading: boolean;
  presetTotes: boolean;
  onPresetTotesChange: (v: boolean) => void;
  onAddPresetUnit: () => void;
  activePresetObj: {
    name: string;
    toteColor: string;
    units: Array<{ hasTop: boolean; hasWheels: boolean }>;
  } | null;

  // Step 4: Summary / Quote
  orderItems: UnitConfig[];
  onRemoveUnit: (index: number) => void;
  grandTotal: number;
  deliveryFeeAmount: number;
  deliveryFeeResult: { applicable: boolean; fee: number; distance?: number } | null;
  depositAmount: number;
  depositLabelText: string;
  stripeAccountId: string | null;

  // Booking form
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;

  // Address
  streetAddress: string;
  city: string;
  addrState: string;
  addrZip: string;
  onStreetAddressChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onAddrStateChange: (v: string) => void;
  onAddrZipChange: (v: string) => void;

  // Delivery address
  hasDifferentDelivery: boolean;
  onHasDifferentDeliveryChange: (v: boolean) => void;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  onDeliveryStreetChange: (v: string) => void;
  onDeliveryCityChange: (v: string) => void;
  onDeliveryStateChange: (v: string) => void;
  onDeliveryZipChange: (v: string) => void;

  // Submit / Booking
  submitting: boolean;
  submitted: boolean;
  submitError: string;
  onBookDeposit: () => void;
  isDemo: boolean;
  onDemoToast: () => void;

  // ZIP check (for local pro)
  zip: string;
  onZipChange: (v: string) => void;
  onZipCheck: () => void;
  zipChecking: boolean;
  zipResult: { available: boolean; message?: string } | null;
  onZipResultClear: () => void;
  installerLocked: boolean;

  // Out of area / waitlist
  zipOutOfArea: boolean;
  zipCheckMsg: string;
  handedOff: boolean;
  handoffInstallerName: string;
  waitlistSending: boolean;
  waitlistSent: boolean;
  waitlistError: string;
  onWaitlist: () => void;

  // Installer services (cleanout upsell — adds to order)
  servicesConfig?: Array<{
    id: string;
    name: string;
    description: string;
    price: number | null;
    enabled: boolean;
    built_in: boolean;
  }>;
  selectedCleanout: string | null;
  onCleanoutChange: (serviceId: string | null) => void;

  // Contact installer
  installerId: string;
  brandingTitle: string;
  showContactForm: boolean;
  onShowContactFormChange: (v: boolean) => void;
  contactMessage: string;
  onContactMessageChange: (v: string) => void;
  contactSending: boolean;
  contactSent: boolean;
  contactError: string;
  onContactInstaller: () => void;

  // Scheduler (inline in sidebar)
  scheduledDate: string | null;
  onScheduledDateChange: (date: string) => void;
  installerLeadTime: number;
  installerWorkingDays: string[];
  blackoutDates: { start_date: string; end_date: string }[];

  // Discount code (inline in sidebar)
  discountInput: string;
  onDiscountInputChange: (v: string) => void;
  discountApplied: { code: string; amount: number; discountType?: "fixed" | "percentage"; discountValue?: number } | null;
  discountLoading: boolean;
  discountError: string;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;

  // Organizer Customization (per-section addons)
  addons: SectionAddon[];
  onAddonsChange: (addons: SectionAddon[]) => void;
  addonPricing?: AddonPricing;

  // Paint options
  paintFrameColor: PaintColorId | null;
  paintDoorColor: PaintColorId | null;
  paintSidePanelColor: PaintColorId | null;
  onPaintFrameColorChange: (c: PaintColorId | null) => void;
  onPaintDoorColorChange: (c: PaintColorId | null) => void;
  onPaintSidePanelColorChange: (c: PaintColorId | null) => void;

  // Open Shelving add-on
  shelvingConfigId: string | null;
  onShelvingConfigChange: (id: string | null) => void;
  shelvingPrice: number | null;
  shelvingLoading: boolean;
  onAddShelvingUnit: () => void;
  /** When true, the open shelving section is hidden */
  shelvingHidden?: boolean;

  // Overhead Ceiling Storage
  /** When true, the overhead storage section is hidden */
  overheadStorageHidden?: boolean;
  onAddOverheadUnit: (result: import("@/lib/overhead-storage").OverheadStorageResult, config: import("@/lib/overhead-storage").OverheadStorageConfig) => void;
  onOverheadConfigPreview?: (preview: { slotsWide: number; slotsDeep: number; toteType: import("@/lib/overhead-storage").OverheadToteType } | null) => void;

  // Multi-unit 3D visualization
  showMultiUnit3D: boolean;
  onShowMultiUnit3DChange: (v: boolean) => void;
  unitVisibility: Record<number, boolean>;
  onUnitVisibilityChange: (index: number, visible: boolean) => void;
  onToggleAllUnits: (visible: boolean) => void;

  // Pulse trigger — called after "Find Max" updates inputs
  // UI_TRIGGER: When this fires, the 3D model should animate/highlight
  // to draw attention to the updated configuration.
  onPulseVisualizerTrigger?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Steps Definition
// ═══════════════════════════════════════════════════════════════════════════

export const STEPS: readonly { id: number; label: string; icon: LucideIcon }[] = [
  { id: 1, label: "Size / Base", icon: Ruler },
  { id: 2, label: "Tote Configuration", icon: Settings2 },
  { id: 3, label: "Add-ons", icon: Palette },
  { id: 4, label: "Summary", icon: ShoppingCart },
] as const;
