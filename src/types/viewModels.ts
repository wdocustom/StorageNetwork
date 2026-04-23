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

// ADDON_PLATFORM_DEFAULTS moved to src/app/actions/platform-defaults.ts (server-only)

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
  bestseller_long_ranger?: number;
  bestseller_gas_station?: number;
  bestseller_track_norris?: number;
  bestseller_rack_city_roller?: number;
  bestseller_mayor_of_rack_city?: number;
  /** Per-shelving-unit total-price overrides.
   *  Key pattern: shelving_shelf_<width>ft_<height> */
  shelving_shelf_4ft_short?: number;
  shelving_shelf_5ft_short?: number;
  shelving_shelf_6ft_short?: number;
  shelving_shelf_4ft_tall?: number;
  shelving_shelf_5ft_tall?: number;
  shelving_shelf_6ft_tall?: number;
  /** When true, totes are globally disabled for this installer — frame-only builds.
   *  Hides tote toggles, tote color, tote size, and tote pricing everywhere. */
  totes_disabled?: boolean;
  /** @deprecated Use mini_enabled instead */
  mini_disabled?: boolean;
  /** When true, the mini (6.5 qt) unit option is shown on the installer's design page (default: off) */
  mini_enabled?: boolean;
  /** @deprecated Use open_shelving_enabled instead */
  open_shelving_disabled?: boolean;
  /** When true, the open shelving section is shown on the installer's design/build pages (default: off) */
  open_shelving_enabled?: boolean;
  /** Per-bestseller visibility toggles (false = hidden from design/build pages).
   *  Key pattern: bestseller_<preset_id_with_underscores>_disabled */
  bestseller_indiana_joe_disabled?: boolean;
  bestseller_long_ranger_disabled?: boolean;
  bestseller_gas_station_disabled?: boolean;
  bestseller_track_norris_disabled?: boolean;
  bestseller_rack_city_roller_disabled?: boolean;
  bestseller_mayor_of_rack_city_disabled?: boolean;
  /** Per-section addon pricing & toggle overrides ("Organizer Customization") */
  addon_pricing?: AddonPricing;
  /** When true, the overhead ceiling storage section is shown on the installer's design page (default: off) */
  overhead_storage_enabled?: boolean;
  /** When true, raised bed planters are shown on the installer's design page (default: off) */
  raised_bed_enabled?: boolean;
  /** When true, builds use ripped 2x4 rails instead of plywood strips.
   *  Openings are 21" universal (tote type irrelevant). Max 5 rows.
   *  Rail heights: 13-3/4", 29-1/2", 45-1/4", 61", 76-3/4".
   *  Also implies totes_disabled behavior (frame-only, universal fit). */
  use_2x4_rails?: boolean;
  /** Per-overhead-grid total-price overrides (ceiling tote rail system).
   *  Key pattern: overhead_<slotsWide>x<slotsDeep> */
  overhead_2x2?: number;
  overhead_2x3?: number;
  overhead_3x2?: number;
  overhead_3x3?: number;
  overhead_3x4?: number;
  overhead_4x4?: number;
  /** Per-raised-bed base price overrides.
   *  Key pattern: raised_bed_<sizeId> */
  raised_bed_legs_18x18x16?: number;
  raised_bed_legs_12x48x16?: number;
  raised_bed_legs_24x48x16?: number;
  raised_bed_legs_24x48x30?: number;
  raised_bed_legs_24x72x16?: number;
  raised_bed_legs_24x24x16_post?: number;
  raised_bed_ground_18x72x22?: number;
  raised_bed_ground_24x72x11?: number;
  raised_bed_ground_24x72x22?: number;
  raised_bed_ground_36x72x22?: number;
  raised_bed_ground_48x48x22?: number;
  /** Raised bed addon overrides */
  raised_bed_stain_addon?: number;
  raised_bed_liner_addon?: number;
  raised_bed_paint_white_addon?: number;
  raised_bed_depth_increase_addon?: number;
  raised_bed_bottom_shelf_addon?: number;
  /** Post + hardware add-on overrides */
  raised_bed_post_72_addon?: number;
  raised_bed_post_84_addon?: number;
  raised_bed_post_96_addon?: number;
  raised_bed_hook_addon?: number;
  raised_bed_high_wind_weighted_addon?: number;
}

// All platform pricing constants moved to src/app/actions/platform-defaults.ts (server-only)
// They are injected into DesignPageViewModel at runtime by the server component.

export interface DesignPageViewModel {
  /** Routing & booking data — needed for lead submission and payments */
  routing: {
    installerId: string;
    slug: string | null;
    stripeAccountId: string | null;
    phone: string | null;
    leadTime: number;
    workingDays: string[];
    schedulingEnabled: boolean;
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

  /** Platform default pricing — populated server-side, never hardcoded in client bundle */
  platformDefaults?: {
    standard_slot: number;
    mini_slot: number;
    standard_tote: number;
    standard_tote_clear: number;
    mini_tote: number;
    standard_wheels: number;
    mini_wheels: number;
    plywood_top: number;
  };

  /** Platform addon defaults — populated server-side */
  addonDefaults?: {
    plywood_door: number;
    side_panel: number;
    concealed_hinge_pair: number;
    rail_removal: number;
    shelf: number;
    paint_frame_price: number;
    paint_doors_panels_price: number;
  };

  /** Installer services config (cleanout pricing, enabled services, etc.) */
  servicesConfig?: Array<{
    id: string;
    name: string;
    description: string;
    price: number | null;
    enabled: boolean;
    built_in: boolean;
  }>;

  /** Indoor delivery fee config — per-item fee for in-home delivery */
  indoorDeliveryConfig?: {
    enabled: boolean;
    fee: number;
  };

  /** Availability metadata */
  available: boolean;
  message: string;
}
