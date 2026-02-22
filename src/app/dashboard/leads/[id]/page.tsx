"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { generateBuildManifest } from "@/lib/buildEngine";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine";
import { toFraction } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Ruler,
  Wrench,
  Navigation,
  AlertCircle,
} from "lucide-react";
import JobTicket from "@/components/dashboard/JobTicket";
import StatusBadge from "@/components/ui/StatusBadge";
import { startTripNotify } from "@/app/actions/sms";

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
}

// ═══════════════════════════════════════════════════════════════════════════
// Job Ticket Page — Mobile-First Work Order
// ═══════════════════════════════════════════════════════════════════════════

export default function JobTicketPage() {
  const params = useParams();
  const leadId = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [manifest, setManifest] = useState<BuildManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Installer Stripe account for payment routing
  const [installerStripeId, setInstallerStripeId] = useState<string | null>(null);
  const [installerIsPro, setInstallerIsPro] = useState<boolean>(false);

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
      .select("id, customer_name, customer_email, customer_phone, address, status, estimated_price, deposit_paid, deposit_amount, balance_due, payout_status, fee_status, photo_url, quote_data, created_at, scheduled_at, installer_id, address_line1, address_city, address_state, address_zip, delivery_address_line1, delivery_address_line2, delivery_address_city, delivery_address_state, delivery_address_zip, source, en_route_notified")
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

    // Generate build manifest from quote data
    if (leadData.quote_data && leadData.quote_data.length > 0) {
      const m = generateBuildManifest(leadData.quote_data);
      setManifest(m);
    }

    // Fetch installer's Stripe account ID and Pro status
    if (leadData.installer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id, is_pro")
        .eq("id", leadData.installer_id)
        .single();
      if (profile?.stripe_account_id) {
        setInstallerStripeId(profile.stripe_account_id);
      }
      if (profile?.is_pro) {
        setInstallerIsPro(profile.is_pro);
      }
    }

    setLoading(false);
  }, [supabase, leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

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

  const totalPrice = lead.estimated_price || 0;
  const depositAmt = manifest
    ? manifest.financials.depositAmount
    : totalPrice * 0.15;
  const balance = manifest
    ? manifest.financials.balanceDue
    : totalPrice - depositAmt;

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
          {/* Delivery / Installation Address */}
          {lead.delivery_address_line1 && (
            <div className="mt-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 px-3 py-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Delivery / Installation Address
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(
                  [lead.delivery_address_line1, lead.delivery_address_city, lead.delivery_address_state, lead.delivery_address_zip].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-semibold text-white hover:text-yellow-400"
              >
                <MapPin className="h-3 w-3 text-emerald-400" />
                {lead.delivery_address_line1}
                {lead.delivery_address_line2 ? `, ${lead.delivery_address_line2}` : ""}
              </a>
              <p className="ml-4 text-xs text-stone-400">
                {[lead.delivery_address_city, lead.delivery_address_state, lead.delivery_address_zip].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          {/* Billing Address (from payment) */}
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
          <p className="mt-2 text-xs text-stone-600">
            Submitted {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </section>

        {/* ── Start Trip & Notify Customer — temporarily disabled ──────
        {lead.deposit_paid &&
          lead.status === "open" &&
          lead.customer_phone &&
          installerIsPro && (
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
          feeStatus={(lead.fee_status as "standard" | "waived") || "standard"}
          photoUrl={lead.photo_url}
          quoteData={lead.quote_data}
          customerEmail={lead.customer_email}
          customerName={lead.customer_name}
          customerPhone={lead.customer_phone}
          scheduledAt={lead.scheduled_at}
          installerStripeId={installerStripeId}
          source={lead.source}
          isPro={installerIsPro}
          onRefresh={fetchLead}
        />

        {/* ── Unit Summary ───────────────────────────────────────────── */}
        {lead.quote_data && lead.quote_data.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Ruler className="h-4 w-4 text-yellow-400" />
              Unit Summary
            </h2>
            <div className="space-y-2">
              {lead.quote_data.map((unit, i) => {
                const addonsList: string[] = [
                  unit.hasTotes ? "Yes Totes" : "No Totes",
                  unit.hasWheels ? "Yes Wheels" : "No Wheels",
                  unit.hasTop ? "Yes Top" : "No Top",
                ];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Unit {i + 1}: {unit.desc}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {unit.toteType} • {addonsList.join(", ")}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-yellow-400">
                      ${unit.price.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Cut Plan Visuals ───────────────────────────────────────── */}
        {manifest && manifest.cut_plan_visuals.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Wrench className="h-4 w-4 text-yellow-400" />
              Cut Plans
            </h2>

            <div className="space-y-6">
              {manifest.cut_plan_visuals.map((mod, mi) => (
                <div key={mi}>
                  <h3 className="mb-1 text-sm font-bold text-yellow-400">
                    Unit #{mod.unitIndex} — Module {mod.moduleIndex} ({mod.cols}
                    x{mod.rows})
                  </h3>
                  <p className="mb-3 text-[11px] text-stone-500">
                    {mod.stripCount} plywood sliders @ {toFraction(1.875)}&quot; (Rails: {mod.railStrips}, Back
                    Supports: {mod.backSupports})
                  </p>

                  <div className="space-y-2.5">
                    {mod.boards.map((board, bi) => (
                      <div
                        key={bi}
                        className="rounded-md border border-slate-700 bg-slate-800/50 p-2 shadow-sm"
                      >
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span className="font-semibold text-stone-400">
                            Board {bi + 1}
                            <span className="ml-1.5 text-stone-600">96&quot; stock</span>
                          </span>
                          <span className="font-mono font-bold text-red-400/70">
                            {toFraction(board.rem)}&quot; waste
                          </span>
                        </div>
                        <div className="flex h-8 overflow-hidden rounded-md bg-slate-700">
                          {board.cuts.map((cut, ci) => {
                            const pct = (cut.len / 96) * 100;
                            const color =
                              cut.type === "rail" ? "#f59e0b" : "#3b82f6";
                            return (
                              <div
                                key={ci}
                                className="flex items-center justify-center border-r border-slate-900/60 font-mono text-[10px] font-extrabold text-white"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: color,
                                  minWidth: "24px",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                                }}
                                title={`${cut.name} — ${toFraction(cut.len)}"`}
                              >
                                {toFraction(cut.len)}&quot;
                              </div>
                            );
                          })}
                          {board.rem > 0 && (
                            <div
                              className="flex-1"
                              style={{
                                background:
                                  "repeating-linear-gradient(45deg, rgba(239,68,68,0.18), rgba(239,68,68,0.18) 4px, rgba(220,38,38,0.08) 4px, rgba(220,38,38,0.08) 8px)",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-3 text-[10px] font-semibold text-stone-400">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                Vertical Posts
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-amber-500" />
                Plates / Framing
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, rgba(239,68,68,0.3), rgba(239,68,68,0.3) 2px, rgba(220,38,38,0.1) 2px, rgba(220,38,38,0.1) 4px)",
                  }}
                />
                Scrap
              </div>
            </div>
          </section>
        )}

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
