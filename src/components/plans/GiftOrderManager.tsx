"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /plans/gift/sent: the gifter's page after paying (and from their receipt)
//
// Shows each recipient's delivery live, and gives the gifter the tools to
// make sure every gift lands: a ready-to-send heads-up text, per-person
// copy / share link, resend (throttled), and fix-a-typo before it's opened.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Gift,
  Loader2,
  Mail,
  MessageSquareText,
  Pencil,
  RotateCw,
  Share2,
  X,
} from "lucide-react";
import { fixGiftEmail, loadGiftOrder, resendGiftEmail } from "@/app/actions/plan-gifts";
import { CONTACT_EMAIL } from "@/lib/plan-library";
import { GIFT_DRAFT_KEY } from "@/components/plans/GiftPlansForm";
import {
  GIFT_SENDER_ADDRESS,
  firstNameOf,
  giftPriceLabel,
  normalizeEmail,
  suggestEmailFix,
  type GiftOrderView,
  type GiftRecipientView,
} from "@/lib/plan-gifts";

const POLL_MS = 2500;
const MAX_POLLS = 24;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older in-app browsers: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function headsUpText(): string {
  return `I got you DIY tote rack plans! Look for an email from ${GIFT_SENDER_ADDRESS} (check spam or Promotions if you don't see it).`;
}

function personalText(r: GiftRecipientView, gifterName: string): string {
  const hi = firstNameOf(r.name) ? `Hi ${firstNameOf(r.name)}! ` : "";
  return `${hi}I got you DIY tote rack plans. Open your gift here: ${r.giftUrl}  (${firstNameOf(gifterName) || gifterName})`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusPill({ r }: { r: GiftRecipientView }) {
  if (r.openedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
        <Eye className="h-3.5 w-3.5" aria-hidden /> Opened
      </span>
    );
  }
  if (r.status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Emailed
      </span>
    );
  }
  if (r.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-300">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Not sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-bold text-stone-300">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Sending
    </span>
  );
}

