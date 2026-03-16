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
// A job counts once a deposit is paid (not just when marked "paid") to
// prevent gaming by leaving jobs in deposit_paid status indefinitely.
const FREE_JOBS_LIMIT = 3;

async function getCompletedJobCount(installerId: string): Promise<number> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("installer_id", installerId)
    .in("status", ["deposit_paid", "payment_pending", "completed", "paid"]);
  return count ?? 0;
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
    .select("stripe_account_id, is_pro, platform_fee_override")
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

  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

  // Auth: verify the caller owns this lead
  const auth = await requireLeadOwnership(leadId);
  if ("error" in auth) return { success: false, error: auth.error };

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

    const safeName = escapeHtml(customerName);
    const safeBiz = escapeHtml(businessName);
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Balance Due</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
          Hi ${safeName}, your installer <strong>${safeBiz}</strong> has
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
  customerEmail: z.email("Invalid email").optional(),
  customerName: z.string().max(200).optional(),
  scheduledAt: z.string().max(30).optional(),
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

  const { leadId, amount, totalPrice, installerId, source, customerEmail, customerName, scheduledAt, salesTaxAmount, billingState, discountCode, discountCodeAmount, deliveryFeeAmount } = parsed.data;
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
    // Only applies when they have Stripe connected (otherwise platform holds deposit).
    const completedJobs = await getCompletedJobCount(installerId);
    const qualifiesForFreeJob = completedJobs < FREE_JOBS_LIMIT && !!installerStripeId;

    // Only split deposit if Pro AND has Stripe connected
    const shouldSplitDeposit = isPro && !!installerStripeId;

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
    const leadUpdate: Record<string, unknown> = {
      source,
      scheduled_at: scheduledAt || null,
      sales_tax_amount: salesTaxAmount || null,
      billing_state: billingState || null,
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
