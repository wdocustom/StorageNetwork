"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/utils";

// Lazy-initialize Supabase client to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables not configured");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Activate Pro subscription for a user.
 * - Sets is_pro = true
 * - Auto-generates a vanity slug from business_name
 * - Checks uniqueness; appends year if taken
 * - Saves stripe_subscription_id
 */
export async function activateProSubscription(
  userId: string,
  stripeSubscriptionId: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    // Fetch the profile to get business_name
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("business_name, first_name, last_name, slug")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    // If they already have a slug, keep it
    if (profile.slug) {
      await getSupabase()
        .from("profiles")
        .update({
          is_pro: true,
          stripe_subscription_id: stripeSubscriptionId,
        })
        .eq("id", userId);

      return { success: true, slug: profile.slug };
    }

    // Generate slug from business_name or full name
    const rawName =
      profile.business_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      userId.slice(0, 8);

    let slug = slugify(rawName);
    if (!slug) slug = userId.slice(0, 8);

    // Check uniqueness
    const { data: existing } = await getSupabase()
      .from("profiles")
      .select("id")
      .eq("slug", slug)
      .neq("id", userId)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${new Date().getFullYear()}`;
    }

    // Double-check the fallback slug
    const { data: existing2 } = await getSupabase()
      .from("profiles")
      .select("id")
      .eq("slug", slug)
      .neq("id", userId)
      .maybeSingle();

    if (existing2) {
      slug = `${slug}-${userId.slice(0, 4)}`;
    }

    // Save
    const { error } = await getSupabase()
      .from("profiles")
      .update({
        is_pro: true,
        slug,
        stripe_subscription_id: stripeSubscriptionId,
      })
      .eq("id", userId);

    if (error) {
      console.error("[ProSubscription] Update failed:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Pro activated for ${userId}, slug: ${slug}`);
    return { success: true, slug };
  } catch (err) {
    console.error("[ProSubscription] FULL ERROR:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Activation failed.",
    };
  }
}

/**
 * Deactivate Pro subscription.
 */
export async function deactivateProSubscription(
  userId: string
): Promise<{ success: boolean }> {
  await getSupabase()
    .from("profiles")
    .update({
      is_pro: false,
      stripe_subscription_id: null,
    })
    .eq("id", userId);

  return { success: true };
}
