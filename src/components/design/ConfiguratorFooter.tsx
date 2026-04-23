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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import { RollingPrice } from "./configurator-primitives";
import { checkDIYPlanAccess } from "@/app/actions/diy-plan-checkout";

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
            {hasQuoteItems ? "Grand Total" : props.activePreset && props.compoundBuild ? props.compoundBuild.presetName : activeStep === 1 && props.raisedBedPreviewPrice != null ? "Raised Bed" : activeStep === 1 && props.shelvingConfigId ? "Open Shelving" : "Current Unit"}
          </div>
          <div className="text-3xl font-black text-white">
            <RollingPrice value={hasQuoteItems ? props.grandTotal : props.activePreset && props.compoundBuild ? props.compoundBuild.totalPrice : activeStep === 1 && props.raisedBedPreviewPrice != null ? props.raisedBedPreviewPrice : activeStep === 1 && props.shelvingConfigId && props.shelvingPrice != null ? props.shelvingPrice : props.build.price} />
          </div>
          {/* Deposit anchoring — show prominent deposit below total */}
          {props.stripeAccountId && hasQuoteItems && (
            <div className="mt-0.5">
              <span className="text-sm font-bold text-yellow-400">
                Book today for ${props.depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deposit
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
            ? `Reserve with $${props.depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Deposit`
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

      {/* Secondary CTA — forward navigation for steps 1-3, or "Return to My Quote" */}
      {activeStep < 4 && (
        <>
          {hasQuoteItems ? (
            <motion.button
              onClick={() => setActiveStep(4)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300"
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.99 }}
            >
              Return to My Quote
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              onClick={() => setActiveStep(activeStep + 1)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/30 py-3 text-sm font-bold uppercase tracking-wider text-yellow-400 transition-all hover:border-yellow-400/50 hover:bg-yellow-400/5"
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.99 }}
            >
              {activeStep === 1 && "Next: Choose Your Style"}
              {activeStep === 2 && "Next: Customize Your Build"}
              {activeStep === 3 && "Add to My Quote"}
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          )}
        </>
      )}

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

      {/* DIY Plans CTA — temporarily disabled */}
      {/* <DIYPlansCTA
        build={props.build}
        orderItems={props.orderItems}
        installerId={props.installerId}
        installerSlug={props.installerSlug}
        installerPhone={props.installerPhone}
        brandingTitle={props.brandingTitle}
      /> */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIY Plans CTA — "Buy DIY Plans ($19)" secondary button
// ═══════════════════════════════════════════════════════════════════════════

function DIYPlansCTA({
  build,
  orderItems,
  installerId,
  installerSlug,
  installerPhone,
  brandingTitle,
}: {
  build: ConfiguratorSidebarProps["build"];
  orderItems: ConfiguratorSidebarProps["orderItems"];
  installerId: string;
  installerSlug: string | null;
  installerPhone: string | null;
  brandingTitle: string;
}) {
  const router = useRouter();
  const [freeAccess, setFreeAccess] = useState(false);

  useEffect(() => {
    checkDIYPlanAccess().then((result) => setFreeAccess(result.hasFreeAccess));
  }, []);

  const item = orderItems[0];
  const config = {
    cols: item?.cols ?? build.cols,
    rows: item?.rows ?? build.rows,
    toteType: (item?.toteType ?? "HDX") as "HDX" | "GM",
    unitType: (item?.unitType ?? build.unitType) as "standard" | "mini",
    orientation: (item?.orientation ?? build.orientation) as "standard" | "sideways",
    hasWheels: item?.hasWheels ?? false,
    hasTop: item?.hasTop ?? false,
    hasTotes: item?.hasTotes ?? true,
    totalW: item?.totalW ?? build.totalW,
    totalH: item?.totalH ?? build.totalH,
    depth: item?.depth ?? 30,
    ...(installerSlug || installerId
      ? {
          installerId,
          installerSlug,
          installerPhone,
          installerName: brandingTitle,
        }
      : {}),
  };

  const isStandardUnit = !item?.shelvingConfigId && !item?.overheadStorageConfig;
  if (!isStandardUnit && orderItems.length > 0) return null;

  const handleClick = () => {
    const encoded = encodeURIComponent(JSON.stringify(config));
    router.push(`/plans/checkout?config=${encoded}`);
  };

  return (
    <div className="mt-3 border-t border-zinc-800/50 pt-3">
      <button
        onClick={handleClick}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
          freeAccess
            ? "border-green-500/30 bg-green-500/10 text-green-400 hover:border-green-400/50 hover:bg-green-500/20 hover:text-green-300"
            : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-300"
        }`}
      >
        <Hammer className="h-3.5 w-3.5" />
        {freeAccess ? "Get DIY Plans" : "Buy DIY Plans ($19)"}
      </button>
      <p className="mt-1.5 text-center text-[9px] text-zinc-600">
        {freeAccess
          ? "Included with your subscription — PDF with cut lists"
          : "Build it yourself — visual step-by-step PDF with cut lists"}
      </p>
    </div>
  );
}
