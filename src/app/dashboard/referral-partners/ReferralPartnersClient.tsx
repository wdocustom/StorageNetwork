"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, KeyRound, Loader2, Pencil, Plus, Send, Users, X } from "lucide-react";
import { useCurrency } from "@/components/currency/CurrencyContext";
import {
  createReferralPartner,
  markCommissionPaid,
  resendPartnerInvite,
  setPartnerPortal,
  updateReferralPartner,
  type ReferralPartnerView,
} from "@/app/actions/referral-partners";
import { describeCut, describeDiscount, STATUS_LABEL, type CutType, type PartnerDiscountType } from "@/lib/referral-partners";

// ═══════════════════════════════════════════════════════════════════════════
// Referral partners — installer screen. A partner can be as slim as a name
// and a cut (you share the link yourself and pay them directly), or get
// portal access: their own login to track referrals, email clients and
// connect Stripe so their cut is paid out of the deposit automatically.
// ═══════════════════════════════════════════════════════════════════════════

const INPUT =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400";
const LABEL = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500";

interface Terms {
  name: string;
  email: string;
  cutType: CutType;
  cutValue: string;
  discountType: PartnerDiscountType | "none";
  discountValue: string;
  portalEnabled: boolean;
}

const EMPTY: Terms = { name: "", email: "", cutType: "percent", cutValue: "10", discountType: "none", discountValue: "", portalEnabled: false };

