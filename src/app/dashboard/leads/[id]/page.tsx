"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { generateBuildManifest } from "@/lib/buildEngine";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Ruler,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import JobTicket from "@/components/dashboard/JobTicket";

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
  quote_data: QuoteUnit[] | null;
  created_at: string;
  installer_id: string | null;
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

  // Checklist state for material pick list
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Installer Stripe account for payment routing
  const [installerStripeId, setInstallerStripeId] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (err || !data) {
      setError("Lead not found or access denied.");
      setLoading(false);
      return;
    }

    const leadData = data as LeadDetail;
    setLead(leadData);

    // Generate build manifest from quote data
    if (leadData.quote_data && leadData.quote_data.length > 0) {
      const m = generateBuildManifest(leadData.quote_data);
      setManifest(m);
    }

    // Fetch installer's Stripe account ID
    if (leadData.installer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", leadData.installer_id)
        .single();
      if (profile?.stripe_account_id) {
        setInstallerStripeId(profile.stripe_account_id);
      }
    }

    setLoading(false);
  }, [supabase, leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  function toggleCheck(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
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
          Back to Dashboard
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
            href="/dashboard"
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
          {lead.deposit_paid ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Deposit Paid
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              Pending
            </span>
          )}
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
          {lead.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-yellow-400 hover:text-yellow-300"
            >
              <MapPin className="h-3 w-3" />
              {lead.address}
            </a>
          )}
          <p className="mt-2 text-xs text-stone-600">
            Submitted {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </section>

        {/* ── Financial Breakdown (Materials / Collect / Profit) ──────── */}
        <JobTicket
          leadId={lead.id}
          totalPrice={totalPrice}
          depositAmount={depositAmt}
          depositPaid={lead.deposit_paid}
          payoutStatus={lead.payout_status}
          quoteData={lead.quote_data}
          customerEmail={lead.customer_email}
          customerName={lead.customer_name}
          installerStripeId={installerStripeId}
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
                const extras: string[] = [];
                if (unit.hasTotes) extras.push("Totes");
                if (unit.hasWheels) extras.push("Wheels");
                if (unit.hasTop) extras.push("Top");
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
                        {unit.toteType} {extras.length > 0 ? `• ${extras.join(", ")}` : "• Frame Only"}
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

        {/* ── Material Pick List (Checklist) ─────────────────────────── */}
        {manifest && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <ShoppingCart className="h-4 w-4 text-yellow-400" />
              Material Pick List
            </h2>
            <ul className="space-y-1">
              {manifest.shopping_list.map((item, i) => {
                const key = `shop-${i}`;
                return (
                  <li
                    key={key}
                    onClick={() => toggleCheck(key)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors ${
                      checked[key]
                        ? "bg-emerald-500/10 line-through opacity-60"
                        : "bg-slate-800 hover:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs ${
                        checked[key]
                          ? "border-emerald-400 bg-emerald-400 text-slate-900"
                          : "border-stone-600"
                      }`}
                    >
                      {checked[key] && "✓"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-slate-700 px-2 py-0.5 font-mono text-sm font-bold text-yellow-400">
                      {item.qty}
                    </span>
                  </li>
                );
              })}
            </ul>
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
                    {mod.stripCount} plywood sliders @ 1.875&quot; (Rails: {mod.railStrips}, Back
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
                            {board.rem.toFixed(1)}&quot; waste
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
                                title={`${cut.name} — ${cut.len.toFixed(1)}"`}
                              >
                                {cut.len.toFixed(0)}&quot;
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
            href="/dashboard"
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
