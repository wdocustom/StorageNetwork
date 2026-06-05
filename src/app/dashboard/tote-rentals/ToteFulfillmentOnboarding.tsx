"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock,
  Loader2,
  MapPin,
  Package,
  Power,
  Truck,
} from "lucide-react";
import Link from "next/link";

import {
  updateToteFulfillmentSettings,
  type ToteFulfillmentOnboarding as Onboarding,
} from "@/app/actions/realtor-gift-fulfillment";
import {
  INSTALLER_FEE_BASE_CENTS,
  INSTALLER_FEE_PER_TOTE_CENTS,
  calcInstallerPayoutCents,
} from "@/lib/realtor-fulfillment-payout";

// ═══════════════════════════════════════════════════════════════════════════
// ToteFulfillmentOnboarding — the pre-opt-in installer experience.
//
// Layout, top to bottom:
//
//   1. Pitch header — three-step explainer of how the program works.
//   2. Payout breakdown — flat-fee math + worked examples.
//   3. Requirements gates — Stripe Connect + service area, each with a
//      pass/fail badge and a "Fix this" link to the relevant settings.
//   4. Opt-in form — stock + capacity inputs. Disabled until all gates pass.
//
// Server-side mirror in updateToteFulfillmentSettings refuses active=true
// when the gates don't pass, so this UI is the friendly version of a
// guard the API enforces anyway.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  readiness: Onboarding;
}

