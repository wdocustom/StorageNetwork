"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInstallerLink } from "@/lib/utils";
import { logActivityClient } from "@/lib/activity-client";
import {
  Copy,
  Check,
  ExternalLink,
  Megaphone,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import AIScriptGenerator from "@/components/dashboard/AIScriptGenerator";
import AssetForge from "@/components/dashboard/AssetForge";
import IGSalesImages from "@/components/dashboard/IGSalesImages";
import InstallerPostTemplates from "@/components/dashboard/InstallerPostTemplates";
import ProPill from "@/components/dashboard/ProPill";

interface UserProfile {
  id: string;
  slug: string | null;
  is_pro: boolean;
  is_admin?: boolean;
  city: string | null;
  state: string | null;
  service_zip: string | null;
  business_name: string | null;
}

export default function MarketingPage() {
  const supabase = getSupabaseBrowserClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, slug, is_pro, is_admin, city, state, service_zip, business_name")
        .eq("id", user.id)
        .single();

      setProfile(
        data
          ? { id: data.id, slug: data.slug ?? null, is_pro: true, is_admin: data.is_admin ?? false, city: data.city ?? null, state: data.state ?? null, service_zip: data.service_zip ?? null, business_name: data.business_name ?? null }
          : { id: user.id, slug: null, is_pro: true, is_admin: false, city: null, state: null, service_zip: null, business_name: null }
      );
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  const bookingLink = getInstallerLink(profile);

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    logActivityClient({ action: "copy_link", pagePath: "/dashboard/marketing" });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 md:max-w-3xl lg:max-w-4xl">
          <a
            href="/dashboard"
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex-1 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">Marketing</h1>
          </div>
          <ProPill link={bookingLink} />
        </div>
      </header>

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
          />
        </section>

        {/* ── AI Asset Forge ──────────────────────────────────── */}
        <AssetForge />

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