function RecipientCard({
  r,
  view,
  manageToken,
  onView,
}: {
  r: GiftRecipientView;
  view: GiftOrderView;
  manageToken: string;
  onView: (v: GiftOrderView) => void;
}) {
  const [busy, setBusy] = useState<"resend" | "fix" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(r.email);
  const [cooldown, setCooldown] = useState(r.resendInSeconds);
  // Read after mount: the server render has no navigator.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  useEffect(() => setCooldown(r.resendInSeconds), [r.resendInSeconds]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => {
    if (!editing) setEmail(r.email);
  }, [r.email, editing]);

  async function resend() {
    setBusy("resend");
    setNote(null);
    const res = await resendGiftEmail(manageToken, r.id).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
    setBusy(null);
    if (res.ok) {
      onView(res.view);
      setNote({ ok: true, text: `Sent again to ${r.email}.` });
    } else setNote({ ok: false, text: res.error });
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("fix");
    setNote(null);
    const res = await fixGiftEmail(manageToken, r.id, email).catch(() => ({
      ok: false as const,
      error: "Check your connection and try again.",
    }));
    setBusy(null);
    if (res.ok) {
      onView(res.view);
      setEditing(false);
      setNote({ ok: true, text: `Updated. The gift was emailed to ${normalizeEmail(email)}, and the old link no longer works.` });
    } else setNote({ ok: false, text: res.error });
  }

  async function copyLink() {
    if (!r.giftUrl) return;
    const ok = await copyText(r.giftUrl);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
    else setNote({ ok: false, text: "Couldn't copy. Press and hold the link to copy it." });
  }

  async function share() {
    if (!r.giftUrl) return;
    try {
      await navigator.share({ title: "Your DIY tote rack plans", text: personalText(r, view.gifterName) });
    } catch {
      /* closed the share sheet */
    }
  }

  const fix = suggestEmailFix(normalizeEmail(email));

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{r.name}</p>
          <p className="truncate text-sm text-stone-400">{r.email}</p>
          {r.openedAt ? (
            <p className="mt-0.5 text-xs text-stone-500">Opened {timeAgo(r.openedAt)}</p>
          ) : r.sentAt ? (
            <p className="mt-0.5 text-xs text-stone-500">Emailed {timeAgo(r.sentAt)}</p>
          ) : null}
        </div>
        <StatusPill r={r} />
      </div>

      {r.error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {r.error}
        </p>
      )}

      {editing ? (
        <form onSubmit={saveEmail} className="mt-4 space-y-2">
          <label htmlFor={`fix-${r.id}`} className="block text-sm font-semibold text-stone-300">
            Correct email for {firstNameOf(r.name) || r.name}
          </label>
          <input
            id={`fix-${r.id}`}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-base text-white outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
          />
          {fix && (
            <p className="text-sm text-amber-300">
              Did you mean <span className="font-semibold">{fix}</span>?{" "}
              <button type="button" onClick={() => setEmail(fix)} className="font-bold text-yellow-400 underline underline-offset-2">
                Use it
              </button>
            </p>
          )}
          <p className="text-xs text-stone-500">We&apos;ll email the gift to this address. The link sent to the old one stops working.</p>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy === "fix" || !email.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
            >
              {busy === "fix" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              Save and send
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNote(null);
              }}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-stone-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.giftUrl && (
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:bg-slate-800"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy their link"}
            </button>
          )}
          {r.giftUrl && canShare && (
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:bg-slate-800"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Text it
            </button>
          )}
          {r.canResend && (
            <button
              type="button"
              onClick={resend}
              disabled={busy === "resend" || cooldown > 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === "resend" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCw className="h-4 w-4" aria-hidden />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
          )}
          {r.canCorrectEmail && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setNote(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-stone-200 transition hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" aria-hidden /> Fix email
            </button>
          )}
        </div>
      )}

      {note && (
        <p
          role="status"
          className={`mt-3 flex items-start gap-2 text-sm ${note.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {note.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {note.text}
        </p>
      )}
    </li>
  );
}

export default function GiftOrderManager({ sessionId, manageToken: initialToken }: { sessionId?: string; manageToken?: string }) {
  const router = useRouter();
  const [view, setView] = useState<GiftOrderView | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(initialToken ?? null);
  const [error, setError] = useState<{ text: string; pending?: boolean } | null>(null);
  const [copiedHeadsUp, setCopiedHeadsUp] = useState(false);
  const polls = useRef(0);

  const load = useCallback(async () => {
    const res = await loadGiftOrder(manageToken ? { manageToken } : { sessionId }).catch(() => ({
      ok: false as const,
      error: "Check your connection and refresh the page.",
      pending: true,
    }));
    if (res.ok) {
      setView(res.view);
      setError(null);
      if (!manageToken) {
        setManageToken(res.manageToken);
        // Swap the one-time session id for the permanent link, so a reload
        // or bookmark keeps working.
        router.replace(`/plans/gift/sent?order=${res.manageToken}`, { scroll: false });
      }
      try {
        sessionStorage.removeItem(GIFT_DRAFT_KEY);
      } catch {
        /* nothing saved */
      }
    } else {
      setError({ text: res.error, pending: "pending" in res ? res.pending : false });
    }
    return res;
  }, [manageToken, sessionId, router]);

  useEffect(() => {
    if (!sessionId && !manageToken) {
      setError({ text: "This page needs the link from your receipt email." });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep checking while payment confirms or emails are going out.
  const busy = !!(error?.pending || view?.recipients.some((r) => r.status === "sending" || r.status === "preparing"));
  useEffect(() => {
    if (!busy || polls.current >= MAX_POLLS) return;
    const t = setTimeout(() => {
      polls.current += 1;
      load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [busy, view, error, load]);

  if (!view) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        {error && !error.pending ? (
          <>
            <AlertCircle className="h-10 w-10 text-red-400" aria-hidden />
            <p className="mt-4 max-w-sm text-base text-stone-300">{error.text}</p>
            <p className="mt-4 text-sm text-stone-500">
              Paid and still stuck? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-stone-300 hover:text-yellow-400">
                {CONTACT_EMAIL}
              </a>
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" aria-hidden />
            <p className="mt-4 text-base text-stone-300">{error?.text ?? "Sending your gifts…"}</p>
          </>
        )}
      </div>
    );
  }

  const count = view.recipients.length;
  const failed = view.recipients.filter((r) => r.status === "failed").length;
  const sending = view.recipients.filter((r) => r.status === "sending" || r.status === "preparing").length;

  return (
    <div className="space-y-10">
      {/* ── Done ────────────────────────────────────────────────── */}
      <section className="pt-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/15">
          <Gift className="h-7 w-7 text-yellow-400" aria-hidden />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
          {sending ? "Sending your gifts…" : count === 1 ? "Your gift is on the way" : `${count} gifts on the way`}
        </h1>
        <p className="mt-2 text-[15px] text-stone-400">
          Thank you, {firstNameOf(view.gifterName) || view.gifterName}. Order {view.orderRef} · {giftPriceLabel(view.amountCents)}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {view.receiptSent ? <>Receipt sent to {view.gifterEmail}</> : <>Your receipt is on its way to {view.gifterEmail}</>}
        </p>
      </section>

      {failed > 0 && (
        <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-[15px] text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>
            {failed === 1 ? "One email" : `${failed} emails`} didn&apos;t go out. Check the address and resend, or copy their link and
            text it to them.
          </span>
        </p>
      )}

      {/* ── Make sure it lands ──────────────────────────────────── */}
      <section className="rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.06] p-5">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-white">
          <MessageSquareText className="h-4 w-4 text-yellow-400" aria-hidden /> Make sure {count === 1 ? "it lands" : "they land"}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-300">
          {count === 1 ? "They aren't" : "Nobody's"} expecting an email from us, so it can end up in spam or Promotions, or just go
          unread. Send a quick heads-up now, and{" "}
          <strong className="text-white">follow up in a day or two</strong> if you haven&apos;t heard back.
        </p>
        <div className="mt-4 rounded-xl bg-slate-950/80 p-3.5 text-[15px] leading-relaxed text-stone-200">“{headsUpText()}”</div>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyText(headsUpText());
            setCopiedHeadsUp(ok);
            if (ok) setTimeout(() => setCopiedHeadsUp(false), 2000);
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300"
        >
          {copiedHeadsUp ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copiedHeadsUp ? "Copied" : "Copy heads-up text"}
        </button>
        <p className="mt-4 text-sm leading-relaxed text-stone-400">
          Fastest of all: copy someone&apos;s link below and text it to them directly. Please don&apos;t open their link
          yourself. The first phone or computer to open it is remembered as theirs, and any other device will need a code
          from their inbox.
        </p>
      </section>

      {/* ── Each person ─────────────────────────────────────────── */}
      <section aria-labelledby="gift-recipients">
        <h2 id="gift-recipients" className="text-lg font-extrabold tracking-tight text-white">
          {count === 1 ? "Your gift" : `Your ${count} gifts`}
        </h2>
        <ul className="mt-4 space-y-3">
          {manageToken &&
            view.recipients.map((r) => (
              <RecipientCard key={r.id} r={r} view={view} manageToken={manageToken} onView={setView} />
            ))}
        </ul>
        <p className="mt-4 text-sm text-stone-500">
          &ldquo;Opened&rdquo; means their gift page was opened in a browser. Status updates when you reload this page.
        </p>
      </section>

      {/* ── Keep this page ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm leading-relaxed text-stone-400">
        <p>
          <strong className="text-stone-200">Coming back later?</strong> Use &ldquo;Manage my gifts&rdquo; in your receipt email,
          or bookmark this page.
        </p>
        <p className="mt-3">
          Digital plans are delivered instantly, so all sales are final. If an email bounced or went to the wrong person, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-stone-200 hover:text-yellow-400">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll help get the gift to the right inbox.
        </p>
      </section>

      <div className="flex flex-col items-center gap-3 pb-6 text-sm">
        <Link href="/plans/gift" className="font-bold text-yellow-400 hover:text-yellow-300">
          Send another gift
        </Link>
        <Link href="/plans" className="text-stone-500 hover:text-stone-300">
          Back to plans
        </Link>
      </div>
    </div>
  );
}
