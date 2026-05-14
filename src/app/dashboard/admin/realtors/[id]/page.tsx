// ═══════════════════════════════════════════════════════════════════════════
// Admin → Realtor detail
//
// Server-component shell that:
//   1. Gates on is_admin
//   2. Fetches the realtor's profile + gift history via getRealtorAdminDetail
//   3. Passes both into <RealtorAdminDetailClient> for the interactive bits
//      (suspend toggle, delete button + preflight modal)
//
// Future sections (referral ledger, custom-branding config, etc.) can slot
// in as additional cards on this page without restructuring.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAuthenticatedUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-server";
import { getRealtorAdminDetail } from "@/app/actions/admin-realtor-management";
import { RealtorAdminDetailClient } from "./RealtorAdminDetailClient";

export default async function RealtorAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = getServiceClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/dashboard");

  const { id } = await params;
  const result = await getRealtorAdminDetail(user.id, id);
  if (!result.ok || !result.detail) {
    if (result.error?.includes("not found") || result.error?.includes("not flagged")) {
      notFound();
    }
    return (
      <ErrorShell>
        <p className="text-sm text-red-300">{result.error || "Failed to load realtor."}</p>
      </ErrorShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <Link
          href="/dashboard/admin/realtors"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          All realtors
        </Link>

        <RealtorAdminDetailClient
          adminUserId={user.id}
          detail={result.detail}
        />
      </div>
    </div>
  );
}

function ErrorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link
          href="/dashboard/admin/realtors"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          All realtors
        </Link>
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">{children}</div>
      </div>
    </div>
  );
}
