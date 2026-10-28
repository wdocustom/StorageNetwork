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
  /** When set, this order item is a raised bed planter */
  raisedBedConfig?: import("@/lib/raised-beds").RaisedBedConfig;
  /** When set, this order item is a compound bestseller (e.g. Indiana Joe) */
  presetUnits?: import("@/lib/buildEngine.types").PresetSubUnitConfig[];
  /** When set, this order item is an Adirondack chair */
  chairConfig?: import("@/lib/chairs").ChairConfig;
  /** Quantity of this item (defaults to 1) */
  quantity?: number;
  /** When true, customer wants this item delivered inside the home */
  indoorDelivery?: boolean;
  /** The indoor delivery fee charged for this item (in dollars) */
  indoorDeliveryFee?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Props — Everything the parent DesignConfigurator passes in
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfiguratorSidebarProps {
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

  // Step 4: Summary / Quote
  orderItems: UnitConfig[];
  onRemoveUnit: (index: number) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  grandTotal: number;
  deliveryFeeAmount: number;
  depositAmount: number;
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
  schedulingEnabled: boolean;
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
  addonPricing?: AddonPricing;
  addonDefaults?: { plywood_door: number; side_panel: number; concealed_hinge_pair: number; rail_removal: number; shelf: number; paint_frame_price: number; paint_doors_panels_price: number };

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
  onOverheadConfigPreview?: (preview: { slotsWide: number; slotsDeep: number; toteType: import("@/lib/overhead-storage").OverheadToteType; hasTotes: boolean } | null) => void;

  // Raised Bed Planters
  raisedBedHidden?: boolean;
  onRaisedBedPriceChange?: (price: number | null) => void;
  onAddRaisedBed: (config: import("@/lib/raised-beds").RaisedBedConfig, price: number, desc: string) => void;
  onRaisedBedPreview?: (preview: { widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean; groundClearance: number; pestCover: string; finish: string; hasStringLightPost?: boolean; postHeightIn?: number } | null) => void;

  // Adirondack Chair
  chairHidden?: boolean;
  /** When true, the chair is the active product being configured */
  chairSelected?: boolean;
  /** Called when user clicks the chair tile in Step 1 */
  onChairSelect?: () => void;
  /** Chair finish being configured (for Step 3 UI) */
  chairFinish?: import("@/lib/chairs").ChairFinish;
  onChairFinishChange?: (finish: import("@/lib/chairs").ChairFinish) => void;
  /** Chair quantity being configured */
  chairQuantity?: number;
  onChairQuantityChange?: (qty: number) => void;
  chairPreviewPrice?: number | null;
  onChairPriceChange?: (price: number | null) => void;
  onAddChair: (config: import("@/lib/chairs").ChairConfig, price: number, desc: string) => void;
  onChairPreview?: (preview: { finish: string } | null) => void;
  /** Installer pricing for chair calculations */
  chairInstallerPricing?: Record<string, unknown>;

  // Trial cap waitlist (installer at 3-job limit — "hostage lead")
  installerAtCapacity: boolean;
  trialCapWaitlistSending: boolean;
  trialCapWaitlistSent: boolean;
  trialCapWaitlistError: string;
  onJoinTrialCapWaitlist: () => void;
}
