"use server";

import { getServiceClient } from "@/lib/supabase-server";
import { slugify } from "@/lib/utils";
import { getAppUrl } from "@/lib/url-helper";
import { sendWaitlistedLeadsUnlocked, sendWaitlistedLeadPaymentReady } from "@/lib/email";
import { getDepositAmount } from "@/app/actions/fee-engine";
import Stripe from "stripe";

const db = getServiceClient;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Pro subscription price: $49/month (launch promo — first 50 subscribers)
const PRO_MONTHLY_PRICE_CENTS = 4900;

/**
 * Create a Stripe checkout session for Pro subscription.
 * Returns the checkout URL for redirect.
 */
export async function createProCheckoutSession(
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    // Get user email for Stripe
    const { data: profile } = await db()
      .from("profiles")
      .select("business_name, first_name, last_name")
      .eq("id", userId)
      .single();

    const { data: authUser } = await db().auth.admin.getUserById(userId);
    const email = authUser?.user?.email;

    if (!email) {
      return { success: false, error: "User email not found" };
    }

    const businessName =
      profile?.business_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "Installer";

    const baseUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Storage Network Pro",
              description: "Pro subscription: 3% maintenance fee, custom link, branded portfolio, deposit splits",
            },
            unit_amount: PRO_MONTHLY_PRICE_CENTS,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        type: "pro_subscription",
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      success_url: `${baseUrl}/dashboard/profile?pro=success`,
      cancel_url: `${baseUrl}/dashboard/profile?pro=cancelled`,
    });

    return { success: true, url: session.url ?? undefined };
  } catch (err) {
    console.error("[ProCheckout] Error creating session:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create checkout",
    };
  }
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
    const { data: profile } = await db()
      .from("profiles")
      .select("business_name, first_name, last_name, slug")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "Profile not found." };
    }

    let finalSlug = profile.slug;

    // If they already have a slug, keep it
    if (finalSlug) {
      await db()
        .from("profiles")
        .update({
          is_pro: true,
          stripe_subscription_id: stripeSubscriptionId,
        })
        .eq("id", userId);
    } else {
      // Generate slug from business_name or full name
      const rawName =
        profile.business_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        userId.slice(0, 8);

      finalSlug = slugify(rawName);
      if (!finalSlug) finalSlug = userId.slice(0, 8);

      // Check uniqueness
      const { data: existing } = await db()
        .from("profiles")
        .select("id")
        .eq("slug", finalSlug)
        .neq("id", userId)
        .maybeSingle();

      if (existing) {
        finalSlug = `${finalSlug}-${new Date().getFullYear()}`;
      }

      // Double-check the fallback slug
      const { data: existing2 } = await db()
        .from("profiles")
        .select("id")
        .eq("slug", finalSlug)
        .neq("id", userId)
        .maybeSingle();

      if (existing2) {
        finalSlug = `${finalSlug}-${userId.slice(0, 4)}`;
      }

      // Save
      const { error } = await db()
        .from("profiles")
        .update({
          is_pro: true,
          slug: finalSlug,
          stripe_subscription_id: stripeSubscriptionId,
        })
        .eq("id", userId);

      if (error) {
        console.error("[ProSubscription] Update failed:", error);
        return { success: false, error: error.message };
      }
    }

    console.log(`✅ Pro activated for ${userId}, slug: ${finalSlug}`);

    // ── Unlock waitlisted leads (hostage → real job) ────────────────
    // When an installer subscribes, flip all their waitlisted leads to
    // pending_payment so they can follow up and collect deposits.
    // Fire-and-forget: don't block activation on this.
    (async () => {
      try {
        const { data: waitlistedLeads } = await db()
          .from("leads")
          .select("id, customer_name, customer_email, customer_phone, estimated_price, quote_data")
          .eq("installer_id", userId)
          .eq("status", "waitlisted");

        if (waitlistedLeads && waitlistedLeads.length > 0) {
          // Flip status to pending_payment
          await db()
            .from("leads")
            .update({ status: "pending_payment" })
            .eq("installer_id", userId)
            .eq("status", "waitlisted");

          console.log(`[ProSubscription] Unlocked ${waitlistedLeads.length} waitlisted lead(s) for ${userId}`);

          // Fetch installer email for notification
          const { data: installerProfile } = await db()
            .from("profiles")
            .select("email, business_name, first_name")
            .eq("id", userId)
            .single();

          if (installerProfile?.email) {
            const installerName = installerProfile.business_name || installerProfile.first_name || "Installer";
            sendWaitlistedLeadsUnlocked(installerProfile.email, {
              installerName,
              leads: waitlistedLeads.map((l) => ({
                customerName: l.customer_name,
                customerEmail: l.customer_email,
                customerPhone: l.customer_phone,
                estimatedPrice: l.estimated_price,
                leadId: l.id,
              })),
            }).catch((err) => console.error("[ProSubscription] Waitlist unlock email failed:", err));
          }

          // ── Auto-email each customer with a payment link ──────────
          // The installer doesn't have to do anything — the system
          // sends each customer a deposit link to /pay/[leadId].
          const installerBiz = installerProfile?.business_name || installerProfile?.first_name || "Your Installer";
          await Promise.all(waitlistedLeads.map(async (lead) => {
            try {
              if (!lead.customer_email) return;
              const depositAmt = await getDepositAmount(
                lead.estimated_price ?? 0,
                userId
              );
              // Parse quote_data for the build summary
              const quoteItems = Array.isArray(lead.quote_data)
                ? (lead.quote_data as Array<Record<string, unknown>>)
                    .filter((u) => !("type" in u)) // organizer units only
                    .map((u) => ({
                      desc: (u.desc as string) || undefined,
                      cols: (u.cols as number) || undefined,
                      rows: (u.rows as number) || undefined,
                      price: (u.price as number) || undefined,
                    }))
                : undefined;

              sendWaitlistedLeadPaymentReady(lead.customer_email, {
                customerName: lead.customer_name,
                installerBusinessName: installerBiz,
                estimatedPrice: lead.estimated_price ?? 0,
                depositAmount: depositAmt,
                leadId: lead.id,
                quoteData: quoteItems,
              }).catch((err) =>
                console.error(`[ProSubscription] Customer payment email failed for lead ${lead.id}:`, err)
              );
            } catch (err) {
              console.error(`[ProSubscription] Failed to process waitlisted lead ${lead.id}:`, err);
            }
          }));
        }
      } catch (err) {
        console.error("[ProSubscription] Waitlist unlock failed (non-fatal):", err);
      }
    })();

    return { success: true, slug: finalSlug };
  } catch (err) {
    console.error("[ProSubscription] FULL ERROR:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Activation failed.",
    };
  }
}

