"use client";

import { motion } from "framer-motion";
import {
  Truck,
  CreditCard,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";
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

      {/* CTA Button */}
      {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && activeStep === 4 && detailsFilled && props.scheduledDate && (
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

      {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && (
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          By placing this order, you agree to our{" "}
          <a href="/terms" className="underline hover:text-yellow-400">Terms of Service</a>.
        </p>
      )}
    </div>
  );
}
