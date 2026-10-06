"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Quote Requests — returning customers asking for a new quote
//
// Customer side (PUBLIC, signed link — see @/lib/server/request-link):
//   getQuoteRequestPage → submitQuoteRequest
// Installer side (AUTH):
//   listQuoteRequests / dismissQuoteRequest (Jobs / Leads → Requests tab)
//   getQuoteRequestForBuild / markQuoteRequestQuoted (build page)
//
// The installer builds the quote in the normal create-quote flow, prefilled
// from the customer's earlier job (/dashboard/build?from=…&request=…).
// Always on — no installer opt-out (returning-customer revenue).
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth";
import { resolveMarketingAttribution } from "@/lib/marketing-attribution";
import { verifyRequestToken, REQUEST_ORIGINS, type RequestOrigin } from "@/lib/server/request-link";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { escapeHtml } from "@/utils/escapeHtml";
import { getAppUrl } from "@/lib/url-helper";
import { requestOptionsFor, requestWantLabel, type RequestOption } from "@/lib/request-options";
import type { InstallerPricing } from "@/types/viewModels";
import type { ServiceOffering } from "@/config/services";

const db = () => getServiceClient();

const MAX_NOTES = 2000;
// One open request per earlier job per day is plenty; repeats within the
// window are folded in rather than emailing the installer again.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function installerDisplay(installerId: string) {
  const { data } = await db()
    .from("profiles")
    .select("business_name, first_name, last_name, avatar_url, email, pricing_config, services_config")
    .eq("id", installerId)
    .maybeSingle();
  const pricing = (data?.pricing_config as InstallerPricing | null) ?? null;
  const services = (data?.services_config as ServiceOffering[] | null) ?? null;
  return {
    // Only what this installer has enabled — see @/lib/request-options.
    options: requestOptionsFor(pricing, services),
    services,
    name:
      (data?.business_name as string) ||
      [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
      "Your Installer",
    avatar: (data?.avatar_url as string) || null,
    email: (data?.email as string) || null,
  };
}

// ── Customer: request page data (PUBLIC) ─────────────────────────────────

export interface QuoteRequestPageData {
  installerName: string;
  installerAvatar: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  /** What this installer offers — the only choices shown. */
  options: RequestOption[];
}

