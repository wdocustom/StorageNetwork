"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/gift: the gift order form, the cart
//
// One card per person (1–10, a stepper and "Add another person" both drive
// it), the gifter's name + email, an optional note, the "before you buy"
// notes with a required acknowledgement, and a live total. Validates with
// the same parser the server uses, then opens Stripe Embedded Checkout.
// The draft survives closing the payment panel and a reload (session only).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, Gift, Loader2, Lock, Mail, Minus, Plus, Sparkles, Tag, UserPlus, X } from "lucide-react";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import { createGiftCheckout } from "@/app/actions/plan-gifts";
import {
  GIFT_MAX_RECIPIENTS,
  GIFT_MESSAGE_MAX,
  GIFT_NAME_MAX,
  GIFT_SENDER_ADDRESS,
  GIFT_FEATURED_BUNDLES,
  GIFT_FLAT_EACH,
  GIFT_FLAT_FROM,
  GIFT_UNIT_PRICE,
  giftDealName,
  giftEachLabel,
  giftListCents,
  giftPriceLabel,
  giftSavingsCents,
  giftTotalCents,
  nextGiftDeal,
  normalizeEmail,
  parseGiftOrder,
  suggestEmailFix,
  type GiftFieldErrors,
} from "@/lib/plan-gifts";

interface Row {
  key: string;
  name: string;
  email: string;
}

interface Draft {
  rows: Row[];
  gifterName: string;
  gifterEmail: string;
  message: string;
}

export const GIFT_DRAFT_KEY = "sn_gift_draft";
const DRAFT_KEY = GIFT_DRAFT_KEY;
const newRow = (): Row => ({ key: Math.random().toString(36).slice(2, 10), name: "", email: "" });

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!Array.isArray(d.rows) || !d.rows.length) return null;
    return {
      rows: d.rows.slice(0, GIFT_MAX_RECIPIENTS).map((r) => ({
        key: typeof r?.key === "string" ? r.key : newRow().key,
        name: typeof r?.name === "string" ? r.name : "",
        email: typeof r?.email === "string" ? r.email : "",
      })),
      gifterName: typeof d.gifterName === "string" ? d.gifterName : "",
      gifterEmail: typeof d.gifterEmail === "string" ? d.gifterEmail : "",
      message: typeof d.message === "string" ? d.message : "",
    };
  } catch {
    return null;
  }
}

function visitorId(): string | undefined {
  try {
    return localStorage.getItem("sn_vid") ?? undefined;
  } catch {
    return undefined;
  }
}

const input =
  "w-full rounded-xl border bg-slate-900 px-3.5 py-3 text-base text-white placeholder:text-stone-600 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20";
const inputBorder = (bad: boolean) => (bad ? "border-red-500/70" : "border-slate-700");
const label = "mb-1.5 block text-sm font-semibold text-stone-300";
const sectionTitle = "flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white";
const stepBadge =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-extrabold text-gray-950";

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-400">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

// ── Volume pricing strip ─────────────────────────────────────────────────────

interface Tier {
  /** Quantity a tap sets */
  qty: number;
  /** Highest quantity this tile covers (inclusive) */
  upTo: number;
  label: string;
  price: string;
  list: string | null;
  each: string;
}

const TIERS: Tier[] = (() => {
  const featured = [...GIFT_FEATURED_BUNDLES];
  const tiers: Tier[] = [
    {
      qty: 1,
      upTo: featured[0] - 1,
      label: `1–${featured[0] - 1}`,
      price: giftPriceLabel(GIFT_UNIT_PRICE),
      list: null,
      each: "each",
    },
  ];
  featured.forEach((q, i) => {
    tiers.push({
      qty: q,
      upTo: (featured[i + 1] ?? GIFT_FLAT_FROM) - 1,
      label: `${q} for`,
      price: giftPriceLabel(giftTotalCents(q)),
      list: giftPriceLabel(giftListCents(q)),
      each: `${giftEachLabel(q)} ea`,
    });
  });
  tiers.push({
    qty: GIFT_FLAT_FROM,
    upTo: Infinity,
    label: `${GIFT_FLAT_FROM}+`,
    price: giftPriceLabel(GIFT_FLAT_EACH),
    list: giftPriceLabel(GIFT_UNIT_PRICE),
    each: "each",
  });
  return tiers;
})();

