"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  updateProfile,
  checkSlugAvailability,
  updateSlug,
} from "@/app/actions/profile";
import {
  connectStripe,
  getStripeStatus,
  getStripeDashboardLink,
} from "@/app/actions/stripe-connect";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Lock,
  ExternalLink,
  CreditCard,
  User,
  Save,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Profile & Settings Page
// ═══════════════════════════════════════════════════════════════════════════

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  );
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  service_zip: string | null;
  avatar_url: string | null;
  slug: string | null;
  subscription_tier: string;
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
}

function ProfilePageInner() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get("stripe");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [serviceZip, setServiceZip] = useState("");

  // Slug state (PRO feature)
  const [slug, setSlug] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugError, setSlugError] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);

  // Stripe state
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    details_submitted: boolean;
    charges_enabled: boolean;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMessage, setStripeMessage] = useState("");

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      const p = data as Profile;
      setProfile(p);
      setFirstName(p.first_name || "");
      setLastName(p.last_name || "");
      setBusinessName(p.business_name || "");
      setServiceZip(p.service_zip || "");
      setSlug(p.slug || "");

      // Fetch Stripe status
      const status = await getStripeStatus(user.id);
      setStripeStatus(status);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Stripe return params
  useEffect(() => {
    if (stripeParam === "success") {
      setStripeMessage("Stripe setup completed! Your payouts are now active.");
      // Refresh status
      if (profile) {
        getStripeStatus(profile.id).then(setStripeStatus);
      }
    } else if (stripeParam === "refresh") {
      setStripeMessage("Stripe setup was interrupted. Click below to continue.");
    }
  }, [stripeParam, profile]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setSaveMessage("");

    const result = await updateProfile({
      user_id: profile.id,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      business_name: businessName || undefined,
      service_zip: serviceZip || undefined,
    });

    if (result.success) {
      setSaveMessage("Changes saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      setSaveMessage(result.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleSlugCheck() {
    if (!profile || !slug.trim()) return;
    setSlugChecking(true);
    setSlugError("");

    const result = await checkSlugAvailability(slug, profile.id);
    setSlugAvailable(result.available);
    if (!result.available) {
      setSlugError(result.error || "Slug not available.");
    }
    setSlugChecking(false);
  }

  async function handleSlugSave() {
    if (!profile || !slugAvailable) return;
    setSlugSaving(true);

    const result = await updateSlug(profile.id, slug);
    if (result.success) {
      setSlug(result.slug || slug);
      setSaveMessage("Custom link saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      setSlugError(result.error || "Failed to save slug.");
    }
    setSlugSaving(false);
  }

  async function handleStripeConnect() {
    if (!profile) return;
    setStripeLoading(true);
    setStripeMessage("");

    const result = await connectStripe(profile.id);
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setStripeMessage(result.error || "Failed to start Stripe setup.");
      setStripeLoading(false);
    }
  }

  async function handleStripeDashboard() {
    if (!profile) return;
    setStripeLoading(true);

    const result = await getStripeDashboardLink(profile.id);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    } else {
      setStripeMessage("Failed to open Stripe dashboard.");
    }
    setStripeLoading(false);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  const isPro = profile?.subscription_tier === "pro";
  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/book/${profile?.slug || profile?.id}`
      : "";

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Profile & Settings
            </h1>
            <p className="text-[11px] text-stone-500">
              Manage your account
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION A: Personal & Business Info
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Personal & Business Info
            </h2>
          </div>

          {/* Avatar */}
          <div className="mb-5 flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-stone-600" />
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-700 text-white transition-colors hover:bg-yellow-400 hover:text-gray-950"
                title="Change photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white">
                {profile?.business_name || profile?.email}
              </p>
              <p className="text-stone-500">{profile?.email}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Business / Trade Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Best Garage Solutions"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Service ZIP Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={serviceZip}
                onChange={(e) =>
                  setServiceZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                placeholder="90210"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {saveMessage && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-400">
              {saveMessage}
            </p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION B: Stripe Connect (Payouts)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Payouts (Stripe Connect)
            </h2>
          </div>

          {/* Status Card */}
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-400">Payout Status</span>
              {stripeStatus?.charges_enabled ? (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
              ) : stripeStatus?.details_submitted ? (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Pending Verification
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Not Connected
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              {stripeStatus?.charges_enabled
                ? "Your account is fully set up. Deposits from your self-leads will be sent directly to your bank."
                : "Connect your Stripe account to receive deposits from self-leads directly."}
            </p>
          </div>

          {stripeMessage && (
            <p
              className={`mb-3 text-xs font-medium ${
                stripeMessage.includes("completed")
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {stripeMessage}
            </p>
          )}

          {stripeStatus?.charges_enabled ? (
            <button
              onClick={handleStripeDashboard}
              disabled={stripeLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {stripeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Open Stripe Dashboard
            </button>
          ) : (
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#635BFF] py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-[#5851DB] disabled:opacity-50"
            >
              {stripeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Setup Payouts
            </button>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION C: Branded Configurator Link (PRO)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Your Booking Link
            </h2>
            {isPro && (
              <span className="rounded bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                PRO
              </span>
            )}
          </div>

          {/* Current Link */}
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Current Link
            </p>
            <p className="mt-1 select-all break-all text-sm font-medium text-yellow-400">
              {bookingUrl}
            </p>
          </div>

          {/* Custom Slug Input */}
          <div className={`${!isPro ? "pointer-events-none" : ""}`}>
            <div className={`${!isPro ? "blur-[6px]" : ""}`}>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Custom Slug (e.g., BestGarageOmaha)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""));
                    setSlugAvailable(null);
                    setSlugError("");
                  }}
                  placeholder="your-custom-slug"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                />
                <button
                  onClick={handleSlugCheck}
                  disabled={!slug.trim() || slugChecking}
                  className="shrink-0 rounded-lg bg-slate-700 px-4 text-xs font-bold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                >
                  {slugChecking ? "..." : "Check"}
                </button>
              </div>

              {slugAvailable === true && (
                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Available!
                </p>
              )}
              {slugError && (
                <p className="mt-2 text-xs text-red-400">{slugError}</p>
              )}

              {slugAvailable === true && (
                <button
                  onClick={handleSlugSave}
                  disabled={slugSaving}
                  className="mt-3 w-full rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                >
                  {slugSaving ? "Saving..." : "Save Custom Link"}
                </button>
              )}
            </div>

            {/* PRO Upgrade Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-900/80 backdrop-blur-sm">
                <div className="mx-auto max-w-xs text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/10">
                    <Lock className="h-6 w-6 text-yellow-400" />
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-white">
                    Custom Links are a PRO Feature
                  </h3>
                  <p className="mb-4 text-xs text-stone-400">
                    Upgrade to get a clean, branded booking URL for your
                    business.
                  </p>
                  <button className="rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300">
                    Upgrade to PRO
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Plan Badge ────────────────────────────────────────────────── */}
        <div className="text-center">
          <span
            className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
              isPro
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-slate-800 text-stone-500"
            }`}
          >
            {isPro ? "Pro Plan" : "Free Plan"}
          </span>
        </div>
      </main>
    </div>
  );
}
