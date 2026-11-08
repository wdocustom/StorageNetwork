"use server";

import { diyPlansEmailUrl } from "@/lib/emails/plansTemplates";
import { getServiceClient } from "@/lib/supabase-server";
import { sendAbandonedCartEmail } from "@/lib/email";
import { siteConfig } from "@/config/site";
import { currencyForInstaller } from "@/lib/server/currency-lookup";
import { bookedCustomerEmails, ilikeLiteral } from "@/lib/server/lead-dedupe";

const db = getServiceClient;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PendingLeadDetails {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address: string | null;
  quote_data: unknown[];
  estimated_price: number;
  deposit_amount: number;
  installer_id: string | null;
  installer_name: string | null;
  installer_stripe_id: string | null;
  /** Currency the installer charges in ("usd" | "cad") — see @/lib/geo/currency. */
  currency: string;
  source: string;
  created_at: string;
  status: string;
  discount_code: string | null;
  delivery_fee: number;
  /** Estimated sales tax saved at quote creation (recomputed at checkout if billing state differs) */
  sales_tax_amount: number;
  /** State code derived from quote ZIP at creation time (overridden at checkout) */
  billing_state: string | null;
  /** Installer's available services (for cleanout upsell on pay page) */
  installer_services?: Array<{ id: string; name: string; description: string; price: number }>;
}