function VolumePricing({
  quantity,
  minQuantity,
  onPick,
}: {
  quantity: number;
  /** People already filled in: a tile below this would drop them, so it's off */
  minQuantity: number;
  onPick: (q: number) => void;
}) {
  return (
    <section aria-labelledby="gift-volume" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
      <div className="flex items-start gap-2.5">
        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        <div>
          <h2 id="gift-volume" className="text-[15px] font-extrabold text-white">
            Volume discounts: send more, pay less
          </h2>
          <p className="mt-0.5 text-sm text-stone-400">
            Bundles start at 3 gifts. {GIFT_FLAT_FROM} or more are just {giftPriceLabel(GIFT_FLAT_EACH)} each.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Price per order size">
        {TIERS.map((t) => {
          const active = quantity >= t.qty && quantity <= t.upTo;
          const blocked = t.upTo < minQuantity;
          return (
            <li key={t.label}>
              <button
                type="button"
                onClick={() => onPick(Math.max(t.qty, Math.min(minQuantity, t.upTo)))}
                disabled={blocked}
                aria-pressed={active}
                aria-label={`${t.label.replace("for", "gifts for")} ${t.price}${t.list ? `, regularly ${t.list}` : ""}`}
                className={`flex h-full w-full flex-col items-center rounded-xl border px-1 py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  active
                    ? "border-emerald-400 bg-emerald-400/15 ring-1 ring-emerald-400/40"
                    : "border-slate-700/80 bg-slate-900/80 hover:border-slate-500"
                }`}
              >
                <span className={`text-[11px] font-bold leading-none ${active ? "text-emerald-300" : "text-stone-400"}`}>{t.label}</span>
                <span className="mt-1.5 text-[17px] font-extrabold leading-none tabular-nums text-white">{t.price}</span>
                <span className="mt-1 h-3.5 text-[11px] leading-none tabular-nums text-stone-500 line-through decoration-stone-500/80">
                  {t.list ?? ""}
                </span>
                <span className={`mt-0.5 text-[10px] leading-none ${t.list ? "text-emerald-300/90" : "text-stone-500"}`}>{t.each}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function GiftPlansForm() {
  const uid = useId();
  // Fixed key for the server-rendered card (a random one wouldn't hydrate);
  // cards added later are client-only and get random keys.
  const [rows, setRows] = useState<Row[]>(() => [{ key: "first", name: "", email: "" }]);
  const [gifterName, setGifterName] = useState("");
  const [gifterEmail, setGifterEmail] = useState("");
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<GiftFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const restored = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Restore an unfinished order (reload, or back from another tab).
  useEffect(() => {
    const d = readDraft();
    if (d) {
      setRows(d.rows);
      setGifterName(d.gifterName);
      setGifterEmail(d.gifterEmail);
      setMessage(d.message);
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, gifterName, gifterEmail, message } satisfies Draft));
    } catch {
      /* private mode: the draft just isn't kept */
    }
  }, [rows, gifterName, gifterEmail, message]);

  const quantity = rows.length;
  const total = giftTotalCents(quantity);
  const listTotal = giftListCents(quantity);
  const savings = giftSavingsCents(quantity);
  const deal = giftDealName(quantity);
  const nextDeal = nextGiftDeal(quantity);
  // People with anything typed in: picking a smaller tier never drops them.
  const filled = rows.filter((r) => r.name.trim() || r.email.trim()).length;
  const order = useMemo(
    () => ({
      gifterName,
      gifterEmail,
      message,
      acknowledged,
      recipients: rows.map(({ name, email }) => ({ name, email })),
    }),
    [gifterName, gifterEmail, message, acknowledged, rows]
  );

  // After the first submit, keep errors live as they type.
  useEffect(() => {
    if (!submitted) return;
    const res = parseGiftOrder(order);
    setErrors(res.ok ? {} : res.fields);
    if (res.ok) setFormError("");
  }, [order, submitted]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const setQuantity = (n: number) => {
    const next = Math.min(GIFT_MAX_RECIPIENTS, Math.max(1, n));
    setRows((prev) => {
      if (next > prev.length) return [...prev, ...Array.from({ length: next - prev.length }, newRow)];
      // Shrinking drops empty cards first, then the last ones.
      let out = [...prev];
      while (out.length > next) {
        const emptyAt = out.map((r) => !r.name.trim() && !r.email.trim()).lastIndexOf(true);
        out = out.filter((_, j) => j !== (emptyAt >= 0 ? emptyAt : out.length - 1));
      }
      return out;
    });
  };

  const removeRow = (i: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));

  const addRow = () => {
    if (rows.length >= GIFT_MAX_RECIPIENTS) return;
    setRows((prev) => [...prev, newRow()]);
    // Focus the new card's name field.
    requestAnimationFrame(() => {
      const inputs = formRef.current?.querySelectorAll<HTMLInputElement>("input[data-recipient-name]");
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  const closeCheckout = useCallback(() => setClientSecret(null), []);

  function focusFirstError(fields: GiftFieldErrors) {
    const first = Object.keys(fields)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    const res = parseGiftOrder(order);
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.error);
      focusFirstError(res.fields);
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      const out = await createGiftCheckout(order, visitorId());
      if (!out.ok) {
        setFormError(out.error);
        if (out.fields) {
          setErrors(out.fields);
          focusFirstError(out.fields);
        }
        return;
      }
      setClientSecret(out.clientSecret);
    } catch {
      setFormError("We couldn't open checkout. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const messageLeft = GIFT_MESSAGE_MAX - message.length;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-12">
      <VolumePricing quantity={quantity} minQuantity={filled} onPick={setQuantity} />

      {/* ── 1. Who's it for ─────────────────────────────────────── */}
      <section aria-labelledby={`${uid}-who`}>
        <div className="flex items-center justify-between gap-4">
          <h2 id={`${uid}-who`} className={sectionTitle}>
            <span className={stepBadge}>1</span> Who&apos;s it for?
          </h2>
          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900" role="group" aria-label="Number of gifts">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= 1}
              aria-label="One fewer gift"
              className="flex h-10 w-10 items-center justify-center rounded-l-xl text-stone-300 transition hover:bg-slate-800 disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <output aria-live="polite" className="min-w-[2.25rem] text-center text-base font-extrabold tabular-nums text-white">
              {quantity}
            </output>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= GIFT_MAX_RECIPIENTS}
              aria-label="One more gift"
              className="flex h-10 w-10 items-center justify-center rounded-r-xl text-stone-300 transition hover:bg-slate-800 disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[15px] text-stone-400">
          Each person gets their own email and their own lifetime access.
        </p>
        <FieldError id={`${uid}-recipients`} text={errors.recipients} />

        <ol className="mt-5 space-y-3">
          {rows.map((row, i) => {
            const nameErr = errors[`recipients.${i}.name`];
            const emailErr = errors[`recipients.${i}.email`];
            const fix = suggestEmailFix(normalizeEmail(row.email));
            const nameId = `${uid}-r${row.key}-name`;
            const emailId = `${uid}-r${row.key}-email`;
            return (
              <li key={row.key} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-400">Person {i + 1}</p>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label={`Remove person ${i + 1}`}
                      className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-slate-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={nameId} className={label}>
                      Their name
                    </label>
                    <input
                      id={nameId}
                      data-field={`recipients.${i}.name`}
                      data-recipient-name
                      value={row.name}
                      onChange={(e) => setRow(i, { name: e.target.value })}
                      maxLength={GIFT_NAME_MAX}
                      autoComplete="off"
                      placeholder="Jordan Smith"
                      aria-invalid={!!nameErr}
                      aria-describedby={nameErr ? `${nameId}-err` : undefined}
                      className={`${input} ${inputBorder(!!nameErr)}`}
                    />
                    <FieldError id={`${nameId}-err`} text={nameErr} />
                  </div>
                  <div>
                    <label htmlFor={emailId} className={label}>
                      Their email
                    </label>
                    <input
                      id={emailId}
                      data-field={`recipients.${i}.email`}
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      value={row.email}
                      onChange={(e) => setRow(i, { email: e.target.value })}
                      placeholder="jordan@example.com"
                      aria-invalid={!!emailErr}
                      aria-describedby={emailErr ? `${emailId}-err` : fix ? `${emailId}-fix` : undefined}
                      className={`${input} ${inputBorder(!!emailErr)}`}
                    />
                    <FieldError id={`${emailId}-err`} text={emailErr} />
                    {fix && !emailErr && (
                      <p id={`${emailId}-fix`} className="mt-1.5 text-sm text-amber-300">
                        Did you mean <span className="font-semibold">{fix}</span>?{" "}
                        <button
                          type="button"
                          onClick={() => setRow(i, { email: fix })}
                          className="font-bold text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                        >
                          Use it
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {rows.length < GIFT_MAX_RECIPIENTS ? (
          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 py-3.5 text-sm font-bold text-stone-300 transition hover:border-yellow-400/60 hover:text-white"
          >
            <UserPlus className="h-4 w-4" aria-hidden /> Add another person
          </button>
        ) : (
          <p className="mt-3 text-center text-sm text-stone-500">
            That&apos;s the most per order ({GIFT_MAX_RECIPIENTS}). Need more? Place a second order.
          </p>
        )}

        {nextDeal && (
          <button
            type="button"
            onClick={() => setQuantity(nextDeal.quantity)}
            className="mt-3 flex w-full items-center gap-2.5 rounded-2xl bg-emerald-400/10 px-4 py-3 text-left text-sm text-emerald-200 transition hover:bg-emerald-400/15"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <span>
              Add {nextDeal.add} more {nextDeal.add === 1 ? "person" : "people"} and it&apos;s{" "}
              <strong className="text-white">
                {nextDeal.quantity >= GIFT_FLAT_FROM
                  ? `${giftPriceLabel(GIFT_FLAT_EACH)} each`
                  : `${nextDeal.quantity} for ${giftPriceLabel(nextDeal.total)}`}
              </strong>{" "}
              <span className="text-emerald-300/80">({giftPriceLabel(nextDeal.eachCents)} each)</span>
            </span>
          </button>
        )}
      </section>

      {/* ── 2. From you ─────────────────────────────────────────── */}
      <section aria-labelledby={`${uid}-from`}>
        <h2 id={`${uid}-from`} className={sectionTitle}>
          <span className={stepBadge}>2</span> From you
        </h2>
        <p className="mt-2 text-[15px] text-stone-400">
          Your name goes on their email. Your receipt, and any replies from them, come to your email.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-gname`} className={label}>
              Your name
            </label>
            <input
              id={`${uid}-gname`}
              data-field="gifterName"
              value={gifterName}
              onChange={(e) => setGifterName(e.target.value)}
              maxLength={GIFT_NAME_MAX}
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={!!errors.gifterName}
              aria-describedby={errors.gifterName ? `${uid}-gname-err` : undefined}
              className={`${input} ${inputBorder(!!errors.gifterName)}`}
            />
            <FieldError id={`${uid}-gname-err`} text={errors.gifterName} />
          </div>
          <div>
            <label htmlFor={`${uid}-gemail`} className={label}>
              Your email
            </label>
            <input
              id={`${uid}-gemail`}
              data-field="gifterEmail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              value={gifterEmail}
              onChange={(e) => setGifterEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={!!errors.gifterEmail}
              aria-describedby={errors.gifterEmail ? `${uid}-gemail-err` : undefined}
              className={`${input} ${inputBorder(!!errors.gifterEmail)}`}
            />
            <FieldError id={`${uid}-gemail-err`} text={errors.gifterEmail} />
            {(() => {
              const fix = suggestEmailFix(normalizeEmail(gifterEmail));
              return fix && !errors.gifterEmail ? (
                <p className="mt-1.5 text-sm text-amber-300">
                  Did you mean <span className="font-semibold">{fix}</span>?{" "}
                  <button
                    type="button"
                    onClick={() => setGifterEmail(fix)}
                    className="font-bold text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                  >
                    Use it
                  </button>
                </p>
              ) : null;
            })()}
          </div>
        </div>
      </section>

      {/* ── 3. A note ───────────────────────────────────────────── */}
      <section aria-labelledby={`${uid}-note`}>
        <h2 id={`${uid}-note`} className={sectionTitle}>
          <span className={stepBadge}>3</span> Add a note <span className="text-sm font-semibold text-stone-500">(optional)</span>
        </h2>
        <p className="mt-2 text-[15px] text-stone-400">
          {rows.length > 1 ? "Everyone on this order sees the same note." : "It goes at the top of their email."}
        </p>
        <div className="mt-4">
          <label htmlFor={`${uid}-msg`} className="sr-only">
            Note
          </label>
          <textarea
            id={`${uid}-msg`}
            data-field="message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, GIFT_MESSAGE_MAX))}
            rows={4}
            placeholder="Saw this and thought of your garage. Happy building!"
            aria-describedby={`${uid}-msg-count`}
            className={`${input} ${inputBorder(!!errors.message)} resize-none leading-relaxed`}
          />
          <div className="mt-1.5 flex justify-between">
            <FieldError id={`${uid}-msg-err`} text={errors.message} />
            <p
              id={`${uid}-msg-count`}
              className={`ml-auto text-xs tabular-nums ${messageLeft < 30 ? "text-amber-300" : "text-stone-500"}`}
            >
              {messageLeft} left
            </p>
          </div>
        </div>
      </section>

      {/* ── Before you buy ──────────────────────────────────────── */}
      <section aria-labelledby={`${uid}-heads-up`} className="rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.06] p-5">
        <h2 id={`${uid}-heads-up`} className="flex items-center gap-2 text-base font-extrabold text-white">
          <Mail className="h-4 w-4 text-yellow-400" aria-hidden /> Before you buy
        </h2>
        <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-stone-300">
          <li className="flex gap-2.5">
            <Check className="mt-1 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
            <span>
              Each person gets their own email from <strong className="text-white">{GIFT_SENDER_ADDRESS}</strong>, the moment
              you pay.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-1 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
            <span>
              They aren&apos;t expecting it, so it can land in spam or Promotions.{" "}
              <strong className="text-white">Give them a heads-up and follow up</strong> to make sure they got it.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-1 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
            <span>
              After paying you can resend an email, fix a mistyped address (before it&apos;s opened), or copy their link to
              text it to them.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-1 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={3} aria-hidden />
            <span>
              Digital plans are delivered instantly, so <strong className="text-white">all sales are final</strong>. Please
              double-check each email.
            </span>
          </li>
        </ul>
        <label
          data-field="acknowledged"
          className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
            errors.acknowledged ? "border-red-500/70 bg-red-500/5" : "border-slate-700 bg-slate-900/70 hover:border-slate-600"
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-yellow-400"
          />
          <span className="text-[15px] leading-snug text-stone-200">
            I understand all sales are final, and I&apos;ll let them know to look for the email.
          </span>
        </label>
        <FieldError id={`${uid}-ack-err`} text={errors.acknowledged} />
      </section>

      {/* ── Summary + pay ───────────────────────────────────────── */}
      <section aria-label="Order summary" className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-bold text-white">
              <Gift className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden /> All-Access plans, gifted
            </p>
            <p className="mt-0.5 text-sm text-stone-400">
              {quantity} {quantity === 1 ? "person" : "people"} × {giftEachLabel(quantity)} each · lifetime access
            </p>
            {deal && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
                <Tag className="h-3.5 w-3.5" aria-hidden /> {deal}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {savings > 0 && (
              <p className="text-sm tabular-nums text-stone-500 line-through decoration-stone-500/80">
                <span className="sr-only">Regular price </span>
                {giftPriceLabel(listTotal)}
              </p>
            )}
            <p className="text-2xl font-extrabold tabular-nums text-white">{giftPriceLabel(total)}</p>
            {savings > 0 && (
              <p className="mt-0.5 text-xs font-bold text-emerald-300">You save {giftPriceLabel(savings)}</p>
            )}
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 text-base font-extrabold text-gray-950 transition hover:bg-yellow-300 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Opening secure checkout…
            </>
          ) : (
            <>
              Continue to payment · {giftPriceLabel(total)} <ArrowRight className="h-5 w-5" aria-hidden />
            </>
          )}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Secure payment by Stripe.
        </p>
      </section>

      {clientSecret && <EmbeddedCheckoutPanel clientSecret={clientSecret} onClose={closeCheckout} />}
    </form>
  );
}
