"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { generateBuildManifest } from "@/lib/buildEngine";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Package,
  Ruler,
  ShoppingCart,
  Wrench,
} from "lucide-react";

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
  quote_data: QuoteUnit[] | null;
  created_at: string;
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

        {/* ── Collection Box (THE BIG NUMBER) ────────────────────────── */}
        <section className="rounded-xl border-2 border-yellow-400 bg-yellow-400/5 p-6 text-center">
          <div className="mb-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-400">
            <DollarSign className="h-4 w-4" />
            Amount to Collect
          </div>
          <div className="text-5xl font-black text-white">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-stone-400">
            <span>
              Total:{" "}
              <span className="font-bold text-white">
                ${totalPrice.toLocaleString()}
              </span>
            </span>
            <span>
              Deposit (15%):{" "}
              <span className="font-bold text-emerald-400">
                -${depositAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        </section>

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
                    {mod.stripCount} strips @ 1.875&quot; (Rails: {mod.railStrips}, Back
                    Supports: {mod.backSupports})
                  </p>

                  <div className="space-y-2">
                    {mod.boards.map((board, bi) => (
                      <div key={bi}>
                        <div className="mb-0.5 flex justify-between text-[10px] text-stone-500">
                          <span>Board {bi + 1}</span>
                          <span>{board.rem.toFixed(1)}&quot; waste</span>
                        </div>
                        <div className="flex h-7 overflow-hidden rounded bg-slate-700">
                          {board.cuts.map((cut, ci) => {
                            const pct = (cut.len / 96) * 100;
                            const color =
                              cut.type === "rail" ? "#f59e0b" : "#3b82f6";
                            return (
                              <div
                                key={ci}
                                className="flex items-center justify-center border-r border-slate-900 text-[10px] font-bold text-slate-900"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: color,
                                  minWidth: "20px",
                                }}
                              >
                                {cut.len.toFixed(0)}&quot;
                              </div>
                            );
                          })}
                          {/* Waste segment */}
                          {board.rem > 0 && (
                            <div
                              className="flex-1 opacity-30"
                              style={{
                                background:
                                  "repeating-linear-gradient(45deg, #ef4444, #ef4444 5px, #dc2626 5px, #dc2626 10px)",
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
            <div className="mt-4 flex items-center gap-4 border-t border-slate-800 pt-3 text-[10px] text-stone-500">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                Uprights
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-amber-500" />
                Rails
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="h-3 w-3 rounded-sm opacity-30"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, #ef4444, #ef4444 3px, #dc2626 3px, #dc2626 6px)",
                  }}
                />
                Waste
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
