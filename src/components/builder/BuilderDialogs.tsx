"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — the dialogs around membership and sharing
//
//   Modal             the shared frame: a sheet from the bottom on a phone,
//                     a centered card on a wide screen
//   SubscribeDialog   what the subscription is, and Stripe's checkout
//   VerifyDialog      "confirm it's you" with the emailed 6-digit code
//   ShareDialog       keep a design private, share a view-only link, or
//                     list its plan for sale
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, Loader2, Lock, Mail, ShieldCheck, Store, X } from "lucide-react";
import {
  confirmBuilderCode,
  createBuilderSubscriptionCheckout,
  requestBuilderCode,
  shareDesign,
  type DesignSummary,
  type ShareMode,
} from "@/app/actions/builder";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import {
  BUILDER_SUBSCRIPTION,
  DESIGN_LIMITS,
  LISTING_PRICE,
  PLATFORM_SHARE,
  formatPrice,
  parseListingPrice,
  sharedDesignHref,
  splitSale,
} from "@/lib/builder/store";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-md"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
          <h2 className="min-w-0 truncate text-sm font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-stone-300 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

const PRIMARY =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60";
const FIELD =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-yellow-400";

// ── Subscribe ────────────────────────────────────────────────────────────

export function SubscribeDialog({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError("");
    const res = await createBuilderSubscriptionCheckout().catch(() => null);
    setBusy(false);
    if (res?.ok) setClientSecret(res.clientSecret);
    else setError(res?.error ?? "Couldn't reach the server. Try again.");
  };

  if (clientSecret) return <EmbeddedCheckoutPanel clientSecret={clientSecret} onClose={() => setClientSecret(null)} />;

  return (
    <Modal title={BUILDER_SUBSCRIPTION.name} onClose={onClose}>
      <p className="text-sm text-stone-300">{reason}</p>
      <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-white">{formatPrice(BUILDER_SUBSCRIPTION.price)}</span>
          <span className="text-sm text-stone-400">a month</span>
        </p>
        <ul className="mt-3 space-y-2">
          {BUILDER_SUBSCRIPTION.includes.map((item) => (
            <li key={item} className="flex gap-2 text-xs text-stone-200">
              <Check className="mt-px h-3.5 w-3.5 shrink-0 text-yellow-400" strokeWidth={3} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}
      <button type="button" onClick={start} disabled={busy} className={`${PRIMARY} mt-4`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Subscribe
      </button>
      <p className="mt-3 text-center text-[11px] leading-snug text-stone-500">
        Billed monthly by Stripe until you cancel. Already subscribed? Open the link in your welcome email on this device.
      </p>
    </Modal>
  );
}

// ── Confirm it's you ─────────────────────────────────────────────────────

export function VerifyDialog({
  token,
  emailHint,
  onVerified,
  onClose,
}: {
  token: string;
  emailHint: string;
  onVerified: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"ask" | "code">("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    setBusy(true);
    setError("");
    const res = await requestBuilderCode(token).catch(() => null);
    setBusy(false);
    if (!res) return setError("Couldn't reach the server. Try again.");
    if (!res.ok) {
      setError(res.error);
      // A code from a moment ago is still good: let them enter it.
      if (/just sent/.test(res.error)) setStage("code");
      return;
    }
    setStage("code");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const verify = async (value: string) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError("");
    const res = await confirmBuilderCode(token, value).catch(() => null);
    setBusy(false);
    if (res?.ok) return onVerified();
    setError(res?.error ?? "Couldn't reach the server. Try again.");
  };

  return (
    <Modal title="Confirm it's you" onClose={onClose}>
      <div className="text-center">
        <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-yellow-400" />
        <p className="text-sm text-stone-300">
          This device hasn&apos;t opened your builder before. We&apos;ll email a 6-digit code to <strong className="text-white">{emailHint}</strong>.
        </p>
      </div>
      {stage === "code" && (
        <input
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          placeholder="000000"
          aria-label="6-digit code"
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            if (value.length === 6) verify(value);
          }}
          className={`${FIELD} mt-4 text-center font-mono text-2xl tracking-[0.4em]`}
        />
      )}
      {error && <p className="mt-3 text-center text-xs font-medium text-red-400">{error}</p>}
      <button type="button" onClick={stage === "ask" ? send : () => verify(code)} disabled={busy || (stage === "code" && code.length !== 6)} className={`${PRIMARY} mt-4`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {stage === "ask" ? "Email me a code" : "Confirm"}
      </button>
      {stage === "code" && (
        <button type="button" onClick={send} disabled={busy} className="mt-3 w-full text-center text-xs font-semibold text-stone-400 hover:text-yellow-300">
          Send a new code
        </button>
      )}
    </Modal>
  );
}

// ── Share ────────────────────────────────────────────────────────────────

const MODES: { id: ShareMode; label: string; detail: string; icon: React.ReactNode }[] = [
  { id: "private", label: "Private", detail: "Only you can open it.", icon: <Lock className="h-4 w-4" /> },
  { id: "view", label: "Share a link", detail: "Anyone with the link can look at it in 3D. Subscribers can copy it.", icon: <Eye className="h-4 w-4" /> },
  { id: "sale", label: "Sell the plan", detail: "Listed in the marketplace. Buyers get the cut list, guide and PDF.", icon: <Store className="h-4 w-4" /> },
];

export function ShareDialog({
  token,
  design,
  onChanged,
  onClose,
}: {
  token: string | null;
  design: DesignSummary;
  onChanged: (design: DesignSummary) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ShareMode>(design.shareMode);
  const [price, setPrice] = useState(design.priceCents ? String(design.priceCents / 100) : String(LISTING_PRICE.suggested / 100));
  const [description, setDescription] = useState(design.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<DesignSummary>(design);
  const [copied, setCopied] = useState(false);

  const priceCents = parseListingPrice(price);
  const earnings = priceCents ? splitSale(priceCents).creatorEarningsCents : null;
  const link = saved.shareSlug && saved.shareMode !== "private" ? `${window.location.origin}${sharedDesignHref(saved.shareSlug)}` : null;
  const changed = mode !== saved.shareMode || (mode !== "private" && description !== (saved.description ?? "")) || (mode === "sale" && priceCents !== saved.priceCents);

  const save = async () => {
    if (mode === "sale" && !priceCents) return setError(`Set a price between $${LISTING_PRICE.min / 100} and $${LISTING_PRICE.max / 100}.`);
    setBusy(true);
    setError("");
    const res = await shareDesign(token, design.id, { mode, priceCents: mode === "sale" ? priceCents : null, description }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(res?.error ?? "Couldn't reach the server. Try again.");
    // Keep the sales figures the list already had
    const next = { ...res.design, sales: design.sales, earningsCents: design.earningsCents };
    setSaved(next);
    onChanged(next);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  return (
    <Modal title={`Share “${design.name}”`} onClose={onClose}>
      <div className="space-y-2" role="radiogroup" aria-label="Who can see this design">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              mode === m.id ? "border-yellow-400 bg-yellow-400/10" : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <span className={`mt-0.5 ${mode === m.id ? "text-yellow-400" : "text-stone-400"}`}>{m.icon}</span>
            <span>
              <span className="block text-sm font-bold text-white">{m.label}</span>
              <span className="block text-xs text-stone-400">{m.detail}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === "sale" && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-500">Price</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">$</span>
              <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${FIELD} pl-7 font-mono`} />
            </span>
          </label>
          <p className="mt-1.5 text-[11px] text-stone-500">
            {earnings !== null
              ? `You earn ${formatPrice(earnings)} per sale. Storage Network keeps ${Math.round(PLATFORM_SHARE * 100)}%.`
              : `Between $${LISTING_PRICE.min / 100} and $${LISTING_PRICE.max / 100}.`}
          </p>
        </div>
      )}

      {mode !== "private" && (
        <label className="mt-4 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-500">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESIGN_LIMITS.maxDescription}
            rows={3}
            placeholder="What is it, what does it hold, anything a builder should know."
            className={`${FIELD} resize-none`}
          />
        </label>
      )}

      {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}
      <button type="button" onClick={save} disabled={busy || !changed} className={`${PRIMARY} mt-4`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {changed ? "Save sharing" : "Saved"}
      </button>

      {link && (
        <div className="mt-4 rounded-xl bg-slate-800/60 p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            {saved.shareMode === "sale" ? "Your listing" : "Your link"}
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${FIELD} min-w-0 flex-1 py-2 font-mono text-xs`} aria-label="Share link" />
            <button type="button" onClick={copy} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs font-bold text-stone-200 hover:border-yellow-400/60 hover:text-yellow-300">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-snug text-stone-500">
        Sharing uses the design as last saved. A plan someone already bought never changes, even if you edit or remove the design later.
      </p>
    </Modal>
  );
}
