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
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import { RollingPrice } from "./configurator-primitives";

export default function ConfiguratorFooter({
  props,
  activeStep,
  detailsFilled,
}: {
  props: ConfiguratorSidebarProps;
  activeStep: number;
  detailsFilled: boolean;
}) {
  return (
    <div
      className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/80 px-4 py-4 backdrop-blur-xl"
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
            {props.orderItems.length > 0 ? "Grand Total" : props.shelvingConfigId ? "Open Shelving" : "Current Unit"}
          </div>
          <div className="text-3xl font-black text-white">
            <RollingPrice value={props.orderItems.length > 0 ? props.grandTotal : props.shelvingConfigId && props.shelvingPrice != null ? props.shelvingPrice : props.build.price} />
          </div>
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
          {props.stripeAccountId && props.orderItems.length > 0 && (
            <div className="text-[10px] text-zinc-500">
              Deposit ({props.depositLabelText}):{" "}
              <span className="font-bold text-yellow-400">${props.depositAmount.toLocaleString()}</span>
            </div>
          )}
          {props.orderItems.length > 0 && (
            <div className="text-[10px] text-zinc-600">
              {props.orderItems.length} unit{props.orderItems.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* CTA Button — normal booking flow */}
      {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && !props.installerAtCapacity && activeStep === 4 && detailsFilled && props.scheduledDate && (
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
            ? `Pay $${props.depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} & Book`
            : "Submit Quote Request"}
        </motion.button>
      )}

      {/* CTA Button — trial cap waitlist (hostage lead) */}
      {props.installerAtCapacity && props.orderItems.length > 0 && !props.submitted && !props.trialCapWaitlistSent && !props.zipOutOfArea && activeStep === 4 && detailsFilled && (
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

      {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && !props.trialCapWaitlistSent && (
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          By placing this order, you agree to our{" "}
          <a href="/terms" className="underline hover:text-yellow-400">Terms of Service</a>.
        </p>
      )}

      {/* DIY Plans CTA — secondary action for all configurator states */}
      <DIYPlansCTA
        build={props.build}
        orderItems={props.orderItems}
        installerId={props.installerId}
        installerSlug={props.installerSlug}
        installerPhone={props.installerPhone}
        brandingTitle={props.brandingTitle}
      />
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

  // Use the first order item if available, otherwise derive from current build
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
    // Installer context for branding on checkout/PDF
    installerId,
    installerSlug,
    installerPhone,
    installerName: brandingTitle,
  };

  // Only show for standard tote organizer configs (not shelving/overhead)
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs font-bold uppercase tracking-wider text-blue-400 transition-all hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-300"
      >
        <Hammer className="h-3.5 w-3.5" />
        Buy DIY Plans ($19)
      </button>
      <p className="mt-1.5 text-center text-[9px] text-zinc-600">
        Build it yourself — visual step-by-step PDF with cut lists
      </p>
    </div>
  );
}
