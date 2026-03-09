// ═══════════════════════════════════════════════════════════════════════════
// DesignPageViewModel — Strict contract between Server and Client
//
// The server maps the raw installer profile into this view model.
// The client NEVER sees is_pro, business_name, or logo_url directly.
// It only renders what the server explicitly decided to show.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Section Addon Types — Per-bay/per-row addon system ("Organizer Customization")
// ═══════════════════════════════════════════════════════════════════════════

/** Types of addons that can be applied per-section */
export type AddonType = "plywood_door" | "side_panel" | "rail_removed" | "hinge_concealed" | "shelf";

/** A single addon applied to a specific bay/row/side of the unit */
export interface SectionAddon {
  type: AddonType;
  /** Which bay (column index) this applies to, or "left"/"right" for side panels, or "doors_on" for full-unit door toggle */
  target: number | "left" | "right" | "doors_on";
  /** Which row/tier, if applicable (e.g., doors per opening) */
  row?: number;
  /** Optional configuration (e.g., { hingeStyle: "concealed" }) */
  options?: Record<string, string>;
}

/** Available paint color IDs */
export type PaintColorId = "red" | "white" | "black";

/** Paint color definition with hex value and display name */
export interface PaintColorOption {
  id: PaintColorId;
  label: string;
  hex: string;
}

/** The three available paint colors — Chiefs red, standard black, clean white */
export const PAINT_COLORS: PaintColorOption[] = [
  { id: "red",   label: "Red",   hex: "#C8102E" },
  { id: "white", label: "White", hex: "#F5F5F0" },
  { id: "black", label: "Black", hex: "#1C1C1C" },
];

/** Which part of the organizer paint applies to */
export type PaintTarget = "all" | "frame" | "doors_panels";

/** Current paint selection state on the design page */
export interface PaintSelection {
  frameColor: PaintColorId | null;
  doorColor: PaintColorId | null;
  sidePanelColor: PaintColorId | null;
}

/** Installer-level addon pricing overrides (all optional, NULL = platform default) */
export interface AddonPricing {
  plywood_door?: number;          // per door (installer-facing: price per individual door)
  side_panel?: number;            // per side panel
  concealed_hinge_pair?: number;  // per pair of Blum concealed hinges (included in door price for retail)
  rail_removal?: number;          // per rail removed (labor credit or charge)
  shelf?: number;                 // per plywood shelf (3/4" plywood sitting on rails)
  /** Master toggle: when false, the entire Organizer Customization section is hidden */
  organizer_customization_enabled?: boolean;
  /** Per-addon-type toggles: when false, that addon type is hidden */
  plywood_door_enabled?: boolean;
  side_panel_enabled?: boolean;
  hinge_concealed_enabled?: boolean;
  rail_removal_enabled?: boolean;
  shelf_enabled?: boolean;
  /** Paint options — master toggle and per-color pricing */
  paint_enabled?: boolean;
  paint_frame_price?: number;          // price to paint the frame
  paint_doors_panels_price?: number;   // price to paint doors & side panels
}

/** Platform default addon pricing */
export const ADDON_PLATFORM_DEFAULTS: Required<Pick<AddonPricing, "plywood_door" | "side_panel" | "concealed_hinge_pair" | "rail_removal" | "shelf" | "paint_frame_price" | "paint_doors_panels_price">> = {
  plywood_door: 45,               // per door (installer sees this as per-door price)
  side_panel: 55,
  concealed_hinge_pair: 15,       // per pair of Blum concealed hinges
  rail_removal: 0,                // no charge by default (it's a material subtraction)
  shelf: 20,                      // per shelf (3/4" plywood on top of rails)
  paint_frame_price: 75,          // default price to paint the frame
  paint_doors_panels_price: 50,   // default price to paint doors & panels
};