export interface FetchPendingLeadResult {
  success: boolean;
  lead?: PendingLeadDetails;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fetch a pending payment lead for resume checkout
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchPendingLead(leadId: string): Promise<FetchPendingLeadResult> {
  if (!leadId) {
    return { success: false, error: "No lead ID provided." };
  }

  try {
    // Fetch the lead
    const { data: lead, error } = await db()
      .from("leads")
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        address,
        quote_data,
        estimated_price,
        deposit_amount,
        installer_id,
        source,
        created_at,
        updated_at,
        status,
        discount_code,
        delivery_fee,
        sales_tax_amount,
        billing_state
      `)
      .eq("id", leadId)
      .single();

    if (error || !lead) {
      console.error("[Abandoned Cart] Lead not found:", error);
      return { success: false, error: "Order not found." };
    }

    // Only allow resuming pending_payment leads
    if (lead.status !== "pending_payment") {
      if (lead.status === "open" || lead.status === "completed" || lead.status === "paid") {
        return { success: false, error: "This order has already been paid." };
      }
      if (lead.status === "cancelled" || lead.status === "archived") {
        return { success: false, error: "This order is no longer available." };
      }
      return { success: false, error: "This order cannot be resumed." };
    }

    // Check if lead is too old (expire after 7 days of no activity).
    // Editing a quote bumps updated_at, so a reactivated quote (installer
    // edited an expired one) gets a fresh 7-day window instead of
    // immediately re-expiring off its original created_at.
    const lastActivity = new Date(lead.updated_at || lead.created_at);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7) {
      // Mark as expired
      await db()
        .from("leads")
        .update({ status: "expired" })
        .eq("id", leadId);
      return { success: false, error: "This order has expired. Please create a new order." };
    }

    // Fetch installer details if assigned
    let installerName: string | null = null;
    let installerStripeId: string | null = null;
    let currency = "usd";
    let installerServices: Array<{ id: string; name: string; description: string; price: number }> = [];

    if (lead.installer_id) {
      const { data: installer } = await db()
        .from("profiles")
        .select("business_name, first_name, stripe_account_id, services_config, currency")
        .eq("id", lead.installer_id)
        .single();

      if (installer) {
        installerName = installer.business_name || installer.first_name || null;
        installerStripeId = installer.stripe_account_id || null;
        currency = (installer.currency as string | null) || "usd";
        // Extract enabled cleanout services for upsell
        if (installer.services_config && Array.isArray(installer.services_config)) {
          installerServices = (installer.services_config as Array<{ id: string; name: string; description: string; price: number | null; enabled: boolean }>)
            .filter((s) => s.enabled && s.price && s.price > 0 && s.id.startsWith("cleanout_"))
            .map((s) => ({ id: s.id, name: s.name, description: s.description, price: s.price! }));
        }
      }
    }

    return {
      success: true,
      lead: {
        ...lead,
        installer_name: installerName,
        installer_stripe_id: installerStripeId,
        currency,
        installer_services: installerServices.length > 0 ? installerServices : undefined,
      } as PendingLeadDetails,
    };
  } catch (err) {
    console.error("[Abandoned Cart] Error fetching lead:", err);
    return { success: false, error: "Failed to load order details." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Send abandoned cart recovery emails
// Called by cron job or edge function
// ═══════════════════════════════════════════════════════════════════════════

export async function processAbandonedCarts(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;

  try {
    // Find leads that are:
    // - status = pending_payment
    // - created more than 18 hours ago (give customers time to pay)
    // - abandoned_email_sent is false or null
    // - created within last 7 days (not expired)
    const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonedLeads, error } = await db()
      .from("leads")
      .select(`
        id,
        customer_name,
        customer_email,
        estimated_price,
        deposit_amount,
        installer_id,
        created_at,
        quote_data
      `)
      .eq("status", "pending_payment")
      .lt("created_at", eighteenHoursAgo)
      .gt("created_at", sevenDaysAgo)
      .or("abandoned_email_sent.is.null,abandoned_email_sent.eq.false")
      .order("created_at", { ascending: false }) // newest first — it's the one we email
      .limit(50); // Process in batches

    if (error) {
      console.error("[Abandoned Cart] Query error:", error);
      return { processed: 0, sent: 0, errors: [error.message] };
    }

    if (!abandonedLeads || abandonedLeads.length === 0) {
      return { processed: 0, sent: 0, errors: [] };
    }

    // ── One reminder per customer per installer ─────────────────────────
    // A customer who resubmitted (or got two quotes) has several pending
    // leads. Email them once, about their newest build, and mark every copy
    // handled. And never nag someone who already booked with this installer
    // on another lead, or who got this reminder in the past week.
    const markHandled = async (ids: string[]) => {
      if (ids.length === 0) return;
      await db().from("leads").update({ abandoned_email_sent: true }).in("id", ids);
    };
    const groups = new Map<string, typeof abandonedLeads>();
    for (const lead of abandonedLeads) {
      if (!lead.customer_email) continue;
      const key = `${lead.customer_email.trim().toLowerCase()}|${lead.installer_id ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), lead]);
    }
    const toEmail = new Set<string>(); // lead ids that actually get the email
    for (const group of groups.values()) {
      const [newest, ...older] = group; // ordered newest first
      const email = newest.customer_email!.trim().toLowerCase();
      let suppress: string | null = null;
      if (newest.installer_id) {
        const booked = await bookedCustomerEmails(db(), newest.installer_id, [email]);
        if (booked.has(email)) suppress = "already booked with this installer";
      }
      if (!suppress) {
        let recent = db()
          .from("leads")
          .select("id")
          .ilike("customer_email", ilikeLiteral(email))
          .eq("abandoned_email_sent", true)
          .gt("created_at", sevenDaysAgo)
          .limit(1);
        recent = newest.installer_id ? recent.eq("installer_id", newest.installer_id) : recent.is("installer_id", null);
        const { data: alreadyNudged } = await recent;
        if (alreadyNudged && alreadyNudged.length > 0) suppress = "reminder already sent this week";
      }
      if (suppress) {
        console.log(`[Abandoned Cart] Skipping ${group.length} lead(s) for one customer — ${suppress}`);
        await markHandled(group.map((l) => l.id));
        continue;
      }
      // Older duplicates are covered by the one email about the newest build.
      await markHandled(older.map((l) => l.id));
      toEmail.add(newest.id);
    }

    for (const lead of abandonedLeads) {
      processed++;

      if (!lead.customer_email) {
        errors.push(`Lead ${lead.id}: No email address`);
        continue;
      }
      if (!toEmail.has(lead.id)) continue; // duplicate / already booked — handled above

      try {
        // Get installer name if assigned — skip if installer is suspended
        let installerName: string | null = null;
        if (lead.installer_id) {
          const { data: installer } = await db()
            .from("profiles")
            .select("business_name, first_name, is_suspended")
            .eq("id", lead.installer_id)
            .single();
          if (installer?.is_suspended) continue;
          installerName = installer?.business_name || installer?.first_name || null;
        }

        // Generate resume URL (uses same domain resolution as rest of app)
        const resumeUrl = `${siteConfig.baseUrl}/pay/${lead.id}`;

        // Send the email
        await sendAbandonedCartEmail(lead.customer_email, {
          customerName: lead.customer_name,
          totalPrice: lead.estimated_price,
          depositAmount: lead.deposit_amount,
          resumeUrl,
          installerName,
          diyPlansUrl: diyPlansEmailUrl(lead.quote_data, "abandoned_cart_email"),
        }, await currencyForInstaller(lead.installer_id));

        // Mark as sent
        await db()
          .from("leads")
          .update({ abandoned_email_sent: true })
          .eq("id", lead.id);

        sent++;
        console.log(`[Abandoned Cart] Email sent for lead ${lead.id}`);
      } catch (emailError) {
        const errMsg = emailError instanceof Error ? emailError.message : String(emailError);
        errors.push(`Lead ${lead.id}: ${errMsg}`);
        console.error(`[Abandoned Cart] Failed to send email for lead ${lead.id}:`, emailError);
      }
    }

    return { processed, sent, errors };
  } catch (err) {
    console.error("[Abandoned Cart] Processing error:", err);
    return { processed, sent, errors: [String(err)] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup expired leads (optional - can be called periodically)
// ═══════════════════════════════════════════════════════════════════════════

export async function cleanupExpiredLeads(): Promise<{ updated: number }> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Base expiry on updated_at (last activity), not created_at — otherwise
    // a quote an installer just edited/reactivated gets re-expired on the
    // very next cron run because its original created_at is still old.
    const { data, error } = await db()
      .from("leads")
      .update({ status: "expired" })
      .eq("status", "pending_payment")
      .lt("updated_at", sevenDaysAgo)
      .select("id");

    if (error) {
      console.error("[Cleanup] Error expiring leads:", error);
      return { updated: 0 };
    }

    return { updated: data?.length || 0 };
  } catch (err) {
    console.error("[Cleanup] Error:", err);
    return { updated: 0 };
  }
}
