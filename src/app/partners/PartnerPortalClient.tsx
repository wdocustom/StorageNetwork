"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy, CreditCard, Loader2, LogOut, Mail, Send } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { connectPartnerStripe, sendClientReferral, type PartnerPortalData, type PartnerProgram, type PartnerReferral } from "@/app/actions/partner-portal";
import { STATUS_LABEL } from "@/lib/referral-partners";

// ═══════════════════════════════════════════════════════════════════════════
// Partner dashboard: Stripe payouts, then one block per installer they refer
// for — link, earnings, an "email a client" form, and every referral with
// whether the deposit is confirmed and whether their cut is paid.
// ═══════════════════════════════════════════════════════════════════════════

const money = (c: number) => `$${(c / 100).toFixed(2).replace(/\.00$/, "")}`;
const INPUT = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400";

export default function PartnerPortalClient({ data, stripeReturn }: { data: PartnerPortalData; stripeReturn: boolean }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Image src={siteConfig.logoPath} alt={siteConfig.name} width={120} height={48} className="h-9 w-auto object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{data.name}</p>
            <p className="truncate text-[11px] text-stone-500">Partner dashboard · {data.email}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await getSupabaseBrowserClient().auth.signOut();
              router.replace("/partners/login");
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-stone-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <StripeCard stripe={data.stripe} justReturned={stripeReturn} />
        {data.programs.map((p) => (
          <Program key={p.partnerId} program={p} multiple={data.programs.length > 1} />
        ))}
      </main>
    </div>
  );
}

function StripeCard({ stripe, justReturned }: { stripe: PartnerPortalData["stripe"]; justReturned: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (stripe.ready) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-stone-300">
          <strong className="text-white">Stripe connected.</strong> Your cut is sent to your bank when a referred customer&apos;s deposit is paid.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{stripe.connected ? "Finish your Stripe setup" : "Connect Stripe to get paid"}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-400">
            {justReturned && stripe.connected
              ? "Stripe is still checking your details. This page updates once they're done, and anything you've earned is sent then."
              : "Takes a few minutes. Anything you've already earned is sent as soon as it's done."}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await connectPartnerStripe();
            if (res.ok) window.location.href = res.url;
            else setError(res.error);
          })
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {stripe.connected ? "Continue on Stripe" : "Connect Stripe"}
      </button>
    </div>
  );
}

function Program({ program: p, multiple }: { program: PartnerProgram; multiple: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="space-y-4">
      {multiple && <h2 className="px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">{p.installerName}</h2>}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-stone-400">
          You refer customers to <strong className="text-white">{p.installerName}</strong> and earn <strong className="text-yellow-300">{p.cutText}</strong>
          {p.discountText ? <>. Your customers get <strong className="text-white">{p.discountText}</strong>.</> : "."}
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-stone-300">{p.link}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(p.link).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-950"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-stone-600">
          Customers can also type <span className="font-mono text-stone-400">{p.code}</span> at checkout.
        </p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 text-center">
          <Stat label="Referrals" value={String(p.referrals.length)} />
          <Stat label="Earned" value={money(p.earnedCents)} />
          <Stat label="Paid to you" value={money(p.paidCents)} />
        </div>
      </div>

      <EmailClient program={p} />

      <div className="rounded-2xl border border-slate-800 bg-slate-900">
        <p className="border-b border-slate-800 px-5 py-3 text-sm font-bold text-white">Your referrals</p>
        {p.referrals.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-stone-500">No referrals yet. Share your link, or email it to a client above.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {p.referrals.map((r) => (
              <ReferralRow key={r.leadId} r={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ReferralRow({ r }: { r: PartnerReferral }) {
  const label = r.commissionStatus ? STATUS_LABEL[r.commissionStatus] : null;
  const tone = label?.tone ?? "stone";
  const pill = {
    amber: "bg-amber-400/15 text-amber-300",
    blue: "bg-sky-400/15 text-sky-300",
    green: "bg-emerald-400/15 text-emerald-300",
    stone: "bg-slate-800 text-stone-400",
  }[tone];
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{r.customer}</p>
        <p className="text-[11px] text-stone-500">
          {new Date(r.createdAt).toLocaleDateString()} · {r.depositPaid ? "Deposit confirmed" : "Booking in progress"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white">{r.cutCents ? money(r.cutCents) : "—"}</p>
        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${pill}`}>{label ? label.partner : "Pending deposit"}</span>
      </div>
    </li>
  );
}

function EmailClient({ program: p }: { program: PartnerProgram }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = () =>
    start(async () => {
      setMsg(null);
      const res = await sendClientReferral({ partnerId: p.partnerId, email, name, note });
      if (!res.ok) return setMsg({ text: res.error, ok: false });
      setMsg({ text: `Sent to ${email}.`, ok: true });
      setEmail("");
      setName("");
      setNote("");
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-yellow-400" />
        <p className="text-sm font-bold text-white">Email your link to a client</p>
      </div>
      <p className="mt-1 text-[12px] text-stone-500">
        We send it from &ldquo;your name via Storage Network&rdquo; with your link{p.discountText ? ` and their ${p.discountText}` : ""}. Replies come to you.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={INPUT} type="email" placeholder="Client's email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={INPUT} placeholder="First name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <textarea
        className={`${INPUT} mt-2 min-h-[72px]`}
        placeholder="A personal note (optional): &ldquo;Congrats on the new place! These folks did great work for us.&rdquo;"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={600}
      />
      {msg && <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <button
        type="button"
        disabled={pending || !email.trim()}
        onClick={send}
        className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
      </button>
      {p.recentEmails.length > 0 && (
        <details className="mt-3 text-xs text-stone-500">
          <summary className="cursor-pointer font-semibold hover:text-white">Sent recently ({p.recentEmails.length})</summary>
          <ul className="mt-2 space-y-1">
            {p.recentEmails.map((e) => (
              <li key={`${e.email}-${e.sentAt}`}>
                {e.name ? `${e.name} · ` : ""}
                {e.email} · {new Date(e.sentAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <p className="text-base font-black text-white">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
    </div>
  );
}
