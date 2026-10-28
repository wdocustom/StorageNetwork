import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getManualServiceZips } from "@/app/actions/territory";
import { getMyAffiliateStatus } from "@/app/actions/affiliate-program";
import { getMyPromoterStatus } from "@/app/actions/promoter-program";
import { getStripeStatus } from "@/app/actions/stripe-connect";
import SettingsView, { type Profile, type StripeStatus } from "./SettingsView";
import { SETTINGS_PROFILE_COLUMNS } from "./columns";

// Settings — everything but the live Stripe check loads here in one parallel
// pass. The Stripe check (a Stripe API round trip) starts now but isn't
// awaited: it streams to the page when it lands, so it never holds the form.

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?redirect=/dashboard/profile");

  const stripeStatus: Promise<StripeStatus> = getStripeStatus().catch(() => ({
    connected: false,
    details_submitted: false,
    charges_enabled: false,
    error: "Failed to check Stripe status",
  }));

  const [profileRes, manualZips, affiliate, promoter] = await Promise.all([
    getServiceClient().from("profiles").select(SETTINGS_PROFILE_COLUMNS).eq("id", user.id).single(),
    getManualServiceZips(user.id).catch(() => []),
    getMyAffiliateStatus().catch(() => ({ application: null, isPartner: false, hasAgreement: false })),
    getMyPromoterStatus().catch(() => ({ application: null, isPromoter: false, hasAgreement: false })),
  ]);

  if (!profileRes.data) {
    console.error("[Settings] profile:", profileRes.error?.message);
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-sm text-red-400">
        Couldn&apos;t load your settings. Please refresh the page.
      </div>
    );
  }

  return (
    <SettingsView
      initial={{ profile: profileRes.data as unknown as Profile, manualZips, affiliate, promoter }}
      stripeStatus={stripeStatus}
    />
  );
}
