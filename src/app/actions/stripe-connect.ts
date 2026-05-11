"use server";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import Stripe from "stripe";

// CSRF state cookie for Stripe Connect (C-2 hotfix).
// Bound to the originating browser session via an HTTP-only cookie that the
// /api/stripe/callback route verifies against the `state` URL parameter.
// The cookie name is duplicated in route.ts — "use server" modules cannot
// export non-async constants, so it lives as a string literal in both files.
const STRIPE_OAUTH_STATE_COOKIE = "stripe_oauth_state";
const STRIPE_OAUTH_STATE_TTL_SECONDS = 60 * 10; // 10 minutes

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

  // SECURITY (C-2 hotfix): the caller-supplied userId is not trusted.
  // Resolve the authoritative user from the session cookie and reject any
  // attempt to start a Stripe Connect flow for a different account.
  const authedUser = await getAuthenticatedUser();
  if (!authedUser) {
    return { success: false, error: "Unauthorized" };
  }
  if (userId && userId !== authedUser.id) {
    return { success: false, error: "Unauthorized" };
  }
  const resolvedUserId = authedUser.id;

  try {
    // 1. Check if user already has a Stripe account
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, email")
      .eq("id", resolvedUserId)
      .single();

    let stripeAccountId = profile?.stripe_account_id;

    // 2. Create a new Stripe Connect account if needed
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: profile?.email || undefined,
        metadata: {
          supabase_user_id: resolvedUserId,
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
        .eq("id", resolvedUserId);
    }

    // 3. Generate an Account Link for onboarding
    const { getAppUrl } = await import("@/lib/url-helper");
    const baseUrl = getAppUrl();

    // Generate a cryptographically secure CSRF state token and persist it in
    // an HTTP-only, short-lived cookie. The /api/stripe/callback route will
    // verify the URL `state` param against this cookie before binding.
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STRIPE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STRIPE_OAUTH_STATE_TTL_SECONDS,
    });

    const returnUrl = `${baseUrl}/api/stripe/callback?state=${encodeURIComponent(
      state
    )}&account_id=${encodeURIComponent(stripeAccountId)}`;

    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/dashboard/profile?stripe=refresh`,
        return_url: returnUrl,
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
        console.log("[Stripe] Invalid account ID, creating fresh account for user:", resolvedUserId);

        // Create a new account
        const newAccount = await stripe.accounts.create({
          type: "standard",
          email: profile?.email || undefined,
          metadata: {
            supabase_user_id: resolvedUserId,
          },
        });

        // Update database with new account ID
        await supabase
          .from("profiles")
          .update({
            stripe_account_id: newAccount.id,
            stripe_details_submitted: false,
          })
          .eq("id", resolvedUserId);

        const newReturnUrl = `${baseUrl}/api/stripe/callback?state=${encodeURIComponent(
          state
        )}&account_id=${encodeURIComponent(newAccount.id)}`;

        // Generate account link for new account
        const accountLink = await stripe.accountLinks.create({
          account: newAccount.id,
          refresh_url: `${baseUrl}/dashboard/profile?stripe=refresh`,
          return_url: newReturnUrl,
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
