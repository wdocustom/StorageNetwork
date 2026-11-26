import Link from "next/link";
import { redirect } from "next/navigation";
import { getPartnerPortal } from "@/app/actions/partner-portal";
import PartnerShell from "./PartnerShell";
import PartnerPortalClient from "./PartnerPortalClient";

export const dynamic = "force-dynamic";

// The referral partner's dashboard (migration 168). Only reachable once an
// installer has turned portal access on for them.
export default async function PartnerPortalPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const res = await getPartnerPortal();
  if (!res.ok && res.error === "signed_out") redirect("/partners/login");
  if (!res.ok) {
    return (
      <PartnerShell title="No partner access" subtitle="This login doesn't have a partner dashboard right now. Ask the installer you work with to turn on portal access for your email.">
        <Link href="/partners/login" className="block text-center text-xs font-semibold text-stone-400 hover:text-white">
          Use a different login
        </Link>
      </PartnerShell>
    );
  }
  const stripeParam = (await searchParams).stripe;
  return <PartnerPortalClient data={res.data} stripeReturn={stripeParam === "return"} />;
}
