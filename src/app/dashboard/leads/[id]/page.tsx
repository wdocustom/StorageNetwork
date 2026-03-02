"use client";

import { useCallback, useEffect, useState } from "react";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { QuoteUnit } from "@/lib/buildEngine";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  AlertCircle,
} from "lucide-react";
import JobTicket from "@/components/dashboard/JobTicket";
import StatusBadge from "@/components/ui/StatusBadge";
import ProPill from "@/components/dashboard/ProPill";
import { startTripNotify } from "@/app/actions/sms";
import type { MaterialInventory } from "@/utils/inventoryManager";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface LeadDetail {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string | null;
  status: string;
  estimated_price: number | null;
  deposit_paid: boolean;
  deposit_amount: number | null;
  balance_due: number | null;
  payout_status: string | null;
  fee_status: string | null;
  photo_url: string | null;
  quote_data: QuoteUnit[] | null;
  created_at: string;
  scheduled_at: string | null;
  installer_id: string | null;
  address_line1: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_address_city: string | null;
  delivery_address_state: string | null;
  delivery_address_zip: string | null;
  source: string | null;
  en_route_notified: boolean;
  sales_tax_amount: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Job Ticket Page — Mobile-First Work Order
// ═══════════════════════════════════════════════════════════════════════════

export default function JobTicketPage() {
  const params = useParams();
  const leadId = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Installer Stripe account for payment routing
  const [installerStripeId, setInstallerStripeId] = useState<string | null>(null);
  const [installerInventory, setInstallerInventory] = useState<MaterialInventory | null>(null);

  // Deposit amount — computed server-side (black box)
  const [depositAmt, setDepositAmt] = useState(0);

  // Start Trip SMS state
  const [tripSending, setTripSending] = useState(false);
  const [tripSent, setTripSent] = useState(false);
  const [tripError, setTripError] = useState("");

  const fetchLead = useCallback(async () => {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Store the current URL for redirect after login
      const redirectUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?redirect=${redirectUrl}`;
      return;
    }

    // Fetch lead and verify it belongs to this installer
    const { data, error: err } = await supabase
      .from("leads")
      .select("id, customer_name, customer_email, customer_phone, address, status, estimated_price, deposit_paid, deposit_amount, balance_due, payout_status, fee_status, photo_url, quote_data, created_at, scheduled_at, installer_id, address_line1, address_city, address_state, address_zip, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip, source, en_route_notified, sales_tax_amount")
      .eq("id", leadId)
      .eq("installer_id", user.id)
      .single();

    if (err || !data) {
      setError("Lead not found or access denied.");
      setLoading(false);
      return;
    }

    const leadData = data as LeadDetail;
    setLead(leadData);
    setTripSent(!!leadData.en_route_notified);

    // Fetch installer's Stripe account ID and inventory
    if (leadData.installer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id, material_inventory")
        .eq("id", leadData.installer_id)
        .single();
      if (profile?.stripe_account_id) {
        setInstallerStripeId(profile.stripe_account_id);
      }
      if (profile?.material_inventory) {
        setInstallerInventory(profile.material_inventory as MaterialInventory);
      }
    }

    setLoading(false);
  }, [supabase, leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // Compute deposit from server (must be above early returns — rules of hooks)
  const totalPrice = lead?.estimated_price || 0;
  useEffect(() => {
    if (totalPrice > 0) {
      getDepositAmount(totalPrice).then(setDepositAmt);
    }
  }, [totalPrice]);

  async function handleStartTrip() {
    if (!lead?.installer_id || tripSent || tripSending) return;
    setTripSending(true);
    setTripError("");

    const result = await startTripNotify(lead.id, lead.installer_id);

    if (result.success) {
      setTripSent(true);
    } else {
      setTripError(result.error || "Failed to send notification.");
    }
    setTripSending(false);
  }

  // ── Loading / Error ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <p className="mb-4 text-lg font-bold text-red-400">{error}</p>
        <a
          href="/dashboard"
          className="text-sm text-yellow-400 underline hover:text-yellow-300"
        >
          Back to Jobs
        </a>
      </div>
    );
  }

  const balance = totalPrice - depositAmt;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard/leads"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-yellow-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Job Ticket
            </h1>
            <p className="text-[10px] text-stone-500">
              #{leadId.slice(0, 8)}
            </p>
          </div>
          <ProPill />
          <StatusBadge status={lead.status} depositPaid={lead.deposit_paid} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* ── Customer Info ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
            Customer
          </h2>
          <p className="text-lg font-bold text-white">{lead.customer_name}</p>
          {lead.customer_email && (
            <p className="text-sm text-stone-400">{lead.customer_email}</p>
          )}
          {lead.customer_phone && (
            <p className="text-sm text-stone-400">{lead.customer_phone}</p>
          )}
          {lead.address ? (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-yellow-400 hover:text-yellow-300"
            >
              <MapPin className="h-3 w-3" />
              {lead.address}
            </a>
          ) : lead.address_line1 ? (
            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              <p className="flex items-center gap-1 text-sm font-semibold text-white">
                <MapPin className="h-3 w-3 text-yellow-400" />
                {lead.address_line1}
              </p>
              <p className="text-xs text-stone-400">
                {[lead.address_city, lead.address_state, lead.address_zip].filter(Boolean).join(", ")}
              </p>
            </div>
          ) : null}

          {/* Delivery / Installation Address */}
          {lead.delivery_address_line1 && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Delivery / Installation Address
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  [lead.delivery_address_line1, lead.delivery_address_city, lead.delivery_address_state, lead.delivery_address_zip].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-semibold text-white hover:text-emerald-300"
              >
                <Navigation className="h-3 w-3 text-emerald-400" />
                {lead.delivery_address_line1}
                {lead.delivery_address_line2 ? `, ${lead.delivery_address_line2}` : ""}
              </a>
              <p className="text-xs text-stone-400">
                {[lead.delivery_address_city, lead.delivery_address_state, lead.delivery_address_zip].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          <p className="mt-2 text-xs text-stone-600">
            Submitted {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </section>

        {/* ── Start Trip & Notify Customer — temporarily disabled ──────
        {lead.deposit_paid &&
          lead.status === "open" &&
          lead.customer_phone && (
          <section className="overflow-hidden rounded-xl border border-yellow-400/20 bg-gradient-to-r from-yellow-400/5 to-slate-900">
            <div className="p-4">
              {tripSent ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">
                      Customer Notified
                    </p>
                    <p className="text-xs text-stone-500">
                      {lead.customer_name} received your en-route SMS.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleStartTrip}
                    disabled={tripSending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                  >
                    {tripSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                    {tripSending
                      ? "Sending Notification..."
                      : "Start Trip & Notify Customer"}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-stone-500">
                    Sends an SMS to {lead.customer_name} with your ETA, prep
                    instructions, and their remaining balance.
                  </p>
                </>
              )}

              {tripError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-xs font-medium text-red-400">
                    {tripError}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        ── End disabled SMS section ── */}

        {/* ── Financial Breakdown (Materials / Collect / Profit) ──────── */}
        <JobTicket
          leadId={lead.id}
          totalPrice={totalPrice}
          depositAmount={depositAmt}
          depositPaid={lead.deposit_paid}
          payoutStatus={lead.payout_status}
          status={lead.status}
          photoUrl={lead.photo_url}
          quoteData={lead.quote_data}
          customerEmail={lead.customer_email}
          customerName={lead.customer_name}
          customerPhone={lead.customer_phone}
          scheduledAt={lead.scheduled_at}
          installerStripeId={installerStripeId}
          source={lead.source}
          inventory={installerInventory}
          salesTaxAmount={lead.sales_tax_amount}
          onRefresh={fetchLead}
        />

        {/* ── Back Link ──────────────────────────────────────────────── */}
        <div className="pb-8 text-center">
          <a
            href="/dashboard/leads"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
