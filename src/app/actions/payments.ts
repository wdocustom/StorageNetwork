"use server";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";

// ═══════════════════════════════════════════════════════════════════════════
// Payment Server Action — Black Box
//
// All fee calculations and Stripe API calls happen here.
// The client NEVER sees fee formulas, API keys, or session internals.
// It only receives a redirect URL.
//
// FEE STRUCTURE (fees calculated on BUILD PRICE, not deposit or tax):
// ─────────────────────────────────────────────────────────────────────────
// Non-Pro: 15% of build → Platform fee
// Pro:     5% of build → Platform fee, 10% → Installer
// ─────────────────────────────────────────────────────────────────────────
//
// SALES TAX HANDLING:
// ─────────────────────────────────────────────────────────────────────────
// - Tax is calculated on FULL BUILD PRICE (not deposit) and collected upfront
// - Tax ALWAYS flows to the installer (they are responsible for remittance)
// - If installer has Stripe connected: Tax sent via destination charge
// - If no Stripe: Tax collected by platform, owed to installer (manual settlement)
//
// Example: $1000 build, 6% tax ($60), 15% deposit ($150)
// ─────────────────────────────────────────────────────────────────────────
// Customer pays today: $210 (deposit + tax)
//
// Non-Pro + Stripe connected:
//   - Platform fee: $150 (15% of build)
//   - Installer receives via Stripe: $60 (tax only)
//
// Non-Pro + NO Stripe:
//   - Platform fee: $150 (15% of build)
//   - Tax owed to installer: $60 (manual settlement)
//
// Pro + Stripe connected:
//   - Platform fee: $50 (5% of build)
//   - Installer receives via Stripe: $160 ($100 deposit share + $60 tax)
//
// Pro + NO Stripe:
//   - Platform fee: $150 (15% - Pro benefits require Stripe connection)
//   - Tax owed to installer: $60 (manual settlement)
// ─────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Fee Constants ────────────────────────────────────────────────────────
const DEPOSIT_RATE = 0.15;           // 15% deposit from customer
const PRO_PLATFORM_FEE_RATE = 0.05;  // 5% platform fee for Pro installers
const PRO_INSTALLER_RATE = 0.10;     // 10% to installer for Pro (from the 15%)
// Note: Balance payments have NO platform fee — platform already took their cut from deposit

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
    .select("stripe_account_id, is_pro")
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
  installerStripeId: string; // Stripe Connect account ID (acct_xxx)
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
  const { leadId, amount, installerStripeId, customerEmail, description } =
    input;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!leadId || !amount || !installerStripeId) {
    return { success: false, error: "Missing required payment parameters." };
  }

  if (amount <= 0) {
    return { success: false, error: "Payment amount must be positive." };
  }

  try {
    // ── Balance Collection ───────────────────────────────────────────────
    // Platform already collected their fee (15% or 5%) from the deposit.
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
  installerStripeId: string;
  customerEmail: string;
  customerName: string;
  businessName: string;
}

export interface InvoiceResult {
  success: boolean;
  error?: string;
}

