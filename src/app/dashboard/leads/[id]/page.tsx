"use client";

import { useCallback, useEffect, useState } from "react";
import { getDepositAmount } from "@/app/actions/fee-engine";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { QuoteUnit } from "@/lib/buildEngine.types";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  AlertCircle,
  Pencil,
  Phone,
  X,
} from "lucide-react";
import JobTicket from "@/components/dashboard/JobTicket";
import StatusBadge from "@/components/ui/StatusBadge";
import ProPill from "@/components/dashboard/ProPill";
import { startTripNotify } from "@/app/actions/sms";
import { updateCustomerContact } from "@/app/actions/jobs";
import { maskName, maskEmail, maskPhone } from "@/lib/mask";
import type { MaterialInventory } from "@/utils/inventoryManager";
import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
import type { MaterialPrices } from "@/utils/calculateMaterials";

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
  time_preference: string | null;
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
  review_token: string | null;
  review_submitted: boolean;
  discount_code: string | null;
  discount_amount: number | null;
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
  const [installerMaterialPrices, setInstallerMaterialPrices] = useState<MaterialPrices | undefined>(undefined);

  // Deposit amount — computed server-side (black box)
  const [depositAmt, setDepositAmt] = useState(0);

  // Start Trip SMS state
  const [tripSending, setTripSending] = useState(false);
  const [tripSent, setTripSent] = useState(false);
  const [tripError, setTripError] = useState("");

  // Customer contact editing popup
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [contactSaving, setContactSaving] = useState(false);

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
      .select("id, customer_name, customer_email, customer_phone, address, status, estimated_price, deposit_paid, deposit_amount, balance_due, payout_status, fee_status, photo_url, quote_data, created_at, scheduled_at, time_preference, installer_id, address_line1, address_city, address_state, address_zip, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip, source, en_route_notified, sales_tax_amount, review_token, review_submitted, discount_code, discount_amount")
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
        .select("stripe_account_id, material_inventory, material_pricing_config")
        .eq("id", leadData.installer_id)
        .single();
      if (profile?.stripe_account_id) {
        setInstallerStripeId(profile.stripe_account_id);
      }
      if (profile?.material_inventory) {
        setInstallerInventory(profile.material_inventory as MaterialInventory);
      }
      if (profile?.material_pricing_config) {
        const mpc = profile.material_pricing_config as MaterialPricingConfig;
        const p: Record<string, number> = {};
        if (mpc.lumber_2x4_8ft !== undefined) p.lumber_2x4_8ft = mpc.lumber_2x4_8ft;
        if (mpc.plywood_sheet !== undefined) p.plywood_sheet = mpc.plywood_sheet;
        if (mpc.tote !== undefined) p.tote = mpc.tote;
        if (mpc.wheels_4pk !== undefined) p.wheels_4pk = mpc.wheels_4pk;
        if (mpc.screw_1in) p.screw_1in_90ct = mpc.screw_1in.price / mpc.screw_1in.count * 90;
        if (mpc.screw_1_5_8in) p.screw_1_5_8in_158ct = mpc.screw_1_5_8in.price / mpc.screw_1_5_8in.count * 158;
        if (mpc.screw_3in) p.screw_3in_137ct = mpc.screw_3in.price / mpc.screw_3in.count * 137;
        if (Object.keys(p).length > 0) setInstallerMaterialPrices(p as MaterialPrices);
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
    // Use the actual deposit stored on the lead (reflects custom installer rates
    // and actual Stripe charge). Only fall back to computed deposit if missing.
    if (lead?.deposit_amount && lead.deposit_amount > 0) {
      setDepositAmt(lead.deposit_amount);
    } else if (totalPrice > 0 && lead?.installer_id) {
      getDepositAmount(totalPrice, lead.installer_id).then(setDepositAmt);
    } else if (totalPrice > 0) {
      getDepositAmount(totalPrice).then(setDepositAmt);
    }
  }, [totalPrice, lead?.deposit_amount, lead?.installer_id]);

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

  function openContactEdit() {
    // Block editing for waitlisted leads — contact details are masked
    if (lead?.status === "waitlisted") return;
    setEditEmail(lead?.customer_email || "");
    setEditPhone(lead?.customer_phone || "");
    setShowContactEdit(true);
  }

  async function handleSaveContact() {
    setContactSaving(true);
    const result = await updateCustomerContact(leadId, {
      email: editEmail || null,
      phone: editPhone || null,
    });
    setContactSaving(false);
    if (result.success) {
      setShowContactEdit(false);
      fetchLead(); // refresh data
    }
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
        {/* ── Customer Info ────────────────────────────────────────── */}
        {lead.status === "waitlisted" ? (
          /* Waitlisted lead — mask contact details, show upgrade CTA */
          <section className="rounded-xl border border-amber-500/30 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Waitlisted Customer
              </h2>
            </div>
            <p className="text-lg font-bold text-white">{maskName(lead.customer_name)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <Mail className="h-3 w-3 text-stone-600" />
              {lead.customer_email ? maskEmail(lead.customer_email) : "Hidden"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <Phone className="h-3 w-3 text-stone-600" />
              {lead.customer_phone ? maskPhone(lead.customer_phone) : "Hidden"}
            </p>

            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <p className="mb-2 text-xs font-semibold text-amber-300">
                Subscribe to Pro to unlock this customer&apos;s full details and accept the job.
              </p>
              <a
                href="/upgrade"
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
              >
                Subscribe &amp; Unlock
              </a>
            </div>

            <p className="mt-3 text-xs text-stone-600">
              Submitted {new Date(lead.created_at).toLocaleDateString()}
            </p>
          </section>
        ) : (
          /* Normal lead — full contact info, editable */
          <section
            onClick={openContactEdit}
            className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-yellow-400/40"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Customer
              </h2>
              <Pencil className="h-3.5 w-3.5 text-stone-600" />
            </div>
            <p className="text-lg font-bold text-white">{lead.customer_name}</p>
            {lead.customer_email ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-400">
                <Mail className="h-3 w-3 text-stone-500" />
                {lead.customer_email}
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600 italic">
                <Mail className="h-3 w-3" />
                No email — tap to add
              </p>
            )}
            {lead.customer_phone ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-400">
                <Phone className="h-3 w-3 text-stone-500" />
                {lead.customer_phone}
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600 italic">
                <Phone className="h-3 w-3" />
                No phone — tap to add
              </p>
            )}
            {lead.address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
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
        )}

        {/* ── Customer Contact Edit Modal ─────────────────────────────── */}
        {showContactEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Edit Contact Info
                </h3>
                <button
                  onClick={() => setShowContactEdit(false)}
                  className="rounded-lg p-1 text-stone-500 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-4 text-sm font-semibold text-stone-300">
                {lead.customer_name}
              </p>

              {/* Email */}
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-500">
                Email
              </label>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
                <Mail className="h-4 w-4 shrink-0 text-stone-500" />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full bg-transparent text-sm text-white placeholder-stone-600 outline-none"
                />
              </div>

              {/* Phone */}
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-500">
                Phone
              </label>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
                <Phone className="h-4 w-4 shrink-0 text-stone-500" />
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-transparent text-sm text-white placeholder-stone-600 outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowContactEdit(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-stone-400 transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveContact}
                  disabled={contactSaving}
                  className="flex-1 rounded-lg bg-yellow-400 py-2.5 text-xs font-black uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
                >
                  {contactSaving ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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
          customerEmail={lead.status === "waitlisted" ? null : lead.customer_email}
          customerName={lead.status === "waitlisted" ? maskName(lead.customer_name) : lead.customer_name}
          customerPhone={lead.status === "waitlisted" ? null : lead.customer_phone}
          scheduledAt={lead.scheduled_at}
          timePreference={lead.time_preference}
          installerStripeId={installerStripeId}
          source={lead.source}
          inventory={installerInventory}
          customMaterialPrices={installerMaterialPrices}
          salesTaxAmount={lead.sales_tax_amount}
          addressState={lead.delivery_address_state || lead.address_state}
          installerId={lead.installer_id}
          reviewToken={lead.review_token}
          reviewSubmitted={lead.review_submitted}
          savedDiscountCode={lead.discount_code}
          savedDiscountAmount={lead.discount_amount}
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
