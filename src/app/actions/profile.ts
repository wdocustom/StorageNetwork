"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase-server";
import { TtlCache } from "@/lib/cache";

// ═══════════════════════════════════════════════════════════════════════════
// Profile — Server actions for profile management
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

/** Cache for public profile reads (60s TTL) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profileCache = new TtlCache<any>(60_000);

/** Revalidate the public portfolio page so Next.js serves fresh data. */
async function revalidatePortfolio(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("slug")
    .eq("id", userId)
    .single();
  if (data?.slug) {
    revalidatePath(`/p/${data.slug}`);
  }
}

export interface ProfileUpdateInput {
  user_id: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  trade_name?: string;
  phone?: string;
  service_zip?: string;
  city?: string;
  state?: string;
  address_line1?: string;
  avatar_url?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Stamp the last login timestamp for a user.
 * Uses service role to bypass RLS so it never fails silently.
 */
export async function stampLastLogin(userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Check if an installer account is suspended.
 * Returns suspension details including reason and Stripe subscription info
 * so the login page can show the appropriate remediation UI.
 */
export async function checkSuspensionStatus(userId: string): Promise<{
  suspended: boolean;
  reason: "manual" | "payment" | null;
  stripeSubscriptionId: string | null;
}> {
  const { data } = await supabase
    .from("profiles")
    .select("is_suspended, suspension_reason, stripe_subscription_id")
    .eq("id", userId)
    .single();

  if (!data || !data.is_suspended) {
    return { suspended: false, reason: null, stripeSubscriptionId: null };
  }

  return {
    suspended: true,
    reason: data.suspension_reason ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
  };
}

/**
 * Update user profile information.
 */
export async function updateProfile(
  input: ProfileUpdateInput
): Promise<ProfileUpdateResult> {
  const { user_id, ...updates } = input;

  // Convert undefined values to null (Supabase rejects undefined)
  const cleanUpdates: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value || null;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) {
    return { success: true }; // Nothing to update
  }

  console.log("[Profile Update] user_id:", user_id);
  console.log("[Profile Update] fields:", Object.keys(cleanUpdates));

  const { error } = await supabase
    .from("profiles")
    .update(cleanUpdates)
    .eq("id", user_id);

  if (error) {
    console.error("SUPABASE UPDATE ERROR:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return { success: false, error: error.message };
  }

  await revalidatePortfolio(user_id);
  console.log("[Profile Update] Success");
  return { success: true };
}

export interface SlugCheckResult {
  available: boolean;
  error?: string;
}

/**
 * Check if a custom slug is available.
 */
export async function checkSlugAvailability(
  slug: string,
  userId: string
): Promise<SlugCheckResult> {
  // Normalize slug: lowercase, alphanumeric and hyphens only
  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length < 3) {
    return { available: false, error: "Slug must be at least 3 characters." };
  }

  if (normalized.length > 30) {
    return { available: false, error: "Slug must be 30 characters or less." };
  }

  // Reserved slugs
  const reserved = ["admin", "dashboard", "login", "signup", "book", "design", "api"];
  if (reserved.includes(normalized)) {
    return { available: false, error: "This slug is reserved." };
  }

  // Check database for existing slug (excluding current user)
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("slug", normalized)
    .neq("id", userId)
    .single();

  if (data) {
    return { available: false, error: "This slug is already taken." };
  }

  return { available: true };
}

export interface SlugUpdateResult {
  success: boolean;
  slug?: string;
  error?: string;
}

/**
 * Update user's custom booking slug.
 */
export async function updateSlug(
  userId: string,
  slug: string
): Promise<SlugUpdateResult> {
  // Normalize
  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Validate
  const check = await checkSlugAvailability(normalized, userId);
  if (!check.available) {
    return { success: false, error: check.error };
  }

  // Update
  const { error } = await supabase
    .from("profiles")
    .update({ slug: normalized })
    .eq("id", userId);

  if (error) {
    return { success: false, error: "Failed to update slug." };
  }

  return { success: true, slug: normalized };
}

/**
 * Get profile by slug (for branded booking page resolution).
 */
export async function getProfileBySlug(slug: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, business_name, avatar_url")
    .eq("slug", slug.toLowerCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get full profile by slug (for the public portfolio page).
 * Cached for 60s to absorb viral traffic on /p/[slug] pages.
 */
export async function getFullProfileBySlug(slug: string) {
  const key = `fullprofile:${slug.trim().toLowerCase()}`;

  return profileCache.getOrFetch(key, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, business_name, trade_name, phone, city, state, avatar_url, slug, is_pro, is_partner, bio, instagram_url, facebook_url, portfolio_photos, lead_time_days, working_days, services_config"
      )
      .ilike("slug", slug.trim())
      .single();

    if (error || !data) {
      console.error("[getFullProfileBySlug]", slug, error?.message);
      return null;
    }

    // Ensure portfolio_photos is always an array (handles string-encoded JSON)
    if (data.portfolio_photos && typeof data.portfolio_photos === "string") {
      try {
        data.portfolio_photos = JSON.parse(data.portfolio_photos);
      } catch {
        data.portfolio_photos = [];
      }
    }

    return data;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Management — Bio, social links, and portfolio photos
// ═══════════════════════════════════════════════════════════════════════════

export interface PortfolioPhoto {
  url: string;
  caption?: string;
}

/**
 * Update portfolio settings (bio, social links).
 */
export async function updatePortfolioSettings(input: {
  user_id: string;
  bio?: string;
  instagram_url?: string;
  facebook_url?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { user_id, ...updates } = input;

  const cleanUpdates: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value?.trim() || null;
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(cleanUpdates)
    .eq("id", user_id);

  if (error) {
    console.error("[Portfolio Settings] Update error:", error);
    return { success: false, error: error.message };
  }

  await revalidatePortfolio(user_id);
  return { success: true };
}

/**
 * Upload a portfolio photo to storage and add to the JSONB array.
 */
export async function uploadPortfolioPhoto(
  userId: string,
  base64Data: string,
  fileExt: string,
  caption?: string
): Promise<{ success: boolean; photo?: PortfolioPhoto; error?: string }> {
  const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!allowedExts.includes(fileExt)) {
    return { success: false, error: "Invalid file type. Use JPG, PNG, GIF, or WebP." };
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
  const path = `${userId}/${filename}`;

  try {
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType = fileExt === "jpg" ? "image/jpeg" : `image/${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("portfolio")
      .upload(path, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("[Portfolio Upload] Storage error:", uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const newPhoto: PortfolioPhoto = { url: publicUrl, caption: caption || "" };

    // Fetch current photos, append, save
    const { data: profile } = await supabase
      .from("profiles")
      .select("portfolio_photos")
      .eq("id", userId)
      .single();

    const currentPhotos: PortfolioPhoto[] = (profile?.portfolio_photos as PortfolioPhoto[]) || [];
    currentPhotos.push(newPhoto);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ portfolio_photos: currentPhotos })
      .eq("id", userId);

    if (updateError) {
      console.error("[Portfolio Upload] Profile update error:", updateError);
      return { success: false, error: "Photo uploaded but failed to save to profile." };
    }

    await revalidatePortfolio(userId);
    return { success: true, photo: newPhoto };
  } catch (err) {
    console.error("[Portfolio Upload] Unexpected error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Upload error: ${msg}` };
  }
}

/**
 * Delete a portfolio photo from storage and remove from the JSONB array.
 */
export async function deletePortfolioPhoto(
  userId: string,
  photoUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract storage path from URL
    const bucketUrl = supabase.storage.from("portfolio").getPublicUrl("").data.publicUrl;
    const storagePath = photoUrl.replace(bucketUrl, "").replace(/^\//, "");

    if (storagePath) {
      await supabase.storage.from("portfolio").remove([storagePath]);
    }

    // Remove from JSONB array
    const { data: profile } = await supabase
      .from("profiles")
      .select("portfolio_photos")
      .eq("id", userId)
      .single();

    const currentPhotos: PortfolioPhoto[] = (profile?.portfolio_photos as PortfolioPhoto[]) || [];
    const updatedPhotos = currentPhotos.filter((p) => p.url !== photoUrl);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ portfolio_photos: updatedPhotos })
      .eq("id", userId);

    if (updateError) {
      console.error("[Portfolio Delete] Profile update error:", updateError);
      return { success: false, error: "Failed to update profile." };
    }

    await revalidatePortfolio(userId);
    return { success: true };
  } catch (err) {
    console.error("[Portfolio Delete] Unexpected error:", err);
    return { success: false, error: "Unexpected error during deletion." };
  }
}

/**
 * Upload avatar and return the public URL.
 * This generates a signed upload URL for the client to use.
 */
export async function getAvatarUploadUrl(
  userId: string,
  fileName: string
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  const fileExt = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"];

  if (!allowedExts.includes(fileExt)) {
    return { success: false, error: "Invalid file type. Use JPG, PNG, GIF, or WebP." };
  }

  const path = `${userId}/avatar.${fileExt}`;

  try {
    console.log("[Avatar Upload] Requesting signed URL for path:", path);

    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[Avatar Upload] Supabase Storage error:", {
        message: error.message,
        name: error.name,
        status: (error as unknown as Record<string, unknown>).status,
        statusCode: (error as unknown as Record<string, unknown>).statusCode,
      });
      return { success: false, error: `Upload failed: ${error.message}` };
    }