/** Installer-configurable pricing overrides (all optional, NULL = platform default) */
export interface InstallerPricing {
  standard_slot?: number;
  mini_slot?: number;
  standard_tote?: number;
  standard_tote_clear?: number;
  mini_tote?: number;
  standard_wheels?: number;
  mini_wheels?: number;
  plywood_top?: number;
  /** Per-bestseller total-price overrides (frame + tops + totes).
   *  When customer toggles totes off, the tote cost is subtracted.
   *  Key pattern: bestseller_<preset_id_with_underscores> */
  bestseller_indiana_joe?: number;
  bestseller_cornhusker?: number;
  bestseller_long_ranger?: number;
  bestseller_gas_station?: number;
  /** Per-shelving-unit total-price overrides.
   *  Key pattern: shelving_shelf_<width>ft_<height> */
  shelving_shelf_4ft_short?: number;
  shelving_shelf_5ft_short?: number;
  shelving_shelf_6ft_short?: number;
  shelving_shelf_4ft_tall?: number;
  shelving_shelf_5ft_tall?: number;
  shelving_shelf_6ft_tall?: number;
  /** When true, the mini (6.5 qt) unit option is hidden from the installer's design page */
  mini_disabled?: boolean;
  /** When true, the open shelving section is hidden from the installer's design/build pages */
  open_shelving_disabled?: boolean;
  /** Per-bestseller visibility toggles (false = hidden from design/build pages).
   *  Key pattern: bestseller_<preset_id_with_underscores>_disabled */
  bestseller_indiana_joe_disabled?: boolean;
  bestseller_cornhusker_disabled?: boolean;
  bestseller_long_ranger_disabled?: boolean;
  bestseller_gas_station_disabled?: boolean;
  /** Per-section addon pricing & toggle overrides ("Organizer Customization") */
  addon_pricing?: AddonPricing;
}

/** Platform default pricing constants (shared across server actions and client UI) */
export const PLATFORM_DEFAULTS: Omit<Required<InstallerPricing>, "mini_disabled" | "open_shelving_disabled" | "bestseller_indiana_joe_disabled" | "bestseller_cornhusker_disabled" | "bestseller_long_ranger_disabled" | "bestseller_gas_station_disabled" | "addon_pricing" | "bestseller_indiana_joe" | "bestseller_cornhusker" | "bestseller_long_ranger" | "bestseller_gas_station" | "shelving_shelf_4ft_short" | "shelving_shelf_5ft_short" | "shelving_shelf_6ft_short" | "shelving_shelf_4ft_tall" | "shelving_shelf_5ft_tall" | "shelving_shelf_6ft_tall"> = {
  standard_slot: 30,
  mini_slot: 15,
  standard_tote: 12,
  standard_tote_clear: 20,
  mini_tote: 4,
  standard_wheels: 65,
  mini_wheels: 40,
  plywood_top: 95,
};

/** Platform default bestseller prices (total with totes included).
 *  Installer overrides in pricing_config take priority over these. */
export const PLATFORM_BESTSELLER_DEFAULTS: Record<string, number> = {
  bestseller_indiana_joe: 950,
  bestseller_cornhusker: 660,
  bestseller_long_ranger: 715,
  bestseller_gas_station: 840,
};

/** Platform default shelving prices (keyed by shelving config ID with underscores).
 *  Used in PricingSettings for default display and in calculator.ts as fallback. */
export const PLATFORM_SHELVING_DEFAULTS: Record<string, number> = {
  shelving_shelf_4ft_short: 175,
  shelving_shelf_5ft_short: 200,
  shelving_shelf_6ft_short: 225,
  shelving_shelf_4ft_tall: 325,
  shelving_shelf_5ft_tall: 375,
  shelving_shelf_6ft_tall: 425,
};

export interface DesignPageViewModel {
  /** Routing & booking data — needed for lead submission and payments */
  routing: {
    installerId: string;
    stripeAccountId: string | null;
    phone: string | null;
    leadTime: number;
    workingDays: string[];
  };

  /** Display identity — strictly controlled by server-side branding gate */
  branding: {
    title: string;
    subtitle: string;
    logoUrl: string | null;
    isVerified: boolean;
  };

  /** Installer custom pricing (Pro only). Undefined = use platform defaults. */
  pricing?: InstallerPricing;

  /** Installer services config (cleanout pricing, enabled services, etc.) */
  servicesConfig?: Array<{
    id: string;
    name: string;
    description: string;
    price: number | null;
    enabled: boolean;
    built_in: boolean;
  }>;

  /** Availability metadata */
  available: boolean;
  message: string;
}
