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
  /** Per-bestseller base-price overrides (frame + tops, BEFORE totes).
   *  Key pattern: bestseller_<preset_id_with_underscores>
   *  e.g. bestseller_indiana_joe, bestseller_cornhusker */
  bestseller_indiana_joe?: number;
  bestseller_cornhusker?: number;
  /** When true, the mini (6.5 qt) unit option is hidden from the installer's design page */
  mini_disabled?: boolean;
}

/** Platform default pricing constants (shared across server actions and client UI) */
export const PLATFORM_DEFAULTS: Omit<Required<InstallerPricing>, "mini_disabled" | "bestseller_indiana_joe" | "bestseller_cornhusker"> = {
  standard_slot: 30,
  mini_slot: 15,
  standard_tote: 12,
  standard_tote_clear: 20,
  mini_tote: 4,
  standard_wheels: 65,
  mini_wheels: 40,
  plywood_top: 95,
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

  /** Availability metadata */
  available: boolean;
  message: string;
}
