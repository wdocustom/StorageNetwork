"use server";

import Stripe from "stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { siteConfig } from "@/config/site";
import { z } from "zod/v4";
import { incrementDiscountCodeUsage } from "./discount-codes";
import { getDepositAmount } from "./fee-engine";

// ═══════════════════════════════════════════════════════════════════════════
// Payment Server Action — Black Box
//
// All fee calculations and Stripe API calls happen here.
// The client NEVER sees fee formulas, API keys, or session internals.
// It only receives a redirect URL.
//
// FEE STRUCTURE (fees calculated on BUILD PRICE, not deposit or tax):
// ─────────────────────────────────────────────────────────────────────────
// First 3 Jobs:     0% → Platform (waived), 15% → Installer (new user promo)
// Standard:         3% of build → Platform (maintenance fee), 12% → Installer
// No Stripe:        15% of build → Platform keeps full deposit
// Fee Override (0): 0% → Platform, 15% → Installer (Founder accounts)
// ─────────────────────────────────────────────────────────────────────────
//
// SALES TAX HANDLING:
// ─────────────────────────────────────────────────────────────────────────
// - Tax is calculated on FULL BUILD PRICE (not deposit, before any discounts)
// - Tax is ALWAYS collected by the installer at installation (with balance)
// - Deposit payment is deposit only — NO tax collected upfront
// - This keeps tax handling simple and uniform for all scenarios
//
// DISCOUNT CODE HANDLING:
// ─────────────────────────────────────────────────────────────────────────
// - Discount codes only affect the REMAINING BALANCE (not deposit)
// - Deposit stays at the installer-configured rate (min 15%)
// - Installer absorbs the discount (reduced balance collection)
// - Tax is always on the full subtotal BEFORE any discounts
// - Platform first-order discounts are permanently deactivated
//
// Example: $1000 build, 6% tax ($60), 15% deposit ($150), $50 discount
// ─────────────────────────────────────────────────────────────────────────
//
// Without Stripe connected:
//   Customer pays today: $150 (deposit — unchanged)
//   Platform keeps: $150 (full deposit until Stripe connected)
//   Balance at install: $860 ($800 remaining + $60 tax → installer collects)
//
// With Stripe connected:
//   Customer pays today: $150 (deposit — unchanged)
//   Platform keeps: $30 (3% maintenance fee)
//   Installer receives via Stripe: $120 (12%)
//   Balance at install: $860 ($800 remaining + $60 tax → installer collects)
// ─────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

import { getAuthenticatedUser } from "@/lib/auth";
import { escapeHtml } from "@/utils/escapeHtml";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = getServiceClient();

// ── Auth Helper: Verify caller owns the lead ────────────────────────────
async function requireLeadOwnership(
  leadId: string
): Promise<{ userId: string } | { error: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated." };

  const { data: lead } = await supabase
    .from("leads")
    .select("installer_id")
    .eq("id", leadId)
    .single();

  if (!lead) return { error: "Lead not found." };
  if (lead.installer_id !== user.id) return { error: "Not authorized." };
  return { userId: user.id };
}

// ── Fee Constants ────────────────────────────────────────────────────────
// Deposit rate is now installer-configurable (min 15%) via fee-engine.ts.
// The deposit amount is passed in by callers who resolve it from getDepositAmount().
const PRO_PLATFORM_FEE_RATE = 0.03;  // 3% platform fee for Pro installers
const PRO_INSTALLER_RATE = 0.12;     // 12% to installer for Pro (from the 15%)
// Note: Balance payments have NO platform fee — platform already took their cut from deposit

// ── First 3 Jobs: Zero Platform Fees ─────────────────────────────────────
// New installers get their first 3 committed jobs with zero platform fees.
// A job counts once a deposit is paid (deposit_paid = true) — NOT by status
// string. This prevents gaming by leaving jobs in open/scheduled/active
// status indefinitely to avoid hitting the 3-job limit.
const FREE_JOBS_LIMIT = 3;

async function getCompletedJobCount(installerId: string): Promise<number> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("installer_id", installerId)
    .eq("deposit_paid", true);
  return count ?? 0;
}

// ── Stripe Customer for off-session balance charging ────────────────────
// Resolves the platform Stripe Customer to attach to the deposit
// PaymentIntent. Without a Customer attached, setup_future_usage cannot
// persist the PaymentMethod, and the balance can't be auto-charged later.
// Order: existing lead.stripe_customer_id → search by email → create.
async function getOrCreateStripeCustomerForLead(
  leadId: string,
  email: string | undefined,
  name: string | undefined
): Promise<string | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("stripe_customer_id")
    .eq("id", leadId)
    .maybeSingle();

  const existingId = (lead?.stripe_customer_id as string | null) ?? null;
  if (existingId) return existingId;

  let customerId: string | null = null;
  if (email) {
    try {
      const found = await stripe.customers.list({ email, limit: 1 });
      customerId = found.data[0]?.id ?? null;
    } catch (err) {
      console.warn("[Deposit] Customer lookup by email failed:", err);
    }
  }

  if (!customerId) {
    const created = await stripe.customers.create({
      email: email || undefined,
      name: name || undefined,
      metadata: { leadId },
    });
    customerId = created.id;
  }

  await supabase
    .from("leads")
    .update({ stripe_customer_id: customerId })
    .eq("id", leadId);

  return customerId;
}

