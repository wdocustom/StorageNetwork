"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Analytics → Plans → "Holiday refund giveaway"
//
// Pick a finished day, draw winners at random from that day's entries, then
// issue each prize (Stripe refund, or a plans account for a free-entry
// winner with no purchase), which also emails the winner. Free entries sent
// by email are added here. See /refund-rules.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RotateCcw, Shuffle, X } from "lucide-react";
import {
  addEmailedEntry,
  drawGiveawayWinners,
  getGiveawayDay,
  issueGiveawayPrize,
  resendGiveawayEmail,
  voidGiveawayWinner,
  type GiveawayDayView,
} from "@/app/actions/refund-giveaway-admin";
import type { WinnerRow } from "@/lib/server/refund-giveaway-draw";
import { REFUND_GIVEAWAY, centralDate, formatGiveawayDate } from "@/lib/refund-giveaway";

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`);

const STATUS_STYLE: Record<WinnerRow["status"], string> = {
  drawn: "bg-yellow-400/15 text-yellow-300",
  processing: "bg-sky-400/15 text-sky-300",
  refunded: "bg-emerald-400/15 text-emerald-300",
  granted: "bg-emerald-400/15 text-emerald-300",
  failed: "bg-red-400/15 text-red-300",
  void: "bg-slate-700/60 text-stone-400",
};

const STATUS_LABEL: Record<WinnerRow["status"], string> = {
  drawn: "To issue",
  processing: "Issuing…",
  refunded: "Refunded",
  granted: "Plans given",
  failed: "Failed",
  void: "Void",
};

const KIND_LABEL = { purchase: "Purchase", gift_order: "Gift order", free: "Free entry" } as const;

function prizeLabel(w: WinnerRow): string {
  return w.prize === "refund" ? `Refund ${money(w.amount_cents)}` : "Lifetime plans";
}

export default function RefundGiveawayAdmin() {
  const [view, setView] = useState<GiveawayDayView | null>(null);
  const [day, setDay] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    const r = await getGiveawayDay(d);
    if (r.ok) {
      setView(r.data);
      setError(null);
    } else setError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(day);
  }, [day, load]);

  const replace = (row: WinnerRow) =>
    setView((v) => (v ? { ...v, winners: v.winners.map((w) => (w.id === row.id ? row : w)) } : v));

  async function draw() {
    if (!view) return;
    if (!window.confirm(`Draw ${count} winner${count === 1 ? "" : "s"} for ${formatGiveawayDate(view.day)}?`)) return;
    setBusy("draw");
    setNotice(null);
    const r = await drawGiveawayWinners(view.day, count);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    const parts = [`Drew ${r.data.winners.length} winner${r.data.winners.length === 1 ? "" : "s"}.`];
    if (r.data.voided.length) parts.push(`${r.data.voided.length} pick${r.data.voided.length === 1 ? " was" : "s were"} void (${r.data.voided.map((v) => v.reason.toLowerCase()).join(", ")}).`);
    if (r.data.exhausted) parts.push("No more eligible entries for this day.");
    setNotice(parts.join(" "));
    await load(view.day);
  }

  async function issue(w: WinnerRow, ask = true): Promise<boolean> {
    if (ask) {
      const what = w.prize === "refund" ? `Refund ${money(w.amount_cents)} to ${w.email}` : `Give ${w.email} a lifetime plans account`;
      if (!window.confirm(`${what} and email them?`)) return false;
    }
    setBusy(w.id);
    const r = await issueGiveawayPrize(w.id);
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    replace(r.data);
    return r.data.status !== "failed";
  }

  async function issueAll() {
    if (!view) return;
    const todo = view.winners.filter((w) => w.status === "drawn");
    const refunds = todo.filter((w) => w.prize === "refund").reduce((s, w) => s + (w.amount_cents ?? 0), 0);
    if (!window.confirm(`Issue ${todo.length} prize${todo.length === 1 ? "" : "s"} (${money(refunds)} in refunds) and email each winner?`)) return;
    let failed = 0;
    for (const w of todo) if (!(await issue(w, false))) failed++;
    setNotice(failed ? `${todo.length - failed} issued, ${failed} failed (see below; you can retry).` : `All ${todo.length} issued and emailed.`);
  }

  async function voidOne(w: WinnerRow) {
    const reason = window.prompt(`Void ${w.email}'s win? Their entry won't be drawn again. Reason:`, "Not eligible");
    if (reason == null) return;
    setBusy(w.id);
    const r = await voidGiveawayWinner(w.id, reason);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (view) await load(view.day);
  }

  async function resend(w: WinnerRow) {
    setBusy(w.id);
    const r = await resendGiveawayEmail(w.id);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    replace(r.data);
  }

  const live = view?.winners.filter((w) => w.status !== "void") ?? [];
  const toIssue = live.filter((w) => w.status === "drawn").length;
  const refunded = live.filter((w) => w.status === "refunded").reduce((s, w) => s + (w.amount_cents ?? 0), 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Holiday refund giveaway</h3>
        <a href={REFUND_GIVEAWAY.rulesPath} target="_blank" rel="noreferrer" className="text-[11px] text-yellow-400 hover:underline">
          Official Rules
        </a>
      </div>

      {error && (
        <p className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </p>
      )}
      {notice && <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

      {loading && !view ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-stone-500" /></div>
      ) : view ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] text-stone-400">
              Drawing day (Central Time)
              <select
                value={view.day}
                onChange={(e) => {
                  setNotice(null);
                  setDay(e.target.value);
                }}
                className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {view.days.map((d) => (
                  <option key={d} value={d}>{formatGiveawayDate(d)}</option>
                ))}
              </select>
            </label>
            {loading && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-stone-500" />}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Purchase entries", value: view.entries.purchase + view.entries.gift_order, sub: view.entries.gift_order ? `${view.entries.gift_order} gift order${view.entries.gift_order === 1 ? "" : "s"}` : null },
              { label: "Free entries", value: view.entries.free, sub: view.entries.freeByEmail ? `${view.entries.freeByEmail} by email` : null },
              { label: "Winners", value: live.length, sub: toIssue ? `${toIssue} to issue` : null },
              { label: "Refunded", value: money(refunded), sub: null },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-stone-500">{k.label}</p>
                <p className="text-lg font-bold text-white">{k.value}</p>
                {k.sub && <p className="text-[10px] text-stone-500">{k.sub}</p>}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-stone-400">
              Winners to draw
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button
              onClick={draw}
              disabled={!!busy || view.remaining === 0}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-950 hover:bg-yellow-300 disabled:opacity-50"
            >
              {busy === "draw" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
              Draw at random
            </button>
            {toIssue > 0 && (
              <button
                onClick={issueAll}
                disabled={!!busy}
                className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Issue all {toIssue} &amp; email
              </button>
            )}
            <span className="text-[11px] text-stone-500">{view.remaining} eligible entr{view.remaining === 1 ? "y" : "ies"} left</span>
          </div>

          {view.winners.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Winner</th>
                    <th className="py-2 pr-3 font-semibold">Entry</th>
                    <th className="py-2 pr-3 font-semibold">Prize</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {view.winners.map((w) => (
                    <tr key={w.id} className={w.status === "void" ? "opacity-60" : ""}>
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-white">{w.full_name || "—"}</p>
                        <p className="text-stone-400">{w.email}</p>
                      </td>
                      <td className="py-2 pr-3 text-stone-300">{KIND_LABEL[w.entry_kind]}</td>
                      <td className="py-2 pr-3 text-stone-300">{prizeLabel(w)}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[w.status]}`}>{STATUS_LABEL[w.status]}</span>
                        {w.notified_at && <p className="mt-1 text-[10px] text-stone-500">Emailed</p>}
                        {w.notify_error && <p className="mt-1 text-[10px] text-red-300">Email failed: {w.notify_error}</p>}
                        {w.error && <p className="mt-1 max-w-[220px] text-[10px] text-stone-400">{w.error}</p>}
                      </td>
                      <td className="py-2 text-right">
                        {busy === w.id ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin text-stone-500" />
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            {(w.status === "drawn" || w.status === "failed") && (
                              <>
                                <button
                                  onClick={() => issue(w)}
                                  disabled={!!busy}
                                  className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 font-bold text-emerald-300 hover:bg-emerald-500/25"
                                >
                                  {w.status === "failed" && <RotateCcw className="h-3 w-3" />}
                                  {w.status === "failed" ? "Retry" : w.prize === "refund" ? "Refund" : "Give plans"}
                                </button>
                                <button onClick={() => voidOne(w)} disabled={!!busy} className="rounded-md px-2 py-1 text-stone-400 hover:bg-slate-800">
                                  Void
                                </button>
                              </>
                            )}
                            {(w.status === "refunded" || w.status === "granted") && (
                              <button onClick={() => resend(w)} disabled={!!busy} title="Send the winner email again" className="flex items-center gap-1 rounded-md px-2 py-1 text-stone-400 hover:bg-slate-800">
                                <Mail className="h-3 w-3" /> {w.notified_at ? "Resend" : "Send email"}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <EmailedEntryForm defaultDay={centralDate()} onAdded={() => load(view.day)} />
        </>
      ) : null}
    </div>
  );
}

function EmailedEntryForm({ defaultDay, onAdded }: { defaultDay: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await addEmailedEntry({ name, email, day });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Added ${email} for ${formatGiveawayDate(day)}.` });
    setName("");
    setEmail("");
    onAdded();
  }

  const input = "rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white";
  return (
    <div className="mt-5 border-t border-slate-800 pt-4">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-stone-300 hover:text-white">
        {open ? "−" : "+"} Add a free entry received by email
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${input} w-40`} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={`${input} w-56`} />
          <label className="text-[11px] text-stone-400">
            Day it arrived (CT)
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${input} mt-1 block`} />
          </label>
          <button disabled={busy || !name.trim() || !email.trim()} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-50">
            {busy ? "Adding…" : "Add entry"}
          </button>
          {msg && <p className={`w-full text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
        </form>
      )}
    </div>
  );
}
