import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { listReferralPartners } from "@/app/actions/referral-partners";
import PageHeader from "@/components/dashboard/PageHeader";
import ReferralPartnersClient from "./ReferralPartnersClient";

// Referral partners — businesses that send this installer customers for a cut
// (migration 168). Lives under More → Grow.
export default async function ReferralPartnersPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?redirect=/dashboard/referral-partners");
  const res = await listReferralPartners();

  return (
    <div className="min-h-screen bg-slate-950">
      <PageHeader title="Referral partners" subtitle="Partners send you customers. You set their cut and the discount." back="/dashboard/more" />
      <main className="px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {res.ok ? (
            <ReferralPartnersClient initialPartners={res.partners} />
          ) : (
            <p className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-stone-400">{res.error}</p>
          )}
        </div>
      </main>
    </div>
  );
}
