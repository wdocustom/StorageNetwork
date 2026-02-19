"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInstallerLink } from "@/lib/utils";
import {
  Copy,
  Check,
  Link2,
  ExternalLink,
  Megaphone,
  Lock,
  ArrowLeft,
  Loader2,
  Zap,
} from "lucide-react";
import AIScriptGenerator from "@/components/dashboard/AIScriptGenerator";
import ProUpgradeModal from "@/components/dashboard/ProUpgradeModal";

// ═══════════════════════════════════════════════════════════════════════════
// Marketing & Promotion — Installer sales toolkit
// ═══════════════════════════════════════════════════════════════════════════

interface UserProfile {
  id: string;
  slug: string | null;
  is_pro: boolean;
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
  const [showProModal, setShowProModal] = useState(false);

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
        .select("id, slug, is_pro, city, state, service_zip, business_name")
        .eq("id", user.id)
        .single();

      setProfile(
        data
          ? { id: data.id, slug: data.slug ?? null, is_pro: !!data.is_pro, city: data.city ?? null, state: data.state ?? null, service_zip: data.service_zip ?? null, business_name: data.business_name ?? null }
          : { id: user.id, slug: null, is_pro: false, city: null, state: null, service_zip: null, business_name: null }
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
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">
              Marketing & Promotion
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 pt-6">
        {/* ── Section 1: Booking Link ──────────────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Your Booking Link
            </h2>
            {profile.is_pro && (
              <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                Pro
              </span>
            )}
          </div>
          <p className="mb-4 text-sm text-stone-500">
            {profile.is_pro && profile.slug
              ? "Your custom branded link is active. Clients see your business name in the URL."
              : "This is your unique booking link. Send this to clients to let them design and book their own jobs."}
          </p>

          {/* Link display */}
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="select-all break-all text-sm font-medium text-blue-400">
              {bookingLink}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </button>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Link
            </a>
          </div>

          {/* Pro feature: Customize Link */}
          {!profile.is_pro ? (
            <button
              onClick={() => setShowProModal(true)}
              className="mt-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-4 py-3 text-left transition-colors hover:border-yellow-400/30 hover:bg-slate-800/50"
            >
              <Lock className="h-3.5 w-3.5 text-stone-600" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-stone-500">
                  Customize Link & Remove Branding
                </p>
                <p className="text-[11px] text-stone-600">
                  Get a branded URL like{" "}
                  <span className="text-blue-400/60">
                    ?installer=your-business
                  </span>
                </p>
              </div>
              <Zap className="h-3.5 w-3.5 text-yellow-400/50" />
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400">
                Pro features active &mdash; Custom link & only 5% fee on your leads
              </p>
            </div>
          )}
        </section>

        {/* ── Section 2: AI Script Generator ──────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              AI Script Generator
            </h2>
            <span className="rounded-full bg-gradient-to-r from-yellow-400/10 to-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
              Powered by AI
            </span>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            Generate platform-specific, localized marketing scripts tailored to your area.
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
          />
        </section>
      </main>

      <ProUpgradeModal
        open={showProModal}
        onClose={() => setShowProModal(false)}
      />
    </div>
  );
}
