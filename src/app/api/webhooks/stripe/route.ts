import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendBookingConfirmation, sendNewLeadAlert } from "@/lib/email";
import {
  activateProSubscription,
  deactivateProSubscription,
} from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Webhook — Automation Brain
// Listens for checkout.session.completed to:
//   1. Mark lead as deposit paid
//   2. Capture customer address from Stripe
//   3. Send customer receipt email
//   4. Send new job alert to installer
//
// ARCHITECTURE: DB-first, email-second. Each step is isolated.
// If email crashes, the DB update is ALREADY committed.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  // ── Parse & verify event ──────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } else {
      event = JSON.parse(body) as Stripe.Event;
      console.warn("[Webhook] No STRIPE_WEBHOOK_SECRET — skipping signature verification");
    }
  } catch (parseErr) {
    console.error("[Webhook] Signature verification failed:", parseErr);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[Webhook] Event received:", event.type, "| ID:", event.id);

  // ── Handle checkout.session.completed ─────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const leadId = session.client_reference_id || metadata.leadId || metadata.lead_id;
    const installerId = metadata.installerId || metadata.installer_id;

    console.log("[Webhook] Session:", session.id, "| Lead:", leadId, "| Installer:", installerId);

    if (!leadId) {
      console.warn("[Webhook] checkout.session.completed without leadId in metadata");
      return NextResponse.json({ received: true });
    }

    const amountPaid = (session.amount_total || 0) / 100;
    const paymentType = metadata.type || "booking"; // "booking" (deposit) or "final_payment"

    console.log("[Webhook] Payment type:", paymentType, "| Amount:", amountPaid);

    // ═════════════════════════════════════════════════════════════════════
    // FINAL PAYMENT — Customer paid the balance via payment link
    // ═════════════════════════════════════════════════════════════════════
    if (paymentType === "final_payment") {
      try {
        const { error } = await supabase
          .from("leads")
          .update({
            status: "paid",
            payout_status: "paid",
            paid_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);

        if (error) {
          console.error("[Webhook] CRITICAL: Final payment DB update failed!", JSON.stringify(error));
        } else {
          console.log("SUCCESS: Job marked PAID (final payment) for lead:", leadId);
        }
      } catch (err) {
        console.error("[Webhook] Final payment update threw:", err);
      }

      // Send emails: receipt to customer, payment alert to installer
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("customer_name, customer_email, estimated_price, deposit_amount, quote_data, installer_id")
          .eq("id", leadId)
          .single();

        const { sendJobReceipt, sendPaymentReceivedAlert } = await import("@/lib/email");
        let installerName = "Your Installer";
        let installerEmail: string | null = null;

        if (lead?.installer_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, business_name")
            .eq("id", lead.installer_id)
            .single();
          if (profile) {
            installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
          }
          // Get installer's email from auth
          const { data: authUser } = await supabase.auth.admin.getUserById(lead.installer_id);
          installerEmail = authUser?.user?.email || null;
        }

        const unitCount = Array.isArray(lead?.quote_data) ? lead.quote_data.length : 1;
        const customerName = lead?.customer_name ?? "Customer";

        // Send receipt to customer
        if (lead?.customer_email) {
          await sendJobReceipt(lead.customer_email, {
            customerName,
            installerName,
            totalAmount: lead.estimated_price ?? amountPaid,
            depositPaid: lead.deposit_amount ?? 0,
            balanceCollected: amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            completedDate: new Date().toISOString(),
          });
          console.log("[Webhook] Receipt email sent to customer");
        }

        // Send payment alert to installer
        if (installerEmail) {
          await sendPaymentReceivedAlert(installerEmail, {
            installerName,
            customerName,
            amountReceived: amountPaid,
            jobTotal: lead?.estimated_price ?? amountPaid,
            leadId,
          });
          console.log("[Webhook] Payment alert sent to installer:", installerEmail);
        }
      } catch (emailErr: any) {
        console.error("[Webhook] Final payment email FAILED (Non-Fatal):", emailErr?.message ?? emailErr);
      }

      return NextResponse.json({ received: true });
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOOKING (Deposit) — Original flow
    // ═════════════════════════════════════════════════════════════════════

    // ── Extract address from Stripe (safe — all optional chaining) ────
    const stripeAddress =
      session.customer_details?.address ||
      (session as any).shipping_details?.address ||
      null;

    let fullAddress = "";
    if (stripeAddress) {
      fullAddress = [
        stripeAddress.line1,
        stripeAddress.line2,
        stripeAddress.city,
        stripeAddress.state,
        stripeAddress.postal_code,
      ].filter(Boolean).join(", ");
    }

    // Robust email extraction: customer_details > customer_email > metadata
    const stripeEmail = session.customer_details?.email || session.customer_email || metadata.customer_email || null;

    console.log("[Webhook] Amount:", amountPaid, "| Email:", stripeEmail, "| Address:", fullAddress || "none");

    // ═════════════════════════════════════════════════════════════════════
    // STEP 1: FORCE DB UPDATE (Critical Path — isolated try/catch)
    // ═════════════════════════════════════════════════════════════════════
    try {
      const updatePayload: Record<string, unknown> = {
        deposit_paid: true,
        deposit_amount: amountPaid,
        payout_status: "deposit_collected",
        status: "open",
        // Address fields — match migration 016 column names
        address_line1: stripeAddress?.line1 ?? "Address Pending",
        address_city: stripeAddress?.city ?? "",
        address_state: stripeAddress?.state ?? "",
        address_zip: stripeAddress?.postal_code ?? "",
        // Also write to migration 012 column names for backward compat
        city: stripeAddress?.city ?? "",
        state: stripeAddress?.state ?? "",
      };

      // Composite address for display
      if (fullAddress) {
        updatePayload.address = fullAddress;
      }

      if (stripeEmail) {
        updatePayload.customer_email = stripeEmail;
      }

      console.log("[Webhook] DB update payload:", JSON.stringify(updatePayload));

      const { error: updateError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", leadId);

      if (updateError) {
        console.error("[Webhook] CRITICAL: DB update failed!", JSON.stringify(updateError));
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      console.log("SUCCESS: Job DB Updated for lead:", leadId);
    } catch (dbError) {
      console.error("[Webhook] CRITICAL: DB update threw!", dbError);
      return NextResponse.json({ error: "DB update exception" }, { status: 500 });
    }

    // ═════════════════════════════════════════════════════════════════════
    // STEP 2: ATTEMPT EMAILS (Non-critical — swallow all errors)
    // ═════════════════════════════════════════════════════════════════════

    // Fetch lead details for email (isolated — if this fails, DB is saved)
    let lead: any = null;
    try {
      const { data } = await supabase
        .from("leads")
        .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at")
        .eq("id", leadId)
        .single();
      lead = data;
    } catch (fetchErr) {
      console.error("[Webhook] Lead fetch failed (non-fatal):", fetchErr);
    }

    if (!lead) {
      console.warn("[Webhook] Lead not found after update — skipping emails");
      return NextResponse.json({ received: true });
    }

    const resolvedInstallerId = installerId || lead.installer_id;
    const customerEmail = lead.customer_email || stripeEmail;
    const customerName = lead.customer_name || session.customer_details?.name || metadata.customer_name || "Customer";

    // ── Send booking confirmation to customer ─────────────────────────
    if (customerEmail) {
      try {
        let installerName = "Your Installer";
        let installerPhone: string | undefined;
        let installerAvatar: string | undefined;

        if (resolvedInstallerId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, business_name, phone, avatar_url")
            .eq("id", resolvedInstallerId)
            .single();
          if (profile) {
            installerName =
              profile.business_name ||
              [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
              "Your Installer";
            installerPhone = profile.phone || undefined;
            installerAvatar = profile.avatar_url || undefined;
          }
        }

        const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;

        console.log("[Webhook] Attempting booking confirmation to:", customerEmail);
        console.log("[Webhook] Email args:", JSON.stringify({
          customerName,
          customerEmail,
          installerName,
          scheduledDate: lead.scheduled_at ?? "TBD",
          address: lead.address ?? fullAddress ?? "Address Pending",
          depositAmount: amountPaid,
          totalPrice: lead.estimated_price ?? amountPaid,
          unitCount,
        }));

        const emailResult = await sendBookingConfirmation({
          customerName,
          customerEmail,
          installerName,
          installerPhone,
          installerAvatarUrl: installerAvatar,
          scheduledDate: lead.scheduled_at ?? "TBD",
          address: lead.address ?? fullAddress ?? "Address Pending",
          depositAmount: amountPaid,
          totalPrice: lead.estimated_price ?? amountPaid,
          jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
          leadId,
        });
        console.log("[Webhook] Booking confirmation result:", JSON.stringify(emailResult));
      } catch (emailErr: any) {
        console.error("[Webhook] EMAIL FAILED (Non-Fatal):", emailErr?.message ?? emailErr);
        console.error("[Webhook] Email stack:", emailErr?.stack);
        // DO NOT THROW. DB is already saved.
      }
    } else {
      console.warn("[Webhook] No customer email — skipping booking confirmation");
    }

    // ── Send new job alert to installer ───────────────────────────────
    if (resolvedInstallerId) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(resolvedInstallerId);
        const installerEmail = authUser?.user?.email;

        if (installerEmail) {
          const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
          const city = lead.address
            ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
            : "Unknown";

          console.log("[Webhook] Sending lead alert to installer:", installerEmail);
          const alertResult = await sendNewLeadAlert(installerEmail, city, {
            customerName,
            customerEmail: customerEmail || undefined,
            address: lead.address || fullAddress || undefined,
            unitCount,
            totalPrice: lead.estimated_price ?? amountPaid,
            leadId,
          });
          console.log("[Webhook] Lead alert result:", JSON.stringify(alertResult));
        }
      } catch (alertErr: any) {
        console.error("[Webhook] Installer alert FAILED (Non-Fatal):", alertErr?.message ?? alertErr);
        // DO NOT THROW.
      }
    }

    console.log(`[Webhook] checkout.session.completed fully processed for lead ${leadId}`);
  }

  // ── Handle Pro subscription events ──────────────────────────────────────
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (userId && subscription.status === "active") {
      console.log("[Webhook] Pro subscription activated for user:", userId);
      const result = await activateProSubscription(userId, subscription.id);
      if (result.success) {
        console.log("[Webhook] Pro activated, slug:", result.slug);
      } else {
        console.error("[Webhook] Pro activation failed:", result.error);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (userId) {
      console.log("[Webhook] Pro subscription cancelled for user:", userId);
      await deactivateProSubscription(userId);
    }
  }

  // ── Handle payment_intent.succeeded (deposits via BookingModal + balance payments) ──
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = paymentIntent.metadata || {};
    const leadId = metadata.leadId || metadata.lead_id;
    const paymentType = metadata.type || "final_payment";

    if (leadId) {
      const amountPaidPI = (paymentIntent.amount || 0) / 100;
      console.log("[Webhook] payment_intent.succeeded for lead:", leadId, "| type:", paymentType, "| amount:", amountPaidPI);

      if (paymentType === "booking" || paymentType === "deposit") {
        // ── DEPOSIT via BookingModal (inline Stripe Elements) ──────────
        try {
          // Extract all relevant data from metadata
          const customerEmail = metadata.customer_email || paymentIntent.receipt_email || null;
          const customerName = metadata.customer_name || null;
          const source = metadata.source || "platform"; // Default to platform if not specified
          const scheduledAt = metadata.scheduled_at || null;

          const updatePayload: Record<string, unknown> = {
            deposit_paid: true,
            deposit_amount: amountPaidPI,
            payout_status: "deposit_collected",
            status: "open",
            source, // Save the lead source!
            updated_at: new Date().toISOString(),
          };

          // Add customer info if available
          if (customerEmail) {
            updatePayload.customer_email = customerEmail;
          }
          if (customerName) {
            updatePayload.customer_name = customerName;
          }
          if (scheduledAt) {
            updatePayload.scheduled_at = scheduledAt;
          }

          console.log("[Webhook] Deposit update payload:", JSON.stringify(updatePayload));

          const { error: updateError } = await supabase
            .from("leads")
            .update(updatePayload)
            .eq("id", leadId);

          if (updateError) {
            console.error("[Webhook] CRITICAL: Deposit DB update failed!", JSON.stringify(updateError));
          } else {
            console.log("[Webhook] Deposit recorded for lead:", leadId, "| source:", source, "| email:", customerEmail);
          }
        } catch (dbErr) {
          console.error("[Webhook] Deposit DB update threw:", dbErr);
        }

        // ── Send booking confirmation email ───────────────────────────
        try {
          const { data: lead } = await supabase
            .from("leads")
            .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at")
            .eq("id", leadId)
            .single();

          // Resolve email: DB > PaymentIntent metadata > receipt_email
          const piEmail = lead?.customer_email || metadata.customer_email || paymentIntent.receipt_email;
          const piName = lead?.customer_name || metadata.customer_name || "Customer";

          if (piEmail && lead) {
            let installerName = "Your Installer";
            let installerPhone: string | undefined;
            let installerAvatar: string | undefined;
            const instId = metadata.installer_stripe_id ? lead.installer_id : lead.installer_id;

            if (instId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("first_name, last_name, business_name, phone, avatar_url")
                .eq("id", instId)
                .single();
              if (profile) {
                installerName = profile.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your Installer";
                installerPhone = profile.phone || undefined;
                installerAvatar = profile.avatar_url || undefined;
              }
            }

            const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;

            console.log("[Webhook] Sending booking confirmation (PI) to:", piEmail);
            await sendBookingConfirmation({
              customerName: piName,
              customerEmail: piEmail,
              installerName,
              installerPhone,
              installerAvatarUrl: installerAvatar,
              scheduledDate: lead.scheduled_at ?? metadata.scheduled_at ?? "TBD",
              address: lead.address ?? "Address Pending",
              depositAmount: amountPaidPI,
              totalPrice: lead.estimated_price ?? amountPaidPI,
              jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
              leadId,
            });
            console.log("[Webhook] Booking confirmation sent (PI flow)");
          } else {
            console.warn("[Webhook] No email found for PI booking — skipping confirmation");
          }

          // ── Send installer alert ────────────────────────────────────
          if (lead?.installer_id) {
            const { data: authUser } = await supabase.auth.admin.getUserById(lead.installer_id);
            const installerEmail = authUser?.user?.email;
            if (installerEmail) {
              const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
              const city = lead.address ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address : "Unknown";
              await sendNewLeadAlert(installerEmail, city, {
                customerName: piName,
                customerEmail: piEmail || undefined,
                address: lead.address || undefined,
                unitCount,
                totalPrice: lead.estimated_price ?? amountPaidPI,
                leadId,
              });
              console.log("[Webhook] Installer alert sent (PI flow)");
            }
          }
        } catch (emailErr: any) {
          console.error("[Webhook] PI booking email FAILED (Non-Fatal):", emailErr?.message ?? emailErr);
        }
      } else {
        // ── FINAL PAYMENT (balance collection) ─────────────────────────
        try {
          await supabase
            .from("leads")
            .update({
              status: "paid",
              payout_status: "paid",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadId);
          console.log("[Webhook] Lead marked paid (PI final):", leadId);
        } catch (piErr) {
          console.error("[Webhook] payment_intent update failed:", piErr);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
