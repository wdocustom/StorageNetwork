"use client";

// Free (no purchase necessary) entry for the Holiday Full Refund Giveaway.
// One per email per Central Time day; the server enforces it (submitFreeEntry).

import { useId, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { submitFreeEntry } from "@/app/actions/refund-giveaway";
import { formatGiveawayDate, type GiveawayStatus } from "@/lib/refund-giveaway";

export default function RefundFreeEntryForm({ status, startDate }: { status: GiveawayStatus; startDate: string | null }) {
  const uid = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; field?: "name" | "email" } | null>(null);
  const open = status === "active";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !open) return;
    setBusy(true);
    setError(null);
    const r = await submitFreeEntry({ name, email, website }).catch(() => ({
      ok: false as const,
      error: "We couldn't record your entry. Check your connection and try again.",
    }));
    setBusy(false);
    if (r.ok) setDone(r.entryDate);
    else setError({ text: r.error, field: "field" in r ? r.field : undefined });
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-emerald-300">You&apos;re entered for {formatGiveawayDate(done)}.</p>
          <p className="mt-1 text-stone-400">You can enter once a day, every day of the promotion (Central Time).</p>
        </div>
      </div>
    );
  }

  const input =
    "w-full rounded-lg border bg-slate-800 px-3 py-2.5 text-base text-white placeholder:text-stone-600 outline-none focus:border-yellow-400 sm:text-sm";
  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-bold text-white">Free entry form</p>
      <p className="mt-1 text-xs text-stone-500">
        {open
          ? "One entry per person per day. No purchase necessary."
          : status === "upcoming" && startDate
            ? `Free entry opens when the promotion starts on ${formatGiveawayDate(startDate)}.`
            : status === "ended"
              ? "The promotion has ended."
              : "Free entry opens when the promotion starts."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className="mb-1 block text-xs font-semibold text-stone-300">
            Full name
          </label>
          <input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            disabled={!open}
            aria-invalid={error?.field === "name"}
            className={`${input} ${error?.field === "name" ? "border-red-500/70" : "border-slate-700"} disabled:opacity-50`}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className="mb-1 block text-xs font-semibold text-stone-300">
            Email
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!open}
            aria-invalid={error?.field === "email"}
            className={`${input} ${error?.field === "email" ? "border-red-500/70" : "border-slate-700"} disabled:opacity-50`}
          />
        </div>
      </div>
      {/* Honeypot: hidden from people, filled in by bots */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!open || busy || !name.trim() || !email.trim()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-sm font-bold text-gray-950 transition hover:bg-yellow-300 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Enter for free
      </button>
    </form>
  );
}
