"use client";

// ═══════════════════════════════════════════════════════════════════════════
// DIY PLANS — design a tote organizer system and buy its plans on one page
//
// Customers size each unit (any size the designer allows — big walls are
// split into 8'-stock modules automatically) against a live 3D preview and
// a module map, with the two plan tiers right underneath.
//
// Arrives pre-filled from every hand-off point:
//   ?design=H2x4t.H2x2t.H2x4t&name=Indiana%20Joe   designer / quote / email
//   ?config={…}                                     legacy single-unit links
//   &utm_source=designer|quote_page|quote_email…    carried to Stripe metadata
//
// Pro subscribers and admins skip Stripe; /plans/build re-verifies them.
// ═══════════════════════════════════════════════════════════════════════════

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Layers, Loader2, Plus, Ruler, Trash2 } from "lucide-react";
import { createDIYPlanCheckout, checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { toFraction } from "@/lib/utils";
import SystemMap from "@/components/plans/SystemMap";
import { Segmented, Stepper } from "@/components/designer/controls";
import PlanRack3D from "@/components/plans/PlanRack3D";
import MaterialCostCard from "@/components/plans/MaterialCostCard";
import BuildItForMe from "@/components/plans/BuildItForMe";
import EmbeddedCheckoutPanel from "@/components/payments/EmbeddedCheckoutPanel";
import { AllAccessOffer, IncludedPlanCard } from "@/components/plans/AllAccessOffer";
import StickyPlanCta from "@/components/plans/StickyPlanCta";
import { checkAllAccess, createIncludedPlan } from "@/app/actions/tote-plan-access";
import { PlanSampleLightbox, PlanSampleThumb } from "@/components/plans/PlanSample";
import { BestsellersButton, BestsellersLightbox } from "@/components/plans/PlanBestsellers";
import { PLAN_REF_COOKIE, cleanReferralId } from "@/lib/plan-splits";
import {
  DEFAULT_TOTE_PLAN_DESIGN,
  DEFAULT_TOTE_PLAN_UNIT,
  TOTE_PLAN_LIMITS,
  designFromSearchParams,
  designModules,
  designOuterSize,
  encodeTotePlanDesign,
  fitTotePlanToWall,
  normalizeBestsellers,
  splitHeight,
  splitWidth,
  totePlanDesignHref,
  TOTE_PLAN_ALL_ACCESS,
  formatPlanPrice,
  totePlanName,
  totePlanSummary,
  type TotePlanDesign,
  type TotePlanTier,
  type TotePlanUnit,
  unitLetter,
} from "@/lib/tote-plans";



// ── Controls ─────────────────────────────────────────────────────────────

function WallFit({
  unit,
  onFit,
}: {
  unit: TotePlanUnit;
  onFit: (size: { cols: number; rows: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [msg, setMsg] = useState("");

  const fit = () => {
    const result = fitTotePlanToWall(Number(w), Number(h), unit);
    if (!result) {
      setMsg("That space is too small for even one tote.");
      return;
    }
    onFit(result);
    setMsg(`Fits ${result.cols} wide × ${result.rows} tall.`);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
      >
        <Ruler className="h-3.5 w-3.5" />
        Not sure? Fit it to my wall
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <div className="mb-2 text-xs text-stone-400">Measure the space you have, in inches.</div>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={w}
          onChange={(e) => setW(e.target.value)}
          placeholder="Width"
          aria-label="Wall width in inches"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
        />
        <input
          inputMode="decimal"
          value={h}
          onChange={(e) => setH(e.target.value)}
          placeholder="Height"
          aria-label="Wall height in inches"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-yellow-400"
        />
        <button
          type="button"
          onClick={fit}
          disabled={!w || !h}
          className="shrink-0 rounded-lg bg-yellow-400 px-4 text-sm font-bold text-gray-950 transition hover:bg-yellow-300 disabled:opacity-50"
        >
          Fit
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-stone-400">{msg}</p>}
    </div>
  );
}

function moduleNote(unit: TotePlanUnit): string | null {
  const widths = splitWidth(unit.cols, unit.sideways);
  const tiers = splitHeight(unit.rows);
  if (widths.length === 1 && tiers.length === 1) return null;
  const parts: string[] = [];
  if (widths.length > 1) parts.push(`${widths.length} modules side by side (${widths.join(" + ")} wide)`);
  if (tiers.length > 1) parts.push(`${tiers.length} stacked tiers (${tiers.join(" + ")} tall)`);
  return `Built as ${parts.join(" and ")} so every part fits an 8' board. Your plan walks you through each module.`;
}

/** This device's All-Access plan link, once the buyer has used it here. */
const MEMBER_KEY = "sn_plan_member";

// ── Page ─────────────────────────────────────────────────────────────────

function PlansDesigner() {
  const searchParams = useSearchParams();
  const [design, setDesign] = useState<TotePlanDesign>(
    () => designFromSearchParams(searchParams) ?? DEFAULT_TOTE_PLAN_DESIGN,
  );
  const [selected, setSelected] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  // Open checkout panel: Stripe's form, embedded in this page.
  const [checkout, setCheckout] = useState<{ clientSecret: string } | null>(null);
  // All-Access owner: their plan link (from ?member= or this device), checked server-side.
  const [member, setMember] = useState<{ token: string; emailHint: string } | null>(null);
  const [memberNote, setMemberNote] = useState<{ text: string; href?: string } | null>(null);
  const [sampleTier, setSampleTier] = useState<TotePlanTier | null>(null);
  const [error, setError] = useState("");
  const [freeAccess, setFreeAccess] = useState<{ hasFreeAccess: boolean; reason?: "pro" | "admin" } | null>(null);
  // Read once: the URL is rewritten as the design changes
  const [cancelled] = useState(() => searchParams.get("cancelled") === "1");
  const [source] = useState(() => searchParams.get("utm_source") ?? undefined);
  // Installer whose link brought the customer here — remembered (no expiry)
  // so they're credited even if the customer buys on a later visit.
  const [ref] = useState(() => cleanReferralId(searchParams.get("ref")));

  useEffect(() => {
    checkDIYPlanAccess().then(setFreeAccess);
  }, []);

  // "Build another plan" links carry the buyer's plan link as ?member=; this
  // device remembers it so the designer keeps showing "included".
  useEffect(() => {
    let token = searchParams.get("member");
    try {
      if (token) localStorage.setItem(MEMBER_KEY, token);
      else token = localStorage.getItem(MEMBER_KEY);
    } catch {
      /* storage blocked */
    }
    if (!token) return;
    const memberToken = token;
    checkAllAccess(memberToken).then((res) => {
      if (res.ok) {
        setMember({ token: memberToken, emailHint: res.emailHint });
      } else if (res.verify) {
        setMemberNote({
          text: "Confirm it's you on this device to use your included plans.",
          href: `/plans/library?token=${res.verify.token}`,
        });
      } else {
        try {
          localStorage.removeItem(MEMBER_KEY);
        } catch {
          /* storage blocked */
        }
      }
    });
    // Read once on load; the URL is rewritten as the design changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browsers cap cookie lifetimes (Chrome: 400 days), so every visit renews
  // the remembered referral; a new installer link replaces it.
  useEffect(() => {
    const saved = cleanReferralId(document.cookie.match(new RegExp(`(?:^|;\\s*)${PLAN_REF_COOKIE}=([^;]*)`))?.[1]);
    const keep = ref ?? saved;
    if (keep) document.cookie = `${PLAN_REF_COOKIE}=${keep};path=/;max-age=${60 * 60 * 24 * 400};SameSite=Lax`;
  }, [ref]);

  // Keep the URL in step with the design so a refresh or shared link keeps it.
  useEffect(() => {
    window.history.replaceState(null, "", totePlanDesignHref(design, source, ref));
  }, [design, source, ref]);

  const unitIndex = Math.min(selected, design.units.length - 1);
  const unit = design.units[unitIndex];

  // Any edit makes it the customer's own design, so a bestseller name no
  // longer applies. Bestseller tags survive brand / caster / worktop edits;
  // a size change or a removed unit drops that bestseller (normalizeBestsellers).
  const updateUnit = (patch: Partial<TotePlanUnit>) =>
    setDesign((d) => ({ units: normalizeBestsellers(d.units.map((u, i) => (i === unitIndex ? { ...u, ...patch } : u))) }));
  const addUnit = () => {
    setDesign((d) => {
      const { bestseller: _copied, ...last } = d.units[d.units.length - 1] ?? DEFAULT_TOTE_PLAN_UNIT;
      return { units: [...d.units, last] };
    });
    setSelected(design.units.length);
  };
  const removeUnit = () => {
    setDesign((d) => ({ units: normalizeBestsellers(d.units.filter((_, i) => i !== unitIndex)) }));
    setSelected(Math.max(0, unitIndex - 1));
  };
  const pickBestseller = (picked: TotePlanDesign, mode: "replace" | "add") => {
    if (mode === "add") {
      setSelected(design.units.length);
      setDesign((d) => ({ units: normalizeBestsellers([...d.units, ...picked.units]) }));
    } else {
      setDesign(picked);
      setSelected(0);
    }
    setPickerOpen(false);
  };
  const multi = design.units.length > 1;
  const letter = unitLetter(unitIndex);

  const size = useMemo(() => designOuterSize(design), [design]);
  const moduleCount = useMemo(() => designModules(design).modules.length, [design]);
  const hasFree = freeAccess?.hasFreeAccess === true;
  const note = moduleNote(unit);

  const closeCheckout = useCallback(() => setCheckout(null), []);

  const handleBuy = async () => {
    setBuying(true);
    setError("");
    let visitorId: string | null = null;
    try {
      visitorId = localStorage.getItem("sn_vid"); // same id as page-view analytics
    } catch {
      /* storage blocked — the click still counts, just not per person */
    }
    const result = await createDIYPlanCheckout(design, source, ref, visitorId);
    setBuying(false);
    if (result.success && result.clientSecret) {
      setCheckout({ clientSecret: result.clientSecret });
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  };

  // All-Access owners: generate this design's plan at no charge and open it.
  const handleIncluded = async () => {
    if (!member) return;
    setBuying(true);
    setError("");
    const result = await createIncludedPlan(member.token, design);
    if (result.ok) {
      window.location.href = `/plans/build?token=${result.token}`;
      return;
    }
    setBuying(false);
    if (result.verify) {
      setMemberNote({ text: result.error, href: `/plans/library?token=${result.verify.token}` });
    } else {
      setError(result.error);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <a href="/plans">
            <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white">Tote Organizer Plans</h1>
            <p className="text-[10px] text-stone-500">Design it · Get the plans · Build it yourself</p>
          </div>
          <Link href="/plans" className="text-[11px] font-semibold text-stone-500 transition hover:text-stone-300">
            All plans
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {cancelled && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            Checkout was cancelled. Your design is still here.
          </div>
        )}

        {/* ── Step 1: design ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="relative h-64 bg-white sm:h-80">
            {/* Every unit, built the way the plan builds it: 2×4 ripped rails, stacked tiers */}
            <PlanRack3D design={design} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/85 px-3 py-1.5 backdrop-blur">
              <p className="font-mono text-[11px] text-stone-300">
                {toFraction(size.widthIn)}&quot; W × {toFraction(size.heightIn)}&quot; H × {toFraction(size.depthIn)}&quot; D
              </p>
            </div>
            <div className="absolute right-3 top-3">
              <BestsellersButton onClick={() => setPickerOpen(true)} />
            </div>
          </div>

          {/* Whole system */}
          <div className="border-b border-slate-800 bg-slate-950/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Layers className="h-3.5 w-3.5 text-yellow-400" />
                {totePlanName(design)}
              </p>
              <p className="shrink-0 font-mono text-[11px] text-stone-400">
                {design.units.length} unit{multi ? "s" : ""} · {moduleCount} module{moduleCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-end justify-center gap-2">
              <SystemMap
                design={design}
                highlight={(m) => multi && m.unitIndex === unitIndex}
                onSelectUnit={setSelected}
                className="h-24 min-w-0 max-w-full"
                title="Your units — tap one to edit it"
              />
              {design.units.length < TOTE_PLAN_LIMITS.maxUnits && (
                <button
                  type="button"
                  onClick={addUnit}
                  aria-label="Add a unit"
                  title="Add a unit"
                  className="mb-1 flex h-14 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-600 text-stone-400 transition hover:border-yellow-400 hover:text-yellow-400"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
            {multi && <p className="mt-1 text-center text-[10px] text-stone-600">Tap a unit to edit it</p>}
          </div>

          <div className="space-y-4 p-4">
            {multi && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white">
                  Editing Unit <span className="text-yellow-400">{letter}</span>
                </p>
                <button
                  type="button"
                  onClick={removeUnit}
                  className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove unit
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Stepper
                label="Totes wide"
                value={unit.cols}
                min={TOTE_PLAN_LIMITS.minCols}
                max={TOTE_PLAN_LIMITS.maxCols}
                onChange={(cols) => updateUnit({ cols })}
              />
              <Stepper
                label="Totes tall"
                value={unit.rows}
                min={TOTE_PLAN_LIMITS.minRows}
                max={TOTE_PLAN_LIMITS.maxRows}
                onChange={(rows) => updateUnit({ rows })}
              />
            </div>
            {note && <p className="rounded-xl bg-yellow-400/5 px-3 py-2 text-[11px] text-yellow-200/80">{note}</p>}
            <WallFit unit={unit} onFit={updateUnit} />
            <Segmented
              label="Totes (27 gallon)"
              value={unit.toteType}
              onChange={(toteType) => updateUnit({ toteType })}
              options={[
                { value: "HDX", label: "HDX", hint: "Home Depot, Walmart, Menards" },
                { value: "GM", label: "Greenmade", hint: "Costco" },
              ]}
            />
            <Segmented
              label="Tote direction"
              value={unit.sideways === true}
              onChange={(sideways) => updateUnit({ sideways: sideways || undefined })}
              options={[
                { value: false, label: "Standard", hint: 'Short end out · 30" deep' },
                { value: true, label: "Sideways", hint: 'Long side out · 20" deep' },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Segmented
                label="Casters"
                value={unit.hasWheels}
                onChange={(hasWheels) => updateUnit({ hasWheels })}
                options={[
                  { value: true, label: "Rolling" },
                  { value: false, label: "Stationary" },
                ]}
              />
              <Segmented
                label="Top"
                value={unit.hasTop}
                onChange={(hasTop) => updateUnit({ hasTop })}
                options={[
                  { value: true, label: "Plywood worktop" },
                  { value: false, label: "Open" },
                ]}
              />
            </div>
            <p className="text-[11px] text-stone-600">{totePlanSummary(design)}</p>
          </div>
        </section>

        <BestsellersLightbox
          open={pickerOpen}
          currentName={design.name}
          currentUnitCount={design.units.length}
          onClose={() => setPickerOpen(false)}
          onPick={pickBestseller}
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        {/* What the materials cost at the store */}
        <MaterialCostCard design={design} />

        {/* ── Step 2: pick a plan ── */}
        <div id="plan-tiers" className="scroll-mt-4">
        {hasFree ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-400">
              <Crown className="h-4 w-4" />
              {freeAccess?.reason === "admin" ? "Admin access" : "Included with Pro"}
            </div>
            <p className="mb-4 text-xs text-stone-400">Every plan, with the PDF and the interactive build guide, no charge.</p>
            <Link
              href={`/plans/build?access=pro&design=${encodeTotePlanDesign(design)}${design.name ? `&name=${encodeURIComponent(design.name)}` : ""}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-emerald-500"
            >
              Open My Build Plan
            </Link>
          </div>
        ) : member ? (
          <IncludedPlanCard emailHint={member.emailHint} loading={buying} onGenerate={handleIncluded} />
        ) : (
          <>
            {memberNote && (
              <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                {memberNote.text}{" "}
                {memberNote.href && (
                  <a href={memberNote.href} className="font-bold underline">
                    Confirm now
                  </a>
                )}
              </p>
            )}
            <AllAccessOffer loading={buying} onBuy={handleBuy} onSample={setSampleTier} />
          </>
        )}
        </div>

        {sampleTier && <PlanSampleLightbox tier={sampleTier} onClose={() => setSampleTier(null)} />}
        {checkout && (
          <EmbeddedCheckoutPanel clientSecret={checkout.clientSecret} onClose={closeCheckout} />
        )}

        {/* Buy from anywhere on this long page; hides while the offer itself is on screen. */}
        {!hasFree && (
          <StickyPlanCta
            watchId="plan-tiers"
            price={member ? "Included" : `${formatPlanPrice(TOTE_PLAN_ALL_ACCESS.price)} for life`}
            note={member ? "with your All-Access plans" : "This plan + every one after"}
            label={member ? "Generate free" : "Get my plans"}
            onClick={member ? handleIncluded : handleBuy}
            loading={buying}
          />
        )}

        {/* Back to an installer: the referring one, or a local pro by ZIP */}
        <BuildItForMe
          design={design}
          referral={ref}
          onBackToPlans={() => document.getElementById("plan-tiers")?.scrollIntoView({ behavior: "smooth" })}
        />

        <p className="pb-4 text-center text-[11px] text-stone-600">
          One price, every design: All-Access covers this plan and every tote organizer you design after it, for life.
          Already own it? Open any of your plans and tap &ldquo;Build another plan&rdquo;.
        </p>
      </div>
      {/* Room for the sticky bar so it never covers the last content. */}
      <div className="h-24" aria-hidden />
    </main>
  );
}

export default function PlansDesignerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </main>
      }
    >
      <PlansDesigner />
    </Suspense>
  );
}
