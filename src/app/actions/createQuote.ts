"use server";

import { siteConfig } from "@/config/site";
import {
  sendTransactionalEmail,
  buildQuoteEmailTemplate,
  sendReferralHandoffEmail,
  sendWaitlistCustomerConfirmation,
} from "@/lib/email";
import { validateServiceArea } from "@/app/actions/installer";
import { rerouteToLocalInstaller } from "@/app/actions/customer";
import { calculateCompoundBuild } from "@/app/actions/calculator";
import { calculateBuild } from "@/app/actions/calculator";
import { recordWaitlistDemand } from "@/app/actions/demand-signals";
import { getDepositAmount, getEstimatedSalesTax } from "@/app/actions/fee-engine";
import { validateDiscountCode } from "@/app/actions/discount-codes";
import type { InstallerPricing } from "@/types/viewModels";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Create Quote — Black Box Server Action
// Saves lead, calculates price server-side, sends email via Resend.
//
// Includes Network Referral Bounty system: when the delivery ZIP is outside
// the originating installer's service area, the quote is transparently
// handed off to a covering installer.  The originating installer earns a
// 30% bounty on the deposit (min $15).  The customer receives the email
// from the covering installer and continues with them.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { checkProTrial } from "@/app/actions/pro-trial";

const supabase = getServiceClient();

export interface QuoteUnit {
  cols: number;
  rows: number;
  toteType: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  desc: string;
  addons?: Array<{
    type: string;
    target: number | "left" | "right" | "doors_on";
    row?: number;
    options?: Record<string, string>;
  }>;
  /** When true, customer wants this item delivered inside the home */
  indoorDelivery?: boolean;
  /** The indoor delivery fee charged for this item (in dollars) */
  indoorDeliveryFee?: number;
}

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CreateQuoteInput {
  installer_id: string;
  installer_business_name?: string; // Ignored — server resolves from DB
  installer_first_name?: string;    // Ignored — server resolves from DB
  installer_phone?: string;         // Ignored — server resolves from DB
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_zip: string;           // Required — used for service area check
  quote_data: QuoteUnit[];
  grand_total: number;
  project_title?: string;
  discount_code?: string;
  delivery_address?: DeliveryAddress;
  delivery_fee?: number;          // Distance-based delivery fee (already included in grand_total)
  build_snapshot_url?: string;    // 3D canvas capture URL for email blueprint image
}

export type ReferralStatus =
  | "none"        // ZIP is in-area or no ZIP provided
  | "handed_off"  // Handed off to a covering installer
  | "waitlisted"; // No covering installer — customer waitlisted

