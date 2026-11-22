// ═══════════════════════════════════════════════════════════════════════════
// Admin → DIY plan reviews. Held (1–3★) reviews wait here for approval;
// publish, hide, or reply publicly as Storage Network.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import PlanReviewsAdmin from "./PlanReviewsAdmin";

export default async function PlanReviewsAdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const { data: me } = await getServiceClient().from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/dashboard/platform-analytics"
          className="mb-6 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Platform analytics
        </Link>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">Admin · Plans</p>
        <h1 className="text-3xl font-black">Plan reviews</h1>
        <p className="mt-2 text-sm text-stone-400">
          4–5★ reviews go live on their own. 1–3★ wait here (you get an email) so you can help the buyer first.
        </p>
        <div className="mt-8">
          <PlanReviewsAdmin />
        </div>
      </div>
    </div>
  );
}
