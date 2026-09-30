"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import {
  getQuoteRequestPage,
  submitQuoteRequest,
  type QuoteRequestPageData,
} from "@/app/actions/quote-requests";

// ═══════════════════════════════════════════════════════════════════════════
// Request a New Quote — /request/[token]
//
// Reached from a returning customer's receipt email, review page / review
// email, or rack inventory email / page. The token is a signed link to their
// earlier job (no login). They pick from what their installer offers (only
// the products and services the installer has enabled) and add notes; the
// installer is emailed and builds the quote in the normal create-quote flow.
// ═══════════════════════════════════════════════════════════════════════════

export default function RequestQuotePage() {
  return (
    <Suspense fallback={<Shell><Loader2 className="mx-auto h-10 w-10 animate-spin text-yellow-400" /></Shell>}>
      <RequestQuoteInner />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">{children}</div>
    </div>
  );
}

function RequestQuoteInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const origin = searchParams.get("via") || "other";

  const [status, setStatus] = useState<"loading" | "ready" | "sending" | "sent" | "invalid">("loading");
  const [page, setPage] = useState<QuoteRequestPageData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wants, setWants] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    getQuoteRequestPage(token).then((r) => {
      if (!r.data) {
        setStatus("invalid");
        return;
      }
      setPage(r.data);
      setName(r.data.customerName);
      setEmail(r.data.customerEmail || "");
      setPhone(r.data.customerPhone || "");
      setStatus("ready");
    });
  }, [token]);

  function toggleWant(w: string) {
    setWants((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  async function handleSubmit() {
    setError("");
    setStatus("sending");
    const r = await submitQuoteRequest({ token, origin, name, email, phone, wants, notes });
    if (r.success) {
      setStatus("sent");
    } else {
      setError(r.error || "Something went wrong. Please try again.");
      setStatus("ready");
    }
  }

  if (status === "loading") {
    return (
      <Shell>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-yellow-400" />
      </Shell>
    );
  }

  if (status === "invalid" || !page) {
    return (
      <Shell>
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <h1 className="mb-2 text-lg font-bold text-white">Link Not Valid</h1>
          <p className="text-sm text-stone-400">
            This link doesn&apos;t work. Please reach out to your installer directly.
          </p>
        </div>
      </Shell>
    );
  }

  if (status === "sent") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Request Sent!</h1>
          <p className="text-sm text-stone-400">
            {page.installerName} has your request and will get back to you with a quote.
          </p>
        </div>
      </Shell>
    );
  }

  const firstName = page.customerName.split(" ")[0];

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-3">
        {page.installerAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.installerAvatar}
            alt={page.installerName}
            className="h-12 w-12 rounded-full border-2 border-yellow-400/50 object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-800 text-lg font-bold text-yellow-400">
            {page.installerName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-white">{page.installerName}</p>
          <p className="text-xs text-stone-500">Your installer</p>
        </div>
      </div>

      <h1 className="mb-1 text-xl font-bold text-white">
        {firstName ? `Hi ${firstName}! ` : ""}Need something new?
      </h1>
      <p className="mb-5 text-sm text-stone-400">
        Tell {page.installerName} what you&apos;re looking for and they&apos;ll send you a quote.
      </p>

      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">What would you like?</p>
      <div className="mb-4 grid grid-cols-1 gap-2">
        {/* Only what this installer offers (see @/lib/request-options) */}
        {page.options.map((o) => {
          const on = wants.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggleWant(o.value)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                on
                  ? "border-yellow-400 bg-yellow-400/10 font-semibold text-yellow-300"
                  : "border-slate-700 bg-slate-800 text-stone-300 hover:border-slate-600"
              }`}
            >
              {on ? "✓ " : ""}
              {o.label}
            </button>
          );
        })}
      </div>

      <label htmlFor="notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-500">
        Details <span className="font-normal normal-case text-stone-600">(optional)</span>
      </label>
      <textarea
        id="notes"
        rows={4}
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Size, where it's going, anything that helps…"
        className="mb-5 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
      />

      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Your details</p>
      <div className="mb-5 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoComplete="name"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          type="tel"
          autoComplete="tel"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={status === "sending"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 px-6 py-3.5 text-sm font-black uppercase tracking-wide text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
      >
        {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Request a Quote
      </button>
    </Shell>
  );
}
