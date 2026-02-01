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
// ═══════════════════════════════════════════════════════════════════════════

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Platform fee: 1% of the total amount ─────────────────────────────────
const PLATFORM_FEE_RATE = 0.01;

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
    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);

    const baseUrl = siteConfig.baseUrl;

    // ── Create Stripe Checkout Session ──────────────────────────────────
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
  import("@/lib/email").then(async ({ sendBookingConfirmation }) => {
    const { data: lead } = await supabase
      .from("leads")
      .select("customer_name, customer_email, address, scheduled_at, estimated_price, deposit_amount, installer_id, notes")
      .eq("id", leadId)
      .single();

    if (!lead?.customer_email || !lead.installer_id) return;

    const { data: installer } = await supabase
      .from("profiles")
      .select("business_name, phone, avatar_url")
      .eq("id", lead.installer_id)
      .single();

    await sendBookingConfirmation({
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
  }).catch((err: unknown) => console.error("[Email] Booking confirmation failed:", err));

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// createDepositIntent — Creates a PaymentIntent for inline Stripe Elements
//
// Returns clientSecret for the Payment Element (no redirect needed).
// Used by BookingModal for inline deposit collection.
// ═══════════════════════════════════════════════════════════════════════════

export interface DepositIntentInput {
  leadId: string;
  amount: number;
  installerStripeId: string;
  customerEmail?: string;
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
  const { leadId, amount, installerStripeId, customerEmail, scheduledAt } = input;

  if (!leadId || !amount || !installerStripeId) {
    return { success: false, error: "Missing required parameters." };
  }

  try {
    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: installerStripeId,
      },
      receipt_email: customerEmail || undefined,
      metadata: {
        lead_id: leadId,
        platform_fee_cents: String(platformFeeCents),
        installer_stripe_id: installerStripeId,
        scheduled_at: scheduledAt || "",
      },
    });

    // Update lead with scheduling info if provided
    if (scheduledAt) {
      await supabase
        .from("leads")
        .update({
          scheduled_at: scheduledAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
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
