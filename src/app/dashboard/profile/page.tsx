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
  Handshake,
  Truck,
  Plus,
  Trash2,
  Percent,
  DollarSign,
} from "lucide-react";
import ProPill from "@/components/dashboard/ProPill";
import ProSubscriptionCard from "@/components/dashboard/ProSubscriptionCard";
import PricingSettings from "@/components/dashboard/PricingSettings";
import DiscountCodesCard from "@/components/dashboard/DiscountCodesCard";
import ProQRCodeCard from "@/components/profile/ProQRCodeCard";
import PortfolioSection from "@/components/profile/PortfolioSection";
import ServicesSection from "@/components/profile/ServicesSection";
import type { PortfolioPhoto } from "@/app/actions/profile";
import type { ServiceOffering } from "@/config/services";

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

/** A single distance-based delivery fee tier */
export interface DeliveryFeeTier {
  max_miles: number;
  fee: number;
  enabled: boolean;
  label: string;
}

/** Delivery fee configuration stored in profiles.delivery_fee_config */
export interface DeliveryFeeConfig {
  enabled: boolean;
  tiers: DeliveryFeeTier[];
}

/** Deposit configuration stored in profiles.deposit_config */
interface DepositConfig {
  type: "percentage" | "flat";
  value: number;
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
  address_line1: string | null;
  avatar_url: string | null;
  slug: string | null;
  subscription_tier: string;
  is_pro: boolean;
  is_partner: boolean;
  stripe_account_id: string | null;
  stripe_details_submitted: boolean;
  delivery_fee_config: DeliveryFeeConfig | null;
  deposit_config: DepositConfig | null;
  bio: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  portfolio_photos: PortfolioPhoto[] | null;
  services_config: ServiceOffering[] | null;
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
  const [addressLine1, setAddressLine1] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Delivery fee state
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(false);
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryFeeTier[]>([]);
  const [deliveryFeeSaving, setDeliveryFeeSaving] = useState(false);
  const [deliveryFeeMessage, setDeliveryFeeMessage] = useState("");

  // Deposit config state
  const [depositType, setDepositType] = useState<"percentage" | "flat">("percentage");
  const [depositValue, setDepositValue] = useState<number>(15);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");

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

