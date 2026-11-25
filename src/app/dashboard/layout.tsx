// Force dynamic rendering for all dashboard pages
// These pages require authentication and runtime data
export const dynamic = "force-dynamic";

import InstallerActivityTracker from "@/components/tracking/InstallerActivityTracker";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { getAuthenticatedUser } from "@/lib/auth";
import { currencyForInstaller } from "@/lib/server/currency-lookup";
import { shouldAutoStartDashboardTour } from "@/lib/server/dashboard-tour";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Everything on an installer's dashboard is in their own currency — CA$
  // for Canadian installers, plain "$" (unchanged) for everyone else.
  const user = await getAuthenticatedUser().catch(() => null);
  const [currency, autoStartTour] = await Promise.all([
    currencyForInstaller(user?.id),
    // The dashboard tour starts on its own once per installer (components/dashboard/tour).
    shouldAutoStartDashboardTour(user?.id),
  ]);

  return (
    <CurrencyProvider currency={currency}>
      <InstallerActivityTracker />
      <DashboardShell autoStartTour={autoStartTour}>{children}</DashboardShell>
    </CurrencyProvider>
  );
}
