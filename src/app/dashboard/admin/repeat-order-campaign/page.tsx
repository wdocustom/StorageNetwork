export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth";
import { isRepeatOrderCampaignAdmin } from "@/app/actions/admin-repeat-order-campaign";
import CampaignClient from "./CampaignClient";

export default async function RepeatOrderCampaignAdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!(await isRepeatOrderCampaignAdmin())) redirect("/dashboard");

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
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          Admin · Marketing
        </p>
        <h1 className="text-3xl font-black sm:text-4xl">Repeat-Order Email</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-400">
          One-time email to past paying customers, pointing them back at their installer.
          Orders from it are billed as network leads. Run a dry run first, then a test to
          yourself, then send in small batches.
        </p>
        <CampaignClient />
      </div>
    </div>
  );
}
