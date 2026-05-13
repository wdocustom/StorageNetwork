// ═══════════════════════════════════════════════════════════════════════════
// Realtor Portal — Authenticated Route Group Layout
//
// Every page rendered under app/realtors/(authed)/* is gated on
// profiles.is_realtor = true. Non-realtors are bounced:
//   - signed out → /realtors/join
//   - signed in but not a realtor → /dashboard (installer portal)
//
// /realtors/join sits OUTSIDE this group, so the public signup remains
// reachable while logged out.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";

export default async function RealtorAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/realtors/join");
  }

  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_realtor")
    .eq("id", user.id)
    .single();

  if (!profile?.is_realtor) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
