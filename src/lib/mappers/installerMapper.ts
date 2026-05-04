import type { AvailabilityResult } from "@/app/actions/customer";
import type { DesignPageViewModel } from "@/types/viewModels";

// ═══════════════════════════════════════════════════════════════════════════
// Installer → DesignPageViewModel Mapper
//
// Single Source of Truth for branding decisions.
// This logic runs on the server (page.tsx) so the raw profile
// never reaches the client. All active installers get their own branding.
// Platform branding is used as fallback when installer data is missing.
// ═══════════════════════════════════════════════════════════════════════════

const PLATFORM_BRANDING = {
  title: "Professional Grade Storage",
  subtitle: "Heavy-duty tote shelving designed, built & installed by certified local pros.",
  logoUrl: "/Header_avatar_logo.png" as string | null,
};

/**
 * Map a raw AvailabilityResult into a DesignPageViewModel.
 * All active installers get their own branding. Platform branding is the fallback.
 */
export function mapToDesignViewModel(
  installer: AvailabilityResult | null
): DesignPageViewModel | null {
  if (!installer || !installer.available || !installer.installer_id) {
    return null;
  }

  const hasCustomBranding = !!(installer.installer_name || installer.installer_logo_url || installer.installer_avatar_url);

  return {
    routing: {
      installerId: installer.installer_id,
      slug: installer.installer_slug,
      stripeAccountId: installer.installer_stripe_id,
      phone: installer.installer_phone,
      leadTime: installer.installer_lead_time,
      workingDays: installer.installer_working_days,
      schedulingEnabled: installer.installer_scheduling_enabled,
    },
    branding: {
      title: hasCustomBranding
        ? (installer.installer_name || "Authorized Installer")
        : PLATFORM_BRANDING.title,
      subtitle: hasCustomBranding
        ? "Authorized Installer"
        : PLATFORM_BRANDING.subtitle,
      logoUrl: hasCustomBranding
        ? (installer.installer_logo_url || installer.installer_avatar_url)
        : PLATFORM_BRANDING.logoUrl,
      isVerified: hasCustomBranding,
    },
    pricing: installer.installer_pricing ?? undefined,
    servicesConfig: installer.installer_services_config ?? undefined,
    socialProof: {
      completedJobs: installer.installer_completed_jobs ?? 0,
      averageRating: 0,
      totalReviews: 0,
    },
    available: true,
    message: installer.message,
  };
}

/**
 * Client-side mapper for ZIP lookup results.
 * Applies the same branding logic.
 */
export function mapAvailabilityToViewModel(
  result: AvailabilityResult
): DesignPageViewModel | null {
  return mapToDesignViewModel(result);
}
