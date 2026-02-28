"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import zipcodes from "zipcodes";
import { slugify } from "@/lib/utils";
import { sendInstallerOnboardingEmail } from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Onboarding — Create Account → Redirect to Dashboard
// No Stripe friction at signup. They connect Stripe later from profile.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default service radius for new installers (miles)
const DEFAULT_SERVICE_RADIUS = 25;

export interface OnboardInput {
  name: string;
  businessName: string;
  email: string;
  password: string;
  zipCode: string;
  withStandardTrial?: boolean; // Activate trial on signup
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

    // Parse name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 2. Create profile with radius-expanded service area
    const baseZip = zipCode.trim();
    const coveredZips = zipcodes.radius(baseZip, DEFAULT_SERVICE_RADIUS) ?? [baseZip];

    await supabase.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      business_name: businessName.trim(),
      service_zip: baseZip,
      service_radius_miles: DEFAULT_SERVICE_RADIUS,
      service_zips: coveredZips.length > 0 ? coveredZips : [baseZip],
      subscription_tier: "pro",
    });

    console.log("✅ Installer account created:", userId);

    // 2b. Check for affiliate referral cookie → link to partner + activate 7-day Pro trial
    let isTrialActivated = false;
    try {
      const cookieStore = await cookies();
      const affiliateSlug = cookieStore.get("sn_affiliate_slug")?.value;

      if (affiliateSlug) {
        const { data: partner } = await supabase
          .from("partners")
          .select("id, name, company")
          .eq("slug", affiliateSlug)
          .single();

        if (partner) {
          // Create referral record
          await supabase.from("referrals").insert({
            partner_id: partner.id,
            installer_id: userId,
            status: "pending", // Activates when they subscribe
          });

          // ── Trial — 3 jobs or 45 days, courtesy of the referring partner ──
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 45);
          const partnerDisplayName = partner.company || partner.name;

          // Generate a slug for the trial (Pro feature)
          const rawName = businessName.trim() || name.trim() || userId.slice(0, 8);
          let trialSlug = slugify(rawName);
          if (!trialSlug) trialSlug = userId.slice(0, 8);

          // Check slug uniqueness
          const { data: existingSlug } = await supabase
            .from("profiles")
            .select("id")
            .eq("slug", trialSlug)
            .neq("id", userId)
            .maybeSingle();

          if (existingSlug) {
            trialSlug = `${trialSlug}-${new Date().getFullYear()}`;
          }

          await supabase
            .from("profiles")
            .update({
              is_pro: true,
              slug: trialSlug,
              pro_trial_ends_at: trialEnd.toISOString(),
              pro_trial_partner: partnerDisplayName,
            })
            .eq("id", userId);

          isTrialActivated = true;
          console.log(`✅ Referral + trial activated: ${userId} → partner ${partner.id} (slug: ${affiliateSlug}) | Trial ends: ${trialEnd.toISOString()}`);
        }
      }
    } catch (refErr) {
      // Non-fatal — don't block onboarding if referral tracking fails
      console.error("[Onboard] Referral tracking failed (non-fatal):", refErr);
    }

    // 2c. Standard trial (CTA join — no partner) if no affiliate trial was activated
    if (!isTrialActivated && input.withStandardTrial) {
      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 45);

        const rawName = businessName.trim() || name.trim() || userId.slice(0, 8);
        let trialSlug = slugify(rawName);
        if (!trialSlug) trialSlug = userId.slice(0, 8);

        const { data: existingSlug } = await supabase
          .from("profiles")
          .select("id")
          .eq("slug", trialSlug)
          .neq("id", userId)
          .maybeSingle();

        if (existingSlug) {
          trialSlug = `${trialSlug}-${new Date().getFullYear()}`;
        }

        await supabase
          .from("profiles")
          .update({
            is_pro: true,
            slug: trialSlug,
            pro_trial_ends_at: trialEnd.toISOString(),
            pro_trial_partner: null,
          })
          .eq("id", userId);

        isTrialActivated = true;
        console.log(`✅ Trial activated: ${userId} | Trial ends: ${trialEnd.toISOString()}`);
      } catch (trialErr) {
        console.error("[Onboard] Standard trial activation failed (non-fatal):", trialErr);
      }
    }

    // 3. Send welcome email with fee structure
    const displayName = businessName.trim() || firstName || name.trim();
    await sendInstallerOnboardingEmail(email.trim().toLowerCase(), {
      name: displayName,
      isPro: isTrialActivated,
    }).catch((err) => {
      // Don't fail onboarding if email fails
      console.error("[Onboard] Welcome email failed:", err);
    });

    // 4. Redirect to dashboard (no Stripe step)
    return { success: true, redirectUrl: "/dashboard" };
  } catch (err) {
    console.error("[Onboard] FULL ERROR:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onboarding failed. Please try again.",
    };
  }
}
