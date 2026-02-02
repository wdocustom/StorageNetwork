// ═══════════════════════════════════════════════════════════════════════════
// DesignPageViewModel — Strict contract between Server and Client
//
// The server maps the raw installer profile into this view model.
// The client NEVER sees is_pro, business_name, or logo_url directly.
// It only renders what the server explicitly decided to show.
// ═══════════════════════════════════════════════════════════════════════════

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

  /** Availability metadata */
  available: boolean;
  message: string;
}
