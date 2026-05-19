"use server";

import { getServiceClient } from "@/lib/supabase-server";
import Stripe from "stripe";
import {
  sendCleanoutUpsellEmail,
  sendCleanoutUpsellInstallerAlert,
  sendCleanoutUpsellConfirmation,
} from "@/lib/email";
import { DEFAULT_SERVICES, type ServiceOffering } from "@/config/services";
import { roundMoney, calculateBalanceDue } from "@/utils/mathHelpers";
import { getDepositAmount } from "@/app/actions/fee-engine";

// ═══════════════════════════════════════════════════════════════════════════
// Cleanout Upsell — Automated Pre-Install Upsell Engine
//
// 3 days before a scheduled install/delivery, if the installer offers
// cleanout services and the customer hasn't been presented them, send
// a branded email with the installer's cleanout options as one-click
// purchase buttons.
//
// FEE STRUCTURE (network-driven upsell):
//
// Cleanout upsells are sourced by the platform — the customer reaches the
// purchase via a platform-sent email — so they're charged the network rate
// (15%), matching how /design and waitlist-activation network leads are
// billed in payments.ts. Installer collects the balance half at service.
// ─────────────────────────────────────────────────────────────────────────
//   50% deposit collected from customer at checkout
//   15% of total → Platform fee (taken from the deposit)
//   35% of total → Installer (immediate transfer via Stripe Connect)
//   50% remaining → Collected at service time (added to job balance)
// ─────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const db = getServiceClient;

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-12-15.clover" });
  return _stripe;
}

// ── Fee Constants ────────────────────────────────────────────────────────
const UPSELL_DEPOSIT_RATE = 0.50;       // 50% deposit
const UPSELL_PLATFORM_FEE_RATE = 0.15;  // 15% network fee
const UPSELL_INSTALLER_RATE = 0.35;     // 35% to installer immediately (50% deposit − 15% platform)

// ═══════════════════════════════════════════════════════════════════════════
// processCleanoutUpsells — Cron job: find eligible jobs & send upsell emails
// ═══════════════════════════════════════════════════════════════════════════

