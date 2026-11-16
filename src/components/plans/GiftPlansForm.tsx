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
import { AlertCircle, ArrowRight, Check, Gift, Loader2, Lock, Mail, Minus, Plus, UserPlus, X } from "lucide-react";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import { createGiftCheckout } from "@/app/actions/plan-gifts";
import {
  GIFT_MAX_RECIPIENTS,
  GIFT_MESSAGE_MAX,
  GIFT_NAME_MAX,
  GIFT_SENDER_ADDRESS,
  GIFT_UNIT_PRICE,
  giftPriceLabel,
  giftTotalCents,
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
          Each person gets their own email and their own lifetime access. {giftPriceLabel(GIFT_UNIT_PRICE)} each.
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
          <div>
            <p className="flex items-center gap-2 font-bold text-white">
              <Gift className="h-4 w-4 text-yellow-400" aria-hidden /> All-Access plans, gifted
            </p>
            <p className="mt-0.5 text-sm text-stone-400">
              {quantity} × {giftPriceLabel(GIFT_UNIT_PRICE)} · lifetime access for each person
            </p>
          </div>
          <p className="text-2xl font-extrabold tabular-nums text-white">{giftPriceLabel(total)}</p>
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
