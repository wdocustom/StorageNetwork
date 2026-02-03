"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  updateProfile,
  uploadAvatarServerSide,
} from "@/app/actions/profile";
import {
  connectStripe,
  getStripeStatus,
  getStripeDashboardLink,
} from "@/app/actions/stripe-connect";
import { deactivateAccount } from "@/app/actions/debug";
import { siteConfig } from "@/config/site";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  CreditCard,
  User,
  Save,
  Upload,
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
  trade_name: string | null;
  phone: string | null;
  service_zip: string | null;
  city: string | null;
  state: string | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceZip, setServiceZip] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
      setTradeName(p.trade_name || "");
      setPhone(p.phone || "");
      setServiceZip(p.service_zip || "");
      setCity(p.city || "");
      setState(p.state || "");
      setAvatarUrl(p.avatar_url);
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setSaveMessage("Please upload a JPG, PNG, GIF, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage("Image must be less than 5MB.");
      return;
    }

    setUploadingPhoto(true);
    setSaveMessage("");

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${profile.id}/avatar.${fileExt}`;

      // Try client-side upload first (uses user's auth token)
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Client upload failed, trying server-side:", uploadError.message);

        // Fallback: server-side upload via service role
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // strip data:image/...;base64,
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const serverResult = await uploadAvatarServerSide(profile.id, base64, fileExt);
        if (!serverResult.success) {
          throw new Error(serverResult.error || "Server upload failed");
        }

        setAvatarUrl(serverResult.url || null);
        setSaveMessage("Photo updated!");
        setTimeout(() => setSaveMessage(""), 3000);
        return;
      }

      // Client upload succeeded — get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL (also sync to logo_url for white-labeling)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl, logo_url: newAvatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      setSaveMessage("Photo updated!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      console.error("Photo upload error:", err);
      setSaveMessage("Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setSaveMessage("");

    if (!city.trim() || !state.trim()) {
      setSaveMessage("City and State are required.");
      setSaving(false);
      return;
    }

    const result = await updateProfile({
      user_id: profile.id,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      business_name: businessName || undefined,
      trade_name: tradeName || undefined,
      phone: phone || undefined,
      service_zip: serviceZip || undefined,
      city: city.trim(),
      state: state.trim(),
    });

    if (result.success) {
      setSaveMessage("Changes saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      console.error("Save failed:", result.error);
      setSaveMessage(result.error || "Failed to save.");
    }
    setSaving(false);
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

          {/* Avatar with Upload */}
          <div className="mb-5 flex items-center gap-4">
            <div className="relative">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {/* Avatar display - strictly circular */}
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover aspect-square rounded-full"
                  />
                ) : (
                  <User className="h-8 w-8 text-stone-600" />
                )}
              </div>
              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-700 text-white transition-colors hover:bg-yellow-400 hover:text-gray-950 disabled:opacity-50"
                title="Change photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white">
                {profile?.business_name || profile?.first_name || profile?.email}
              </p>
              <p className="text-stone-500">{profile?.email}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="mt-1 flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
              >
                <Upload className="h-3 w-3" />
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              </button>
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
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Best Garage Solutions LLC"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Trade Name (DBA)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Best Garage"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Service ZIP
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  City <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Los Angeles"
                  className={`w-full rounded-lg border bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400 ${
                    !city.trim() ? "border-red-500/50" : "border-slate-700"
                  }`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  State <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                  className={`w-full rounded-lg border bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400 ${
                    !state.trim() ? "border-red-500/50" : "border-slate-700"
                  }`}
                />
              </div>
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
            <p
              className={`mt-2 text-center text-xs font-medium ${
                saveMessage.includes("Failed") ? "text-red-400" : "text-emerald-400"
              }`}
            >
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
                ? "Your account is fully set up. Deposits from your leads will be sent directly to your bank."
                : "Connect your Stripe account to receive deposits directly."}
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
          <p className="mt-2 text-center text-xs text-stone-500">
            By joining, I agree to the{" "}
            <a href="/legal/terms#contractor" target="_blank" className="underline hover:text-stone-300">
              Contractor Agreement
            </a>.
          </p>
        </section>

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-red-900/50 bg-slate-900 p-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-red-400">
            Danger Zone
          </h2>
          <p className="mb-4 text-xs text-stone-400">
            Deactivate your account. Your data will be preserved but your profile
            will be hidden from the platform.
          </p>
          <button
            onClick={async () => {
              if (!profile?.id) return;
              if (!confirm("Are you sure you want to deactivate your account? This will hide your profile from customers.")) return;
              const result = await deactivateAccount(profile.id);
              if (result.success) {
                alert("Account deactivated. You will be signed out.");
                await supabase.auth.signOut();
                window.location.href = "/";
              } else {
                alert("Failed to deactivate: " + (result.error || "Unknown error"));
              }
            }}
            className="rounded-lg border border-red-800 bg-red-900/30 px-5 py-2.5 text-sm font-bold text-red-400 transition-all hover:bg-red-900/50"
          >
            Deactivate Account
          </button>
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
