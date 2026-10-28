"use client";

import { useState } from "react";
import { logActivityClient } from "@/lib/activity-client";
import { Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import AIScriptGenerator from "@/components/dashboard/AIScriptGenerator";
import { ASSET_FORGE_ENABLED } from "@/config/features";
import dynamic from "next/dynamic";
import IGSalesImages from "@/components/dashboard/IGSalesImages";
import InstallerPostTemplates from "@/components/dashboard/InstallerPostTemplates";
import PageHeader from "@/components/dashboard/PageHeader";
import CloseQuotes from "@/components/dashboard/CloseQuotes";
import type { MarketingProfile, OpenQuote, RecentJob } from "@/lib/server/marketing";

// Loaded only when switched on, so its code isn't shipped otherwise.
const AssetForge = dynamic(() => import("@/components/dashboard/AssetForge"));

// The page (page.tsx) loads everything on the server and hands it in.
export default function MarketingView({
  profile,
  bookingLink,
  baseUrl,
  quotes,
  jobs,
}: {
  profile: MarketingProfile;
  bookingLink: string;
  baseUrl: string;
  quotes: OpenQuote[];
  jobs: RecentJob[];
}) {
  const [copied, setCopied] = useState(false);
  const me = profile.business_name || profile.first_name || "your installer";

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    logActivityClient({ action: "copy_link", pagePath: "/dashboard/marketing" });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <PageHeader title="Marketing" subtitle="Close your quotes, then get new leads" />

      <main className="mx-auto max-w-lg space-y-4 p-4 pt-5 md:max-w-3xl lg:max-w-4xl">
        {/* ── Booking Link Strip ────────────────────────────────── */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-blue-400">
            {bookingLink}
          </p>
          <button
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
          >
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
          <a
            href={bookingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center rounded-lg border border-slate-700 p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Open booking link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* ── Close the quotes already sent (closest money first) ── */}
        <CloseQuotes quotes={quotes} me={me} baseUrl={baseUrl} />

        {/* ── AI Script Generator ─────────────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              AI Script Generator
            </h2>
            <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              AI
            </span>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            Generate a custom marketing script for any platform.
            {profile.city && profile.state && (
              <span className="ml-1 font-semibold text-emerald-400">
                Localized to {profile.city}, {profile.state}.
              </span>
            )}
          </p>

          <AIScriptGenerator
            bookingLink={bookingLink}
            city={profile.city}
            state={profile.state}
            zip={profile.service_zip}
            businessName={profile.business_name}
            userId={profile.id}
            recentJobs={jobs}
          />
        </section>

        {/* ── AI Asset Forge (switched off, see config/features) ── */}
        {ASSET_FORGE_ENABLED && <AssetForge />}

        {/* ── Admin-Only: IG Templates ──────────────────────────── */}
        {profile.is_admin && (
          <InstallerPostTemplates
            businessName={profile.business_name}
            city={profile.city}
            state={profile.state}
            bookingLink={bookingLink}
          />
        )}

        {/* ── Admin-Only: Platform Promo Images ────────────────── */}
        {profile.is_admin && <IGSalesImages />}
      </main>
    </div>
  );
}
