"use server";

import { createClient } from "@supabase/supabase-js";
import { sendAbandonedCartEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  source: string;
  created_at: string;
  status: string;
  discount_code: string | null;
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
    const { data: lead, error } = await supabase
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
        status,
        discount_code
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

    // Check if lead is too old (expire after 7 days)
    const createdAt = new Date(lead.created_at);
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      // Mark as expired
      await supabase
        .from("leads")
        .update({ status: "expired" })
        .eq("id", leadId);
      return { success: false, error: "This order has expired. Please create a new order." };
    }

    // Fetch installer details if assigned
    let installerName: string | null = null;
    let installerStripeId: string | null = null;

    if (lead.installer_id) {
      const { data: installer } = await supabase
        .from("profiles")
        .select("business_name, first_name, stripe_account_id")
        .eq("id", lead.installer_id)
        .single();

      if (installer) {
        installerName = installer.business_name || installer.first_name || null;
        installerStripeId = installer.stripe_account_id || null;
      }
    }

    return {
      success: true,
      lead: {
        ...lead,
        installer_name: installerName,
        installer_stripe_id: installerStripeId,
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
    // - created more than 30 minutes ago
    // - abandoned_email_sent is false or null
    // - created within last 7 days (not expired)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonedLeads, error } = await supabase
      .from("leads")
      .select(`
        id,
        customer_name,
        customer_email,
        estimated_price,
        deposit_amount,
        installer_id,
        created_at
      `)
      .eq("status", "pending_payment")
      .lt("created_at", thirtyMinutesAgo)
      .gt("created_at", sevenDaysAgo)
      .or("abandoned_email_sent.is.null,abandoned_email_sent.eq.false")
      .limit(50); // Process in batches

    if (error) {
      console.error("[Abandoned Cart] Query error:", error);
      return { processed: 0, sent: 0, errors: [error.message] };
    }

    if (!abandonedLeads || abandonedLeads.length === 0) {
      return { processed: 0, sent: 0, errors: [] };
    }

    for (const lead of abandonedLeads) {
      processed++;

      if (!lead.customer_email) {
        errors.push(`Lead ${lead.id}: No email address`);
        continue;
      }

      try {
        // Get installer name if assigned
        let installerName: string | null = null;
        if (lead.installer_id) {
          const { data: installer } = await supabase
            .from("profiles")
            .select("business_name, first_name")
            .eq("id", lead.installer_id)
            .single();
          installerName = installer?.business_name || installer?.first_name || null;
        }

        // Generate resume URL
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://storagenetwork.io";
        const resumeUrl = `${baseUrl}/pay/${lead.id}`;

        // Send the email
        await sendAbandonedCartEmail(lead.customer_email, {
          customerName: lead.customer_name,
          totalPrice: lead.estimated_price,
          depositAmount: lead.deposit_amount,
          resumeUrl,
          installerName,
        });

        // Mark as sent
        await supabase
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

    const { data, error } = await supabase
      .from("leads")
      .update({ status: "expired" })
      .eq("status", "pending_payment")
      .lt("created_at", sevenDaysAgo)
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
