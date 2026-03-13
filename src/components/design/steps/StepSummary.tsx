"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Sparkles,
  Info,
  X,
  CheckCircle2,
  Loader2,
  User,
  ChevronRight,
  Calendar,
  Tag,
  AlertTriangle,
  Clock,
} from "lucide-react";
import NativeScheduler from "@/components/booking/NativeScheduler";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import OrderItemCard from "../OrderItemCard";

export default function StepSummary({
  props,
  hasQuoteItems,
  detailsCollapsed,
  setDetailsCollapsed,
  detailsFilled,
  setActiveStep,
  goPrev,
}: {
  props: ConfiguratorSidebarProps;
  hasQuoteItems: boolean;
  detailsCollapsed: boolean;
  setDetailsCollapsed: (v: boolean) => void;
  detailsFilled: boolean;
  setActiveStep: (step: number) => void;
  goPrev: () => void;
}) {
  return (
    <>
      {/* Order Items */}
      {props.orderItems.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Your Quote
          </h3>
          <AnimatePresence>
            {props.orderItems.map((item, index) => (
              <OrderItemCard
                key={index}
                item={item}
                index={index}
                onRemove={() => props.onRemoveUnit(index)}
                pricing={props.pricing}
                platformDefaults={props.platformDefaults}
                addonPricing={props.addonPricing}
              />
            ))}
          </AnimatePresence>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-2 text-sm font-medium text-zinc-500">No units added yet</p>
          <button
            onClick={() => setActiveStep(2)}
            className="mt-3 text-xs font-bold uppercase tracking-wider text-yellow-400 hover:text-yellow-300"
          >
            Go configure a unit
          </button>
        </div>
      )}

      {/* Add Another Unit + Discount Code (inline row) */}
      {props.orderItems.length > 0 && !props.submitted && (
        <div className="flex gap-2">
          {/* Add Another Unit — 1/3 width */}
          <button
            onClick={() => setActiveStep(1)}
            className="w-1/3 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            + Add Unit
          </button>

          {/* Discount Code — 2/3 width */}
          <div className="flex-1">
            {!props.discountApplied ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={props.discountInput}
                  onChange={(e) => props.onDiscountInputChange(e.target.value.toUpperCase())}
                  placeholder="Discount code"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-[11px] text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") props.onApplyDiscount(); }}
                />
                <button
                  onClick={props.onApplyDiscount}
                  disabled={!props.discountInput.trim() || props.discountLoading}
                  className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-[10px] font-bold text-white transition-colors hover:bg-zinc-600 disabled:opacity-40"
                >
                  {props.discountLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
                <Tag className="h-3 w-3 shrink-0 text-emerald-400" />
                <span className="flex-1 truncate text-[10px] font-semibold text-emerald-400">
                  {props.discountApplied.code} — {props.discountApplied.discountType === "percentage" ? `${props.discountApplied.discountValue}% off` : `$${props.discountApplied.amount} off`}
                </span>
                <button onClick={props.onRemoveDiscount} className="text-zinc-500 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {props.discountError && (
              <p className="mt-0.5 text-[10px] text-red-400">{props.discountError}</p>
            )}
          </div>
        </div>
      )}

      {/* Cleanout Service */}
      {props.installerId && !props.submitted && (() => {
        const cleanoutServices = (props.servicesConfig ?? []).filter(
          (s) => s.id.startsWith("cleanout_") && s.enabled && s.price != null
        );
        if (cleanoutServices.length === 0) return null;
        return (
          <section className="relative rounded-xl border border-yellow-400/20 bg-zinc-900/60 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3 w-3 shrink-0 text-yellow-400" />
                <div className="min-w-0 group/cleanout relative">
                  <span className="inline-flex cursor-help items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400 border-b border-dashed border-yellow-400/30 transition-colors hover:border-yellow-400 hover:text-yellow-300">
                    Cleanout
                    <Info className="inline h-2.5 w-2.5 text-yellow-400/50 group-hover/cleanout:text-yellow-400" />
                  </span>
                  <div className="pointer-events-none absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 opacity-0 shadow-xl transition-opacity group-hover/cleanout:pointer-events-auto group-hover/cleanout:opacity-100">
                    <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t border-zinc-700 bg-zinc-900" />
                    <h4 className="mb-1.5 text-[11px] font-bold text-yellow-400">Cleanout Service Details</h4>
                    <p className="mb-2 text-[10px] leading-relaxed text-zinc-400">
                      Professional crew to clear, sort, and haul away unwanted items from your garage or basement.
                    </p>
                    <ul className="mb-2 space-y-1 text-[10px] text-zinc-400">
                      <li className="flex items-start gap-1"><span className="text-yellow-400/60">•</span>Crew to clear &amp; load items</li>
                      <li className="flex items-start gap-1"><span className="text-yellow-400/60">•</span>Hauling &amp; disposal included</li>
                      <li className="flex items-start gap-1"><span className="text-yellow-400/60">•</span>Basic sweep of cleared area</li>
                    </ul>
                    <p className="text-[9px] leading-relaxed text-zinc-500">
                      Pricing is a starting estimate. Final cost confirmed on-site. Hazardous materials &amp; heavy items may incur extra fees.
                    </p>
                  </div>
                  <p className="text-[10px] leading-tight text-zinc-500 truncate">
                    We&apos;ll clear your space first
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {cleanoutServices.map((svc) => {
                  const label = svc.id === "cleanout_1car" ? "1-Car" : svc.id === "cleanout_2car" ? "2-Car" : "3+";
                  const isSelected = props.selectedCleanout === svc.id;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => props.onCleanoutChange(isSelected ? null : svc.id)}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-all ${
                        isSelected
                          ? "border-yellow-400 bg-yellow-400/15 text-yellow-400"
                          : "border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:border-yellow-400/40 hover:text-zinc-200"
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`font-black ${isSelected ? "text-yellow-400" : "text-zinc-300"}`}>
                        ${svc.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Booking Form — collapsible */}
      {props.orderItems.length > 0 && !props.submitted && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsCollapsed(!detailsCollapsed)}
            className="flex w-full items-center justify-between p-4"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-yellow-400" />
              Your Details
              {detailsFilled && detailsCollapsed && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </span>
              )}
            </h3>
            <motion.div
              animate={{ rotate: detailsCollapsed ? 0 : 90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {!detailsCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <div className="space-y-2 px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={props.firstName}
                      onChange={(e) => props.onFirstNameChange(e.target.value)}
                      placeholder="First Name *"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={props.lastName}
                      onChange={(e) => props.onLastNameChange(e.target.value)}
                      placeholder="Last Name *"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={props.email}
                      onChange={(e) => props.onEmailChange(e.target.value)}
                      placeholder="Email *"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="tel"
                      value={props.phone}
                      onChange={(e) => props.onPhoneChange(e.target.value)}
                      placeholder="Phone *"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>

                  {/* Billing Address */}
                  <div className="pt-1">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Billing Address
                    </label>
                    <input
                      type="text"
                      value={props.streetAddress}
                      onChange={(e) => props.onStreetAddressChange(e.target.value)}
                      placeholder="Street Address"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={props.city}
                      onChange={(e) => props.onCityChange(e.target.value)}
                      placeholder="City"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={props.addrState}
                      onChange={(e) => props.onAddrStateChange(e.target.value)}
                      placeholder="State"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={props.addrZip}
                      onChange={(e) => props.onAddrZipChange(e.target.value)}
                      placeholder="Zip"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>

                  {/* Hand-off banner */}
                  {props.handedOff && !props.zipOutOfArea && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"
                    >
                      <div className="mb-1 flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                        <p className="text-xs font-medium text-blue-300">
                          Routed to a local partner installer.
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500">
                        <strong className="text-zinc-400">{props.handoffInstallerName}</strong> will handle your build.
                      </p>
                    </motion.div>
                  )}

                  {/* Out of area waitlist */}
                  {props.zipOutOfArea && !props.waitlistSent && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <p className="text-xs font-medium text-amber-300">{props.zipCheckMsg}</p>
                      </div>
                      <button
                        onClick={props.onWaitlist}
                        disabled={props.waitlistSending}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {props.waitlistSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                        {props.waitlistSending ? "Sending..." : "Notify Me When Available"}
                      </button>
                      {props.waitlistError && (
                        <p className="mt-2 text-xs font-medium text-red-400">{props.waitlistError}</p>
                      )}
                    </motion.div>
                  )}
                  {props.waitlistSent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center"
                    >
                      <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                      <p className="text-sm font-semibold text-zinc-200">You&apos;re on the List</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        We&apos;ll email you as soon as an installer is available.
                      </p>
                    </motion.div>
                  )}

                  {/* Installation address toggle */}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 transition-colors hover:bg-zinc-800/50">
                    <input
                      type="checkbox"
                      checked={props.hasDifferentDelivery}
                      onChange={(e) => props.onHasDifferentDeliveryChange(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-600 accent-yellow-400"
                    />
                    <span className="text-xs font-medium text-zinc-400">
                      Installation address is different from billing
                    </span>
                  </label>

                  {/* Installation address fields */}
                  {props.hasDifferentDelivery && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2 rounded-lg border border-yellow-400/10 bg-yellow-400/5 p-3"
                    >
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                        Installation Address
                      </label>
                      <input
                        type="text"
                        value={props.deliveryStreet}
                        onChange={(e) => props.onDeliveryStreetChange(e.target.value)}
                        placeholder="Street Address"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={props.deliveryCity}
                          onChange={(e) => props.onDeliveryCityChange(e.target.value)}
                          placeholder="City"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={props.deliveryState}
                          onChange={(e) => props.onDeliveryStateChange(e.target.value)}
                          placeholder="State"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={props.deliveryZip}
                          onChange={(e) => props.onDeliveryZipChange(e.target.value)}
                          placeholder="Zip"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                    </motion.div>
                  )}

                  {props.submitError && (
                    <p className="text-xs font-medium text-red-400">{props.submitError}</p>
                  )}

                  {/* Collapse button when details are filled */}
                  {detailsFilled && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setDetailsCollapsed(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Details Complete — Continue
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Scheduler */}
      {props.orderItems.length > 0 && !props.submitted && props.installerId && (
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-yellow-400" />
            Pick a Date
          </h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <NativeScheduler
              leadTimeDays={props.installerLeadTime}
              workingDays={props.installerWorkingDays}
              blackoutDates={props.blackoutDates}
              selectedDate={props.scheduledDate}
              onSelectDate={props.onScheduledDateChange}
            />
          </div>
          {props.scheduledDate && (
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2 text-center text-xs font-semibold text-yellow-400">
              Scheduled:{" "}
              {new Date(props.scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
        </section>
      )}

      {/* Submitted confirmation */}
      {props.submitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-8 text-center"
        >
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
          <p className="text-lg font-bold text-white">Booking Received!</p>
          <p className="mt-1 text-sm text-zinc-500">We&apos;ll reach out within 24 hours.</p>
        </motion.div>
      )}

      {/* Back button */}
      <button
        onClick={goPrev}
        className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
      >
        Back
      </button>
    </>
  );
}