    console.log("[Avatar Upload] Signed URL generated successfully");
    return {
      success: true,
      url: data.signedUrl,
      path,
    };
  } catch (err) {
    console.error("[Avatar Upload] Unexpected error:", err);
    return { success: false, error: "Unexpected error generating upload URL." };
  }
}

/**
 * Get the public URL for an avatar.
 */
export async function getAvatarPublicUrl(path: string): Promise<string | null> {
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Server-side avatar upload — used as fallback when client upload fails.
 * Accepts a base64-encoded image and uploads via service role key.
 */
export async function uploadAvatarServerSide(
  userId: string,
  base64Data: string,
  fileExt: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"];
  if (!allowedExts.includes(fileExt)) {
    return { success: false, error: "Invalid file type." };
  }

  const path = `${userId}/avatar.${fileExt}`;

  try {
    console.log("[Avatar Server Upload] Uploading to path:", path);

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType = fileExt === "jpg" ? "image/jpeg" : `image/${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Avatar Server Upload] Storage error:", {
        message: uploadError.message,
        name: uploadError.name,
      });
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (profileError) {
      console.error("[Avatar Server Upload] Profile update error:", profileError);
      return { success: false, error: "Photo uploaded but profile update failed." };
    }

    console.log("[Avatar Server Upload] Success:", publicUrl);
    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("[Avatar Server Upload] Unexpected error:", err);
    return { success: false, error: "Unexpected error during upload." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Services Config — Manage service offerings shown on portfolio page
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceOffering {
  id: string;
  name: string;
  description: string;
  price: number | null; // null for tote_storage (priced via configurator)
  enabled: boolean;
  built_in: boolean;
}

/** Default built-in services every installer starts with */
export const DEFAULT_SERVICES: ServiceOffering[] = [
  {
    id: "tote_storage",
    name: "Custom Tote Storage",
    description: "Design in 3D, get instant pricing, book installation.",
    price: null,
    enabled: true,
    built_in: true,
  },
  {
    id: "cleanout_1car",
    name: "1-Car Garage Clean Out",
    description: "Single bay / small basement",
    price: 349,
    enabled: true,
    built_in: true,
  },
  {
    id: "cleanout_2car",
    name: "2-Car Garage Clean Out",
    description: "Double bay / large basement",
    price: 549,
    enabled: true,
    built_in: true,
  },
];

/** Read services config for an installer, falling back to defaults if NULL */
export async function getServicesConfig(userId: string): Promise<ServiceOffering[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("services_config")
    .eq("id", userId)
    .single();

  if (error || !data?.services_config) {
    return DEFAULT_SERVICES;
  }

  return data.services_config as ServiceOffering[];
}

/** Save services config and revalidate the portfolio page */
export async function updateServicesConfig(
  userId: string,
  services: ServiceOffering[]
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({ services_config: services })
    .eq("id", userId);

  if (error) {
    console.error("[updateServicesConfig]", error);
    return { success: false, error: "Failed to save services." };
  }

  // Bust cache and revalidate public portfolio
  profileCache.clear();
  await revalidatePortfolio(userId);

  return { success: true };
}
