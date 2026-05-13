"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendRealtorWelcomeEmail } from "@/lib/email";
import { getBlockedEmailDomain } from "@/lib/disposable-emails";
import {
  enforceActionRateLimit,
  RateLimitError,
} from "@/lib/server/action-rate-limit";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Onboarding — Create Account → Redirect to Realtor Dashboard
//
// Mirrors onboardInstaller() but for the realtor persona:
//   - Sets profiles.is_realtor = true
//   - Captures brokerage + license number
//   - Sends a realtor-flavored welcome email
//   - Does NOT touch service_zip / territory clusters (realtors do not
//     fulfill jobs; fulfillment is routed through installers).
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

export interface OnboardRealtorInput {
  name: string;
  brokerage: string;
  licenseNumber?: string;
  email: string;
  password: string;
}

export interface OnboardRealtorResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

export async function onboardRealtor(
  input: OnboardRealtorInput
): Promise<OnboardRealtorResult> {
  // Spam / abuse cap. Realtor signup is public, so key on IP — 5 attempts
  // per hour per address is enough headroom for genuine retries but kills
  // scripted account farming.
  try {
    await enforceActionRateLimit({
      action: "onboard-realtor",
      limit: 5,
      window: "1 h",
      identify: "ip",
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const { name, brokerage, licenseNumber, email, password } = input;

  if (!name?.trim() || !brokerage?.trim() || !email?.trim() || !password) {
    return { success: false, error: "Name, brokerage, email, and password are all required." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  // Block disposable / alias / privacy-cloaked email domains. Realtors are
  // a credibility-driven channel — we don't want anonymized signups here.
  const blockedDomain = getBlockedEmailDomain(email);
  if (blockedDomain) {
    return {
      success: false,
      error: "Please use a real brokerage or personal email address. Temporary and alias email services are not accepted.",
    };
  }

  try {
    // 1. Create the Supabase auth user.
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
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

    // 2. Parse name → first/last.
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 3. Upsert profile with the realtor flag and brokerage metadata.
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      business_name: brokerage.trim(),
      is_realtor: true,
      realtor_brokerage: brokerage.trim(),
      realtor_license: licenseNumber?.trim() || null,
    });

    if (profileError) {
      // Roll the auth user back so the email isn't blocked on retry.
      console.error("[OnboardRealtor] Profile insert failed, rolling back auth user:", profileError);
      await supabase.auth.admin.deleteUser(userId);
      return { success: false, error: "Failed to create realtor profile. Please try again." };
    }

    // 4. Fire-and-forget welcome email. We don't await — a Resend hiccup
    //    must not block signup.
    sendRealtorWelcomeEmail(email.trim().toLowerCase(), {
      name: firstName || name,
      brokerage: brokerage.trim(),
    }).catch((err) => {
      console.warn("[OnboardRealtor] Welcome email failed:", err);
    });

    console.log(`✅ Realtor account created: ${userId} (${brokerage.trim()})`);

    return { success: true, redirectUrl: "/realtors/dashboard" };
  } catch (err) {
    console.error("[OnboardRealtor] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Signup failed. Please try again.",
    };
  }
}
