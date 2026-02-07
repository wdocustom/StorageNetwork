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
// FEE STRUCTURE:
// ─────────────────────────────────────────────────────────────────────────
// Platform Lead (organic):     15% deposit → 100% to Platform
// Partner Link + Non-Pro:      15% deposit → 100% to Platform
// Partner Link + Pro ($99/mo): 15% deposit → 10% to Installer, 5% to Platform
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

// For final payments (balance collection), Pro gets 95%
const FINAL_PAYMENT_PLATFORM_FEE_RATE = 0.05;

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
    // ── Black Box: Fee Calculation ──────────────────────────────────────
    // Final payments (balance collection): 5% to Platform, 95% to Installer
    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * FINAL_PAYMENT_PLATFORM_FEE_RATE);

    const baseUrl = siteConfig.baseUrl;

    // ── Create Stripe Checkout Session with destination charge ──────────
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
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: installerStripeId,
        },
      },
      customer_email: customerEmail || undefined,
      success_url: `${baseUrl}/dashboard/leads/${leadId}?payment=success`,
      cancel_url: `${baseUrl}/dashboard/leads/${leadId}?payment=cancelled`,
      metadata: {
        lead_id: leadId,
        type: "final_payment",
        platform_fee_cents: String(platformFeeCents),
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

export type LeadSource = "platform" | "partner_link";

export interface DepositIntentInput {
  leadId: string;
  amount: number;                    // Deposit amount in dollars
  installerId: string;               // Supabase user ID of installer
  source: LeadSource;                // Where the lead came from
  customerEmail?: string;
  customerName?: string;
  scheduledAt?: string;
}

export interface DepositIntentResult {
  success: boolean;
  clientSecret?: string;
  error?: string;
}

export async function createDepositIntent(
  input: DepositIntentInput
): Promise<DepositIntentResult> {
  const { leadId, amount, installerId, source, customerEmail, customerName, scheduledAt } = input;

  if (!leadId || !amount || !installerId) {
    return { success: false, error: "Missing required parameters." };
  }

  try {
    const amountCents = Math.round(amount * 100);

    // ── Determine fee routing based on source + Pro status ───────────────
    //
    // Platform Lead:          100% to Platform (no destination charge)
    // Partner Link + Non-Pro: 100% to Platform (no destination charge)
    // Partner Link + Pro:     10% to Installer, 5% to Platform (destination charge)
    //
    const installerProfile = await getInstallerProfile(installerId);
    const isPro = installerProfile?.is_pro === true;
    const installerStripeId = installerProfile?.stripe_account_id;

    // Route to installer only if: partner_link + Pro + has Stripe connected
    const routeToInstaller = source === "partner_link" && isPro && installerStripeId;

    let paymentIntent;

    if (routeToInstaller && installerStripeId) {
      // ── Pro Partner Link: Destination charge with 5% platform fee ────
      // Installer receives 10% of the total (amount - platform fee)
      const platformFeeCents = Math.round(amountCents * PRO_PLATFORM_FEE_RATE);

      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
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
          installer_receives_cents: String(amountCents - platformFeeCents),
          installer_stripe_id: installerStripeId,
          scheduled_at: scheduledAt || "",
        },
      });

      console.log(`[Deposit] Pro Partner Link: $${amount} → Installer gets $${(amountCents - platformFeeCents) / 100}, Platform gets $${platformFeeCents / 100}`);
    } else {
      // ── Platform Lead OR Non-Pro Partner Link: All to Platform ───────
      // No destination charge — entire deposit goes to platform account
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
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
          platform_fee_cents: String(amountCents), // Platform keeps 100%
          installer_receives_cents: "0",
          scheduled_at: scheduledAt || "",
        },
      });

      console.log(`[Deposit] ${source === "platform" ? "Platform Lead" : "Non-Pro Partner Link"}: $${amount} → 100% to Platform`);
    }

    // Update lead with scheduling info and source
    await supabase
      .from("leads")
      .update({
        source,
        scheduled_at: scheduledAt || null,
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

    // 4. Fire emails (non-blocking)
    import("@/lib/email").then(async ({ sendBookingConfirmation, sendNewLeadAlert }) => {
      try {
        // Resolve installer info
        let installerName = "Your Installer";
        let installerPhone: string | undefined;
        let installerAvatar: string | undefined;

        if (lead.installer_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, business_name, phone, avatar_url")
            .eq("id", lead.installer_id)
            .single();
          if (profile) {
            installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
            installerPhone = profile.phone || undefined;
            installerAvatar = profile.avatar_url || undefined;
          }
        }

        const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
        const customerEmail = lead.customer_email || pi.receipt_email;
        const customerName = lead.customer_name || "Customer";

        // Customer confirmation
        if (customerEmail) {
          await sendBookingConfirmation({
            customerName,
            customerEmail,
            installerName,
            installerPhone,
            installerAvatarUrl: installerAvatar,
            scheduledDate: lead.scheduled_at ?? "TBD",
            address: lead.address ?? "Address Pending",
            depositAmount: amountPaid,
            totalPrice: lead.estimated_price ?? amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            leadId,
          });
          console.log("[VerifyDeposit] Customer confirmation sent");
        }

        // Installer alert
        if (lead.installer_id) {
          const { data: authUser } = await supabase.auth.admin.getUserById(lead.installer_id);
          const installerEmail = authUser?.user?.email;
          if (installerEmail) {
            const city = lead.address ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address : "Unknown";
            await sendNewLeadAlert(installerEmail, city, {
              customerName,
              customerEmail: customerEmail || undefined,
              address: lead.address || undefined,
              unitCount,
              totalPrice: lead.estimated_price ?? amountPaid,
              leadId,
            });
            console.log("[VerifyDeposit] Installer alert sent");
          }
        }
      } catch (emailErr) {
        console.error("[VerifyDeposit] Email error (non-fatal):", emailErr);
      }
    }).catch(console.error);

    return { success: true };
  } catch (stripeErr) {
    console.error("[VerifyDeposit] Stripe search error:", stripeErr);
    return { success: false, error: "Stripe verification failed" };
  }
}