export async function processCleanoutUpsells(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;

  try {
    // Find jobs scheduled 3 days from now that:
    // 1. Have deposit_paid = true (paid deposit jobs only)
    // 2. Haven't received a cleanout upsell email yet
    // 3. Have a scheduled_at date
    // 4. Status is "open" (active jobs)
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Window: 3 days from now ± 12 hours (to catch daily cron runs)
    const windowStart = new Date(threeDaysFromNow);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(threeDaysFromNow);
    windowEnd.setHours(23, 59, 59, 999);

    const { data: eligibleLeads, error: fetchError } = await db()
      .from("leads")
      .select(
        "id, customer_name, customer_email, installer_id, scheduled_at, estimated_price, deposit_amount, balance_due, quote_data, notes, address"
      )
      .eq("deposit_paid", true)
      .eq("status", "open")
      .is("cleanout_upsell_sent", null)
      .not("customer_email", "is", null)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", windowStart.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (fetchError) {
      console.error("[CleanoutUpsell] Fetch error:", fetchError);
      return { processed: 0, sent: 0, errors: [fetchError.message] };
    }

    if (!eligibleLeads || eligibleLeads.length === 0) {
      console.log("[CleanoutUpsell] No eligible leads found for upsell.");
      return { processed: 0, sent: 0, errors: [] };
    }

    console.log(`[CleanoutUpsell] Found ${eligibleLeads.length} eligible leads`);

    for (const lead of eligibleLeads) {
      processed++;

      try {
        if (!lead.installer_id || !lead.customer_email) continue;

        // Check if the lead already has cleanout in its quote_data (skip if so)
        const quoteData = lead.quote_data as Array<{ toteType?: string; desc?: string }> | null;
        const hasCleanoutAlready = quoteData?.some(
          (item) =>
            item.toteType === "cleanout" ||
            item.desc?.toLowerCase().includes("clean out")
        );
        if (hasCleanoutAlready) {
          console.log(`[CleanoutUpsell] Lead ${lead.id} already has cleanout — skipping`);
          continue;
        }

        // Fetch installer profile with services_config and Stripe info
        const { data: installer } = await db()
          .from("profiles")
          .select(
            "id, business_name, first_name, last_name, phone, avatar_url, stripe_account_id, services_config, is_pro, is_suspended"
          )
          .eq("id", lead.installer_id)
          .single();

        if (!installer) continue;

        // Skip leads belonging to suspended/locked installers
        if (installer.is_suspended) continue;

        // Resolve cleanout services from installer's services_config
        const servicesConfig = (installer.services_config as ServiceOffering[] | null) ?? DEFAULT_SERVICES;
        const cleanoutServices = servicesConfig.filter(
          (s) =>
            s.enabled &&
            s.id.startsWith("cleanout_") &&
            s.price !== null &&
            s.price > 0
        );

        // Also grab any custom (non-built-in) add-on services
        const customAddons = servicesConfig.filter(
          (s) => s.enabled && !s.built_in && s.price !== null && s.price > 0
        );

        if (cleanoutServices.length === 0 && customAddons.length === 0) {
          console.log(`[CleanoutUpsell] Installer ${installer.id} has no cleanout/add-on services — skipping`);
          continue;
        }

        // Must have Stripe connected for payment flow
        if (!installer.stripe_account_id) {
          console.log(`[CleanoutUpsell] Installer ${installer.id} has no Stripe account — skipping`);
          continue;
        }

        const installerName =
          installer.business_name ||
          [installer.first_name, installer.last_name].filter(Boolean).join(" ") ||
          "Your Installer";

        // Send the upsell email
        const allUpsellServices = [...cleanoutServices, ...customAddons];

        const emailResult = await sendCleanoutUpsellEmail({
          customerName: lead.customer_name,
          customerEmail: lead.customer_email,
          installerName,
          installerPhone: installer.phone || undefined,
          installerAvatarUrl: installer.avatar_url || undefined,
          scheduledDate: lead.scheduled_at,
          address: lead.address || undefined,
          leadId: lead.id,
          services: allUpsellServices.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            price: s.price!,
          })),
        });

        if (emailResult.success) {
          // Mark as sent
          await db()
            .from("leads")
            .update({
              cleanout_upsell_sent: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id);

          sent++;
          console.log(`[CleanoutUpsell] Email sent to ${lead.customer_email} for lead ${lead.id}`);
        } else {
          errors.push(`Lead ${lead.id}: ${emailResult.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Lead ${lead.id}: ${msg}`);
        console.error(`[CleanoutUpsell] Error processing lead ${lead.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[CleanoutUpsell] Fatal error:", err);
    errors.push(err instanceof Error ? err.message : "Fatal error");
  }

  return { processed, sent, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// createCleanoutUpsellCheckout — Creates Stripe Checkout for the upsell
//
// 50% deposit collected, split: 15% platform (network fee) + 35% installer
// ═══════════════════════════════════════════════════════════════════════════

export interface CleanoutUpsellCheckoutInput {
  leadId: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number; // Full price of the cleanout service
}

export interface CleanoutUpsellCheckoutResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function createCleanoutUpsellCheckout(
  input: CleanoutUpsellCheckoutInput
): Promise<CleanoutUpsellCheckoutResult> {
  const { leadId, serviceId, serviceName, servicePrice } = input;

  if (!leadId || !serviceId || !servicePrice) {
    return { success: false, error: "Missing required parameters." };
  }

  try {
    // Fetch the lead to get installer info
    const { data: lead, error: leadError } = await db()
      .from("leads")
      .select("installer_id, customer_email, customer_name, scheduled_at")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: "Order not found." };
    }

    if (!lead.installer_id) {
      return { success: false, error: "No installer assigned to this order." };
    }

    // Fetch installer's Stripe account
    const { data: installer } = await db()
      .from("profiles")
      .select("stripe_account_id, business_name, services_config")
      .eq("id", lead.installer_id)
      .single();

    if (!installer?.stripe_account_id) {
      return { success: false, error: "Installer payment not configured." };
    }

    // Validate the service exists and price matches installer's config
    const servicesConfig = (installer.services_config as ServiceOffering[] | null) ?? DEFAULT_SERVICES;
    const matchedService = servicesConfig.find((s) => s.id === serviceId && s.enabled);
    if (!matchedService) {
      return { success: false, error: "Service not available." };
    }

    const actualPrice = matchedService.price ?? servicePrice;

    // Calculate fee split
    const depositAmount = roundMoney(actualPrice * UPSELL_DEPOSIT_RATE);
    const depositCents = Math.round(depositAmount * 100);
    const platformFeeCents = Math.round(actualPrice * UPSELL_PLATFORM_FEE_RATE * 100);
    const installerAmountCents = Math.round(actualPrice * UPSELL_INSTALLER_RATE * 100);

    const { getAppUrl } = await import("@/lib/url-helper");
    const baseUrl = getAppUrl();

    // Create Stripe Checkout Session with fee split
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Add-On: ${serviceName}`,
              description: `50% deposit for ${serviceName} — ${installer.business_name || "Your Installer"}`,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: installer.stripe_account_id,
        },
      },
      customer_email: lead.customer_email || undefined,
      success_url: `${baseUrl}/upsell/success?job=${leadId}&service=${serviceId}`,
      cancel_url: `${baseUrl}/upsell/cancel?job=${leadId}`,
      metadata: {
        lead_id: leadId,
        type: "cleanout_upsell",
        service_id: serviceId,
        service_name: serviceName,
        service_price: Math.round(actualPrice * 100).toString(),
        deposit_amount: depositCents.toString(),
        platform_fee: platformFeeCents.toString(),
        installer_amount: installerAmountCents.toString(),
        installer_id: lead.installer_id,
      },
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session." };
    }

    return { success: true, url: session.url };
  } catch (err) {
    console.error("[CleanoutUpsell] Checkout error:", err);
    return {
      success: false,
      error: "Failed to create checkout. Please try again.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// handleCleanoutUpsellPayment — Called by Stripe webhook after payment
//
// Updates the lead with the upsold service, adjusts the balance,
// sends confirmation to customer + notification to installer.
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCleanoutUpsellPayment(
  leadId: string,
  metadata: Record<string, string>,
  amountPaid: number
): Promise<void> {
  try {
    const serviceId = metadata.service_id;
    const serviceName = metadata.service_name;
    const servicePrice = parseFloat(metadata.service_price || "0");
    const depositAmount = parseFloat(metadata.deposit_amount || "0");
    const remainingBalance = calculateBalanceDue(servicePrice, depositAmount);
    const installerId = metadata.installer_id;

    // 1. Fetch current lead data
    const { data: lead } = await db()
      .from("leads")
      .select(
        "customer_name, customer_email, balance_due, estimated_price, quote_data, scheduled_at, address, notes"
      )
      .eq("id", leadId)
      .single();

    if (!lead) {
      console.error("[CleanoutUpsell] Lead not found:", leadId);
      return;
    }

    // 2. Build the upsell service snapshot
    const upsellService = {
      id: serviceId,
      name: serviceName,
      price: servicePrice,
      deposit: depositAmount,
      remaining: remainingBalance,
      added_at: new Date().toISOString(),
    };

    // 3. Update the lead — add upsell data + adjust balance
    const currentBalance = lead.balance_due || 0;
    const newBalance = roundMoney(currentBalance + remainingBalance);
    const currentTotal = lead.estimated_price || 0;
    const newTotal = roundMoney(currentTotal + servicePrice);

    // Append cleanout to notes
    const currentNotes = lead.notes || "";
    const upsellNote = `\n+ Add-On: ${serviceName} ($${servicePrice}) — 50% deposit paid ($${depositAmount})`;

    await db()
      .from("leads")
      .update({
        cleanout_upsell_service: upsellService,
        cleanout_upsell_amount: servicePrice,
        cleanout_upsell_deposit: depositAmount,
        cleanout_upsell_paid_at: new Date().toISOString(),
        balance_due: newBalance,
        estimated_price: newTotal,
        notes: currentNotes + upsellNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    console.log(
      `[CleanoutUpsell] Lead ${leadId} updated — upsell: ${serviceName} ($${servicePrice}), new balance: $${newBalance}`
    );

    // 4. Fetch installer info for emails
    let installerName = "Your Installer";
    let installerEmail: string | null = null;
    let installerPhone: string | undefined;

    if (installerId) {
      const { data: profile } = await db()
        .from("profiles")
        .select("business_name, first_name, last_name, phone")
        .eq("id", installerId)
        .single();

      if (profile) {
        installerName =
          profile.business_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "Your Installer";
        installerPhone = profile.phone || undefined;
      }

      // Get installer's email from auth
      const { data: authUser } = await db().auth.admin.getUserById(installerId);
      installerEmail = authUser?.user?.email || null;
    }

    // 5. Send installer notification email
    if (installerEmail) {
      await sendCleanoutUpsellInstallerAlert(installerEmail, {
        installerName,
        customerName: lead.customer_name || "Customer",
        serviceName,
        servicePrice,
        depositCollected: depositAmount,
        remainingBalance,
        scheduledDate: lead.scheduled_at || undefined,
        leadId,
      });
      console.log("[CleanoutUpsell] Installer notification sent to:", installerEmail);
    }

    // 6. Send customer confirmation email
    if (lead.customer_email) {
      // Build full services list for the confirmation
      const quoteData = lead.quote_data as Array<{ desc?: string; price?: number }> | null;
      const existingServices = (quoteData || []).map((item) => ({
        name: item.desc || "Tote Storage Unit",
        price: item.price || 0,
      }));

      await sendCleanoutUpsellConfirmation({
        customerName: lead.customer_name || "Customer",
        customerEmail: lead.customer_email,
        installerName,
        installerPhone,
        scheduledDate: lead.scheduled_at || undefined,
        address: lead.address || undefined,
        existingServices,
        upsellService: {
          name: serviceName,
          price: servicePrice,
          depositPaid: depositAmount,
          remaining: remainingBalance,
        },
        totalPrice: newTotal,
        totalDeposit: (lead.estimated_price ? (lead.estimated_price - (lead.balance_due || 0)) : 0) + depositAmount,
        totalBalance: newBalance,
        leadId,
      });
      console.log("[CleanoutUpsell] Confirmation email sent to:", lead.customer_email);
    }
  } catch (err) {
    console.error("[CleanoutUpsell] handleCleanoutUpsellPayment error:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// updateLeadWithAddons — Integrates add-on services directly into the quote
//
// Called from the /pay page when a customer selects add-on services before
// paying their deposit. Updates the lead's total, deposit, and balance so
// the single payment covers everything.
// ═══════════════════════════════════════════════════════════════════════════

export interface UpdateLeadWithAddonsInput {
  leadId: string;
  services: Array<{ id: string; name: string; price: number }>;
}

export interface UpdateLeadWithAddonsResult {
  success: boolean;
  newTotal: number;
  newDeposit: number;
  newBalance: number;
  error?: string;
}

export async function updateLeadWithAddons(
  input: UpdateLeadWithAddonsInput
): Promise<UpdateLeadWithAddonsResult> {
  const { leadId, services } = input;
  const empty = { success: false, newTotal: 0, newDeposit: 0, newBalance: 0 };

  if (!leadId || !services.length) {
    return { ...empty, error: "Missing required parameters." };
  }

  try {
    // Fetch current lead
    const { data: lead, error: fetchErr } = await db()
      .from("leads")
      .select("estimated_price, deposit_amount, installer_id, notes, delivery_fee")
      .eq("id", leadId)
      .single();

    if (fetchErr || !lead) {
      return { ...empty, error: "Order not found." };
    }

    // Validate services exist in installer's config
    let servicesConfig: ServiceOffering[] = DEFAULT_SERVICES;
    if (lead.installer_id) {
      const { data: installer } = await db()
        .from("profiles")
        .select("services_config")
        .eq("id", lead.installer_id)
        .single();
      if (installer?.services_config && Array.isArray(installer.services_config)) {
        servicesConfig = installer.services_config as ServiceOffering[];
      }
    }

    // Validate each service and use installer's actual price
    const validatedServices: Array<{ id: string; name: string; price: number }> = [];
    for (const svc of services) {
      const match = servicesConfig.find((s) => s.id === svc.id && s.enabled && s.price && s.price > 0);
      if (!match) {
        return { ...empty, error: `Service "${svc.name}" is not available.` };
      }
      validatedServices.push({ id: match.id, name: match.name, price: match.price! });
    }

    const addonTotal = validatedServices.reduce((s, svc) => s + svc.price, 0);
    const newTotal = roundMoney(lead.estimated_price + addonTotal);

    // Recalculate deposit for the new total
    const newDeposit = await getDepositAmount(newTotal, lead.installer_id || undefined);
    const newBalance = calculateBalanceDue(newTotal, newDeposit);

    // Build upsell snapshot
    const upsellSnapshot = validatedServices.map((svc) => ({
      id: svc.id,
      name: svc.name,
      price: svc.price,
      added_at: new Date().toISOString(),
    }));

    // Build notes about the change
    const currentNotes = lead.notes || "";
    const addonLines = validatedServices
      .map((svc) => `+ Add-On: ${svc.name} ($${svc.price})`)
      .join("\n");
    const depositNote = `Deposit adjusted from $${lead.deposit_amount} → $${newDeposit} (add-on services included)`;
    const newNotes = currentNotes + (currentNotes ? "\n" : "") + addonLines + "\n" + depositNote;

    // Update the lead
    const { error: updateErr } = await db()
      .from("leads")
      .update({
        estimated_price: newTotal,
        deposit_amount: newDeposit,
        balance_due: newBalance,
        cleanout_upsell_service: upsellSnapshot.length === 1 ? upsellSnapshot[0] : upsellSnapshot,
        cleanout_upsell_amount: addonTotal,
        notes: newNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateErr) {
      console.error("[Upsell] updateLeadWithAddons DB error:", updateErr);
      return { ...empty, error: "Failed to update quote." };
    }

    console.log(
      `[Upsell] Lead ${leadId} updated — addons: ${validatedServices.map((s) => s.name).join(", ")}, new total: $${newTotal}, deposit: $${newDeposit}`
    );

    return { success: true, newTotal, newDeposit, newBalance };
  } catch (err) {
    console.error("[Upsell] updateLeadWithAddons error:", err);
    return { ...empty, error: "Failed to update quote." };
  }
}