  const applyProfile = useCallback((p: Profile) => {
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
    setAddressLine1(p.address_line1 || "");
    setAvatarUrl(p.avatar_url);
    // Delivery fee config
    if (p.delivery_fee_config) {
      setDeliveryFeeEnabled(p.delivery_fee_config.enabled);
      setDeliveryTiers(p.delivery_fee_config.tiers || []);
    }
    // Deposit config
    if (p.deposit_config) {
      setDepositType(p.deposit_config.type);
      setDepositValue(p.deposit_config.value);
    }
  }, []);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, business_name, trade_name, phone, service_zip, service_radius_miles, city, state, address_line1, avatar_url, slug, subscription_tier, is_pro, is_partner, stripe_account_id, stripe_details_submitted, delivery_fee_config, deposit_config, bio, instagram_url, facebook_url, portfolio_photos, services_config")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("[Profile] Query failed:", error.message, error.code, error.details);
      // Retry once after refreshing the session
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name, business_name, trade_name, phone, service_zip, service_radius_miles, city, state, address_line1, avatar_url, slug, subscription_tier, is_pro, is_partner, stripe_account_id, stripe_details_submitted, delivery_fee_config, deposit_config, bio, instagram_url, facebook_url, portfolio_photos, services_config")
          .eq("id", user.id)
          .single();
        if (retry.data) {
          console.log("[Profile] Retry succeeded after session refresh");
          applyProfile(retry.data as Profile);
          const status = await getStripeStatus(user.id);
          setStripeStatus(status);
          setLoading(false);
          return;
        }
        if (retry.error) {
          console.error("[Profile] Retry also failed:", retry.error.message);
        }
      }
    }

    if (data) {
      applyProfile(data as Profile);
      // Fetch Stripe status
      const status = await getStripeStatus(user.id);
      setStripeStatus(status);
    }

    setLoading(false);
  }, [supabase, applyProfile]);

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
      address_line1: addressLine1.trim() || undefined,
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

    try {
      const result = await connectStripe(profile.id);
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setStripeMessage(result.error || "Failed to start Stripe setup.");
        setStripeLoading(false);
      }
    } catch (err) {
      console.error("Stripe connect error:", err);
      setStripeMessage("Connection error. Please try again.");
      setStripeLoading(false);
    }
  }

  async function handleStripeDashboard() {
    if (!profile) return;
    setStripeLoading(true);
    setStripeMessage("");

    try {
      const result = await getStripeDashboardLink(profile.id);
      if (result.success && result.url) {
        // Use location.href instead of window.open to avoid popup blockers
        window.location.href = result.url;
      } else {
        setStripeMessage(result.error || "Failed to open Stripe dashboard.");
      }
    } catch (err) {
      console.error("Stripe dashboard error:", err);
      setStripeMessage("Connection error. Please try again.");
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

  async function handleSaveDeliveryFees() {
    if (!profile) return;
    setDeliveryFeeSaving(true);
    setDeliveryFeeMessage("");

    const config: DeliveryFeeConfig = {
      enabled: deliveryFeeEnabled,
      tiers: deliveryTiers,
    };

    const { error } = await supabase
      .from("profiles")
      .update({ delivery_fee_config: config })
      .eq("id", profile.id);

    if (error) {
      setDeliveryFeeMessage("Failed to save delivery fees.");
    } else {
      setDeliveryFeeMessage("Delivery fees saved!");
      setTimeout(() => setDeliveryFeeMessage(""), 3000);
    }
    setDeliveryFeeSaving(false);
  }

  async function handleSaveDepositConfig() {
    if (!profile) return;
    setDepositSaving(true);
    setDepositMessage("");

    // Validate: percentage must be >= 15
    if (depositType === "percentage" && depositValue < 15) {
      setDepositMessage("Minimum deposit is 15% to cover network lead fees.");
      setDepositSaving(false);
      return;
    }
    // Validate: flat must be > 0
    if (depositType === "flat" && depositValue <= 0) {
      setDepositMessage("Deposit amount must be greater than $0.");
      setDepositSaving(false);
      return;
    }

    // If it's the default (percentage, 15%), store null to use system default
    const isDefault = depositType === "percentage" && depositValue === 15;
    const config: DepositConfig | null = isDefault ? null : { type: depositType, value: depositValue };

    const { error } = await supabase
      .from("profiles")
      .update({ deposit_config: config })
      .eq("id", profile.id);

    if (error) {
      setDepositMessage("Failed to save deposit settings.");
    } else {
      setDepositMessage("Deposit settings saved!");
      setTimeout(() => setDepositMessage(""), 3000);
    }
    setDepositSaving(false);
  }

  function addDeliveryTier() {
    const lastMax = deliveryTiers.length > 0 ? deliveryTiers[deliveryTiers.length - 1].max_miles : 0;
    const newMax = Math.min(lastMax + 25, serviceRadius || 100);
    setDeliveryTiers([
      ...deliveryTiers,
      { max_miles: newMax, fee: 0, enabled: true, label: `${lastMax}-${newMax} mi` },
    ]);
  }

  function removeDeliveryTier(idx: number) {
    setDeliveryTiers(deliveryTiers.filter((_, i) => i !== idx));
  }

  function updateDeliveryTier(idx: number, updates: Partial<DeliveryFeeTier>) {
    setDeliveryTiers(deliveryTiers.map((t, i) => {
      if (i !== idx) return t;
      const updated = { ...t, ...updates };
      // Auto-update label based on distance
      const prevMax = idx > 0 ? deliveryTiers[idx - 1].max_miles : 0;
      updated.label = `${prevMax}-${updated.max_miles} mi`;
      return updated;
    }));
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

  // Import icons for quick-access tiles
  const portfolioUrl = profile?.slug ? `/p/${profile.slug}` : null;

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
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Profile & Settings
            </h1>
            <p className="text-[11px] text-stone-500">
              {profile?.business_name || profile?.first_name || "Manage your account"}
            </p>
          </div>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">

        {/* ── Quick-Access Toolbar ─────────────────────────────────────── */}
        {profile?.slug && (
          <div className="grid grid-cols-3 gap-2">
            <ProQRCodeCard slug={profile.slug} businessName={profile.business_name || undefined} phone={profile.phone || undefined} />
            <a
              href={portfolioUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-yellow-400"
            >
              <ExternalLink className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Portfolio</span>
            </a>
            {stripeStatus?.charges_enabled ? (
              <button
                onClick={handleStripeDashboard}
                disabled={stripeLoading}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-yellow-400 disabled:opacity-50"
              >
                {stripeLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {stripeLoading ? "Loading..." : "Stripe"}
                </span>
              </button>
            ) : (
              <button
                onClick={handleStripeConnect}
                disabled={stripeLoading}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-stone-400 transition-all hover:border-yellow-400/40 hover:text-yellow-400 disabled:opacity-50"
              >
                {stripeLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {stripeLoading ? "Loading..." : "Payouts"}
                </span>
              </button>
            )}
          </div>
        )}
        {/* Stripe toolbar feedback */}
        {stripeMessage && (
          <p className={`text-center text-xs font-medium ${
            stripeMessage.includes("error") || stripeMessage.includes("Failed") || stripeMessage.includes("interrupted")
              ? "text-red-400"
              : "text-emerald-400"
          }`}>
            {stripeMessage}
          </p>
        )}
        {/* ── Group: Business ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Business</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>

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

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Street Address
              </label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="1234 Main St"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
              />
              <p className="mt-0.5 text-[10px] text-stone-600">Used for delivery distance calculations</p>
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

        {/* ── Group: Coverage ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Coverage</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>

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
            SECTION A.6: Delivery Fee Tiers
        ═══════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Delivery Fees
              </h2>
            </div>
            {/* Master Toggle */}
            <button
              onClick={() => setDeliveryFeeEnabled(!deliveryFeeEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                deliveryFeeEnabled ? "bg-yellow-400" : "bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  deliveryFeeEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <p className="mb-4 text-xs text-stone-500">
            Charge delivery fees based on distance from your home base ZIP. Fees are added to the customer&apos;s total and are <span className="font-semibold text-stone-400">not subject to sales tax</span>.
          </p>

          {deliveryFeeEnabled && (
            <>
              {/* Tier List */}
              <div className="space-y-2">
                {deliveryTiers.map((tier, idx) => {
                  const prevMax = idx > 0 ? deliveryTiers[idx - 1].max_miles : 0;
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 transition-colors ${
                        tier.enabled
                          ? "border-slate-700 bg-slate-800"
                          : "border-slate-800 bg-slate-800/30 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Tier toggle */}
                        <button
                          onClick={() => updateDeliveryTier(idx, { enabled: !tier.enabled })}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            tier.enabled ? "bg-yellow-400" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              tier.enabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>

                        {/* Distance label */}
                        <span className="text-xs font-semibold text-stone-400 whitespace-nowrap">
                          {prevMax}–
                        </span>

                        {/* Max miles input */}
                        <input
                          type="number"
                          min={prevMax + 1}
                          max={serviceRadius || 200}
                          value={tier.max_miles}
                          onChange={(e) => updateDeliveryTier(idx, { max_miles: e.target.value === "" ? 0 : Number(e.target.value) })}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!v || v <= prevMax) updateDeliveryTier(idx, { max_miles: prevMax + 1 });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-16 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-xs font-bold text-white outline-none focus:border-yellow-400"
                        />
                        <span className="text-xs text-stone-500">mi</span>

                        <span className="text-xs text-stone-600 mx-1">=</span>

                        {/* Fee input */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-stone-400">$</span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={tier.fee}
                            onChange={(e) => updateDeliveryTier(idx, { fee: e.target.value === "" ? 0 : Number(e.target.value) })}
                            onFocus={(e) => e.target.select()}
                            className="w-16 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-xs font-bold text-white outline-none focus:border-yellow-400"
                          />
                        </div>

                        {/* Delete tier */}
                        <button
                          onClick={() => removeDeliveryTier(idx)}
                          className="ml-auto rounded p-1 text-stone-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {tier.fee === 0 && tier.enabled && (
                        <p className="mt-1 ml-12 text-[10px] text-emerald-500">Free delivery</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Tier button */}
              <button
                onClick={addDeliveryTier}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 py-2 text-xs font-semibold text-stone-500 transition-colors hover:border-yellow-400/50 hover:text-yellow-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Distance Tier
              </button>

              {deliveryTiers.length === 0 && (
                <p className="mt-2 text-center text-xs text-stone-600">
                  No tiers yet. Add a distance tier to start charging delivery fees.
                </p>
              )}
            </>
          )}

          {/* Save */}
          <button
            onClick={handleSaveDeliveryFees}
            disabled={deliveryFeeSaving}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {deliveryFeeSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            {deliveryFeeSaving ? "Saving..." : "Save Delivery Fees"}
          </button>

          {deliveryFeeMessage && (
            <p
              className={`mt-2 text-center text-xs font-medium ${
                deliveryFeeMessage.includes("saved") ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {deliveryFeeMessage}
            </p>
          )}
        </section>

        {/* ── Group: Payments ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Payments</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>

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

        {/* Pro Subscription Management */}
        {profile && (
          <ProSubscriptionCard userId={profile.id} slug={profile.slug} />
        )}

        {/* ── Group: Portfolio ───────────────────────────────────────── */}
        {profile?.slug && (
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Portfolio</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION C.5: Portfolio & Social
        ═══════════════════════════════════════════════════════════════ */}
        {profile?.slug && (
          <PortfolioSection
            userId={profile.id}
            slug={profile.slug}
            initialBio={profile.bio || ""}
            initialInstagram={profile.instagram_url || ""}
            initialFacebook={profile.facebook_url || ""}
            initialPhotos={(profile.portfolio_photos as PortfolioPhoto[]) || []}
            businessName={profile.business_name || undefined}
            firstName={profile.first_name || undefined}
            city={profile.city || undefined}
            state={profile.state || undefined}
          />
        )}

        {/* ── Group: Services ────────────────────────────────────────── */}
        {profile?.slug && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Services</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </div>

            <ServicesSection
              userId={profile.id}
              initialServices={profile.services_config}
            />
          </>
        )}

        {/* ── Group: Pricing ─────────────────────────────────────────── */}
        {profile && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Pricing</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </div>

            {/* SECTION D: Custom Pricing */}
            <PricingSettings userId={profile.id} />

            {/* SECTION D.5: Custom Deposit */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Customer Deposit
                </h2>
              </div>

              <p className="mb-4 text-xs text-stone-500">
                Set how much your customers pay upfront when booking. Minimum is <span className="font-semibold text-stone-400">15%</span> to cover
                the network lead fee. You can require a higher percentage or a flat dollar amount.
              </p>

              {/* Deposit Type Selector */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => { setDepositType("percentage"); if (depositValue < 15) setDepositValue(15); }}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    depositType === "percentage"
                      ? "bg-yellow-400 text-gray-950"
                      : "border border-slate-700 bg-slate-800 text-stone-400 hover:border-yellow-400/50"
                  }`}
                >
                  <Percent className="h-3.5 w-3.5" />
                  Percentage
                </button>
                <button
                  onClick={() => setDepositType("flat")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                    depositType === "flat"
                      ? "bg-yellow-400 text-gray-950"
                      : "border border-slate-700 bg-slate-800 text-stone-400 hover:border-yellow-400/50"
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Flat Amount
                </button>
              </div>

              {/* Deposit Value Input */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center gap-3">
                  {depositType === "flat" && (
                    <span className="text-lg font-bold text-stone-400">$</span>
                  )}
                  <input
                    type="number"
                    min={depositType === "percentage" ? 15 : 1}
                    max={depositType === "percentage" ? 100 : 99999}
                    step={depositType === "percentage" ? 5 : 25}
                    value={depositValue}
                    onChange={(e) => setDepositValue(e.target.value === "" ? 0 : Number(e.target.value))}
                    onBlur={() => {
                      if (depositType === "percentage" && depositValue < 15) setDepositValue(15);
                      if (depositType === "flat" && depositValue < 1) setDepositValue(1);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-24 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-center text-lg font-bold text-white outline-none focus:border-yellow-400"
                  />
                  {depositType === "percentage" && (
                    <span className="text-lg font-bold text-stone-400">%</span>
                  )}
                  <span className="ml-2 text-xs text-stone-500">
                    {depositType === "percentage"
                      ? depositValue === 15
                        ? "Default — standard 15% deposit"
                        : `Customer pays ${depositValue}% of build total upfront`
                      : `Customer pays $${depositValue} upfront (min 15% of total enforced)`
                    }
                  </span>
                </div>
                {depositType === "flat" && (
                  <p className="mt-2 text-[10px] text-amber-400/80">
                    If 15% of the build total exceeds this amount, the deposit will automatically increase to cover the network fee.
                  </p>
                )}
                {depositType === "percentage" && depositValue > 15 && (
                  <p className="mt-2 text-[10px] text-emerald-400/80">
                    You&apos;ll collect {depositValue}% upfront. The remaining {100 - depositValue}% is due at installation.
                  </p>
                )}
              </div>

              {/* Save */}
              <button
                onClick={handleSaveDepositConfig}
                disabled={depositSaving}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
              >
                {depositSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                {depositSaving ? "Saving..." : "Save Deposit Settings"}
              </button>

              {depositMessage && (
                <p
                  className={`mt-2 text-center text-xs font-medium ${
                    depositMessage.includes("saved") ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {depositMessage}
                </p>
              )}
            </section>

            {/* SECTION E: Discount Codes */}
            <DiscountCodesCard userId={profile.id} />
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PARTNER PORTAL (Partners only — gated by is_partner flag)
        ═══════════════════════════════════════════════════════════════ */}
        {profile?.is_partner && (
          <section className="overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/5 to-slate-900">
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Handshake className="h-4 w-4 text-yellow-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-yellow-400">
                  Affiliate Partner
                </h2>
              </div>
              <p className="mb-4 text-sm text-stone-400">
                View your referral dashboard, track commissions, and manage your installer network.
              </p>
              <a
                href="/dashboard/partner"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
              >
                <Handshake className="h-4 w-4" />
                Open Partner Portal
              </a>
            </div>
          </section>
        )}

        {/* ── Group: Account ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">Account</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>

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