// ── Helper: Check if installer is Pro ────────────────────────────────────
async function isInstallerPro(installerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", installerId)
    .single();
  return data?.is_pro === true;
}

// ── Helper: Get installer profile with Stripe account ────────────────────
async function getInstallerProfile(installerId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("stripe_account_id, is_pro, platform_fee_override, stripe_subscription_id")
    .eq("id", installerId)
    .single();
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// createPaymentSession — Generates a Stripe Checkout URL
// ═══════════════════════════════════════════════════════════════════════════

export interface PaymentSessionInput {
  leadId: string;
  amount: number; // dollars (e.g., 1200)
  installerStripeId?: string; // Optional — server looks it up from DB if not provided
  customerEmail?: string;
  description?: string;
}

export interface PaymentSessionResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function createPaymentSession(
  input: PaymentSessionInput
): Promise<PaymentSessionResult> {
  const { leadId, amount, customerEmail, description } = input;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!leadId || !amount) {
    return { success: false, error: "Missing required payment parameters." };
  }

  if (amount <= 0) {
    return { success: false, error: "Payment amount must be positive." };
  }

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  // ── Look up installer's Stripe account from DB (source of truth) ──────
  // Client may pass installerStripeId as a hint, but we always verify server-side
  const profile = await getInstallerProfile(auth.userId);
  const installerStripeId = profile?.stripe_account_id;
  if (!installerStripeId) {
    return { success: false, error: "Stripe account not connected. Please connect Stripe in Settings." };
  }

  // ── Server-side balance sanity check ─────────────────────────────────
  // Verify the client-passed amount is within a reasonable range of what
  // the DB expects. Prevents tampered clients from overcharging customers.
  const { data: lead } = await supabase
    .from("leads")
    .select("estimated_price, deposit_amount, sales_tax_amount")
    .eq("id", leadId)
    .single();

  if (lead) {
    const expectedBalance = (lead.estimated_price || 0) - (lead.deposit_amount || 0) + (lead.sales_tax_amount || 0);
    // Allow tolerance for discounts (client can charge LESS than expected, not MORE)
    if (amount > expectedBalance + 0.01) {
      console.warn(`[Payment] Amount exceeds expected balance: client=$${amount}, expected=$${expectedBalance} for lead ${leadId}`);
      return { success: false, error: "Payment amount exceeds balance due. Please refresh and try again." };
    }
  }

  try {
    // ── Balance Collection ───────────────────────────────────────────────
    // Platform already collected their fee (15% or 3%) from the deposit.
    // Balance goes 100% to installer via Stripe Connect — NO additional fee.
    const amountCents = Math.round(amount * 100);

    const baseUrl = siteConfig.baseUrl;

    // ── Create Stripe Checkout Session with destination charge ──────────
    // 100% of payment transfers to installer (no application_fee_amount)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || "Storage Unit — Remaining Balance",
              description: `Job #${leadId.slice(0, 8)}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        // No application_fee_amount — platform already took their cut from deposit
        transfer_data: {
          destination: installerStripeId,
        },
      },
      customer_email: customerEmail || undefined,
      success_url: `${baseUrl}/payment/success?job=${leadId}`,
      cancel_url: `${baseUrl}/payment/cancelled?job=${leadId}`,
      metadata: {
        lead_id: leadId,
        type: "final_payment",
        installer_stripe_id: installerStripeId,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    // ── Update lead status to "payment_pending" ─────────────────────────
    await supabase
      .from("leads")
      .update({
        payout_status: "payment_link_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[Payment] Stripe session error:", err);
    return {
      success: false,
      error: "Failed to create payment session. Please try again.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// sendPaymentInvoice — Sends an email with the payment link
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoiceInput {
  leadId: string;
  amount: number;
  installerStripeId?: string; // Optional — server resolves from DB
  customerEmail: string;
  customerName: string;
}

export interface InvoiceResult {
  success: boolean;
  error?: string;
}

export async function sendPaymentInvoice(
  input: InvoiceInput
): Promise<InvoiceResult> {
  const { leadId, amount, customerEmail, customerName } = input;

  // Auth: verify the caller owns this lead
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  // Resolve installer's business name from their profile
  const { data: installerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("business_name, first_name, last_name")
    .eq("id", auth.userId)
    .single();

  if (profileError) {
    console.error("[Payment] Profile lookup failed for installer:", auth.userId, profileError);
    return { success: false, error: "Could not load installer profile." };
  }

  const resolvedBusinessName =
    installerProfile.business_name ||
    [installerProfile.first_name, installerProfile.last_name].filter(Boolean).join(" ");

  // Use permanent app URL — never embeds a Stripe session URL (those expire in 24h)
  const baseUrl = siteConfig.baseUrl;
  const paymentUrl = `${baseUrl}/payment/collect/${leadId}`;

  // Send email with permanent payment link
  try {
    const { sendTransactionalEmail, emailShell } = await import("@/lib/email");

    const safeName = escapeHtml(customerName);
    const safeBiz = escapeHtml(resolvedBusinessName);
    const emailHtml = emailShell(
      "Balance Due",
      `
      <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hi ${safeName},</p>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.7;">
        Your installer <strong style="color:#facc15;">${safeBiz}</strong> has
        requested payment for the remaining balance on your storage unit build.
      </p>
      <div style="background:#1e293b;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;border:1px solid #334155;">
        <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">
          Amount Due
        </p>
        <p style="color:#facc15;font-size:36px;font-weight:900;margin:0;">
          $${amount.toLocaleString()}
        </p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${paymentUrl}" style="display:inline-block;background:#facc15;color:#0f172a;text-align:center;padding:14px 48px;border-radius:12px;font-weight:900;text-decoration:none;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
          Pay Now &rarr;
        </a>
      </div>
      <p style="color:#57534e;font-size:11px;text-align:center;">
        Payments processed securely via Stripe.
      </p>
      `
    );

    const emailResult = await sendTransactionalEmail({
      to: customerEmail,
      toName: customerName,
      subject: `Balance Due — $${amount.toLocaleString()} from ${resolvedBusinessName}`,
      html: emailHtml,
      senderName: resolvedBusinessName,
    });

    if (!emailResult.success) {
      console.error("[Payment] Invoice email failed:", emailResult.error);
    }

    // Update lead status
    await supabase
      .from("leads")
      .update({
        payout_status: "invoice_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    const { logActivityInternal } = await import("@/app/actions/installer-activity");
    await logActivityInternal(auth.userId, "payment_invoice_sent", { leadId, amount, customerEmail });

    return { success: true };
  } catch (err) {
    console.error("[Payment] Invoice email error:", err);
    return { success: false, error: "Failed to send invoice email." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// markAsPaid — Manually mark a lead as paid (webhook handler or manual)
//
// NOTE: In production, this would be triggered by a Stripe webhook
// listening for `checkout.session.completed`. For the demo, we expose
// it as a callable action for the "Mark Paid" button.
// ═══════════════════════════════════════════════════════════════════════════

export async function markLeadAsPaid(leadId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await supabase
    .from("leads")
    .update({
      status: "paid",           // triggers fn_increment_job_score
      deposit_paid: true,
      payout_status: "paid",
      paid_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    return { success: false, error: "Failed to update payment status." };
  }

  // Fire booking confirmation email to customer (non-blocking)
  console.log("[MarkPaid] Firing booking confirmation for lead:", leadId);
  import("@/lib/email").then(async ({ sendBookingConfirmation, quoteDataToBookingUnits }) => {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("customer_name, customer_email, address, scheduled_at, estimated_price, deposit_amount, installer_id, notes, quote_data")
        .eq("id", leadId)
        .single();

      console.log("[MarkPaid] Lead data:", lead?.customer_email || "NO EMAIL", lead?.installer_id || "NO INSTALLER");
      if (!lead?.customer_email || !lead.installer_id) return;

      const { data: installer } = await supabase
        .from("profiles")
        .select("business_name, phone, avatar_url")
        .eq("id", lead.installer_id)
        .single();

      const result = await sendBookingConfirmation({
        customerName: lead.customer_name || "Customer",
        customerEmail: lead.customer_email,
        installerName: installer?.business_name || "Your Installer",
        installerPhone: installer?.phone || undefined,
        installerAvatarUrl: installer?.avatar_url || undefined,
        scheduledDate: lead.scheduled_at || new Date().toISOString().split("T")[0],
        address: lead.address || "",
        depositAmount: lead.deposit_amount || 0,
        totalPrice: lead.estimated_price || 0,
        jobDescription: lead.notes || "Storage Unit Installation",
        units: quoteDataToBookingUnits(lead.quote_data),
        leadId,
      });
      console.log("[MarkPaid] Booking confirmation result:", result);
    } catch (err) {
      console.error("[MarkPaid] Booking confirmation error:", err);
    }
  }).catch((err: unknown) => console.error("[MarkPaid] Email import failed:", err));

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// checkInstallerPaymentInfo — Check installer's Stripe and Pro status
//
// Used by clients to display correct fee breakdown.
// Note: Tax is ALWAYS collected at installation, never upfront.
// ═══════════════════════════════════════════════════════════════════════════

export interface InstallerPaymentInfo {
  hasStripeConnected: boolean;
  isPro: boolean;
}

export async function checkInstallerPaymentInfo(installerId: string): Promise<InstallerPaymentInfo> {
  const profile = await getInstallerProfile(installerId);
  const hasStripeConnected = !!profile?.stripe_account_id;
  const isPro = profile?.is_pro === true;

  return {
    hasStripeConnected,
    isPro,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createBalanceCheckout — PUBLIC (no auth). Creates a fresh Stripe Checkout
// Session for the remaining balance on a lead. Used by /payment/collect/[leadId]
// so the email link never expires (it always creates a new session on visit).
// ═══════════════════════════════════════════════════════════════════════════

export interface BalanceCheckoutResult {
  success: boolean;
  url?: string;
  error?: string;
  alreadyPaid?: boolean;
}

export async function createBalanceCheckout(
  leadId: string
): Promise<BalanceCheckoutResult> {
  if (!leadId) return { success: false, error: "Missing lead ID." };

  // Look up lead — public, no auth required
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("installer_id, estimated_price, deposit_amount, sales_tax_amount, customer_email, customer_name, status, payout_status")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, error: "Order not found." };
  }

  // Already paid — don't create a new session
  if (lead.status === "paid" || lead.payout_status === "paid") {
    return { success: false, alreadyPaid: true, error: "This order has already been paid." };
  }

  // Calculate balance
  const balance = (lead.estimated_price || 0) - (lead.deposit_amount || 0) + (lead.sales_tax_amount || 0);
  if (balance <= 0) {
    return { success: false, alreadyPaid: true, error: "No balance due." };
  }

  // Look up installer's Stripe account
  const profile = await getInstallerProfile(lead.installer_id);
  const installerStripeId = profile?.stripe_account_id;
  if (!installerStripeId) {
    return { success: false, error: "Installer payment account not configured." };
  }

  // Resolve business name for description
  const { data: nameData } = await supabase
    .from("profiles")
    .select("business_name, first_name, last_name")
    .eq("id", lead.installer_id)
    .single();

  const bizName = nameData?.business_name ||
    [nameData?.first_name, nameData?.last_name].filter(Boolean).join(" ") ||
    "Your Installer";

  try {
    const amountCents = Math.round(balance * 100);
    const baseUrl = siteConfig.baseUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Storage Unit — Balance Due (${bizName})`,
              description: `Job #${leadId.slice(0, 8)}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: {
          destination: installerStripeId,
        },
      },
      customer_email: lead.customer_email || undefined,
      success_url: `${baseUrl}/payment/success?job=${leadId}`,
      cancel_url: `${baseUrl}/payment/collect/${leadId}`,
      metadata: {
        lead_id: leadId,
        type: "final_payment",
        installer_stripe_id: installerStripeId,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[BalanceCheckout] Stripe error:", err);
    return { success: false, error: "Payment system error. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// chargeBalanceOffSession — AUTH (installer-owned). Charges the saved card
// for the remaining balance without customer interaction.
//
// Requires the lead's deposit to have been collected with our setup_future_usage
// flow (see createDepositIntent). Falls back to a Checkout URL when the
// PaymentMethod isn't on file yet (legacy leads) or when Stripe demands
// customer authentication (3DS / SCA).
// ═══════════════════════════════════════════════════════════════════════════

export interface OffSessionChargeResult {
  success: boolean;
  paymentIntentId?: string;
  alreadyPaid?: boolean;
  /** Customer must complete 3DS — front the existing /payment/collect/[leadId] link. */
  requiresAuthentication?: boolean;
  /** No saved card on file — use the Checkout fallback URL. */
  fallbackUrl?: string;
  error?: string;
}

export async function chargeBalanceOffSession(
  leadId: string
): Promise<OffSessionChargeResult> {
  if (!leadId) return { success: false, error: "Missing lead ID." };

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "installer_id, estimated_price, deposit_amount, sales_tax_amount, discount_amount, customer_email, customer_name, status, payout_status, stripe_customer_id, stripe_payment_method_id"
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) return { success: false, error: "Order not found." };

  if (lead.status === "paid" || lead.payout_status === "paid") {
    return { success: false, alreadyPaid: true, error: "This order has already been paid." };
  }

  // Mirror createBalanceCheckout's balance math — discount reduces balance,
  // tax is added (installer collects tax with balance).
  const discountAmt = lead.discount_amount ?? 0;
  const balance =
    (lead.estimated_price || 0) -
    (lead.deposit_amount || 0) -
    discountAmt +
    (lead.sales_tax_amount || 0);
  if (balance <= 0) {
    return { success: false, alreadyPaid: true, error: "No balance due." };
  }

  // Legacy leads (deposited before the setup_future_usage migration) won't
  // have a saved card. Send the caller the Checkout URL instead.
  const customerId = lead.stripe_customer_id as string | null;
  const paymentMethodId = lead.stripe_payment_method_id as string | null;
  if (!customerId || !paymentMethodId) {
    const baseUrl = siteConfig.baseUrl;
    return {
      success: false,
      fallbackUrl: `${baseUrl}/payment/collect/${leadId}`,
      error: "Saved card not on file for this lead. Use the payment link.",
    };
  }

  const profile = await getInstallerProfile(lead.installer_id);
  const installerStripeId = profile?.stripe_account_id;
  if (!installerStripeId) {
    return { success: false, error: "Installer payment account not configured." };
  }

  const amountCents = Math.round(balance * 100);

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        // Balance carries no platform fee — platform took its cut from the
        // deposit. 100% transfers to the installer.
        transfer_data: { destination: installerStripeId },
        receipt_email: lead.customer_email || undefined,
        metadata: {
          lead_id: leadId,
          leadId,
          type: "final_payment",
          installer_stripe_id: installerStripeId,
        },
      },
      { idempotencyKey: `balance-${leadId}` }
    );

    if (paymentIntent.status === "succeeded") {
      // Webhook will mark the lead paid + send receipts. Don't double-write here.
      return { success: true, paymentIntentId: paymentIntent.id };
    }

    // confirm:true should yield "succeeded" or throw. Anything else is unexpected.
    console.warn(
      "[OffSessionCharge] Unexpected PaymentIntent status:",
      paymentIntent.status,
      "| lead:",
      leadId
    );
    return {
      success: false,
      paymentIntentId: paymentIntent.id,
      error: `Payment did not complete (status: ${paymentIntent.status}).`,
    };
  } catch (err) {
    // Stripe surfaces 3DS / SCA requirements as a `card_error` with
    // `code: 'authentication_required'`. The PI is still on Stripe, so the
    // customer can complete it via the existing redirect Checkout flow.
    if (err instanceof Stripe.errors.StripeCardError) {
      const code = err.code;
      if (code === "authentication_required") {
        const baseUrl = siteConfig.baseUrl;
        console.log(
          "[OffSessionCharge] 3DS required — falling back to Checkout for lead:",
          leadId
        );
        return {
          success: false,
          requiresAuthentication: true,
          fallbackUrl: `${baseUrl}/payment/collect/${leadId}`,
          error: "Customer authentication required. Send them the payment link.",
        };
      }
      console.error("[OffSessionCharge] Card declined:", code, err.message);
      return {
        success: false,
        error: err.message || "Card was declined.",
      };
    }
    console.error("[OffSessionCharge] Stripe error:", err);
    return { success: false, error: "Payment system error. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// createDepositIntent — Creates a PaymentIntent for inline Stripe Elements
//
// Returns clientSecret for the Payment Element (no redirect needed).
// Used by BookingModal for inline deposit collection.
// ═══════════════════════════════════════════════════════════════════════════

export type LeadSource = "platform" | "partner_link" | "installer_manual";

export interface DepositIntentInput {
  leadId: string;
  amount: number;                    // Deposit amount in dollars (includes tax if applicable)
  totalPrice: number;                // Total job price in dollars (for fee calculation) — includes delivery fee
  installerId?: string;              // Supabase user ID of installer (optional for platform leads)
  source: LeadSource;                // Where the lead came from
  customerEmail?: string;
  customerName?: string;
  scheduledAt?: string;
  timePreference?: string;           // "morning" | "afternoon" | undefined
  // Tax info for installer records
  salesTaxAmount?: number;           // Tax amount in dollars (on build price only, NOT delivery fee)
  billingState?: string;             // 2-letter state code
  // Discount code (installer-specific promo codes — reduces balance, not deposit)
  discountCode?: string;             // The code string (for tracking)
  discountCodeAmount?: number;       // Resolved dollar amount to deduct from balance
  // Delivery fee (tax-exempt, but included in totalPrice for fee calculation)
  deliveryFeeAmount?: number;        // Delivery fee in dollars (0 or undefined = no delivery fee)
}

export interface DepositIntentResult {
  success: boolean;
  clientSecret?: string;
  error?: string;
}

const depositIntentSchema = z.object({
  leadId: z.string().uuid("Invalid lead ID"),
  amount: z.number().positive("Deposit must be positive").max(100_000, "Amount too large"),
  totalPrice: z.number().positive("Total price must be positive").max(1_000_000, "Price too large"),
  installerId: z.string().uuid("Invalid installer ID").optional(),
  source: z.enum(["platform", "partner_link", "installer_manual"]),
  customerEmail: z.union([z.email("Invalid email"), z.literal("")]).optional().transform(v => v || undefined),
  customerName: z.string().max(200).optional(),
  scheduledAt: z.string().max(30).optional(),
  timePreference: z.enum(["morning", "afternoon"]).optional(),
  salesTaxAmount: z.number().min(0).max(100_000).optional(),
  billingState: z.string().max(2).optional(),
  discountCode: z.string().max(50).optional(),
  discountCodeAmount: z.number().min(0).max(100_000).optional(),
  deliveryFeeAmount: z.number().min(0).max(10_000).optional(),
});

export async function createDepositIntent(
  input: DepositIntentInput
): Promise<DepositIntentResult> {
  // Validate all inputs before processing
  const parsed = depositIntentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + parsed.error.issues[0]?.message };
  }

  const { leadId, amount, totalPrice, installerId, source, customerEmail, customerName, scheduledAt, timePreference, salesTaxAmount, billingState, discountCode, discountCodeAmount, deliveryFeeAmount } = parsed.data;
  const promoCodeCents = discountCodeAmount ? Math.round(discountCodeAmount * 100) : 0;
  const deliveryFeeCents = deliveryFeeAmount ? Math.round(deliveryFeeAmount * 100) : 0;

  if (!leadId || !amount || !installerId || !totalPrice) {
    const missing = [
      !leadId && "leadId",
      !amount && "deposit amount",
      !installerId && "installerId",
      !totalPrice && "totalPrice",
    ].filter(Boolean).join(", ");
    return { success: false, error: `Missing required parameters: ${missing}.` };
  }

  // ── Server-side deposit re-derivation ─────────────────────────────────
  // Re-derive the expected deposit from totalPrice + installer config to
  // prevent a tampered client from submitting a reduced deposit amount.
  const expectedDeposit = await getDepositAmount(totalPrice, installerId);
  if (Math.abs(amount - expectedDeposit) > 0.01) {
    console.warn(`[Deposit] Amount mismatch: client sent $${amount}, expected $${expectedDeposit} for $${totalPrice} build (installer ${installerId})`);
    return { success: false, error: "Deposit amount mismatch. Please refresh and try again." };
  }

  // Deposit is always charged WITHOUT tax. Tax is collected by installer at installation.
  // Deposit uses installer's custom rate (min 15%) — discount codes only affect the remaining balance.
  const depositAmountCents = Math.round(amount * 100);
  const totalPriceCents = Math.round(totalPrice * 100);
  const taxCents = salesTaxAmount ? Math.round(salesTaxAmount * 100) : 0;
  // Balance = (totalPrice - deposit - discount) + tax. Installer absorbs discount from their balance.
  const balanceWithTaxCents = (totalPriceCents - depositAmountCents - promoCodeCents) + taxCents;

  try {
    // ── Determine fee routing based on Pro status and Stripe connection ───────
    //
    // DEPOSIT ONLY (no tax) is always charged. Tax collected at installation.
    //
    // Fee rates (calculated on BUILD PRICE):
    //   - No Stripe connected:  15% → all to Platform (until they connect Stripe)
    //   - Stripe connected:     3% → Platform (maintenance fee), 12% → Installer
    //
    const installerProfile = await getInstallerProfile(installerId);
    const isPro = installerProfile?.is_pro === true;
    const installerStripeId = installerProfile?.stripe_account_id;
    const feeOverride = installerProfile?.platform_fee_override;
    const hasFeeOverride = feeOverride !== null && feeOverride !== undefined;

    // ── First 3 Jobs: Zero Platform Fees ───────────────────────────────
    // Check if this installer qualifies for the free-first-3-jobs promotion.
    // Only applies during the trial period (no active subscription) with Stripe connected.
    // Once an installer subscribes and starts paying monthly, the 3% fee always applies.
    const completedJobs = await getCompletedJobCount(installerId);
    const hasActiveSubscription = !!installerProfile?.stripe_subscription_id;
    const qualifiesForFreeJob = completedJobs < FREE_JOBS_LIMIT && !!installerStripeId && !hasActiveSubscription;

    // Only split deposit if Pro AND has Stripe connected
    const shouldSplitDeposit = isPro && !!installerStripeId;

    // Resolve / create the platform Stripe Customer so the card is saved as
    // a reusable PaymentMethod (off-session balance charging later).
    const stripeCustomerId = await getOrCreateStripeCustomerForLead(
      leadId,
      customerEmail,
      customerName
    );

    let paymentIntent;

    // ── Discount codes do NOT affect the deposit or platform fees. ──────────
    // Deposit uses installer's custom rate (min 15%). Discount reduces the
    // balance the installer collects at installation (installer absorbs their own discount codes).

    if (qualifiesForFreeJob && installerStripeId) {
      // ── First 3 Jobs: Zero Platform Fees ─────────────────────────────────
      // Installer gets 100% of deposit, platform takes $0.
      // Requires Stripe connected (otherwise platform must hold deposit).
      const platformFeeCents = 0;
      const installerReceivesCents = depositAmountCents;

      paymentIntent = await stripe.paymentIntents.create({
        amount: depositAmountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        setup_future_usage: "off_session",
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: installerStripeId,
        },
        receipt_email: customerEmail || undefined,
        metadata: {
          lead_id: leadId,
          leadId,
          type: "deposit",
          source,
          installer_id: installerId,
          is_pro: isPro ? "true" : "false",
          fee_waived: "true",
          completed_jobs: String(completedJobs),
          customer_name: customerName || "",
          customer_email: customerEmail || "",
          platform_fee_cents: "0",
          platform_fee_rate: "0% (first 3 jobs free)",
          installer_receives_cents: String(installerReceivesCents),
          installer_stripe_id: installerStripeId,
          scheduled_at: scheduledAt || "",
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          balance_due_with_tax_cents: String(balanceWithTaxCents),
          discount_code: discountCode || "",
          discount_code_cents: String(promoCodeCents),
          delivery_fee_cents: String(deliveryFeeCents),
        },
      }, {
        idempotencyKey: `deposit-${leadId}`,
      });

      console.log(`[Deposit] FREE JOB ${completedJobs + 1}/${FREE_JOBS_LIMIT}: $${totalPrice} build | Deposit $${depositAmountCents / 100} → Platform $0 (waived), Installer $${installerReceivesCents / 100}${promoCodeCents ? ` | Discount -$${promoCodeCents / 100} off balance` : ""} | Balance+Tax: $${balanceWithTaxCents / 100}`);
    } else if (hasFeeOverride && shouldSplitDeposit && installerStripeId) {
      // ── Fee Override (Founder / special rate) + Stripe ───────────────────
      // Platform fee uses the override rate (e.g., 0 = $0 platform fee)
      // Bounds-check: clamp override to [0, 0.25] to prevent negative fees
      // or unreasonable platform takes from misconfigured DB values.
      const rawRate = Number(feeOverride);
      const overrideRate = Math.max(0, Math.min(rawRate, 0.25));
      if (rawRate !== overrideRate) {
        console.warn(`[Deposit] Fee override out of bounds: ${rawRate} → clamped to ${overrideRate} (installer ${installerId})`);
      }
      const platformFeeCents = Math.round(totalPriceCents * overrideRate);
      const installerReceivesCents = depositAmountCents - platformFeeCents;

      paymentIntent = await stripe.paymentIntents.create({
        amount: depositAmountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        setup_future_usage: "off_session",
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: installerStripeId,
        },
        receipt_email: customerEmail || undefined,
        metadata: {
          lead_id: leadId,
          leadId,
          type: "deposit",
          source,
          installer_id: installerId,
          is_pro: "true",
          fee_override: String(overrideRate),
          customer_name: customerName || "",
          customer_email: customerEmail || "",
          platform_fee_cents: String(platformFeeCents),
          platform_fee_rate: `${overrideRate * 100}%`,
          installer_receives_cents: String(installerReceivesCents),
          installer_stripe_id: installerStripeId,
          scheduled_at: scheduledAt || "",
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          balance_due_with_tax_cents: String(balanceWithTaxCents),
          discount_code: discountCode || "",
          discount_code_cents: String(promoCodeCents),
          delivery_fee_cents: String(deliveryFeeCents),
        },
      }, {
        idempotencyKey: `deposit-${leadId}`,
      });

      console.log(`[Deposit] Founder (${overrideRate * 100}% override): $${totalPrice} build | Deposit $${depositAmountCents / 100} → Platform $${platformFeeCents / 100}, Installer $${installerReceivesCents / 100}${promoCodeCents ? ` | Discount -$${promoCodeCents / 100} off balance` : ""} | Balance+Tax: $${balanceWithTaxCents / 100}`);
    } else if (shouldSplitDeposit && installerStripeId) {
      // ── Pro + Stripe: Split deposit via destination charge ────────────────
      // Platform gets 3% of build, Installer gets 12% of build
      const platformFeeCents = Math.round(totalPriceCents * PRO_PLATFORM_FEE_RATE); // 3%
      const installerReceivesCents = depositAmountCents - platformFeeCents;

      paymentIntent = await stripe.paymentIntents.create({
        amount: depositAmountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        setup_future_usage: "off_session",
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: installerStripeId,
        },
        receipt_email: customerEmail || undefined,
        metadata: {
          lead_id: leadId,
          leadId,
          type: "deposit",
          source,
          installer_id: installerId,
          is_pro: "true",
          customer_name: customerName || "",
          customer_email: customerEmail || "",
          platform_fee_cents: String(platformFeeCents),
          platform_fee_rate: "3%",
          installer_receives_cents: String(installerReceivesCents),
          installer_stripe_id: installerStripeId,
          scheduled_at: scheduledAt || "",
          // Tax info (for reference — installer collects at installation)
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          balance_due_with_tax_cents: String(balanceWithTaxCents),
          discount_code: discountCode || "",
          discount_code_cents: String(promoCodeCents),
          delivery_fee_cents: String(deliveryFeeCents),
        },
      }, {
        idempotencyKey: `deposit-${leadId}`,
      });

      console.log(`[Deposit] Pro (Stripe): $${totalPrice} build | Deposit $${depositAmountCents / 100} → Platform $${platformFeeCents / 100} (3%), Installer $${installerReceivesCents / 100} (12%)${promoCodeCents ? ` | Discount -$${promoCodeCents / 100} off balance` : ""} | Balance+Tax at install: $${balanceWithTaxCents / 100}`);
    } else {
      // ── No Stripe connected: Full deposit to Platform ──────────────────────
      // Platform keeps entire deposit (15% of build) until installer connects Stripe
      // Installer collects balance + tax at installation (minus any discount)
      paymentIntent = await stripe.paymentIntents.create({
        amount: depositAmountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        ...(stripeCustomerId && { customer: stripeCustomerId }),
        setup_future_usage: "off_session",
        receipt_email: customerEmail || undefined,
        metadata: {
          lead_id: leadId,
          leadId,
          type: "deposit",
          source,
          installer_id: installerId,
          is_pro: isPro ? "true" : "false",
          customer_name: customerName || "",
          customer_email: customerEmail || "",
          platform_fee_cents: String(depositAmountCents),
          platform_fee_rate: "15%",
          installer_receives_cents: "0",
          scheduled_at: scheduledAt || "",
          // Tax info (for reference — installer collects at installation)
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          balance_due_with_tax_cents: String(balanceWithTaxCents),
          discount_code: discountCode || "",
          discount_code_cents: String(promoCodeCents),
          delivery_fee_cents: String(deliveryFeeCents),
        },
      }, {
        idempotencyKey: `deposit-${leadId}`,
      });

      console.log(`[Deposit] No Stripe: $${totalPrice} build | Deposit $${depositAmountCents / 100} → Platform (15%)${promoCodeCents ? ` | Discount -$${promoCodeCents / 100} off balance` : ""} | Balance+Tax at install: $${balanceWithTaxCents / 100}`);
    }

    // Update lead with scheduling info, tax info, and discount (for reference)
    // Deposit stays at installer's configured rate — discount only reduces balance_due (installer absorbs)
    // Also backfill customer_email if it was provided (e.g. collected on /pay page)
    const leadUpdate: Record<string, unknown> = {
      source,
      scheduled_at: scheduledAt || null,
      time_preference: timePreference || null,
      sales_tax_amount: salesTaxAmount || null,
      billing_state: billingState || null,
      ...(customerEmail && { customer_email: customerEmail }),
      updated_at: new Date().toISOString(),
      // Mark fee as waived if this is one of the installer's first 3 free jobs
      fee_status: qualifiesForFreeJob ? "waived" : "standard",
    };
    // If discount applied, reduce balance_due (installer absorbs the discount)
    // Deposit amount stays unchanged at the full 15%
    if (promoCodeCents > 0) {
      leadUpdate.balance_due = totalPrice - (depositAmountCents / 100) - (promoCodeCents / 100);
    }
    // Store discount code info on the lead for tracking
    if (discountCode) {
      leadUpdate.discount_code = discountCode;
      leadUpdate.discount_amount = (promoCodeCents / 100);
    }
    // Store delivery fee on the lead and update estimated_price to include it
    if (deliveryFeeCents > 0) {
      leadUpdate.delivery_fee = (deliveryFeeCents / 100);
      leadUpdate.estimated_price = totalPrice; // totalPrice already includes delivery fee from BookingModal
    }
    await supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId);

    // Increment discount code usage counter (fire-and-forget)
    if (discountCode && installerId) {
      incrementDiscountCodeUsage(discountCode, installerId).catch(() => {});
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret || undefined,
    };
  } catch (err) {
    console.error("[Payment] PaymentIntent error:", err);
    return {
      success: false,
      error: "Failed to initialize payment. Please try again.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// verifyAndConfirmDeposit — Webhook fallback
//
// Called from the /success page after redirect. Checks Stripe for paid
// PaymentIntents linked to the lead and updates DB if the webhook missed it.
// Also triggers customer + installer emails if they haven't been sent.
// ═══════════════════════════════════════════════════════════════════════════

export async function verifyAndConfirmDeposit(
  leadId: string
): Promise<{ success: boolean; alreadyPaid?: boolean; error?: string }> {
  if (!leadId) return { success: false, error: "No lead ID" };

  // Auth guard: only the installer who owns this lead can trigger verification
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

  console.log("[VerifyDeposit] Checking lead:", leadId);

  // 1. Check if already marked as paid
  const { data: lead } = await supabase
    .from("leads")
    .select("deposit_paid, customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at, deposit_amount")
    .eq("id", leadId)
    .single();

  if (!lead) return { success: false, error: "Lead not found" };
  if (lead.deposit_paid) {
    console.log("[VerifyDeposit] Already paid, skipping");
    return { success: true, alreadyPaid: true };
  }

  // 2. Search Stripe for a succeeded PaymentIntent with this leadId
  try {
    const paymentIntents = await stripe.paymentIntents.search({
      query: `metadata["leadId"]:"${leadId}" status:"succeeded"`,
    });

    const pi = paymentIntents.data[0];
    if (!pi) {
      console.log("[VerifyDeposit] No succeeded PI found for lead:", leadId);
      return { success: false, error: "No payment found" };
    }

    const amountPaid = pi.amount / 100;
    console.log("[VerifyDeposit] Found succeeded PI:", pi.id, "| amount:", amountPaid);

    // 3. Update DB — same as webhook would do
    const fallbackUpdate: Record<string, unknown> = {
      deposit_paid: true,
      deposit_amount: amountPaid,
      payout_status: "deposit_collected",
      status: "open",
      updated_at: new Date().toISOString(),
    };
    if (typeof pi.customer === "string") {
      fallbackUpdate.stripe_customer_id = pi.customer;
    }
    if (typeof pi.payment_method === "string") {
      fallbackUpdate.stripe_payment_method_id = pi.payment_method;
      // Best-effort fetch of card brand + last4 for installer-side display.
      // Failure here is non-fatal — deposit is the priority.
      try {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
        if (pm.type === "card" && pm.card) {
          fallbackUpdate.stripe_payment_method_brand = pm.card.brand;
          fallbackUpdate.stripe_payment_method_last4 = pm.card.last4;
        }
      } catch (pmErr) {
        console.warn("[VerifyDeposit] PM display meta fetch failed:", pmErr);
      }
    }
    const { error: updateError } = await supabase
      .from("leads")
      .update(fallbackUpdate)
      .eq("id", leadId);

    if (updateError) {
      console.error("[VerifyDeposit] DB update failed:", updateError);
      return { success: false, error: "DB update failed" };
    }

    console.log("[VerifyDeposit] Deposit confirmed for lead:", leadId);

    // NOTE: Emails are sent by the webhook (payment_intent.succeeded).
    // This fallback only updates the DB if webhook missed it.
    // Do NOT send emails here to avoid duplicates.

    return { success: true };
  } catch (stripeErr) {
    console.error("[VerifyDeposit] Stripe search error:", stripeErr);
    return { success: false, error: "Stripe verification failed" };
  }
}
