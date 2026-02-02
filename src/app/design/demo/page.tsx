import type { Metadata } from "next";
import DesignConfigurator from "../DesignConfigurator";
import type { DesignPageViewModel } from "@/types/viewModels";

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
  const demoViewModel: DesignPageViewModel = {
    routing: {
      installerId: "demo-platform",
      stripeAccountId: "demo_stripe_placeholder",
      phone: null,
      leadTime: 5,
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    branding: {
      title: "Professional Grade Storage",
      subtitle: "Heavy-duty tote shelving designed, built & installed by certified local pros.",
      logoUrl: null,
      isVerified: false,
    },
    available: true,
    message: "Demo mode — The Storage Network",
  };

  return (
    <DesignConfigurator
      initialData={demoViewModel}
      initialZip=""
      mode=""
      isDemo
    />
  );
}