export interface CreateQuoteResult {
  success: boolean;
  lead_id?: string;
  customer_id?: string;
  email_sent?: boolean;
  referral_status?: ReferralStatus;
  covering_installer_name?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZIP-based service area check (exported for the /build page UI)
// ═══════════════════════════════════════════════════════════════════════════

export interface ZipCheckResult {
  in_area: boolean;
  covering_installer_name?: string;
  waitlist: boolean;
}

/**
 * Check if a delivery ZIP is within the installer's area, and if not,
 * whether another installer covers it.  Used by the /build page to show
 * real-time feedback as the installer types the ZIP.
 */
export async function checkDeliveryZip(
  installerId: string,
  zip: string
): Promise<ZipCheckResult> {
  if (!installerId || !zip || zip.trim().length !== 5) {
    return { in_area: true, waitlist: false }; // Skip if no valid ZIP
  }

  const trimmed = zip.trim();
  const areaCheck = await validateServiceArea(installerId, trimmed);

  if (areaCheck.inArea) {
    return { in_area: true, waitlist: false };
  }

  // Out of area — check for a covering installer
  const localResult = await rerouteToLocalInstaller(trimmed, installerId);

  if (localResult.available && localResult.installer_id) {
    return {
      in_area: false,
      covering_installer_name: localResult.installer_name || "a local installer",
      waitlist: false,
    };
  }

  return { in_area: false, waitlist: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main quote creation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a quote and send it via email.
 *
 * When the delivery ZIP is outside the originating installer's service area:
 * 1. Find a covering installer via rerouteToLocalInstaller()
 * 2. Re-price the quote using the covering installer's pricing_config
 * 3. Create the lead under the covering installer
 * 4. Send the email from the covering installer's business name
 * 5. Track the originating installer as the referrer (bounty_status: "pending")
 * 6. Notify the originating installer of the referral handoff
 *
 * If no covering installer exists:
 * 1. Record a waitlist demand signal
 * 2. Return referral_status: "waitlisted" so the UI can inform the installer
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  const {
    installer_id,
    installer_business_name,
    installer_first_name,
    installer_phone,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    customer_zip,
    quote_data,
    grand_total,
    project_title,
    discount_code,
    delivery_address,
    delivery_fee,
    build_snapshot_url,
  } = input;

  // ── Validation ──────────────────────────────────────────────────────────
  if (!customer_name?.trim()) {
    return { success: false, error: "Customer name is required." };
  }

  const normalizedEmail = customer_email?.trim().toLowerCase() || null;

  if (!quote_data?.length) {
    return { success: false, error: "Quote must contain at least one item." };
  }

  if (!installer_id) {
    return { success: false, error: "Installer ID is required." };
  }

  // ── Resolve installer profile server-side (never trust client values) ──
  const { data: installerProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("business_name, first_name, phone, email")
    .eq("id", installer_id)
    .single();

  if (profileErr || !installerProfile) {
    console.error("[Quote] Installer profile lookup failed:", installer_id, profileErr);
    return { success: false, error: "Could not load installer profile." };
  }

  // ── Trial Job Cap — block new quotes when 3-job limit reached ──────
  // Server-side enforcement so it can't be bypassed via direct API call.
  const trialStatus = await checkProTrial(installer_id);
  if (trialStatus.jobCapReached && !trialStatus.trialExpired) {
    return { success: false, error: "Trial job limit reached. Subscribe to Pro to send unlimited quotes." };
  }
  if (trialStatus.softLocked) {
    return { success: false, error: "Trial has ended. Subscribe to Pro to send new quotes." };
  }

  try {
    // ── Service Area Check ────────────────────────────────────────────────
    // If a delivery ZIP is provided, check whether it's inside the
    // originating installer's area.  If not, hand off to a local installer.
    let effectiveInstallerId = installer_id;
    let effectiveBusinessName = installerProfile.business_name || installerProfile.first_name;
    let effectiveFirstName = installerProfile.first_name;
    let effectivePhone = installerProfile.phone;
    let effectiveEmail = installerProfile.email as string | null;
    let referringInstallerId: string | null = null;
    let referralStatus: ReferralStatus = "none";
    let referrerSoftLocked = false;
    let coveringInstallerName: string | undefined;
    let effectiveQuoteData = quote_data;
    let effectiveTotal = grand_total;

    const deliveryZip = customer_zip?.trim() || delivery_address?.zip?.trim();

    if (!deliveryZip || !/^\d{5}$/.test(deliveryZip)) {
      return { success: false, error: "A valid 5-digit ZIP code is required." };
    }

    const areaCheck = await validateServiceArea(installer_id, deliveryZip);

    if (!areaCheck.inArea) {
      // Out of area — try to find a covering installer
      const localResult = await rerouteToLocalInstaller(deliveryZip, installer_id);

      if (localResult.available && localResult.installer_id) {
        // ── Handoff: re-route to covering installer ──────────────────
        referringInstallerId = installer_id;
        effectiveInstallerId = localResult.installer_id;
        effectiveBusinessName = localResult.installer_name || "a local installer";
        coveringInstallerName = localResult.installer_name || "a local installer";
        referralStatus = "handed_off";

        // Check if referring installer is soft-locked (no bounty)
        const { data: refProfile } = await supabase
          .from("profiles")
          .select("pro_trial_ends_at, stripe_subscription_id")
          .eq("id", installer_id)
          .maybeSingle();
        if (refProfile?.pro_trial_ends_at && !refProfile.stripe_subscription_id) {
          if (new Date() >= new Date(refProfile.pro_trial_ends_at)) {
            referrerSoftLocked = true;
          }
        }

        // Fetch covering installer's profile for email details + pricing
        const { data: coveringProfile } = await supabase
          .from("profiles")
          .select("first_name, phone, pricing_config, email")
          .eq("id", effectiveInstallerId)
          .single();

        if (coveringProfile) {
          effectiveFirstName = (coveringProfile.first_name as string) || undefined;
          effectivePhone = (coveringProfile.phone as string) || undefined;
          effectiveEmail = (coveringProfile.email as string) || null;

          // ── Re-price with covering installer's rates ──────────────
          const coveringPricing = (coveringProfile.pricing_config as InstallerPricing) || undefined;
          const repriced = await repriceQuoteUnits(quote_data, coveringPricing);
          effectiveQuoteData = repriced.units;
          effectiveTotal = repriced.total;
        }
      } else {
        // ── No covering installer — waitlist path ────────────────────
        referralStatus = "waitlisted";

        // Record demand signal so the customer gets notified when an
        // installer covers their area
        if (normalizedEmail) {
          await recordWaitlistDemand({
            zip: deliveryZip,
            customerName: customer_name.trim(),
            customerEmail: normalizedEmail,
            customerPhone: customer_phone?.trim(),
            sourceInstallerId: installer_id,
            quoteData: quote_data,
          }).catch((err) => {
            console.error("[Quote] Waitlist demand recording failed (non-fatal):", err);
          });

          // Send the customer a waitlist confirmation email so they
          // know their build is saved and they'll be notified later
          await sendWaitlistCustomerConfirmation(normalizedEmail, {
            customerName: customer_name.trim(),
            installerBusinessName: effectiveBusinessName || "Your Installer",
            zip: deliveryZip,
            quoteData: quote_data as Array<{ desc?: string; cols?: number; rows?: number; price?: number }>,
          }).catch((err) => {
            console.error("[Quote] Waitlist customer confirmation email failed (non-fatal):", err);
          });
        }

        return {
          success: true,
          referral_status: "waitlisted",
          email_sent: !!normalizedEmail,
          error: undefined,
        };
      }
    }

    // ── Load installer's cleanout services (for upsell in email) ──────────
    let cleanoutServices: Array<{ id: string; name: string; description: string; price: number }> = [];
    {
      const { data: installerProfile } = await supabase
        .from("profiles")
        .select("services_config")
        .eq("id", effectiveInstallerId)
        .single();

      if (installerProfile?.services_config && Array.isArray(installerProfile.services_config)) {
        cleanoutServices = (installerProfile.services_config as Array<{ id: string; name: string; description: string; price: number | null; enabled: boolean }>)
          .filter((s) => s.enabled && s.price && s.price > 0 && s.id.startsWith("cleanout_"))
          .map((s) => ({ id: s.id, name: s.name, description: s.description, price: s.price! }));
      }
    }

    // ── 1. Create or Find Customer ────────────────────────────────────────
    let customerId: string;

    // If email provided, try to find existing customer by email + effective installer
    let existingCustomer = null;
    if (normalizedEmail) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("installer_id", effectiveInstallerId)
        .single();
      existingCustomer = data;
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update customer info
      await supabase
        .from("customers")
        .update({
          name: customer_name.trim(),
          phone: customer_phone?.trim() || null,
          address: customer_address?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customer_name.trim(),
          email: normalizedEmail,
          phone: customer_phone?.trim() || null,
          address: customer_address?.trim() || null,
          installer_id: effectiveInstallerId,
          source: "quote",
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        console.error("[Quote] Customer create error:", customerError);
        return { success: false, error: "Failed to create customer record." };
      }
      customerId = newCustomer.id;
    }

    // ── 2. Calculate Totals Server-Side ─────────────────────────────────
    const serverTotal = effectiveQuoteData.reduce((sum, unit) => sum + unit.price, 0);
    const finalTotal = serverTotal > 0 ? serverTotal : effectiveTotal;

    // Use the effective installer's custom deposit config (min 15% enforced by fee engine)
    const depositAmount = await getDepositAmount(finalTotal, effectiveInstallerId);

    // ── Validate discount code (if provided) ─────────────────────────
    let discountAmount = 0;
    if (discount_code?.trim()) {
      const discountResult = await validateDiscountCode(
        discount_code,
        effectiveInstallerId,
        finalTotal,
        { noDepositCap: true, unitCount: effectiveQuoteData.length }
      );
      if (discountResult.valid) {
        discountAmount = discountResult.discountAmount;
      }
    }

    // ── Estimated Sales Tax ─────────────────────────────────────────────
    // Derive state from the entered ZIP and compute tax at quote time.
    // finalTotal is sum(unit.price) — already excludes delivery fees and
    // indoor delivery (those are tracked separately and are tax-exempt).
    // Cleanout / custom_service items are also tax-exempt (labor).
    const hasServiceItem = effectiveQuoteData.some(
      (u) => u.toteType === "cleanout" || u.toteType === "custom_service"
    );
    const taxableAmount = hasServiceItem
      ? effectiveQuoteData
          .filter((u) => u.toteType !== "cleanout" && u.toteType !== "custom_service")
          .reduce((sum, u) => sum + (u.price || 0), 0)
      : finalTotal;

    const taxQuote = await getEstimatedSalesTax(taxableAmount, deliveryZip, installer_id);

    const balanceDue = roundMoney(finalTotal - depositAmount - discountAmount + taxQuote.taxAmount);

    // ── 3. Create Lead Record ─────────────────────────────────────────────
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        installer_id: effectiveInstallerId,
        customer_id: customerId,
        customer_name: customer_name.trim(),
        customer_email: normalizedEmail,
        customer_phone: customer_phone?.trim() || null,
        address: customer_address?.trim() || null,
        quote_data: effectiveQuoteData,
        estimated_price: finalTotal,
        deposit_amount: depositAmount,
        balance_due: balanceDue,
        source: "installer_manual",
        status: "pending_payment",
        deposit_paid: false,
        discount_code: discount_code?.toUpperCase() || null,
        discount_amount: discountAmount || 0,
        // Delivery / installation address
        delivery_address_line1: delivery_address?.line1 || null,
        delivery_address_line2: delivery_address?.line2 || null,
        delivery_address_city: delivery_address?.city || null,
        delivery_address_state: delivery_address?.state || null,
        delivery_address_zip: delivery_address?.zip || null,
        // Distance-based delivery fee (tax-exempt, included in estimated_price)
        delivery_fee: delivery_fee || 0,
        // Estimated sales tax (recomputed at /pay from customer's billing state)
        sales_tax_amount: taxQuote.taxAmount,
        billing_state: taxQuote.stateCode,
        // Network Referral Bounty tracking
        // Soft-locked installers (trial expired, active jobs in grace period)
        // don't earn new bounties — that's a paid-subscriber benefit.
        referring_installer_id: referringInstallerId,
        bounty_status: referringInstallerId && !referrerSoftLocked ? "pending" : "none",
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      console.error("[Quote] Lead create error:", JSON.stringify(leadError));
      const detail = leadError?.message || leadError?.code || "Unknown DB error";
      return { success: false, error: `Failed to create quote: ${detail}` };
    }

    // ── 4. Send Email ────────────────────────────────────────────────────
    // If handed off, the email comes FROM the covering installer, not the
    // originating installer.  The customer's experience is seamless — they
    // interact with the installer who will actually do the work.
    let emailSent = false;

    if (normalizedEmail) {
      const baseUrl = siteConfig.baseUrl;
      const checkoutUrl = `${baseUrl}/pay/${lead.id}`;

      const quoteItems = effectiveQuoteData.map((unit) => {
        let description = unit.desc || `${unit.cols}×${unit.rows} Storage Unit`;

        // Append addon summary if present
        const addons = unit.addons ?? [];
        if (addons.length > 0) {
          const addonCounts: Record<string, number> = {};
          for (const a of addons) {
            const label =
              a.type === "plywood_door" ? (a.target === "doors_on" ? "Plywood Doors (All Columns)" : "Plywood Door") :
              a.type === "side_panel" ? "Side Panel" :
              a.type === "hinge_concealed" ? "Blum Concealed Hinge" :
              a.type === "rail_removed" ? "Rail Removed" : a.type;
            addonCounts[label] = (addonCounts[label] ?? 0) + 1;
          }
          const parts = Object.entries(addonCounts).map(
            ([name, count]) => count > 1 ? `${count}× ${name}` : name
          );
          description += ` + ${parts.join(", ")}`;
        }

        return { description, price: unit.price };
      });

      const emailHtml = buildQuoteEmailTemplate({
        customerName: customer_name.trim(),
        businessName: effectiveBusinessName || "Your Installer",
        installerFirstName: effectiveFirstName || undefined,
        installerPhone: effectivePhone || undefined,
        quoteItems,
        totalPrice: finalTotal,
        depositAmount,
        checkoutUrl,
        cleanoutServices: cleanoutServices.length > 0 ? cleanoutServices : undefined,
        estimatedTax: taxQuote.stateCode && taxQuote.taxAmount > 0
          ? { amount: taxQuote.taxAmount, rate: taxQuote.taxRate, stateCode: taxQuote.stateCode }
          : null,
        deliveryFee: delivery_fee || 0,
        buildSnapshotUrl: build_snapshot_url || undefined,
      });

      const bizName = effectiveBusinessName || "Your Installer";
      const subjectTitle = project_title
        ? `Quote for ${customer_name.trim()} - ${project_title}`
        : `Your Custom Storage Quote from ${bizName}`;

      const emailResult = await sendTransactionalEmail({
        to: normalizedEmail,
        toName: customer_name.trim(),
        subject: subjectTitle,
        html: emailHtml,
        senderName: effectiveBusinessName || undefined,
        replyTo: effectiveEmail || undefined,
      });

      if (!emailResult.success) {
        console.error("[Quote] Email send failed:", emailResult.error);
      }
      emailSent = emailResult.success;
    }

    // ── 5. Notify referrer (fire-and-forget) ─────────────────────────────
    if (referringInstallerId) {
      (async () => {
        try {
          const { data: referrer } = await supabase
            .from("profiles")
            .select("email, business_name, first_name")
            .eq("id", referringInstallerId)
            .single();

          if (referrer?.email) {
            const estimatedBounty = Math.max(
              roundMoney(depositAmount * 0.30),
              15
            );

            await sendReferralHandoffEmail(referrer.email, {
              referrerName: referrer.business_name || referrer.first_name || "Installer",
              customerCity: delivery_address?.city || null,
              customerState: delivery_address?.state || null,
              customerZip: delivery_address?.zip || null,
              localInstallerName: coveringInstallerName || null,
              estimatedBounty,
            });
          }
        } catch (emailErr) {
          console.error("[Quote] Referral handoff email failed (non-fatal):", emailErr);
        }
      })();
    }

    return {
      success: true,
      lead_id: lead.id,
      customer_id: customerId,
      email_sent: emailSent,
      referral_status: referralStatus,
      covering_installer_name: coveringInstallerName,
    };
  } catch (err) {
    console.error("[Quote] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Re-price quote units using a different installer's pricing
// ═══════════════════════════════════════════════════════════════════════════

async function repriceQuoteUnits(
  units: QuoteUnit[],
  pricing?: InstallerPricing
): Promise<{ units: QuoteUnit[]; total: number }> {
  const repriced: QuoteUnit[] = [];

  for (const unit of units) {
    try {
      const result = await calculateBuild({
        cols: unit.cols,
        rows: unit.rows,
        toteModel: unit.toteType as "HDX" | "GM",
        toteColor: "black",
        unitType: "standard",
        orientation: "standard",
        addOns: {
          totes: unit.hasTotes,
          wheels: unit.hasWheels,
          top: unit.hasTop,
        },
        mode: "manual",
        installerPricing: pricing,
      });

      if (result.success) {
        repriced.push({
          ...unit,
          price: result.price,
          totalW: result.dimensions.totalW,
          totalH: result.dimensions.totalH,
        });
      } else {
        // Calculation failed — keep original price as fallback
        repriced.push(unit);
      }
    } catch {
      repriced.push(unit);
    }
  }

  const total = repriced.reduce((sum, u) => sum + u.price, 0);
  return { units: repriced, total };
}