export async function sendPaymentInvoice(
  input: InvoiceInput
): Promise<InvoiceResult> {
  const {
    leadId,
    amount,
    installerStripeId,
    customerEmail,
    customerName,
    businessName,
  } = input;

  // First, create the payment session to get the URL
  const sessionResult = await createPaymentSession({
    leadId,
    amount,
    installerStripeId,
    customerEmail,
    description: `Storage Unit — Balance Due (${businessName})`,
  });

  if (!sessionResult.success || !sessionResult.url) {
    return { success: false, error: sessionResult.error };
  }

  // Send email with payment link via Resend
  try {
    const { sendTransactionalEmail } = await import("@/lib/email");

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Balance Due</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
          Hi ${customerName}, your installer <strong>${businessName}</strong> has
          requested payment for the remaining balance on your storage unit build.
        </p>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">
            Amount Due
          </p>
          <p style="color: #1a1a1a; font-size: 36px; font-weight: 900; margin: 0;">
            $${amount.toLocaleString()}
          </p>
        </div>
        <a href="${sessionResult.url}" style="display: block; background: #facc15; color: #1a1a1a; text-align: center; padding: 14px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
          Pay Now →
        </a>
        <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 16px;">
          Payments processed securely via Stripe.
        </p>
      </div>
    `;

    const emailResult = await sendTransactionalEmail({
      to: customerEmail,
      toName: customerName,
      subject: `Balance Due — $${amount.toLocaleString()} from ${businessName}`,
      html: emailHtml,
      senderName: businessName,
    });

    if (!emailResult.success) {
      console.error("[Payment] Invoice email failed:", emailResult.error);
      // Don't fail — payment link was still created
    }

    // Update lead status
    await supabase
      .from("leads")
      .update({
        payout_status: "invoice_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

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
  const { error } = await supabase
    .from("leads")
    .update({
      deposit_paid: true,
      payout_status: "paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    return { success: false, error: "Failed to update payment status." };
  }

  // Fire booking confirmation email to customer (non-blocking)
  console.log("[MarkPaid] Firing booking confirmation for lead:", leadId);
  import("@/lib/email").then(async ({ sendBookingConfirmation }) => {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("customer_name, customer_email, address, scheduled_at, estimated_price, deposit_amount, installer_id, notes")
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
// createDepositIntent — Creates a PaymentIntent for inline Stripe Elements
//
// Returns clientSecret for the Payment Element (no redirect needed).
// Used by BookingModal for inline deposit collection.
// ═══════════════════════════════════════════════════════════════════════════

export type LeadSource = "platform" | "partner_link" | "installer_manual";

export interface DepositIntentInput {
  leadId: string;
  amount: number;                    // Deposit amount in dollars (includes tax if applicable)
  totalPrice: number;                // Total job price in dollars (for fee calculation)
  installerId?: string;              // Supabase user ID of installer (optional for platform leads)
  source: LeadSource;                // Where the lead came from
  customerEmail?: string;
  customerName?: string;
  scheduledAt?: string;
  // Tax info for installer records
  salesTaxAmount?: number;           // Tax amount in dollars
  billingState?: string;             // 2-letter state code
}

export interface DepositIntentResult {
  success: boolean;
  clientSecret?: string;
  error?: string;
}

export async function createDepositIntent(
  input: DepositIntentInput
): Promise<DepositIntentResult> {
  const { leadId, amount, totalPrice, installerId, source, customerEmail, customerName, scheduledAt, salesTaxAmount, billingState } = input;

  if (!leadId || !amount || !installerId || !totalPrice) {
    return { success: false, error: "Missing required parameters." };
  }

  // Calculate deposit base (amount before tax) for fee calculation
  const depositBase = salesTaxAmount ? amount - salesTaxAmount : amount;
  const taxCents = salesTaxAmount ? Math.round(salesTaxAmount * 100) : 0;

  try {
    const amountCents = Math.round(amount * 100);
    const totalPriceCents = Math.round(totalPrice * 100);

    // ── Determine fee routing based on Pro status and Stripe connection ───────
    //
    // Fee rates (calculated on BUILD PRICE, not deposit or tax):
    //   - Non-Pro: 15% platform fee
    //   - Pro:     5% platform fee (installer keeps 10%)
    //
    // Tax handling:
    //   - Tax ALWAYS flows to installer (they're responsible for remittance)
    //   - If installer has Stripe: Send via destination charge
    //   - If no Stripe: Platform holds, manual settlement required
    //
    const installerProfile = await getInstallerProfile(installerId);
    const isPro = installerProfile?.is_pro === true;
    const installerStripeId = installerProfile?.stripe_account_id;

    // Use destination charge if installer has Stripe connected (regardless of Pro status)
    // This ensures tax flows directly to installer when possible
    const canRouteToInstaller = !!installerStripeId;

    let paymentIntent;
    const depositBaseCents = Math.round(depositBase * 100);

    if (canRouteToInstaller && installerStripeId) {
      // ── Installer has Stripe connected: Use destination charge ────────────
      // Platform fee depends on Pro status:
      //   - Pro:     5% of build price
      //   - Non-Pro: 15% of build price (full deposit)
      // Installer receives the rest (including tax) via destination charge
      const platformFeeRate = isPro ? PRO_PLATFORM_FEE_RATE : DEPOSIT_RATE;
      const platformFeeCents = Math.round(totalPriceCents * platformFeeRate);
      const installerReceivesCents = amountCents - platformFeeCents;

      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
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
          customer_name: customerName || "",
          customer_email: customerEmail || "",
          // Platform fee based on Pro status (NOT including tax)
          platform_fee_cents: String(platformFeeCents),
          platform_fee_rate: isPro ? "5%" : "15%",
          // Installer receives via Stripe (deposit share + tax for Pro, tax only for Non-Pro)
          installer_receives_cents: String(installerReceivesCents),
          installer_tax_owed_cents: "0", // Tax sent via Stripe, nothing owed
          installer_stripe_id: installerStripeId,
          scheduled_at: scheduledAt || "",
          // Tax info for installer records
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          deposit_base_cents: String(depositBaseCents),
        },
      });

      const planLabel = isPro ? "Pro" : "Non-Pro";
      const feePercent = isPro ? "5%" : "15%";
      console.log(`[Deposit] ${planLabel} (Stripe connected): $${totalPrice} build | Platform fee: $${platformFeeCents / 100} (${feePercent}), Installer receives via Stripe: $${installerReceivesCents / 100} (includes $${taxCents / 100} tax)`);
    } else {
      // ── No Stripe connected: All to platform, tax owed to installer ───────
      // Platform collects full amount, tax must be settled manually with installer.
      // Platform fee is 15% of build (full deposit) regardless of Pro status
      // (Pro benefits only apply when Stripe is connected for direct transfers)
      const platformFeeCents = depositBaseCents; // 15% of build

      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
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
          // Platform fee is full deposit (15% of build), NOT including tax
          platform_fee_cents: String(platformFeeCents),
          platform_fee_rate: "15%",
          // Installer receives $0 via Stripe, but is owed the tax amount
          installer_receives_cents: "0",
          installer_tax_owed_cents: String(taxCents), // Tax flows to installer (manual settlement)
          scheduled_at: scheduledAt || "",
          // Tax info for installer records
          sales_tax_cents: String(taxCents),
          billing_state: billingState || "",
          deposit_base_cents: String(depositBaseCents),
        },
      });

      const planLabel = isPro ? "Pro (no Stripe)" : "Non-Pro (no Stripe)";
      console.log(`[Deposit] ${planLabel}: $${totalPrice} build | Platform fee: $${depositBase} (15%), Tax owed to installer: $${salesTaxAmount || 0} (manual settlement)`);
    }

    // Update lead with scheduling info, source, and tax info
    await supabase
      .from("leads")
      .update({
        source,
        scheduled_at: scheduledAt || null,
        sales_tax_amount: salesTaxAmount || null,
        billing_state: billingState || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

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
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        deposit_paid: true,
        deposit_amount: amountPaid,
        payout_status: "deposit_collected",
        status: "open",
        updated_at: new Date().toISOString(),
      })
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
