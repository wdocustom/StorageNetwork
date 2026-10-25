"use client";

import { motion } from "framer-motion";
import {
  Truck,
  CreditCard,
  Send,
  Loader2,
  Sparkles,
  Clock,
  Hammer,
  Shield,
  RefreshCcw,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import { RollingPrice } from "./configurator-primitives";
import { checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";
import { TOTE_PLAN_TIERS, designFromItems, formatPlanPrice, totePlanDesignHref, type PlanTranslation } from "@/lib/tote-plans";
import { formatCurrency } from "@/utils/paymentHelpers";
import { getChairDescription } from "@/lib/chairs";

export default function ConfiguratorFooter({
  props,
  activeStep,
  detailsFilled,
  setActiveStep,
}: {
  props: ConfiguratorSidebarProps;
  activeStep: number;
  detailsFilled: boolean;
  setActiveStep: (step: number) => void;
}) {
  const hasQuoteItems = props.orderItems.length > 0;

  return (
    <div
      className="sticky bottom-0 z-20 shrink-0 border-t border-zinc-800/80 bg-zinc-950/80 px-4 py-4 backdrop-blur-xl"
      style={{
        background: "linear-gradient(to top, rgba(9,9,11,0.95), rgba(9,9,11,0.85))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Grand Total */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {hasQuoteItems ? "Grand Total" : props.chairSelected && props.chairPreviewPrice != null ? "Adirondack Chair" : props.activePreset && props.compoundBuild ? props.compoundBuild.presetName : activeStep === 1 && props.raisedBedPreviewPrice != null ? "Raised Bed" : activeStep === 1 && props.shelvingConfigId ? "Open Shelving" : "Current Unit"}
          </div>
          <div className="text-3xl font-black text-white">
            <RollingPrice value={hasQuoteItems ? props.grandTotal : props.chairSelected && props.chairPreviewPrice != null ? props.chairPreviewPrice : props.activePreset && props.compoundBuild ? props.compoundBuild.totalPrice : activeStep === 1 && props.raisedBedPreviewPrice != null ? props.raisedBedPreviewPrice : activeStep === 1 && props.shelvingConfigId && props.shelvingPrice != null ? props.shelvingPrice : props.build.price} />
          </div>
          {/* Deposit anchoring — show prominent deposit below total */}
          {props.stripeAccountId && hasQuoteItems && (
            <div className="mt-0.5">
              <span className="text-sm font-bold text-yellow-400">
                Book today for {formatCurrency(props.depositAmount)} deposit
              </span>
              <div className="text-[10px] text-zinc-500">
                Remaining balance paid after installation
              </div>
            </div>
          )}
        </div>
        <div className="text-right">
          {props.deliveryFeeAmount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Truck className="h-3 w-3 text-amber-400" />
              +${props.deliveryFeeAmount} delivery
            </div>
          )}
          {props.selectedCleanout && (() => {
            const svc = (props.servicesConfig ?? []).find((s) => s.id === props.selectedCleanout);
            if (!svc || svc.price == null) return null;
            const label = svc.id === "cleanout_1car" ? "1-Car" : svc.id === "cleanout_2car" ? "2-Car" : "3+";
            return (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Sparkles className="h-3 w-3 text-yellow-400" />
                +${svc.price} cleanout ({label})
              </div>
            );
          })()}
          {hasQuoteItems && (
            <div className="text-[10px] text-zinc-600">
              {props.orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0)} unit{props.orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0) !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Primary CTA — booking flow (Step 4 only) */}
      {hasQuoteItems && !props.submitted && !props.zipOutOfArea && !props.installerAtCapacity && activeStep === 4 && detailsFilled && (props.scheduledDate || !props.schedulingEnabled) && (
        <motion.button
          onClick={props.isDemo ? props.onDemoToast : props.onBookDeposit}
          disabled={props.submitting}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 ${
            props.isDemo
              ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              : "bg-yellow-400 text-zinc-900 shadow-yellow-400/20 hover:bg-yellow-300"
          }`}
          whileHover={props.isDemo ? {} : { scale: 1.01, y: -1 }}
          whileTap={props.isDemo ? {} : { scale: 0.99 }}
        >
          {props.submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : props.stripeAccountId ? (
            <CreditCard className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {props.isDemo
            ? "Demo Mode"
            : props.submitting
            ? "Submitting..."
            : props.stripeAccountId
            ? `Reserve with ${formatCurrency(props.depositAmount)} Deposit`
            : "Submit My Design"}
        </motion.button>
      )}

      {/* CTA Button — trial cap waitlist (hostage lead) */}
      {props.installerAtCapacity && hasQuoteItems && !props.submitted && !props.trialCapWaitlistSent && !props.zipOutOfArea && activeStep === 4 && detailsFilled && (
        <motion.button
          onClick={props.onJoinTrialCapWaitlist}
          disabled={props.trialCapWaitlistSending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold uppercase tracking-wider text-zinc-900 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 disabled:opacity-50"
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
          {props.trialCapWaitlistSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {props.trialCapWaitlistSending ? "Saving..." : "Join Wait-list"}
        </motion.button>
      )}

      {/* Secondary CTA — forward navigation for steps 1-3.
          Step 3 actually adds the draft unit to the quote (matches the
          old in-step "Add to My Quote" behavior). Presets and shelving
          are added by their own dropdowns in step 1, so on step 3 they
          just review the summary. */}
      {activeStep < 4 && (() => {
        const isChairFlow = props.chairSelected === true;
        const isAddToQuoteStep =
          activeStep === 3 && !props.activePreset && !props.shelvingConfigId;
        const isChairAddStep = activeStep === 3 && isChairFlow;
        const addDisabled = isChairAddStep
          ? (props.chairPreviewPrice == null || props.chairPreviewPrice === 0)
          : isAddToQuoteStep && (props.buildLoading || props.build.price === 0);

        const handleClick = () => {
          if (isChairAddStep) {
            const finish = props.chairFinish ?? "natural";
            const qty = props.chairQuantity ?? 1;
            const config = { finish, quantity: qty };
            const desc = getChairDescription(config);
            props.onAddChair(config, props.chairPreviewPrice ?? 0, desc);
            setActiveStep(4);
            return;
          }
          if (isAddToQuoteStep) {
            props.onAddUnit();
            setActiveStep(4);
            return;
          }
          // Skip Step 2 for chair flow
          if (activeStep === 1 && isChairFlow) {
            setActiveStep(3);
            return;
          }
          setActiveStep(activeStep === 3 ? 4 : activeStep + 1);
        };

        const label = hasQuoteItems && activeStep < 3 && !isChairFlow
          ? "Return to My Quote"
          : activeStep === 1 && isChairFlow
          ? "Next: Customize Your Chair"
          : activeStep === 1
          ? "Next: Choose Your Style"
          : activeStep === 2
          ? "Next: Customize Your Build"
          : isChairAddStep
          ? "Add to My Quote"
          : isAddToQuoteStep
          ? "Add to My Quote"
          : "Review Summary";

        const onClickFinal = hasQuoteItems && activeStep < 3 && !isChairFlow
          ? () => setActiveStep(4)
          : handleClick;

        const filled = (hasQuoteItems && activeStep < 3 && !isChairFlow) ? true : isAddToQuoteStep || isChairAddStep;

        return (
          <motion.button
            onClick={onClickFinal}
            disabled={addDisabled}
            className={
              filled
                ? "flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 disabled:opacity-40"
                : "flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/30 py-3 text-sm font-bold uppercase tracking-wider text-yellow-400 transition-all hover:border-yellow-400/50 hover:bg-yellow-400/5 disabled:opacity-40"
            }
            whileHover={addDisabled ? {} : { scale: 1.01, y: -1 }}
            whileTap={addDisabled ? {} : { scale: 0.99 }}
          >
            {isAddToQuoteStep ? <Plus className="h-4 w-4" /> : null}
            {label}
            {!isAddToQuoteStep && <ChevronRight className="h-4 w-4" />}
          </motion.button>
        );
      })()}

      {/* Trust signals row — step 4 only */}
      {activeStep === 4 && hasQuoteItems && !props.submitted && (
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-emerald-400" />
            Secure checkout
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            Free 3D design
          </span>
          <span className="flex items-center gap-1">
            <RefreshCcw className="h-3 w-3 text-blue-400" />
            Refundable deposit
          </span>
        </div>
      )}

      {hasQuoteItems && !props.submitted && !props.zipOutOfArea && !props.trialCapWaitlistSent && (
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          By placing this order, you agree to our{" "}
          <a href="/terms" className="underline hover:text-yellow-400">Terms of Service</a>.
        </p>
      )}

      {/* DIY plans — a small alternative to booking, once the design has taken shape */}
      {activeStep >= 3 && <DIYPlansCTA props={props} activeStep={activeStep} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans CTA — "build it yourself" alternative to booking, on every
// installer's designer. Hands the customer's design to /plans/checkout:
// the whole cart (bestsellers break out into their sub-units, quantities
// repeat), or the unit / bestseller on screen when the cart is empty.
// ═══════════════════════════════════════════════════════════════════════════

/** Exported for tests. */
export function designerPlanTranslation(props: ConfiguratorSidebarProps, activeStep: number): PlanTranslation {
  if (props.orderItems.length > 0) {
    const presetItems = props.orderItems.filter((it) => it.presetUnits && it.presetUnits.length > 0);
    // A cart that is just one bestseller keeps its name ("Indiana Joe").
    const name =
      props.orderItems.length === 1 && presetItems.length === 1 ? presetItems[0].desc.split(" (")[0] : undefined;
    return designFromItems(props.orderItems, name);
  }

  if (props.chairSelected || (activeStep <= 3 && (props.shelvingConfigId || props.raisedBedPreviewPrice != null))) {
    return { design: null, covered: 0, skipped: 1 };
  }

  if (props.activePreset && props.compoundBuild && props.activePresetObj) {
    const preset = props.presetOptions.find((p) => p.id === props.activePreset);
    const flags = props.activePresetObj.units;
    return designFromItems(
      [
        {
          toteType: preset?.toteModel ?? "HDX",
          unitType: "standard",
          orientation: "standard",
          presetUnits: props.compoundBuild.subUnits.map((su, i) => ({
            cols: su.cols,
            rows: su.rows,
            hasTop: flags[i]?.hasTop ?? false,
            hasWheels: flags[i]?.hasWheels ?? false,
          })),
        },
      ],
      props.compoundBuild.presetName,
    );
  }

  return designFromItems([
    {
      cols: props.build.cols,
      rows: props.build.rows,
      toteType: props.toteType,
      unitType: props.unitType,
      orientation: props.orientation,
      hasWheels: props.hasWheels,
      hasTop: props.effectiveHasTop,
    },
  ]);
}

function DIYPlansCTA({ props, activeStep }: { props: ConfiguratorSidebarProps; activeStep: number }) {
  const router = useRouter();
  const [freeAccess, setFreeAccess] = useState(false);

  useEffect(() => {
    checkDIYPlanAccess().then((result) => setFreeAccess(result.hasFreeAccess));
  }, []);

  const { design, skipped } = designerPlanTranslation(props, activeStep);
  if (!design) return null;

  const lowest = formatPlanPrice(TOTE_PLAN_TIERS.pdf.price);

  return (
    <div className="mt-3 border-t border-zinc-800/50 pt-3">
      <button
        onClick={() => router.push(totePlanDesignHref(design, "designer"))}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
          freeAccess
            ? "border-green-500/30 bg-green-500/10 text-green-400 hover:border-green-400/50 hover:bg-green-500/20 hover:text-green-300"
            : "border-zinc-700 bg-transparent text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-300"
        }`}
      >
        <Hammer className="h-3.5 w-3.5" />
        {freeAccess ? "Get DIY Build Plans" : `Or build it yourself — DIY plans from ${lowest}`}
      </button>
      <p className="mt-1.5 text-center text-[9px] text-zinc-600">
        {freeAccess
          ? "Included with your subscription — PDF + interactive 3D guide"
          : skipped > 0
            ? "Printable PDF or interactive 3D guide for the tote organizers in this design"
            : "Printable PDF or interactive 3D guide for exactly this design"}
      </p>
    </div>
  );
}
