export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth";
import { getAdminProfileForReferrals } from "@/app/actions/admin-installer-referrals";
import InstallerReferralClient from "./InstallerReferralClient";

export default async function InstallerReferralsAdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const result = await getAdminProfileForReferrals();
  if (!result.success || !result.profile) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Link
          href="/dashboard/partner"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Partner portal
        </Link>

        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Admin · Installer Referrals
          </p>
          <h1 className="text-3xl font-black sm:text-4xl">
            Generate Referral Links
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Generate a personalised booking link for any installer so they can refer
            rack-build jobs to you. When a customer books through their link, the
            installer earns the standard 30% network bounty (min $15) — no extra
            configuration needed.
          </p>
        </div>

        <InstallerReferralClient adminProfile={result.profile} />
      </div>
    </div>
  );
}
