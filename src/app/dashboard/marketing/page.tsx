import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadMarketing } from "@/lib/server/marketing";
import { getAppUrl, getInstallerLink } from "@/lib/utils";
import MarketingView from "./MarketingView";

// Marketing — loads the profile, the open quotes to close and recent jobs to
// post about in one parallel pass on the server.

export default async function MarketingPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { profile, quotes, jobs } = await loadMarketing(user.id);
  const p = profile ?? {
    id: user.id,
    slug: null,
    is_pro: true,
    is_admin: false,
    city: null,
    state: null,
    service_zip: null,
    business_name: null,
    first_name: null,
  };

  return (
    <MarketingView
      profile={p}
      bookingLink={getInstallerLink({ id: p.id, slug: p.slug, is_pro: true })}
      baseUrl={getAppUrl()}
      quotes={quotes}
      jobs={jobs}
    />
  );
}
