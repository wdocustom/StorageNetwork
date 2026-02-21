import type { AvailabilityResult } from "@/app/actions/customer";
import type { DesignPageViewModel } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Installer → DesignPageViewModel Mapper
//
// Single Source of Truth for branding decisions.
// This logic runs on the server (page.tsx) so the raw profile
// never reaches the client. Free installers always get platform branding.
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_BRANDING = {
  title: "Professional Grade Storage",
  subtitle: "Heavy-duty tote shelving designed, built & installed by certified local pros.",
  logoUrl: "/Header_avatar_logo.png" as string | null,
};

/**
 * Map a raw AvailabilityResult into a DesignPageViewModel.
 * Branding is gated by is_pro — Free installers get platform identity.
 */
export function mapToDesignViewModel(
  installer: AvailabilityResult | null
): DesignPageViewModel | null {
  if (!installer || !installer.available || !installer.installer_id) {
    return null;
  }

  const hasBrandingRights = installer.installer_is_pro === true;

  return {
    routing: {
      installerId: installer.installer_id,
      stripeAccountId: installer.installer_stripe_id,
      phone: installer.installer_phone,
      leadTime: installer.installer_lead_time,
      workingDays: installer.installer_working_days,
    },
    branding: {
      title: hasBrandingRights
        ? (installer.installer_name || "Authorized Installer")
        : PLATFORM_BRANDING.title,
      subtitle: hasBrandingRights
        ? "Authorized Installer"
        : PLATFORM_BRANDING.subtitle,
      logoUrl: hasBrandingRights
        ? (installer.installer_logo_url || installer.installer_avatar_url)
        : PLATFORM_BRANDING.logoUrl,
      isVerified: hasBrandingRights,
    },
    // Custom pricing applies to all installers who have set it (not gated by Pro)
    pricing: installer.installer_pricing ?? undefined,
    available: true,
    message: installer.message,
  };
}

/**
 * Client-side mapper for ZIP lookup results.
 * Applies the same branding gate so client-resolved installers
 * also get platform branding if not Pro.
 */
export function mapAvailabilityToViewModel(
  result: AvailabilityResult
): DesignPageViewModel | null {
  return mapToDesignViewModel(result);
}
