"use client";

// "Finish on your computer? Email this design to yourself" — under the offer.
// Visitors in Facebook's app often want to buy later on a computer; the
// email reopens their exact design (at their current price) anywhere.

import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";

export default function EmailDesignLink({
  onSend,
}: {
  onSend: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (sent) {
    return (
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-300">
        <Check className="h-3.5 w-3.5" /> Sent — open it on any device to pick up where you left off.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-semibold text-stone-400 underline-offset-2 hover:text-yellow-300 hover:underline"
      >
        <Mail className="h-3.5 w-3.5" /> Finish on your computer? Email this design to yourself
      </button>
    );
  }
  return (
    <form
      className="mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const r = await onSend(email).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
        setBusy(false);
        if (r.ok) setSent(true);
        else setError(r.error);
      }}
    >
      <div className="flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
        />
        <button
          type="submit"
          disabled={busy || !email}
          className="shrink-0 rounded-xl border border-slate-600 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-amber-400">{error}</p>}
    </form>
  );
}
