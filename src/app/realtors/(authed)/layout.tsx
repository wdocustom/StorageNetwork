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
import { RealtorPortalHeader } from "./RealtorPortalHeader";

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
    .select("is_realtor, is_pro, stripe_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.is_realtor) {
    redirect("/dashboard");
  }

  // Dual-role detection: a user has an installer side if they're currently
  // on Pro OR have ever set up Stripe payouts. Lapsed-Pro installers (no
  // sub, never connected Stripe) intentionally won't see the switcher — for
  // them /dashboard would just prompt them to onboard again, which isn't
  // useful from a "switch portals" affordance.
  const hasInstallerSide = Boolean(profile.is_pro || profile.stripe_account_id);

  return (
    <>
      <RealtorPortalHeader hasInstallerSide={hasInstallerSide} />
      {children}
    </>
  );
}
