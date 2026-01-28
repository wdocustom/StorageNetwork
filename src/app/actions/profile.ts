"use server";

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Profile — Server actions for profile management
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProfileUpdateInput {
  user_id: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  trade_name?: string;
  phone?: string;
  service_zip?: string;
  avatar_url?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Update user profile information.
 */
export async function updateProfile(
  input: ProfileUpdateInput
): Promise<ProfileUpdateResult> {
  const { user_id, ...updates } = input;

  // Filter out undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(cleanUpdates).length === 0) {
    return { success: true }; // Nothing to update
  }

  const { error } = await supabase
    .from("profiles")
    .update(cleanUpdates)
    .eq("id", user_id);

  if (error) {
    console.error("Profile update error:", error);
    return { success: false, error: "Failed to save changes." };
  }

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
 * Update user's custom booking slug (PRO only).
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

  // Check if user is PRO
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  if (profile?.subscription_tier !== "pro") {
    return { success: false, error: "Custom slugs require a Pro subscription." };
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

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUploadUrl(path);

  if (error) {
    console.error("Avatar upload URL error:", error);
    return { success: false, error: "Failed to generate upload URL." };
  }

  return {
    success: true,
    url: data.signedUrl,
    path,
  };
}

/**
 * Get the public URL for an avatar.
 */
export async function getAvatarPublicUrl(path: string): Promise<string | null> {
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || null;
}