export async function getQuoteRequestPage(
  token: string
): Promise<{ data?: QuoteRequestPageData; error?: string }> {
  const leadId = verifyRequestToken(token);
  if (!leadId) return { error: "This link isn't valid." };

  const { data: lead } = await db()
    .from("leads")
    .select("installer_id, customer_name, customer_email, customer_phone, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.installer_id || lead.status === "waitlisted") return { error: "This link isn't valid." };

  const installer = await installerDisplay(lead.installer_id);
  return {
    data: {
      installerName: installer.name,
      installerAvatar: installer.avatar,
      customerName: lead.customer_name || "",
      customerEmail: lead.customer_email,
      customerPhone: lead.customer_phone,
      options: installer.options,
    },
  };
}

// ── Customer: submit a request (PUBLIC) ──────────────────────────────────

export interface SubmitQuoteRequestInput {
  token: string;
  origin?: string;
  name: string;
  email?: string;
  phone?: string;
  wants: string[];
  notes?: string;
}

export async function submitQuoteRequest(
  input: SubmitQuoteRequestInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await enforceActionRateLimit({ action: "quoteRequest", limit: 5, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const leadId = verifyRequestToken(input.token);
  if (!leadId) return { success: false, error: "This link isn't valid." };

  const name = input.name?.trim().slice(0, 200) || "";
  const email = input.email?.trim().toLowerCase().slice(0, 200) || null;
  const phone = input.phone?.trim().slice(0, 40) || null;
  const notes = input.notes?.trim().slice(0, MAX_NOTES) || null;
  const origin: RequestOrigin = REQUEST_ORIGINS.includes(input.origin as RequestOrigin)
    ? (input.origin as RequestOrigin)
    : "other";

  if (!name) return { success: false, error: "Please enter your name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "That email address doesn't look right." };
  }
  if (!email && !phone) return { success: false, error: "Please leave an email or phone number." };

  const { data: lead } = await db()
    .from("leads")
    .select("installer_id, customer_id, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.installer_id || lead.status === "waitlisted") {
    return { success: false, error: "This link isn't valid." };
  }

  // Keep only choices this installer offers (a stale page can't sneak in a
  // product they've since switched off).
  const installer = await installerDisplay(lead.installer_id);
  const allowed = new Set(installer.options.map((o) => o.value));
  const wants = Array.from(new Set((input.wants || []).filter((w) => allowed.has(w))));
  if (wants.length === 0 && !notes) {
    return { success: false, error: "Tell us what you're looking for." };
  }

  // Fold a repeat submission into the open request from the last day instead
  // of stacking duplicates (and emailing the installer again).
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent } = await db()
    .from("quote_requests")
    .select("id, notes, wants")
    .eq("source_lead_id", leadId)
    .eq("status", "open")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const mergedWants = Array.from(new Set([...(recent.wants as string[]), ...wants]));
    const mergedNotes = [recent.notes, notes].filter(Boolean).join("\n\n").slice(0, MAX_NOTES) || null;
    await db()
      .from("quote_requests")
      .update({
        wants: mergedWants,
        notes: mergedNotes,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recent.id);
    return { success: true };
  }

  const { data: row, error } = await db()
    .from("quote_requests")
    .insert({
      installer_id: lead.installer_id,
      source_lead_id: leadId,
      customer_id: lead.customer_id,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      wants,
      notes,
      origin,
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("[QuoteRequest] insert failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  await notifyInstaller({
    installer,
    installerId: lead.installer_id,
    requestId: row.id,
    sourceLeadId: leadId,
    name,
    email,
    phone,
    wants,
    notes,
  }).catch((err) => console.error("[QuoteRequest] installer email failed:", err));

  return { success: true };
}

async function notifyInstaller(p: {
  installer: Awaited<ReturnType<typeof installerDisplay>>;
  installerId: string;
  requestId: string;
  sourceLeadId: string;
  name: string;
  email: string | null;
  phone: string | null;
  wants: string[];
  notes: string | null;
  /** Came from a platform marketing email → billed as a network lead. */
  fromCampaign?: boolean;
}) {
  const installer = p.installer;
  let to = installer.email;
  if (!to) {
    const { data } = await db().auth.admin.getUserById(p.installerId);
    to = data?.user?.email || null;
  }
  if (!to) return;

  const base = getAppUrl();
  const buildUrl = `${base}/dashboard/build?from=${p.sourceLeadId}&request=${p.requestId}`;
  const requestsUrl = `${base}/dashboard/leads?tab=requests`;
  const safeName = escapeHtml(p.name);
  const wantsHtml = p.wants.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;color:#e2e8f0;font-size:14px;">${p.wants
        .map((w) => `<li style="margin:0 0 4px;">${escapeHtml(requestWantLabel(w, installer.services))}</li>`)
        .join("")}</ul>`
    : "";
  const notesHtml = p.notes
    ? `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin:0 0 16px;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(p.notes)}</div>`
    : "";
  const contact = [p.email && escapeHtml(p.email), p.phone && escapeHtml(p.phone)].filter(Boolean).join(" · ");

  const { sendTransactionalEmail, emailShell } = await import("@/lib/email");
  const html = emailShell(
    "New Quote Request",
    `
    <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">
      <strong style="color:#facc15;">${safeName}</strong>, a past customer of yours, wants a new quote.
    </p>
    ${wantsHtml}
    ${notesHtml}
    <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;">${contact}</p>
    ${
      p.fromCampaign
        ? `<p style="margin:0 0 24px;padding:12px 14px;background:#1e293b;border-left:3px solid #facc15;border-radius:8px;color:#e2e8f0;font-size:13px;line-height:1.6;">
            This customer came back through a <strong>Storage Network email</strong>, so this is a
            <strong>network lead (15% platform fee)</strong>. Build the quote from the button below
            so it&rsquo;s billed correctly.
          </p>`
        : ""
    }
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${buildUrl}" style="display:inline-block;background:#facc15;color:#0f172a;padding:14px 40px;border-radius:12px;font-weight:900;text-decoration:none;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Build Their Quote &rarr;
      </a>
    </div>
    <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
      Their details are filled in for you. Or see it in
      <a href="${requestsUrl}" style="color:#facc15;">Jobs / Leads &rarr; Requests</a>.
    </p>
    `
  );

  await sendTransactionalEmail({
    to,
    toName: installer.name,
    subject: `${p.name} wants a new quote`,
    html,
  });
}

// ── Installer: list / dismiss (AUTH) ─────────────────────────────────────

export interface QuoteRequestItem {
  id: string;
  sourceLeadId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  wants: string[];
  wantLabels: string[];
  notes: string | null;
  origin: string;
  /** Prompted by a platform marketing email (billed as a network lead). */
  fromCampaign: boolean;
  createdAt: string;
}

function toItem(r: Record<string, unknown>, services: ServiceOffering[] | null): QuoteRequestItem {
  const wants = (r.wants as string[]) || [];
  return {
    id: r.id as string,
    sourceLeadId: (r.source_lead_id as string | null) ?? null,
    customerName: r.customer_name as string,
    customerEmail: (r.customer_email as string | null) ?? null,
    customerPhone: (r.customer_phone as string | null) ?? null,
    wants,
    wantLabels: wants.map((w) => requestWantLabel(w, services)),
    notes: (r.notes as string | null) ?? null,
    origin: r.origin as string,
    fromCampaign: !!r.marketing_send_id,
    createdAt: r.created_at as string,
  };
}

const REQUEST_COLUMNS =
  "id, source_lead_id, customer_name, customer_email, customer_phone, wants, notes, origin, marketing_send_id, created_at";

export async function listQuoteRequests(): Promise<{ success: boolean; requests?: QuoteRequestItem[]; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const { data, error } = await db()
    .from("quote_requests")
    .select(REQUEST_COLUMNS)
    .eq("installer_id", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) {
    // Table missing (migration 140 not applied) → just no requests.
    console.warn("[QuoteRequest] list failed:", error.message);
    return { success: true, requests: [] };
  }
  const services = (await installerDisplay(user.id)).services;
  return { success: true, requests: (data ?? []).map((r) => toItem(r, services)) };
}

/** Installer declines a request — hidden from the Requests tab. */
export async function dismissQuoteRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const { data, error } = await db()
    .from("quote_requests")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("installer_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { success: false, error: "Request not found." };
  return { success: true };
}

// ── Installer: build page (AUTH) ─────────────────────────────────────────

export async function getQuoteRequestForBuild(
  requestId: string
): Promise<{ success: boolean; request?: QuoteRequestItem; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const { data } = await db()
    .from("quote_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq("installer_id", user.id)
    .maybeSingle();
  if (!data) return { success: false, error: "Request not found." };
  return { success: true, request: toItem(data, (await installerDisplay(user.id)).services) };
}

/** The installer sent a quote for this request — take it off the list. */
export async function markQuoteRequestQuoted(
  requestId: string,
  quotedLeadId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const { data: lead } = await db()
    .from("leads")
    .select("installer_id")
    .eq("id", quotedLeadId)
    .maybeSingle();
  if (lead?.installer_id !== user.id) return { success: false, error: "Quote not found." };

  const { error } = await db()
    .from("quote_requests")
    .update({ status: "quoted", quoted_lead_id: quotedLeadId, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("installer_id", user.id)
    .eq("status", "open");
  if (error) return { success: false, error: "Failed to update request." };
  return { success: true };
}

// ── Customer: request from a campaign email's /book page (token-gated) ───
// A returning customer can't re-order a custom build online, so they ask the
// installer. The request carries the campaign send id; createQuote then bills
// the resulting quote as a network lead (platform_campaign, 15%).

export async function submitCampaignQuoteRequest(input: {
  token: string;
  installerId: string;
  name: string;
  email?: string;
  phone?: string;
  notes: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await enforceActionRateLimit({ action: "campaignQuoteRequest", limit: 5, window: "1 h", identify: "ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { success: false, error: err.message };
    throw err;
  }

  const attribution = await resolveMarketingAttribution(db(), input.token, input.installerId);
  if (!attribution) return { success: false, error: "This link has expired. Please contact your installer directly." };

  const name = input.name?.trim().slice(0, 200) || "";
  const email = input.email?.trim().toLowerCase().slice(0, 200) || null;
  const phone = input.phone?.trim().slice(0, 40) || null;
  const notes = input.notes?.trim().slice(0, MAX_NOTES) || "";
  if (!name) return { success: false, error: "Please enter your name." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "That email address doesn't look right." };
  }
  if (!email && !phone) return { success: false, error: "Please leave an email or phone number." };
  if (!notes) return { success: false, error: "Tell us what you're looking for." };

  const { data: send } = await db()
    .from("marketing_email_sends")
    .select("installer_id, source_lead_id")
    .eq("id", attribution.sendId)
    .maybeSingle();
  if (!send) return { success: false, error: "This link has expired." };

  const { data: sourceLead } = send.source_lead_id
    ? await db().from("leads").select("customer_id").eq("id", send.source_lead_id).maybeSingle()
    : { data: null };

  // Fold a repeat submission from the last day into the open request.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent } = await db()
    .from("quote_requests")
    .select("id, notes")
    .eq("marketing_send_id", attribution.sendId)
    .eq("status", "open")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (recent) {
    await db()
      .from("quote_requests")
      .update({
        notes: [recent.notes, notes].filter(Boolean).join("\n\n").slice(0, MAX_NOTES),
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recent.id);
    return { success: true };
  }

  const { data: row, error } = await db()
    .from("quote_requests")
    .insert({
      installer_id: send.installer_id,
      source_lead_id: send.source_lead_id,
      customer_id: sourceLead?.customer_id ?? null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      wants: [],
      notes,
      origin: "campaign",
      marketing_send_id: attribution.sendId,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[QuoteRequest] campaign insert failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  const installer = await installerDisplay(send.installer_id as string);
  await notifyInstaller({
    installer,
    installerId: send.installer_id as string,
    requestId: row.id,
    sourceLeadId: (send.source_lead_id as string) || "",
    name,
    email,
    phone,
    wants: [],
    notes,
    fromCampaign: true,
  }).catch((err) => console.error("[QuoteRequest] installer email failed:", err));

  return { success: true };
}
