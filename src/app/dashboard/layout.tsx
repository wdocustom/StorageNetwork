// Force dynamic rendering for all dashboard pages
// These pages require authentication and runtime data
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
