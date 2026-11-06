// Force dynamic rendering for all dashboard pages
// These pages require authentication and runtime data
export const dynamic = "force-dynamic";

import InstallerActivityTracker from "@/components/tracking/InstallerActivityTracker";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { getAuthenticatedUser } from "@/lib/auth";
import { currencyForInstaller } from "@/lib/server/currency-lookup";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Everything on an installer's dashboard is in their own currency — CA$
  // for Canadian installers, plain "$" (unchanged) for everyone else.
  const user = await getAuthenticatedUser().catch(() => null);
  const currency = await currencyForInstaller(user?.id);

  return (
    <CurrencyProvider currency={currency}>
      <InstallerActivityTracker />
      <DashboardShell>{children}</DashboardShell>
    </CurrencyProvider>
  );
}
