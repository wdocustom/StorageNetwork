"use server";

import { getServiceClient } from "@/lib/supabase-server";
import Stripe from "stripe";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Connect — Onboarding & Account Management for Installers
// ═══════════════════════════════════════════════════════════════════════════

const supabase = getServiceClient();

// Initialize Stripe only if key is present
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export interface ConnectResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Create or retrieve a Stripe Connect account and generate an onboarding link.
 * The installer is redirected to Stripe's hosted onboarding flow.
 */
export async function connectStripe(userId: string): Promise<ConnectResult> {
  if (!stripe) {
    return {
      success: false,
      error: "Stripe is not configured. Please contact support.",
    };
  }

  try {
    // 1. Check if user already has a Stripe account
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, email")
      .eq("id", userId)
      .single();

    let stripeAccountId = profile?.stripe_account_id;

    // 2. Create a new Stripe Connect account if needed
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: profile?.email || undefined,
        metadata: {
          supabase_user_id: userId,
        },
      });

      stripeAccountId = account.id;

      // Save to profiles
      await supabase
        .from("profiles")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_details_submitted: false,
        })
        .eq("id", userId);
    }

    // 3. Generate an Account Link for onboarding
    const { getAppUrl } = await import("@/lib/url-helper");
    const baseUrl = getAppUrl();

    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/dashboard/profile?stripe=refresh`,
        return_url: `${baseUrl}/dashboard/profile?stripe=success`,
        type: "account_onboarding",
      });

      return {
        success: true,
        url: accountLink.url,
      };
    } catch (linkError: unknown) {
      // If account link fails (account doesn't exist on this platform),
      // clear the old ID and create a fresh account
      const errorMessage = linkError instanceof Error ? linkError.message : String(linkError);
      if (errorMessage.includes("not connected to your platform") ||
          errorMessage.includes("does not exist")) {
        console.log("[Stripe] Invalid account ID, creating fresh account for user:", userId);

        // Create a new account
        const newAccount = await stripe.accounts.create({
          type: "standard",
          email: profile?.email || undefined,
          metadata: {
            supabase_user_id: userId,
          },
        });

        // Update database with new account ID
        await supabase
          .from("profiles")
          .update({
            stripe_account_id: newAccount.id,
            stripe_details_submitted: false,
          })
          .eq("id", userId);

        // Generate account link for new account
        const accountLink = await stripe.accountLinks.create({
          account: newAccount.id,
          refresh_url: `${baseUrl}/dashboard/profile?stripe=refresh`,
          return_url: `${baseUrl}/dashboard/profile?stripe=success`,
          type: "account_onboarding",
        });

        return {
          success: true,
          url: accountLink.url,
        };
      }

      // Re-throw if it's a different error
      throw linkError;
    }
  } catch (err) {
    console.error("Stripe Connect error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to connect Stripe.",
    };
  }
}

/**
 * Check the status of a Stripe Connect account.
 * Returns whether the account has completed onboarding.
 */
export async function getStripeStatus(userId: string) {
  if (!stripe) {
    return {
      connected: false,
      details_submitted: false,
      charges_enabled: false,
      error: "Stripe not configured",
    };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_account_id) {
      return {
        connected: false,
        details_submitted: false,
        charges_enabled: false,
      };
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // Update our database with the latest status
    if (account.details_submitted) {
      await supabase
        .from("profiles")
        .update({ stripe_details_submitted: true })
        .eq("id", userId);
    }

    return {
      connected: true,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    };
  } catch (err) {
    console.error("Stripe status error:", err);
    return {
      connected: false,
      details_submitted: false,
      charges_enabled: false,
      error: "Failed to check Stripe status",
    };
  }
}

/**
 * Generate a login link to the Stripe Express Dashboard.
 * Allows installers to manage their connected account.
 */
export async function getStripeDashboardLink(userId: string): Promise<ConnectResult> {
  if (!stripe) {
    return {
      success: false,
      error: "Stripe not configured",
    };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_account_id) {
      return {
        success: false,
        error: "No Stripe account connected",
      };
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_account_id
    );

    return {
      success: true,
      url: loginLink.url,
    };
  } catch (err) {
    console.error("[StripeDashboard] Login link creation failed:", err);
    // Fallback: link to Stripe's direct dashboard
    return {
      success: true,
      url: "https://dashboard.stripe.com/",
    };
  }
}
