import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendBookingConfirmation, sendNewLeadAlert } from "@/lib/email";

// ═══════════════════════════════════════════════════════════════════════════
// Stripe Webhook — Automation Brain
// Listens for checkout.session.completed to:
//   1. Mark lead as deposit paid
//   2. Send customer receipt email
//   3. Send new job alert to installer
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

    // ── Handle checkout.session.completed ─────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const leadId = metadata.leadId || metadata.lead_id;
      const installerId = metadata.installerId || metadata.installer_id;

      if (!leadId) {
        console.warn("[Webhook] checkout.session.completed without leadId in metadata");
        return NextResponse.json({ received: true });
      }

      const amountPaid = (session.amount_total || 0) / 100;

      // 1. Update lead: mark deposit as paid
      await supabase
        .from("leads")
        .update({
          deposit_paid: true,
          deposit_amount: amountPaid,
          payout_status: "paid",
          status: "deposit_paid",
        })
        .eq("id", leadId);

      // 2. Fetch lead details for email notifications
      const { data: lead } = await supabase
        .from("leads")
        .select("customer_name, customer_email, address, quote_data, estimated_price, installer_id")
        .eq("id", leadId)
        .single();

      if (!lead) {
        console.warn("[Webhook] Lead not found:", leadId);
        return NextResponse.json({ received: true });
      }

      const resolvedInstallerId = installerId || lead.installer_id;

      // 3. Send booking confirmation to customer
      if (lead.customer_email) {
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
        await sendBookingConfirmation({
          customerName: lead.customer_name || "Customer",
          customerEmail: lead.customer_email,
          installerName,
          installerPhone,
          installerAvatarUrl: installerAvatar,
          scheduledDate: new Date().toISOString().split("T")[0],
          address: lead.address || "",
          depositAmount: amountPaid,
          totalPrice: lead.estimated_price || amountPaid,
          jobDescription: `${unitCount} shelving unit${unitCount !== 1 ? "s" : ""}`,
          leadId,
        });
      }

      // 4. Send new job alert to installer
      if (resolvedInstallerId) {
        const { data: installer } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", resolvedInstallerId)
          .single();

        if (installer) {
          // Get installer's email from auth
          const { data: authUser } = await supabase.auth.admin.getUserById(
            resolvedInstallerId
          );
          const installerEmail = authUser?.user?.email;

          if (installerEmail) {
            const unitCount = Array.isArray(lead.quote_data)
              ? lead.quote_data.length
              : 1;
            const city = lead.address
              ? lead.address.split(",").slice(-2, -1)[0]?.trim() || lead.address
              : "Unknown";

            await sendNewLeadAlert(installerEmail, city, {
              customerName: lead.customer_name || "Customer",
              unitCount,
              totalPrice: lead.estimated_price || amountPaid,
              leadId,
            });
          }
        }
      }

      console.log(`[Webhook] checkout.session.completed processed for lead ${leadId}`);
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
