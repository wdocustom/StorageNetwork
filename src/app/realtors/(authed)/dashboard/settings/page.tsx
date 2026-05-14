// ═══════════════════════════════════════════════════════════════════════════
// Realtor Settings — currently scoped to custom branding (photo, logo,
// signature). Future-friendly shell: drop new sections (notifications,
// integrations, etc.) above or below the branding card.
//
// The (authed) layout already gates access to is_realtor users, so this
// page just fetches existing values and hands off to the client form.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getRealtorBranding } from "@/app/actions/realtor-branding";
import { BrandingForm } from "./BrandingForm";

export default async function RealtorSettingsPage() {
  // (authed)/layout.tsx has already verified is_realtor; we trust it here.
  const branding = await getRealtorBranding();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Link
          href="/realtors/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Settings
          </p>
          <h1 className="text-3xl font-black sm:text-4xl">Custom branding</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Personalize the gift page your buyers and sellers see. A head-shot, your
            brokerage logo, and a default closing line — all optional, all editable
            here at any time.
          </p>
        </div>

        <BrandingForm initial={branding} />
      </div>
    </div>
  );
}
