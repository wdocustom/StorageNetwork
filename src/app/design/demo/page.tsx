import type { Metadata } from "next";
import DesignConfigurator from "../DesignConfigurator";
import type { AvailabilityResult } from "@/app/actions/customer";

export const metadata: Metadata = {
  title: "Demo — The Storage Network Configurator",
  robots: { index: false, follow: false },
};

/**
 * Hidden demo page at /design/demo
 *
 * Shows the full 3D configurator with platform branding.
 * Payment is intercepted — no Stripe calls, no database writes.
 */
export default function DemoPage() {
  const platformProfile: AvailabilityResult = {
    available: true,
    installer_id: "demo-platform",
    installer_name: "The Storage Network",
    installer_stripe_id: "demo_stripe_placeholder",
    installer_avatar_url: null,
    installer_phone: null,
    installer_lead_time: 5,
    installer_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    installer_is_pro: true,
    installer_logo_url: "/logo-storage-network.png",
    message: "Demo mode — The Storage Network",
  };

  return (
    <DesignConfigurator
      initialInstaller={platformProfile}
      initialZip=""
      mode=""
      isDemo
    />
  );
}
