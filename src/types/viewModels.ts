// ═══════════════════════════════════════════════════════════════════════════
// DesignPageViewModel — Strict contract between Server and Client
//
// The server maps the raw installer profile into this view model.
// The client NEVER sees is_pro, business_name, or logo_url directly.
// It only renders what the server explicitly decided to show.
// ═══════════════════════════════════════════════════════════════════════════

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
  /** When true, the mini (6.5 qt) unit option is hidden from the installer's design page */
  mini_disabled?: boolean;
}

/** Platform default pricing constants (shared across server actions and client UI) */
export const PLATFORM_DEFAULTS: Omit<Required<InstallerPricing>, "mini_disabled" | "bestseller_indiana_joe" | "bestseller_cornhusker" | "bestseller_long_ranger"> = {
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
