"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import zipcodes from "zipcodes";
import { slugify } from "@/lib/utils";
import { sendInstallerOnboardingEmail } from "@/lib/email";
import { checkTerritoryAvailability, assignTerritoryCluster } from "@/app/actions/territory";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Onboarding — Create Account → Redirect to Dashboard
// No Stripe friction at signup. They connect Stripe later from profile.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

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
    // 0. Territory exclusivity check — MUST happen before auth user creation
    //    to prevent orphaned accounts when territory is taken.
    const baseZip = zipCode.trim();
    if (!/^\d{5}$/.test(baseZip)) {
      return { success: false, error: "Please enter a valid 5-digit ZIP code." };
    }

    const territoryCheck = await checkTerritoryAvailability(baseZip);
    if (!territoryCheck.available) {
      return {
        success: false,
        error: territoryCheck.reason || "This territory is unavailable. Try a different ZIP code.",
      };
    }

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

    // 2. Create profile (service_zips populated by territory cluster assignment below)
    const zipGeo = zipcodes.lookup(baseZip);

    await supabase.from("profiles").upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      business_name: businessName.trim(),
      service_zip: baseZip,
      service_radius_miles: DEFAULT_SERVICE_RADIUS,
      service_zips: [baseZip], // Temporary — overwritten by cluster assignment
      subscription_tier: "pro",
      latitude: zipGeo?.latitude ?? null,
      longitude: zipGeo?.longitude ?? null,
    });

    // 2a. Assign exclusive ZIP cluster (atomic via PRIMARY KEY on territory_zips)
    //     This is the real territory claim. If it fails (race condition where
    //     someone claimed the ZIP between our pre-check and now), we clean up.
    const clusterResult = await assignTerritoryCluster(userId, baseZip);
    if (!clusterResult.success) {
      // Clean up: delete the auth user + profile we just created
      console.error(`[Onboard] Territory claim failed for ${userId}, cleaning up:`, clusterResult.error);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: clusterResult.error || "This territory was just claimed. Try a different ZIP code.",
      };
    }

    console.log(
      `✅ Installer account created: ${userId} | Territory: ${clusterResult.assignedZips?.length} ZIPs (${clusterResult.tier})`
    );

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

    // 3. Send welcome email (Email 1: "Get Paid" Hook) + set onboarding step
    const displayName = businessName.trim() || firstName || name.trim();
    await sendInstallerOnboardingEmail(email.trim().toLowerCase(), {
      name: displayName,
      isPro: isTrialActivated,
    }).catch((err) => {
      // Don't fail onboarding if email fails
      console.error("[Onboard] Welcome email failed:", err);
    });

    // Mark onboarding step 1 (welcome email sent) for drip sequence
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_step: 1 })
        .eq("id", userId);
      console.log(`[Onboard] Onboarding step set to 1 for ${userId}`);
    } catch (stepErr) {
      console.error("[Onboard] Failed to set onboarding step:", stepErr);
    }

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
