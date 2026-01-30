"use server";

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Onboarding — Create Account + Stripe Connect Redirect
// Server action only. All secrets stay server-side.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface OnboardInput {
  name: string;
  businessName: string;
  email: string;
  password: string;
  zipCode: string;
}

export interface OnboardResult {
  success: boolean;
  stripeUrl?: string;
  error?: string;
}

/**
 * Full onboarding flow:
 * 1. Create Supabase auth user
 * 2. Create profile row (installer role)
 * 3. Create Stripe Connect account
 * 4. Generate Stripe onboarding link
 * 5. Return URL → client redirects to Stripe
 */
export async function onboardInstaller(
  input: OnboardInput
): Promise<OnboardResult> {
  const { name, businessName, email, password, zipCode } = input;

  // Validate
  if (!name || !email || !password || !zipCode) {
    return { success: false, error: "All fields are required." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }
  if (!stripe) {
    return { success: false, error: "Payment system not configured." };
  }

  try {
    // 1. Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true, // Auto-confirm for onboarding flow
      });

    if (authError) {
      // Handle duplicate email
      if (authError.message?.includes("already been registered")) {
        return { success: false, error: "An account with this email already exists. Please sign in instead." };
      }
      return { success: false, error: authError.message };
    }

    const userId = authData.user.id;

    // Parse name into first/last
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 2. Create/update profile
    await supabase.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      business_name: businessName.trim(),
      service_zip: zipCode.trim(),
      service_zips: [zipCode.trim()],
      subscription_tier: "free",
    });

    // 3. Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: "standard",
      email: email.trim().toLowerCase(),
      business_profile: {
        name: businessName.trim(),
      },
      metadata: {
        supabase_user_id: userId,
      },
    });

    // 4. Save Stripe account ID to profile
    await supabase
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_details_submitted: false,
      })
      .eq("id", userId);

    // 5. Generate Stripe onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/partner/join?stripe=refresh`,
      return_url: `${baseUrl}/api/stripe/callback?account_id=${account.id}`,
      type: "account_onboarding",
    });

    return {
      success: true,
      stripeUrl: accountLink.url,
    };
  } catch (err) {
    console.error("[Onboard] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onboarding failed. Please try again.",
    };
  }
}
