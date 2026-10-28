// Force dynamic rendering for all dashboard pages
// These pages require authentication and runtime data
export const dynamic = "force-dynamic";

import InstallerActivityTracker from "@/components/tracking/InstallerActivityTracker";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InstallerActivityTracker />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
