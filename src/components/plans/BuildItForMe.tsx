"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BUILD IT FOR ME — the plans designer's way back to an installer
//
// Referred customers (installer link → ?ref / cookie) go straight back to
// that installer with this exact build priced. Everyone else enters a ZIP:
// local installer → price → request; no installer → waitlist, and a nudge
// back to the DIY plans. Requesting creates the lead on the server and
// opens the installer's quote page (address + deposit), the normal flow.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle, Hammer, Loader2, MapPin, X } from "lucide-react";
import {
  findPlanBuilder,
  joinPlanBuildWaitlist,
  quotePlanBuild,
  requestPlanBuild,
  type PlanBuilder,
  type PlanBuildQuoteView,
} from "@/app/actions/plan-build-request";
import SystemMap from "@/components/plans/SystemMap";
import { encodeTotePlanDesign, type TotePlanDesign } from "@/lib/tote-plans";

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

type Step =
  | { kind: "loading" }
  | { kind: "zip"; error?: string }
  | { kind: "builder"; builder: PlanBuilder; zip: string | null }
  | { kind: "none"; zip: string }
  | { kind: "waitlisted"; zip: string }
  | { kind: "sent"; builder: PlanBuilder };

const input =
  "min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400";

/** The card in the designer: a lean nudge that opens the sheet. */
export default function BuildItForMe({
  design,
  referral,
  onBackToPlans,
}: {
  design: TotePlanDesign;
  referral: string | null;
  onBackToPlans: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [builderName, setBuilderName] = useState<string | null>(null);

  // A referred customer sees their installer's name on the card
  useEffect(() => {
    if (!referral) return;
    findPlanBuilder({ ref: referral })
      .then((r) => r.status === "found" && r.builder.referred && setBuilderName(r.builder.name))
      .catch(() => {});
  }, [referral]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-yellow-400/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          <Hammer className="h-5 w-5 text-yellow-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Rather have it built for you?</p>
          <p className="text-[11px] text-stone-400">
            {builderName ? `Get ${builderName}'s price for this exact build` : "See a local pro's price for this exact build"}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-stone-500 transition group-hover:translate-x-0.5 group-hover:text-yellow-400" aria-hidden />
      </button>
      {open && <BuildSheet design={design} referral={referral} onClose={() => setOpen(false)} onBackToPlans={onBackToPlans} />}
    </>
  );
}

function BuildSheet({
  design,
  referral,
  onClose,
  onBackToPlans,
}: {
  design: TotePlanDesign;
  referral: string | null;
  onClose: () => void;
  onBackToPlans: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [zip, setZip] = useState("");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    findPlanBuilder({ ref: referral })
      .then((r) =>
        setStep(r.status === "found" ? { kind: "builder", builder: r.builder, zip: r.zip } : r.status === "none" ? { kind: "none", zip: r.zip } : { kind: "zip" }),
      )
      .catch(() => setStep({ kind: "zip" }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [referral]);

  const checkZip = async () => {
    if (!/^\d{5}$/.test(zip.trim())) {
      setStep({ kind: "zip", error: "Enter a 5-digit ZIP code." });
      return;
    }
    setStep({ kind: "loading" });
    try {
      const r = await findPlanBuilder({ ref: referral, zip: zip.trim() });
      setStep(r.status === "found" ? { kind: "builder", builder: r.builder, zip: r.zip } : r.status === "none" ? { kind: "none", zip: r.zip } : { kind: "zip" });
    } catch {
      setStep({ kind: "zip", error: "We couldn't check that ZIP just now. Please try again." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Have it built"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-black text-white">
            <Hammer className="h-4 w-4 text-yellow-400" aria-hidden />
            Have it built
          </p>
          <button type="button" onClick={onClose} autoFocus aria-label="Close" className="rounded-full p-1.5 text-stone-400 transition hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl bg-slate-950/60 p-3">
            <SystemMap design={design} className="h-16 w-full" title="Your build" />
          </div>

          {step.kind === "loading" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
            </div>
          )}

          {step.kind === "zip" && (
            <div>
              <p className="mb-1 text-sm font-bold text-white">Where's it going?</p>
              <p className="mb-3 text-xs text-stone-400">We'll find the installer who covers your area and show their price.</p>
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && checkZip()}
                  placeholder="ZIP code"
                  aria-label="ZIP code"
                  className={input}
                />
                <button
                  type="button"
                  onClick={checkZip}
                  className="shrink-0 rounded-lg bg-yellow-400 px-4 text-sm font-black text-gray-950 transition hover:bg-yellow-300"
                >
                  Find my pro
                </button>
              </div>
              {step.error && <p className="mt-2 text-xs text-red-400">{step.error}</p>}
            </div>
          )}

          {step.kind === "builder" && (
            <BuilderQuote
              design={design}
              builder={step.builder}
              zip={step.zip}
              referral={referral}
              onChangeZip={() => setStep({ kind: "zip" })}
              onSent={(builder) => setStep({ kind: "sent", builder })}
            />
          )}

          {step.kind === "none" && (
            <Waitlist zip={step.zip} onJoined={() => setStep({ kind: "waitlisted", zip: step.zip })} onChangeZip={() => setStep({ kind: "zip" })} />
          )}

          {(step.kind === "waitlisted" || step.kind === "none") && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-3">
              {step.kind === "waitlisted" && (
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                  <CheckCircle className="h-4 w-4" aria-hidden />
                  You're on the list for {step.zip}.
                </p>
              )}
              <p className="mb-3 text-xs text-stone-300">
                Don't want to wait? Build it yourself this weekend with plans made for exactly this design.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBackToPlans();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-sm font-black uppercase tracking-wider text-gray-950"
              >
                Get the DIY plans
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {step.kind === "sent" && (
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" aria-hidden />
              <p className="text-sm font-bold text-white">Request sent to {step.builder.name}</p>
              <p className="mt-1 text-xs text-stone-400">
                They're booked up right now — you're on their list, and we've emailed you a copy of your build.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BuilderQuote({
  design,
  builder,
  zip: knownZip,
  referral,
  onChangeZip,
  onSent,
}: {
  design: TotePlanDesign;
  builder: PlanBuilder;
  zip: string | null;
  referral: string | null;
  onChangeZip: () => void;
  onSent: (builder: PlanBuilder) => void;
}) {
  const [totes, setTotes] = useState(false);
  const [quote, setQuote] = useState<PlanBuildQuoteView | null | "error">(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", zip: knownZip ?? "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const key = encodeTotePlanDesign(design);

  useEffect(() => {
    setQuote(null);
    quotePlanBuild({ design, installerId: builder.id, includeTotes: totes })
      .then((q) => setQuote(q ?? "error"))
      .catch(() => setQuote("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, builder.id, totes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    const r = await requestPlanBuild({
      design,
      installerId: builder.id,
      zip: form.zip,
      includeTotes: totes,
      name: form.name,
      email: form.email,
      phone: form.phone,
      ref: referral,
    }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    if (!r.ok) {
      setError(r.error);
      setSending(false);
      return;
    }
    if (r.waitlisted) onSent(builder);
    else window.location.href = `/pay/${r.leadId}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {builder.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={builder.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg font-black text-yellow-400">
            {builder.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{builder.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-stone-400">
            {builder.referred ? (
              <>
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                Your installer
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 text-yellow-400" aria-hidden />
                Local pro{knownZip ? ` for ${knownZip}` : ""}
              </>
            )}
            {builder.completedJobs > 0 && ` · ${builder.completedJobs} builds`}
          </p>
        </div>
        <button type="button" onClick={onChangeZip} className="shrink-0 text-[11px] font-semibold text-stone-500 hover:text-stone-300">
          {builder.referred ? "Different area?" : "Change ZIP"}
        </button>
      </div>

      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">Built &amp; installed</p>
        {quote === null ? (
          <Loader2 className="my-2 h-5 w-5 animate-spin text-yellow-400" />
        ) : quote === "error" ? (
          <p className="text-sm text-stone-300">We couldn't price this build — you can still send it and they'll quote it.</p>
        ) : (
          <>
            <p className="text-3xl font-black text-white">{money(quote.total)}</p>
            <p className="text-[11px] text-stone-400">
              {quote.lines.length} unit{quote.lines.length === 1 ? "" : "s"} · {quote.totes ? "totes included" : "your totes"} · delivered and installed
            </p>
          </>
        )}
        {builder.totesAvailable && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-stone-300">
            <input type="checkbox" checked={totes} onChange={(e) => setTotes(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
            Include totes
          </label>
        )}
      </div>

      <form onSubmit={submit} className="space-y-2">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" aria-label="Your name" autoComplete="name" className={input} />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" aria-label="Email" autoComplete="email" className={input} />
        <div className="flex gap-2">
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" aria-label="Phone" autoComplete="tel" className={input} />
          <input
            required
            inputMode="numeric"
            maxLength={5}
            value={form.zip}
            onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, "") })}
            placeholder="ZIP"
            aria-label="ZIP code"
            autoComplete="postal-code"
            className={`${input} max-w-[6.5rem]`}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {sending ? "Sending…" : `Book ${builder.referred ? builder.name : "this pro"}`}
        </button>
        <p className="text-center text-[10px] text-stone-600">Next: your address and a small deposit to lock in the build.</p>
      </form>
    </div>
  );
}

function Waitlist({ zip, onJoined, onChangeZip }: { zip: string; onJoined: () => void; onChangeZip: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    const r = await joinPlanBuildWaitlist({ zip, name, email }).catch(() => ({ success: false, error: "Something went wrong." }));
    setSending(false);
    if (r.success) onJoined();
    else setError(r.error || "Something went wrong.");
  };

  return (
    <form onSubmit={join} className="space-y-2">
      <p className="text-sm font-bold text-white">No installer in {zip} yet</p>
      <p className="text-xs text-stone-400">
        Join the waitlist and we'll reach out as soon as a pro covers your area.{" "}
        <button type="button" onClick={onChangeZip} className="font-semibold text-stone-300 underline">
          Try another ZIP
        </button>
      </p>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={input} />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className={input} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="submit" disabled={sending} className="w-full rounded-xl border border-slate-600 py-2.5 text-sm font-bold text-white transition hover:border-yellow-400 disabled:opacity-60">
        {sending ? "Joining…" : "Join the waitlist"}
      </button>
    </form>
  );
}
