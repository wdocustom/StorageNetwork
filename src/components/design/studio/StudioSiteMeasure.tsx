"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio "Rather have a pro measure?" — the free on-site measure request the
// first-visit modal used to offer, as a link under "Fit it to my wall".
// Same action (requestOnSiteMeasure); pre-filled from what the customer has
// already typed anywhere in the designer.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { requestOnSiteMeasure } from "@/app/actions/site-measure";

const input =
  "w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none";

export default function StudioSiteMeasure({
  installerId,
  defaults,
}: {
  installerId: string;
  defaults: { name: string; email: string; phone: string; zip: string };
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-[11px] text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Request sent — your installer will reach out to schedule a quick measure. Keep designing in the meantime.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(defaults.name);
          setEmail(defaults.email);
          setPhone(defaults.phone);
          setZip(defaults.zip);
          setOpen(true);
        }}
        className="block text-left text-[11px] font-semibold text-zinc-400 underline-offset-2 transition hover:text-yellow-300 hover:underline"
      >
        Rather have a pro measure? Request a free on-site measure
      </button>
    );
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    const result = await requestOnSiteMeasure({
      installerId: installerId || undefined,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      zip,
      notes: notes || undefined,
    });
    setBusy(false);
    if (result.success) setDone(true);
    else setError(result.error ?? "Something went wrong. Please try again.");
  };

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-[11px] text-zinc-400">Free, no obligation — your installer reaches out to schedule a quick visit.</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" className={input} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" aria-label="Phone" className={input} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" aria-label="Email" className={input} />
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="ZIP"
          inputMode="numeric"
          maxLength={5}
          aria-label="ZIP"
          className={input}
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything we should know? (best time to call, garage layout…)"
        rows={2}
        maxLength={1000}
        className={input}
      />
      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-900 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Request my free measure
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-700 px-3 text-xs font-semibold text-zinc-400 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
