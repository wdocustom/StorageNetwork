"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import zipcodes from "zipcodes";
import { slugify } from "@/lib/utils";
import { sendInstallerOnboardingEmail } from "@/lib/email";
import { assignTerritoryCluster } from "@/app/actions/territory";
import { getBlockedEmailDomain } from "@/lib/disposable-emails";

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

  // Block disposable / alias / privacy-cloaked email domains
  const blockedDomain = getBlockedEmailDomain(email);
  if (blockedDomain) {
    console.warn(`[Onboard] Blocked disposable email domain: ${blockedDomain} (${email})`);
    return {
      success: false,
      error: "Please use a real business or personal email address. Temporary and alias email services are not accepted.",
    };
  }

  try {
    // 0. Validate ZIP format
    const baseZip = zipCode.trim();
    if (!/^\d{5}$/.test(baseZip)) {
      return { success: false, error: "Please enter a valid 5-digit ZIP code." };
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

    // 2a. Assign ZIP cluster (shared territories — multiple installers can cover same ZIPs)
    const clusterResult = await assignTerritoryCluster(userId, baseZip);
    if (!clusterResult.success) {
      console.error(`[Onboard] Territory claim failed for ${userId}, cleaning up:`, clusterResult.error);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: clusterResult.error || "Failed to set up territory. Please try again.",
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

          // ── Cross-link into new affiliate program. If the legacy partner
          //    has a linked user_id AND that user has an active agreement,
          //    set referred_by_installer_id so Phase 5's payout pipeline
          //    fires on this recruit's invoices too. Idempotent: only sets
          //    when currently NULL.
          const { data: partnerUser } = await supabase
            .from("partners")
            .select("user_id")
            .eq("id", partner.id)
            .maybeSingle();
          if (partnerUser?.user_id) {
            const { data: activeAgreement } = await supabase
              .from("affiliate_agreements")
              .select("id")
              .eq("affiliate_id", partnerUser.user_id)
              .eq("status", "active")
              .maybeSingle();
            if (activeAgreement) {
              await supabase
                .from("profiles")
                .update({ referred_by_installer_id: partnerUser.user_id })
                .eq("id", userId)
                .is("referred_by_installer_id", null);
            }
          }
        }
      }
    } catch (refErr) {
      // Non-fatal — don't block onboarding if referral tracking fails
      console.error("[Onboard] Referral tracking failed (non-fatal):", refErr);
    }

    // 2b'. Affiliate cold-email invite attribution (Phase 6, fixed in 6.5).
    //      Activates the trial AND attributes the recruit to the referring
    //      affiliate. When this block claims attribution, it ALSO overrides
    //      pro_trial_partner — otherwise a stale value from the legacy
    //      partner-slug block (e.g. "WDO Custom") would still drive the
    //      "courtesy of X" dashboard banner even though the new system
    //      correctly attributes the recruit elsewhere.
    //
    //      Priority is intentional: when both the legacy slug cookie AND
    //      an invite cookie exist, this block claims attribution because
    //      the invite is more recent + more specific (a person typed the
    //      prospect's email; the slug cookie may have been sitting for 30
    //      days from a different click).
    try {
      const cookieStore = await cookies();
      const inviteToken = cookieStore.get("sn_affiliate_invite")?.value;
      if (inviteToken) {
        const { data: invite } = await supabase
          .from("affiliate_email_invites")
          .select("id, referring_installer_id, prospect_email, status")
          .eq("invite_token", inviteToken)
          .maybeSingle();
        if (invite && invite.referring_installer_id !== userId) {
          // Only attribute if the referrer has an active agreement —
          // otherwise the recruit row sits unattributable until/unless
          // an admin sets one up.
          const { data: activeAgreement } = await supabase
            .from("affiliate_agreements")
            .select("id")
            .eq("affiliate_id", invite.referring_installer_id)
            .eq("status", "active")
            .maybeSingle();
          if (activeAgreement) {
            // Look up the referrer's display name for pro_trial_partner.
            const { data: referrerProfile } = await supabase
              .from("profiles")
              .select("business_name, first_name, last_name")
              .eq("id", invite.referring_installer_id)
              .maybeSingle();
            const referrerName =
              (referrerProfile?.business_name as string | null) ||
              [referrerProfile?.first_name, referrerProfile?.last_name]
                .filter(Boolean)
                .join(" ") ||
              "An installer";

            // ── Claim attribution (first-write-wins on referred_by_installer_id).
            // If the legacy block already claimed (referred_by != null), this
            // is a no-op for both columns — we don't poach attribution from
            // a partner who got there first via slug.
            const { data: claimed } = await supabase
              .from("profiles")
              .update({
                referred_by_installer_id: invite.referring_installer_id,
                pro_trial_partner: referrerName,
              })
              .eq("id", userId)
              .is("referred_by_installer_id", null)
              .select("id")
              .maybeSingle();

            // ── If we successfully claimed AND legacy didn't activate a
            //    trial yet, activate one now so the recruit gets the same
            //    45-day / 3-job courtesy trial the legacy path provides.
            //    Setting isTrialActivated prevents block 2c from later
            //    overwriting pro_trial_partner to null.
            if (claimed && !isTrialActivated) {
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + 45);

              const rawName =
                businessName.trim() || name.trim() || userId.slice(0, 8);
              let trialSlug = slugify(rawName);
              if (!trialSlug) trialSlug = userId.slice(0, 8);

              const { data: slugClash } = await supabase
                .from("profiles")
                .select("id")
                .eq("slug", trialSlug)
                .neq("id", userId)
                .maybeSingle();
              if (slugClash) {
                trialSlug = `${trialSlug}-${new Date().getFullYear()}`;
              }

              await supabase
                .from("profiles")
                .update({
                  is_pro: true,
                  slug: trialSlug,
                  pro_trial_ends_at: trialEnd.toISOString(),
                })
                .eq("id", userId);

              isTrialActivated = true;
              console.log(
                `✅ Phase-6 invite trial activated: ${userId} ← referrer ${invite.referring_installer_id} (${referrerName})`
              );
            }

            // Mark the invite as signed_up so the affiliate's portal
            // reflects conversion. Done regardless of whether we won the
            // attribution race — the invite still produced a signup.
            await supabase
              .from("affiliate_email_invites")
              .update({
                status: "signed_up",
                signed_up_at: new Date().toISOString(),
                signed_up_user_id: userId,
              })
              .eq("id", invite.id);

            if (!claimed) {
              console.log(
                `[Onboard] Affiliate invite attribution: legacy slug claimed first, invite recorded as signed_up only: ${userId}`
              );
            } else {
              console.log(
                `✅ Affiliate invite attribution: ${userId} ← referrer ${invite.referring_installer_id} (${referrerName})`
              );
            }
          }
        }
      }
    } catch (inviteErr) {
      console.error("[Onboard] Affiliate invite attribution failed (non-fatal):", inviteErr);
    }

    // 2b''. Affiliate public-referral-link attribution (Phase 6.6).
    //       The /join/[slug] route sets sn_affiliate_link when the slug
    //       belongs to an installer with an active affiliate agreement.
    //       Same atomic claim shape as the Phase 6 invite block, just
    //       sourced from a public slug click instead of a personal invite
    //       token. Priority order remains: invite token > public link >
    //       legacy partner slug — but in practice only one cookie tends
    //       to be live, and first-write-wins on referred_by_installer_id
    //       handles the rest.
    try {
      const cookieStore = await cookies();
      const linkAffiliateId = cookieStore.get("sn_affiliate_link")?.value;
      if (linkAffiliateId && linkAffiliateId !== userId) {
        const { data: activeAgreement } = await supabase
          .from("affiliate_agreements")
          .select("id")
          .eq("affiliate_id", linkAffiliateId)
          .eq("status", "active")
          .maybeSingle();
        if (activeAgreement) {
          const { data: referrerProfile } = await supabase
            .from("profiles")
            .select("business_name, first_name, last_name")
            .eq("id", linkAffiliateId)
            .maybeSingle();
          const referrerName =
            (referrerProfile?.business_name as string | null) ||
            [referrerProfile?.first_name, referrerProfile?.last_name]
              .filter(Boolean)
              .join(" ") ||
            "An installer";

          // Atomic claim — first-write-wins. No-op if earlier block already
          // claimed referred_by_installer_id.
          const { data: claimed } = await supabase
            .from("profiles")
            .update({
              referred_by_installer_id: linkAffiliateId,
              pro_trial_partner: referrerName,
            })
            .eq("id", userId)
            .is("referred_by_installer_id", null)
            .select("id")
            .maybeSingle();

          // If we won the claim AND no trial has been activated yet,
          // activate one — same shape as the invite block.
          if (claimed && !isTrialActivated) {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 45);

            const rawName =
              businessName.trim() || name.trim() || userId.slice(0, 8);
            let trialSlug = slugify(rawName);
            if (!trialSlug) trialSlug = userId.slice(0, 8);

            const { data: slugClash } = await supabase
              .from("profiles")
              .select("id")
              .eq("slug", trialSlug)
              .neq("id", userId)
              .maybeSingle();
            if (slugClash) {
              trialSlug = `${trialSlug}-${new Date().getFullYear()}`;
            }

            await supabase
              .from("profiles")
              .update({
                is_pro: true,
                slug: trialSlug,
                pro_trial_ends_at: trialEnd.toISOString(),
              })
              .eq("id", userId);

            isTrialActivated = true;
            console.log(
              `✅ Phase-6.6 public-link trial activated: ${userId} ← referrer ${linkAffiliateId} (${referrerName})`
            );
          }

          if (claimed) {
            console.log(
              `✅ Affiliate public-link attribution: ${userId} ← referrer ${linkAffiliateId} (${referrerName})`
            );
          } else {
            console.log(
              `[Onboard] Public-link attribution: earlier block claimed first, skipping: ${userId}`
            );
          }
        }
      }
    } catch (linkErr) {
      console.error("[Onboard] Affiliate public-link attribution failed (non-fatal):", linkErr);
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