export default function ReferralPartnersClient({ initialPartners }: { initialPartners: ReferralPartnerView[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(initialPartners.length === 0);
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <HowItWorks />
      {adding ? (
        <PartnerForm
          mode="create"
          initial={EMPTY}
          onCancel={initialPartners.length ? () => setAdding(false) : undefined}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-yellow-400/40 py-4 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/5"
        >
          <Plus className="h-4 w-4" /> Add a partner
        </button>
      )}
      {initialPartners.map((p) => (
        <PartnerCard key={p.id} partner={p} onChanged={refresh} />
      ))}
    </div>
  );
}

function HowItWorks() {
  return (
    <details className="group rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-stone-400">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-white">
        <Users className="h-4 w-4 text-yellow-400" /> How referral partners work
        <ChevronDown className="ml-auto h-4 w-4 text-stone-500 transition group-open:rotate-180" />
      </summary>
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed">
        <li>• Each partner gets a link. Customers who use it land on your page with the partner&apos;s discount already applied, and the booking is counted as your own lead (3% platform fee).</li>
        <li>• When the customer&apos;s deposit is paid, the partner earns their cut of the job total after the discount.</li>
        <li>• <strong className="text-stone-200">Without portal access</strong>, you pay the partner yourself. Their cut shows here as owed until you tap Mark paid.</li>
        <li>• <strong className="text-stone-200">With portal access</strong>, the partner gets a login to see their referrals and email clients. Once they connect Stripe, their cut comes out of the deposit and is sent to them automatically. If it doesn&apos;t fit in the deposit, or the customer pays you in cash, it shows as owed instead.</li>
      </ul>
    </details>
  );
}

function PartnerForm({
  mode,
  initial,
  partnerId,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: Terms;
  partnerId?: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [t, setT] = useState<Terms>(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { symbol } = useCurrency();
  const set = <K extends keyof Terms>(k: K, v: Terms[K]) => setT((x) => ({ ...x, [k]: v }));

  const submit = () =>
    start(async () => {
      setError(null);
      const payload = {
        name: t.name,
        email: t.email || null,
        cutType: t.cutType,
        cutValue: Number(t.cutValue) || 0,
        discountType: t.discountType === "none" ? null : t.discountType,
        discountValue: t.discountType === "none" ? null : Number(t.discountValue) || 0,
      };
      if (mode === "create") {
        const res = await createReferralPartner({ ...payload, portalEnabled: t.portalEnabled });
        if (!res.ok) return setError(res.error);
        if (res.inviteError) {
          setNotice(`Partner added, but the portal invite didn't go out: ${res.inviteError}`);
          setTimeout(onSaved, 2500);
          return;
        }
        onSaved();
      } else if (partnerId) {
        const res = await updateReferralPartner(partnerId, payload);
        if (!res.ok) return setError(res.error);
        onSaved();
      }
    });

  return (
    <div className="space-y-3 rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
      <p className="text-sm font-bold text-white">{mode === "create" ? "New referral partner" : "Edit partner"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Partner name</label>
          <input className={INPUT} value={t.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Moving Co." maxLength={120} />
        </div>
        <div>
          <label className={LABEL}>Email {t.portalEnabled ? "(needed for their login)" : "(optional)"}</label>
          <input className={INPUT} type="email" value={t.email} onChange={(e) => set("email", e.target.value)} placeholder="owner@acmemoving.com" />
        </div>
      </div>

      <div>
        <label className={LABEL}>Their cut of each job</label>
        <div className="flex gap-2">
          <Segmented
            value={t.cutType}
            options={[
              ["percent", "%"],
              ["flat", symbol],
            ]}
            onChange={(v) => set("cutType", v as CutType)}
          />
          <input className={`${INPUT} max-w-[8rem]`} inputMode="decimal" value={t.cutValue} onChange={(e) => set("cutValue", e.target.value)} />
          <p className="self-center text-xs text-stone-500">{t.cutType === "percent" ? "of the job total" : "per booked job"}</p>
        </div>
      </div>

      <div>
        <label className={LABEL}>Discount for their customers</label>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={t.discountType}
            options={[
              ["none", "None"],
              ["percent", "% off"],
              ["fixed", `${symbol} off`],
            ]}
            onChange={(v) => set("discountType", v as Terms["discountType"])}
          />
          {t.discountType !== "none" && (
            <input className={`${INPUT} max-w-[8rem]`} inputMode="decimal" value={t.discountValue} onChange={(e) => set("discountValue", e.target.value)} placeholder={t.discountType === "percent" ? "10" : "50"} />
          )}
        </div>
        <p className="mt-1 text-[11px] text-stone-600">Comes off the balance, like your other discount codes. You cover it.</p>
      </div>

      {mode === "create" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-yellow-400" checked={t.portalEnabled} onChange={(e) => set("portalEnabled", e.target.checked)} />
          <span className="text-[13px] leading-relaxed text-stone-400">
            <strong className="text-white">Give them portal access.</strong> We&apos;ll create their login and email them a link to set a password. They can track referrals, email clients and connect Stripe for automatic payouts. You can turn this on later.
          </span>
        </label>
      )}

      {error && <p className="text-xs font-medium text-red-400">{error}</p>}
      {notice && <p className="text-xs font-medium text-amber-300">{notice}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !t.name.trim()}
          className="flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {mode === "create" ? "Add partner" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-stone-500 hover:text-white">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${value === v ? "bg-yellow-400 text-slate-950" : "text-stone-400 hover:text-white"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PartnerCard({ partner: p, onChanged }: { partner: ReferralPartnerView; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [pending, start] = useTransition();
  const { symbol } = useCurrency();
  const money = (c: number) => `${symbol}${(c / 100).toFixed(2).replace(/\.00$/, "")}`;
  const discount = describeDiscount(p.discountType, p.discountValue);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) setMsg({ text: res.error ?? "Something went wrong.", tone: "err" });
      else {
        if (okText) setMsg({ text: okText, tone: "ok" });
        onChanged();
      }
    });

  if (editing) {
    return (
      <PartnerForm
        mode="edit"
        partnerId={p.id}
        initial={{
          name: p.name,
          email: p.email ?? "",
          cutType: p.cutType,
          cutValue: String(p.cutValue),
          discountType: p.discountType ?? "none",
          discountValue: p.discountValue ? String(p.discountValue) : "",
          portalEnabled: p.portalEnabled,
        }}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className={`rounded-2xl border bg-slate-900 p-5 ${p.active ? "border-slate-800" : "border-slate-800/60 opacity-70"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-black text-white">{p.name}</p>
            {!p.active && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-400">Off</span>}
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {describeCut(p.cutType, p.cutValue)}
            {discount ? ` · customers get ${discount}` : " · no customer discount"}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg p-2 text-stone-500 hover:bg-slate-800 hover:text-white" aria-label="Edit partner">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Link */}
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
        Or they can type <span className="font-mono text-stone-400">{p.code}</span> at checkout.
      </p>

      {/* Numbers */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 text-center">
        <Stat label="Referred" value={String(p.referred)} />
        <Stat label="You owe" value={money(p.owedCents)} tone={p.owedCents ? "text-amber-300" : undefined} />
        <Stat label="Paid out" value={money(p.paidCents)} hint={p.heldCents ? `+${money(p.heldCents)} waiting on their Stripe` : undefined} />
      </div>

      {/* Portal */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 p-3">
        <KeyRound className="h-4 w-4 shrink-0 text-yellow-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Portal access</p>
          <p className="text-[11px] text-stone-500">
            {p.portalEnabled
              ? `On${p.portalInvitedAt ? ` · invite sent ${new Date(p.portalInvitedAt).toLocaleDateString()}` : ""}${p.email ? ` to ${p.email}` : ""}`
              : "Off · just the link. You pay them directly."}
          </p>
        </div>
        {p.portalEnabled && (
          <button type="button" disabled={pending} onClick={() => act(() => resendPartnerInvite(p.id), "Invite sent.")} className="flex items-center gap-1 text-[11px] font-bold text-stone-400 hover:text-white">
            <Send className="h-3.5 w-3.5" /> Resend invite
          </button>
        )}
        <Toggle
          on={p.portalEnabled}
          disabled={pending}
          onChange={(on) =>
            act(
              () => setPartnerPortal(p.id, on),
              on ? `Portal on. We emailed ${p.email ?? "them"} a link to get in.` : "Portal off.",
            )
          }
        />
      </div>
      {msg && <p className={`mt-2 text-xs font-medium ${msg.tone === "err" ? "text-red-400" : "text-emerald-400"}`}>{msg.text}</p>}

      {/* Jobs */}
      {p.commissions.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowJobs((s) => !s)} className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-white">
            <ChevronDown className={`h-4 w-4 transition ${showJobs ? "rotate-180" : ""}`} />
            {p.commissions.length} confirmed {p.commissions.length === 1 ? "referral" : "referrals"}
          </button>
          {showJobs && (
            <ul className="mt-2 divide-y divide-slate-800 rounded-xl border border-slate-800">
              {p.commissions.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{c.customer}</p>
                    <p className="text-[11px] text-stone-500">
                      {new Date(c.createdAt).toLocaleDateString()} · {STATUS_LABEL[c.status].installer}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-white">{money(c.amountCents)}</p>
                  {c.status === "owed" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => act(() => markCommissionPaid(c.id))}
                      className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700"
                    >
                      Mark paid
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => updateReferralPartner(p.id, { active: !p.active }), p.active ? "Link switched off." : "Link switched on.")}
          className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-white"
        >
          {p.active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {p.active ? "Switch link off" : "Switch link on"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="px-2 py-3">
      <p className={`text-base font-black ${tone ?? "text-white"}`}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-sky-300">{hint}</p>}
    </div>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Portal access"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-yellow-400" : "bg-slate-700"} disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