/**
 * Deactivate Pro subscription (called by webhook when subscription ends).
 * Suspends the account: is_pro=false, booking links stop working,
 * portfolio page shows inactive overlay. Slug is preserved so the
 * portfolio URL still resolves (but shows "inactive installer" state).
 */
export async function deactivateProSubscription(
  userId: string
): Promise<{ success: boolean }> {
  await db()
    .from("profiles")
    .update({
      is_pro: false,
      stripe_subscription_id: null,
    })
    .eq("id", userId);

  return { success: true };
}

/**
 * Get Pro subscription status from Stripe.
 * Returns subscription details including cancel_at_period_end.
 */
export async function getProSubscriptionStatus(
  userId: string
): Promise<{
  success: boolean;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("stripe_subscription_id, is_pro")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return { success: false, error: "No active subscription" };
    }

    const subscription = (await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    )) as Stripe.Subscription;

    // In Stripe SDK v20+, current_period_end is on subscription items
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    return {
      success: true,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : undefined,
    };
  } catch (err) {
    console.error("[ProSubscription] Error fetching status:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch status",
    };
  }
}

/**
 * Cancel Pro subscription at end of billing period.
 * User keeps Pro benefits until the period ends.
 */
export async function cancelProSubscription(
  userId: string
): Promise<{ success: boolean; cancelDate?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return { success: false, error: "No active subscription found" };
    }

    // Cancel at period end (user keeps access until then)
    const subscription = (await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      { cancel_at_period_end: true }
    )) as Stripe.Subscription;

    // In Stripe SDK v20+, current_period_end is on subscription items
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
    const cancelDate = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : new Date().toISOString();

    console.log(
      `[ProSubscription] Subscription ${profile.stripe_subscription_id} set to cancel on ${cancelDate}`
    );

    return { success: true, cancelDate };
  } catch (err) {
    console.error("[ProSubscription] Cancel failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel",
    };
  }
}

/**
 * Reactivate a Pro subscription that was set to cancel.
 * Only works if the subscription hasn't ended yet.
 */
export async function reactivateProSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }

    // Remove the cancel_at_period_end flag
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    console.log(
      `[ProSubscription] Subscription ${profile.stripe_subscription_id} reactivated`
    );

    return { success: true };
  } catch (err) {
    console.error("[ProSubscription] Reactivate failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reactivate",
    };
  }
}

/**
 * Get a summary of pending bounties for a user.
 * Used in the cancellation confirmation modal to warn the installer
 * about forfeiting pending bounties.
 */
export async function getPendingBountySummary(
  userId: string
): Promise<{
  count: number;
  estimatedValue: number;
}> {
  const { data: pendingLeads } = await db()
    .from("leads")
    .select("deposit_amount, estimated_price")
    .eq("referring_installer_id", userId)
    .eq("bounty_status", "pending");

  if (!pendingLeads || pendingLeads.length === 0) {
    return { count: 0, estimatedValue: 0 };
  }

  // Estimate bounty: 30% of deposit, min $15 per lead
  const estimatedValue = pendingLeads.reduce((sum: number, lead: { deposit_amount: number | null; estimated_price: number | null }) => {
    const deposit = lead.deposit_amount ?? (lead.estimated_price ? lead.estimated_price * 0.15 : 0);
    const bounty = Math.max(Math.round(deposit * 0.30 * 100) / 100, 15);
    return sum + bounty;
  }, 0);

  return {
    count: pendingLeads.length,
    estimatedValue: Math.round(estimatedValue * 100) / 100,
  };
}

/**
 * Create a Stripe Customer Portal session for subscription management.
 * Allows user to update payment method, view invoices, cancel, etc.
 */
export async function createCustomerPortalSession(
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return { success: false, error: "No active subscription" };
    }

    // Get the subscription to find the customer ID
    const subscription = (await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    )) as Stripe.Subscription;

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const baseUrl = getAppUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/profile`,
    });

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ProSubscription] Portal session failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create portal",
    };
  }
}

/**
 * Generate a Stripe billing portal link for a payment-suspended installer
 * so they can reconcile their subscription from the login blocked screen.
 * Uses service role so it works even though the user is signed out.
 */
export async function getPaymentRecoveryUrl(
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("stripe_subscription_id, is_suspended, suspension_reason")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }

    if (!profile.is_suspended || profile.suspension_reason !== "payment") {
      return { success: false, error: "Account is not payment-suspended" };
    }

    const subscription = (await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    )) as Stripe.Subscription;

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const baseUrl = getAppUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/login`,
    });

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[ProSubscription] Payment recovery portal failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create recovery portal",
    };
  }
}
