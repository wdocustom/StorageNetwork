"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  updateProfile,
  uploadAvatarServerSide,
} from "@/app/actions/profile";
import { updateInstallerProfile } from "@/app/actions/installer";
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
  KeyRound,
  Zap,
  MapPin,
  Target,
  X,
} from "lucide-react";
import ProUpgradeCTA from "@/components/dashboard/ProUpgradeCTA";
import ProSubscriptionCard from "@/components/dashboard/ProSubscriptionCard";
import ProQRCodeCard from "@/components/profile/ProQRCodeCard";

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
  service_radius_miles: number | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  slug: string | null;
  subscription_tier: string;
  is_pro: boolean;
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
}

function ProfilePageInner() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const stripeParam = searchParams.get("stripe");
  const proParam = searchParams.get("pro");
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

  // Service radius state
  const [serviceRadius, setServiceRadius] = useState(25);
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [radiusMessage, setRadiusMessage] = useState("");
  const [zipsCovered, setZipsCovered] = useState<number | null>(null);

  // Stripe state
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    details_submitted: boolean;
    charges_enabled: boolean;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeMessage, setStripeMessage] = useState("");

  // Deactivate state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Pro subscription state
  const [proMessage, setProMessage] = useState("");

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
      .select("id, email, first_name, last_name, business_name, trade_name, phone, service_zip, service_radius_miles, city, state, avatar_url, slug, subscription_tier, is_pro, stripe_account_id, stripe_details_submitted")
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
      setServiceRadius(p.service_radius_miles ?? 25);
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

  // Handle Pro subscription return params
  useEffect(() => {
    if (proParam === "success") {
      setProMessage("Welcome to Pro! Your subscription is now active.");
      // Refresh profile to get updated is_pro status
      fetchData();
    } else if (proParam === "cancelled") {
      setProMessage("Upgrade cancelled. You can upgrade anytime.");
    }
  }, [proParam, fetchData]);

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

  async function handleSaveRadius() {
    if (!profile || !serviceZip || serviceZip.length !== 5) {
      setRadiusMessage("Please set a valid 5-digit ZIP code first.");
      return;
    }
    setRadiusSaving(true);
    setRadiusMessage("");

    const result = await updateInstallerProfile({
      installer_id: profile.id,
      service_zip: serviceZip,
      service_radius_miles: serviceRadius,
    });

    if (result.success) {
      setZipsCovered(result.zips_covered);
      setRadiusMessage(`Service area updated! Covering ${result.zips_covered.toLocaleString()} ZIP codes.`);
      setTimeout(() => setRadiusMessage(""), 4000);
    } else {
      setRadiusMessage(result.error || "Failed to update service area.");
    }
    setRadiusSaving(false);
  }

  async function handleChangePassword() {
    // Validate inputs
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError("");
    setPasswordMessage("");
    setPasswordLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setPasswordMessage("Password updated successfully!");
        // Clear form and close modal after a moment
        setTimeout(() => {
          setShowPasswordModal(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPasswordMessage("");
        }, 2000);
      }
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
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

  // isPro: true if database says so OR if just returned from successful checkout
  // (webhook may still be processing, so we trust the success redirect)
  const isPro = profile?.is_pro === true || proParam === "success";

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
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="h-full w-full object-cover aspect-square rounded-full"
                    unoptimized
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
                onClick={() => setShowPasswordModal(true)}
                className="mt-1 flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
              >
                <KeyRound className="h-3 w-3" />
                Change Password
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
            SECTION A.5: Service Area Radius
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Service Area
            </h2>
          </div>

          {/* Current ZIP Display */}
          <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/10">
                  <MapPin className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Home Base ZIP</p>
                  <p className="text-lg font-bold text-white">
                    {serviceZip || "Not set"}
                  </p>
                </div>
              </div>
              {zipsCovered !== null && (
                <div className="text-right">
                  <p className="text-2xl font-black text-yellow-400">
                    {zipsCovered.toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">
                    ZIP Codes
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Radius Slider */}
          <div className="mb-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Service Radius
              </label>
              <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-sm font-bold text-yellow-400">
                {serviceRadius} miles
              </span>
            </div>

            {/* Custom Slider Track */}
            <div className="relative">
              {/* Track background */}
              <div className="h-3 rounded-full bg-slate-700">
                {/* Filled portion */}
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                  style={{ width: `${((serviceRadius - 5) / 95) * 100}%` }}
                />
              </div>
              {/* Hidden range input */}
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={serviceRadius}
                onChange={(e) => setServiceRadius(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {/* Custom thumb */}
              <div
                className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 border-yellow-400 bg-slate-900 shadow-lg transition-all"
                style={{ left: `calc(${((serviceRadius - 5) / 95) * 100}% - 12px)` }}
              />
            </div>

            {/* Preset Quick Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[10, 25, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setServiceRadius(preset)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    serviceRadius === preset
                      ? "bg-yellow-400 text-gray-950"
                      : "bg-slate-800 text-stone-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {preset} mi
                </button>
              ))}
            </div>
          </div>

          {/* Visual Distance Reference */}
          <div className="mb-5 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
            <p className="text-xs text-stone-400">
              <span className="font-semibold text-white">{serviceRadius} miles</span> ≈{" "}
              {serviceRadius <= 15
                ? "local neighborhood coverage"
                : serviceRadius <= 30
                ? "city-wide coverage"
                : serviceRadius <= 50
                ? "metro area coverage"
                : serviceRadius <= 75
                ? "regional coverage"
                : "multi-city / statewide coverage"}
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveRadius}
            disabled={radiusSaving || !serviceZip || serviceZip.length !== 5}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {radiusSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            {radiusSaving ? "Updating..." : "Update Service Area"}
          </button>

          {radiusMessage && (
            <p
              className={`mt-2 text-center text-xs font-medium ${
                radiusMessage.includes("updated") ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {radiusMessage}
            </p>
          )}

          {!serviceZip || serviceZip.length !== 5 ? (
            <p className="mt-2 text-center text-xs text-amber-400">
              Set your Service ZIP above to configure your service area.
            </p>
          ) : null}
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

        {/* ═══════════════════════════════════════════════════════════════
            SECTION C: Pro Upgrade CTA (Non-Pro users only)
        ═══════════════════════════════════════════════════════════════ */}
        {!isPro && profile && (
          <ProUpgradeCTA userId={profile.id} />
        )}

        {/* Pro Upgrade Success/Cancel Message */}
        {proMessage && (
          <div
            className={`rounded-xl border p-4 text-center ${
              proMessage.includes("active")
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {proMessage.includes("active") ? (
                <Zap className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-400" />
              )}
              <p
                className={`text-sm font-semibold ${
                  proMessage.includes("active")
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {proMessage}
              </p>
            </div>
          </div>
        )}

        {/* Pro Subscription Management (Pro users only) */}
        {isPro && profile && (
          <ProSubscriptionCard userId={profile.id} slug={profile.slug} />
        )}

        {/* Pro QR Code Generator (Pro users with slug only) */}
        {isPro && profile?.slug && (
          <ProQRCodeCard slug={profile.slug} businessName={profile.business_name || undefined} />
        )}

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-red-900/50 bg-slate-900 p-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-red-400">
            Danger Zone
          </h2>
          <p className="mb-4 text-xs text-stone-400">
            Deactivate your account. Your data will be preserved but your profile
            will be hidden from the platform.
          </p>

          {!showDeactivateConfirm ? (
            <button
              onClick={() => setShowDeactivateConfirm(true)}
              className="rounded-lg border border-red-800 bg-red-900/30 px-5 py-2.5 text-sm font-bold text-red-400 transition-all hover:bg-red-900/50"
            >
              Deactivate Account
            </button>
          ) : (
            <div className="rounded-lg border border-red-700 bg-red-950/50 p-4">
              <p className="mb-3 text-sm font-semibold text-red-300">
                Are you sure? This will hide your profile from customers.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!profile?.id) return;
                    setDeactivating(true);
                    const result = await deactivateAccount(profile.id);
                    if (result.success) {
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    } else {
                      setDeactivating(false);
                      setShowDeactivateConfirm(false);
                      setSaveMessage("Failed to deactivate: " + (result.error || "Unknown error"));
                    }
                  }}
                  disabled={deactivating}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-500 disabled:opacity-50"
                >
                  {deactivating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deactivating ? "Deactivating..." : "Yes, Deactivate"}
                </button>
                <button
                  onClick={() => setShowDeactivateConfirm(false)}
                  disabled={deactivating}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-stone-400 transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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

      {/* ═══════════════════════════════════════════════════════════════════
          Change Password Modal
      ═══════════════════════════════════════════════════════════════════ */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6">
            {/* Modal Header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-yellow-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Change Password
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                  setPasswordMessage("");
                }}
                className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success Message */}
            {passwordMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-xs font-medium text-emerald-400">
                  {passwordMessage}
                </p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Re-enter password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Error Message */}
            {passwordError && (
              <p className="mt-3 text-xs font-medium text-red-400">
                {passwordError}
              </p>
            )}

            {/* Buttons */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
              >
                {passwordLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {passwordLoading ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                  setPasswordMessage("");
                }}
                disabled={passwordLoading}
                className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-stone-400 transition-all hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
