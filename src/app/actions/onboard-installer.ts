"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Onboarding — Create Account → Redirect to Dashboard
// No Stripe friction at signup. They connect Stripe later from profile.
// ═══════════════════════════════════════════════════════════════════════════

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

export interface OnboardInput {
  name: string;
  businessName: string;
  email: string;
  password: string;
  zipCode: string;
}

export interface OnboardResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

/**
 * Onboarding flow (no Stripe):
 * 1. Create Supabase auth user
 * 2. Create profile row (installer role)
 * 3. Return dashboard URL → client redirects
 */
export async function onboardInstaller(
  input: OnboardInput
): Promise<OnboardResult> {
  const { name, businessName, email, password, zipCode } = input;

  if (!name || !email || !password || !zipCode) {
    return { success: false, error: "All fields are required." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  try {
    // 1. Create auth user
    const { data: authData, error: authError } =
      await getSupabase().auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        return {
          success: false,
          error: "An account with this email already exists. Please sign in instead.",
        };
      }
      return { success: false, error: authError.message };
    }

    const userId = authData.user.id;

    // Parse name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 2. Create profile
    await getSupabase().from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      business_name: businessName.trim(),
      service_zip: zipCode.trim(),
      service_zips: [zipCode.trim()],
      subscription_tier: "free",
    });

    console.log("✅ Installer account created:", userId);

    // 3. Redirect to dashboard (no Stripe step)
    return { success: true, redirectUrl: "/dashboard" };
  } catch (err) {
    console.error("[Onboard] FULL ERROR:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onboarding failed. Please try again.",
    };
  }
}
