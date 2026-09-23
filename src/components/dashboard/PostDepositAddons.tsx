"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusCircle, CreditCard, Mail, Link, Check, Loader2, Heart } from "lucide-react";
import {
  getLeadAddons,
  chargeAddonDepositOffSession,
  sendAddonDepositLink,
} from "@/app/actions/payments";
import type { LeadAddon } from "@/lib/server/lead-addons";
import { formatCurrency as fmt } from "@/utils/paymentHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// PostDepositAddons — job ticket panel for items added after the deposit
//
// Lists each add-on with its own deposit, and lets the installer collect the
// pending add-on deposit: charge the card on file, email the customer the
// /payment/addon link, or copy it. Anything left unpaid is simply part of the
// final balance (its platform fee comes out of that charge). Also shows the
// tip the customer left on the balance payment link, if any.
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_LABEL: Record<LeadAddon["status"], { text: string; cls: string }> = {
  pending: { text: "Deposit due", cls: "bg-amber-500/15 text-amber-300" },
  paid: { text: "Deposit paid", cls: "bg-emerald-500/15 text-emerald-300" },
  collected_with_balance: { text: "Paid with balance", cls: "bg-emerald-500/15 text-emerald-300" },
  invoiced: { text: "Paid off-platform", cls: "bg-slate-600/40 text-stone-300" },
};

interface Props {
  leadId: string;
  customerEmail: string | null;
  hasSavedCard: boolean;
  savedCardLabel: string;
  isPaid: boolean;
  onRefresh: () => void;
}

export default function PostDepositAddons({
  leadId,
  customerEmail,
  hasSavedCard,
  savedCardLabel,
  isPaid,
  onRefresh,
}: Props) {
  const [addons, setAddons] = useState<LeadAddon[]>([]);
  const [tipAmount, setTipAmount] = useState(0);
  const [busy, setBusy] = useState<null | "charge" | "email">(null);
  const [confirmCharge, setConfirmCharge] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    getLeadAddons(leadId).then((r) => {
      if (!r.success) return;
      setAddons(r.addons || []);
      setTipAmount(r.tipAmount || 0);
    });
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  if (addons.length === 0 && tipAmount <= 0) return null;

  const pending = addons.filter((a) => a.status === "pending");
  const pendingDeposit = Math.round(pending.reduce((s, a) => s + a.deposit_amount, 0) * 100) / 100;
  const canCollect = pending.length > 0 && !isPaid;

  async function handleCharge() {
    setBusy("charge");
    setMessage(null);
    const r = await chargeAddonDepositOffSession(leadId);
    setBusy(null);
    setConfirmCharge(false);
    if (r.success) {
      setMessage({ ok: true, text: `Charged ${fmt(pendingDeposit)}. It will show as paid in a moment.` });
      // The webhook records the payment; give it a moment before refreshing.
      setTimeout(() => {
        load();
        onRefresh();
      }, 3000);
    } else {
      setMessage({ ok: false, text: r.error || "Charge failed." });
    }
  }

  async function handleEmail() {
    setBusy("email");
    setMessage(null);
    const r = await sendAddonDepositLink(leadId);
    setBusy(null);
    setMessage(r.success ? { ok: true, text: `Add-on deposit link sent to ${customerEmail}.` } : { ok: false, text: r.error || "Email failed." });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/payment/addon/${leadId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      {addons.length > 0 && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <PlusCircle className="h-4 w-4 text-yellow-400" />
            Added After Deposit
          </h2>
          <div className="space-y-2">
            {addons.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-800/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{a.description || "Add-on"}</p>
                  <p className="text-[11px] text-stone-500">
                    Deposit {fmt(a.deposit_amount)}
                    {a.platform_fee > 0 && <> · platform fee {fmt(a.platform_fee)}</>}
                    {a.sales_tax_amount > 0 && <> · tax {fmt(a.sales_tax_amount)}</>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-white">+{fmt(a.amount)}</p>
                  <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_LABEL[a.status].cls}`}>
                    {STATUS_LABEL[a.status].text}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {canCollect && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="mb-2 text-xs text-amber-200">
                Add-on deposit due: <strong className="text-white">{fmt(pendingDeposit)}</strong>
                <span className="block text-[10px] text-stone-500">
                  If it isn&apos;t paid separately, it&apos;s collected with the final balance.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {hasSavedCard && (
                  confirmCharge ? (
                    <button
                      onClick={handleCharge}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {busy === "charge" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                      Confirm {fmt(pendingDeposit)} on {savedCardLabel}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmCharge(true)}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-950 hover:bg-yellow-300 disabled:opacity-50"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Charge Card on File
                    </button>
                  )
                )}
                {customerEmail && (
                  <button
                    onClick={handleEmail}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    Email Link
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-200 hover:bg-slate-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              {message && (
                <p className={`mt-2 text-[11px] ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
              )}
            </div>
          )}
        </>
      )}

      {tipAmount > 0 && (
        <p className={`flex items-center gap-1.5 text-sm text-pink-300 ${addons.length > 0 ? "mt-3 border-t border-slate-800 pt-3" : ""}`}>
          <Heart className="h-4 w-4" />
          Customer tip: <strong className="text-white">{fmt(tipAmount)}</strong>
          <span className="text-[10px] text-stone-500">(no platform fee)</span>
        </p>
      )}
    </section>
  );
}
