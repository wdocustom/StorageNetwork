import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendBookingConfirmation, sendNewLeadAlert } from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Webhook — Automation Brain
// Listens for checkout.session.completed to:
//   1. Mark lead as deposit paid
//   2. Capture customer address from Stripe
//   3. Send customer receipt email
//   4. Send new job alert to installer
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

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature
    let event: Stripe.Event;
    if (WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } else {
      // Dev mode: parse without verification
      event = JSON.parse(body) as Stripe.Event;
      console.warn("[Webhook] No STRIPE_WEBHOOK_SECRET — skipping signature verification");
    }

    console.log("[Webhook] Event received:", event.type, "| ID:", event.id);

    // ── Handle checkout.session.completed ─────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const leadId = metadata.leadId || metadata.lead_id;
      const installerId = metadata.installerId || metadata.installer_id;

      console.log("[Webhook] Session:", session.id, "| Lead:", leadId, "| Installer:", installerId);
      console.log("[Webhook] Customer email from Stripe:", session.customer_details?.email);
      console.log("[Webhook] Customer address from Stripe:", JSON.stringify(session.customer_details?.address || (session as any).shipping_details?.address || null));

      if (!leadId) {
        console.warn("[Webhook] checkout.session.completed without leadId in metadata");
        return NextResponse.json({ received: true });
      }

      const amountPaid = (session.amount_total || 0) / 100;

      // ── Extract address from Stripe ───────────────────────────────
      const stripeAddress =
        session.customer_details?.address ||
        (session as any).shipping_details?.address ||
        null;

      let fullAddress: string | null = null;
      if (stripeAddress) {
        const parts = [
          stripeAddress.line1,
          stripeAddress.line2,
          stripeAddress.city,
          stripeAddress.state,
          stripeAddress.postal_code,
        ].filter(Boolean);
        fullAddress = parts.join(", ");
        console.log("[Webhook] Resolved address:", fullAddress);
      }

      // 1. Update lead: mark deposit as paid + save address if captured
      const updatePayload: Record<string, unknown> = {
        deposit_paid: true,
        deposit_amount: amountPaid,
        payout_status: "deposit_collected",
        status: "deposit_paid",
      };

      // Only overwrite address if we got one from Stripe and the lead doesn't have one
      if (fullAddress) {
        // Fetch current lead to check existing address
        const { data: currentLead } = await supabase
          .from("leads")
          .select("address")
          .eq("id", leadId)
          .single();

        if (!currentLead?.address || currentLead.address.trim() === "") {
          updatePayload.address = fullAddress;
          console.log("[Webhook] Saving Stripe address to lead:", fullAddress);
        }
      }

      // Also save customer email from Stripe if we have it
      const stripeEmail = session.customer_details?.email;
      if (stripeEmail) {
        updatePayload.customer_email = stripeEmail;
      }

      await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", leadId);

      // 2. Fetch lead details for email notifications
      const { data: lead } = await supabase
        .from("leads")
        .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id, scheduled_at")
        .eq("id", leadId)
        .single();

      if (!lead) {
        console.warn("[Webhook] Lead not found after update:", leadId);
        return NextResponse.json({ received: true });
      }

      const resolvedInstallerId = installerId || lead.installer_id;

      // 3. Send booking confirmation to customer
      const customerEmail = lead.customer_email || stripeEmail;
      console.log("[Webhook] Resolved customer email for confirmation:", customerEmail);

      if (customerEmail) {
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
        console.log("[Webhook] Sending booking confirmation to:", customerEmail);

        try {
          console.log("[Webhook] sendBookingConfirmation args:", JSON.stringify({
            customerName: lead.customer_name || "Customer",
            customerEmail,
            installerName,
            scheduledDate: lead.scheduled_at || new Date().toISOString().split("T")[0],
            address: lead.address || fullAddress || "",
            depositAmount: amountPaid,
            totalPrice: lead.estimated_price || amountPaid,
            unitCount,
          }));
          const emailResult = await sendBookingConfirmation({
            customerName: lead.customer_name || "Customer",
            customerEmail,
            installerName,
            installerPhone,
            installerAvatarUrl: installerAvatar,
            scheduledDate: lead.scheduled_at || new Date().toISOString().split("T")[0],
            address: lead.address || fullAddress || "",
            depositAmount: amountPaid,
            totalPrice: lead.estimated_price || amountPaid,
            jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
            leadId,
          });
          console.log("[Webhook] Booking confirmation result:", JSON.stringify(emailResult));
        } catch (emailErr: any) {
          console.error("[Webhook] Booking confirmation FAILED:", emailErr?.message || emailErr);
          console.error("[Webhook] Booking confirmation stack:", emailErr?.stack);
        }
      } else {
        console.warn("[Webhook] No customer email available — skipping booking confirmation");
      }

      // 4. Send new job alert to installer
      if (resolvedInstallerId) {
        const { data: authUser } = await supabase.auth.admin.getUserById(
          resolvedInstallerId
        );
        const installerEmail = authUser?.user?.email;

        if (installerEmail) {
          console.log("[Webhook] Sending new lead alert to installer:", installerEmail);
          const unitCount = Array.isArray(lead.quote_data) ? lead.quote_data.length : 1;
          const city = lead.address
            ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
            : "Unknown";

          try {
            const alertResult = await sendNewLeadAlert(installerEmail, city, {
              customerName: lead.customer_name || "Customer",
              unitCount,
              totalPrice: lead.estimated_price || amountPaid,
              leadId,
            });
            console.log("[Webhook] Lead alert result:", JSON.stringify(alertResult));
          } catch (alertErr) {
            console.error("[Webhook] Lead alert FAILED:", alertErr);
          }
        } else {
          console.warn("[Webhook] Could not resolve installer email for:", resolvedInstallerId);
        }
      }

      console.log(`[Webhook] checkout.session.completed fully processed for lead ${leadId}`);
    }

    // ── Handle payment_intent.succeeded (for balance payments) ─────────
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const leadId = metadata.leadId || metadata.lead_id;

      if (leadId) {
        console.log("[Webhook] payment_intent.succeeded for lead:", leadId);
        await supabase
          .from("leads")
          .update({
            status: "paid",
            payout_status: "paid",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);
        console.log("[Webhook] Lead marked paid via payment_intent.succeeded:", leadId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 400 }
    );
  }
}