export function ToteFulfillmentOnboarding({ readiness }: Props) {
  const { gates, allGatesPassed } = readiness;

  const [stock, setStock] = useState(String(readiness.stock || 30));
  const [capacity, setCapacity] = useState(String(readiness.capacity || 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setError(null);

    const stockNum = parseInt(stock, 10);
    const capacityNum = parseInt(capacity, 10);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setError("Enter a valid tote stock count.");
      return;
    }
    if (!Number.isFinite(capacityNum) || capacityNum < 1) {
      setError("Capacity must be at least 1.");
      return;
    }

    setSaving(true);
    const result = await updateToteFulfillmentSettings({
      active: true,
      stock: stockNum,
      capacity: capacityNum,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not turn on fulfillment.");
      return;
    }
    // Reload so the page re-renders into the live-state UI. Cheaper and
    // less state-sync work than mounting/unmounting components client-side.
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <PitchHeader />

      <PayoutBreakdown />

      <RequirementsPanel gates={gates} />

      <OptInForm
        stock={stock}
        capacity={capacity}
        onStockChange={setStock}
        onCapacityChange={setCapacity}
        disabled={!allGatesPassed}
        saving={saving}
        error={error}
        onSubmit={activate}
      />
    </div>
  );
}

// ── Section: how it works ──────────────────────────────────────────────────

function PitchHeader() {
  return (
    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 ring-1 ring-yellow-400/40">
          <Truck className="h-5 w-5 text-yellow-400" />
        </div>
        <h2 className="text-lg font-bold">How realtor closing-gift jobs work</h2>
      </div>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-stone-300">
        Realtors send their buyers and sellers a closing gift: a stack of reusable
        moving totes. You deliver them, the recipient packs and moves, and you swing
        back to pick the totes up. We auto-route every gift in your service area to
        you and pay you one flat payout per job, transferred to your Stripe account.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StepCard
          n={1}
          icon={Package}
          title="Deliver"
          body="Drop off 10–50 totes at the recipient's address inside their chosen window."
        />
        <StepCard
          n={2}
          icon={Clock}
          title="Wait"
          body="They pack and move during the 7- or 14-day rental window the realtor picked."
        />
        <StepCard
          n={3}
          icon={Truck}
          title="Pick up"
          body="Swing back for the empty totes. Your inventory auto-refills on pickup."
        />
      </div>
    </div>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-zinc-950">
          {n}
        </span>
        <Icon className="h-4 w-4 text-yellow-300" />
        <p className="text-sm font-bold">{title}</p>
      </div>
      <p className="text-xs leading-relaxed text-stone-400">{body}</p>
    </div>
  );
}

// ── Section: payout breakdown ──────────────────────────────────────────────

function PayoutBreakdown() {
  const base = INSTALLER_FEE_BASE_CENTS / 100;
  const perTote = INSTALLER_FEE_PER_TOTE_CENTS / 100;

  const examples = [10, 20, 30, 50];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 ring-1 ring-emerald-400/40">
          <CircleDollarSign className="h-5 w-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold">What you earn per job</h2>
      </div>

      <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-stone-300">
        <p className="mb-1 font-mono text-xs text-yellow-300">
          payout = ${base.toFixed(0)} base + ${perTote.toFixed(0)} &times; totes
        </p>
        <p className="text-xs text-stone-400">
          One flat payout per gift covering both delivery and pickup. Transferred to
          your connected Stripe account when you mark the gift returned.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950/60 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Gift size</th>
              <th className="px-4 py-2.5 text-right">Payout per gift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {examples.map((n) => {
              const payout = calcInstallerPayoutCents(n) / 100;
              return (
                <tr key={n} className="bg-zinc-950/20">
                  <td className="px-4 py-2.5 font-medium text-stone-300">{n} totes</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-300">
                    ${payout.toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section: requirements gates ────────────────────────────────────────────

function RequirementsPanel({ gates }: { gates: Onboarding["gates"] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-zinc-700">
          <Check className="h-5 w-5 text-stone-300" />
        </div>
        <h2 className="text-lg font-bold">Before you turn it on</h2>
      </div>

      <div className="space-y-3">
        <GateCard
          passed={gates.stripeConnect.passed}
          title="Stripe Connect payouts"
          okBody="Connected and verified. Payouts will land on your account automatically."
          failBody={
            gates.stripeConnect.hasAccount
              ? "Account created but onboarding isn't finished. Complete the Stripe steps so payouts can land."
              : "We pay installers through Stripe Connect. Finish onboarding to enable payouts."
          }
          fixHref="/dashboard/profile#payouts"
          fixLabel={
            gates.stripeConnect.hasAccount ? "Finish Stripe setup" : "Set up Stripe Connect"
          }
        />

        <GateCard
          passed={gates.serviceArea.passed}
          title="Service area"
          okBody={
            <ServiceAreaOk
              homeZip={gates.serviceArea.homeZip!}
              radiusMiles={gates.serviceArea.radiusMiles}
              total={gates.serviceArea.coveredZipCount}
              withinCap={gates.serviceArea.withinRealtorCapCount}
            />
          }
          failBody="Set your home ZIP and service radius on the Profile page. We use the same coverage area you set for regular leads to route closing-gift jobs."
          fixHref="/dashboard/profile#service-area"
          fixLabel="Set service area"
        />
      </div>
    </div>
  );
}

function GateCard({
  passed,
  title,
  okBody,
  failBody,
  fixHref,
  fixLabel,
}: {
  passed: boolean;
  title: string;
  okBody: React.ReactNode;
  failBody: React.ReactNode;
  fixHref: string;
  fixLabel: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        passed
          ? "border-emerald-400/30 bg-emerald-400/5"
          : "border-amber-400/40 bg-amber-400/5"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {passed ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-300" />
        )}
        <p className={`text-sm font-bold ${passed ? "text-emerald-100" : "text-amber-100"}`}>
          {title}
        </p>
      </div>
      <div
        className={`mb-2 pl-6 text-xs leading-relaxed ${
          passed ? "text-emerald-200/80" : "text-amber-200/80"
        }`}
      >
        {passed ? okBody : failBody}
      </div>
      {!passed && (
        <div className="pl-6">
          <Link
            href={fixHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-100 transition-colors hover:bg-amber-400/20"
          >
            {fixLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function ServiceAreaOk({
  homeZip,
  radiusMiles,
  total,
  withinCap,
}: {
  homeZip: string;
  radiusMiles: number | null;
  total: number;
  withinCap: number;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-emerald-300" />
        <span>
          Home base <span className="font-mono font-bold text-white">{homeZip}</span>
          {typeof radiusMiles === "number" && (
            <> &middot; {radiusMiles}-mi radius &middot; {total} ZIPs covered</>
          )}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-emerald-200/60">
        Realtor jobs are capped at 75 mi from your home base.{" "}
        <strong className="text-emerald-100">
          {withinCap} of your {total} ZIPs
        </strong>{" "}
        are within that range.
      </p>
    </>
  );
}

// ── Section: opt-in form ───────────────────────────────────────────────────

function OptInForm({
  stock,
  capacity,
  onStockChange,
  onCapacityChange,
  disabled,
  saving,
  error,
  onSubmit,
}: {
  stock: string;
  capacity: string;
  onStockChange: (v: string) => void;
  onCapacityChange: (v: string) => void;
  disabled: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 sm:p-8 ${
        disabled
          ? "border-zinc-800 bg-zinc-900/30"
          : "border-yellow-400/30 bg-yellow-400/5"
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
            disabled
              ? "bg-zinc-800 ring-zinc-700"
              : "bg-yellow-400/10 ring-yellow-400/40"
          }`}
        >
          <Power className={`h-5 w-5 ${disabled ? "text-stone-500" : "text-yellow-400"}`} />
        </div>
        <h2 className="text-lg font-bold">Turn on tote-rental fulfillment</h2>
      </div>

      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-stone-300">
        Tell us how many 27-gallon totes you have on hand and how many concurrent
        gift jobs you can comfortably run. We&apos;ll route the next closing-gift
        order in your area to you and email you the moment it lands.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="27-gallon totes on hand"
          value={stock}
          onChange={onStockChange}
          help="Starting inventory. We auto-increment this when gifts come back from pickup."
          disabled={disabled}
        />
        <NumberField
          label="Max concurrent gift jobs"
          value={capacity}
          onChange={onCapacityChange}
          help="We won't assign you a new job past this number."
          disabled={disabled}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={disabled || saving}
        className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Turning on&hellip;
          </>
        ) : disabled ? (
          <>Resolve requirements above to turn on</>
        ) : (
          <>Turn on tote-rental fulfillment</>
        )}
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-stone-400">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p className="mt-1 text-[11px] text-stone-500">{help}</p>
    </div>
  );
}
