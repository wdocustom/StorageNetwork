"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronUp,
  X,
  Loader2,
  Send,
  Link2,
  Clock,
  CheckCircle2,
  MapPin,
  Calculator,
  ChevronDown,
} from "lucide-react";
import type { UnitConfig } from "./types";
import type { DeliveryFeeResult, IndoorDeliveryConfig } from "@/app/actions/delivery-fee";
import type { MaterialBreakdown, MaterialPrices } from "@/utils/calculateMaterials";
import type { BuildFeeBreakdown } from "@/app/actions/fee-engine";
import CartLineItems from "./CartLineItems";
import CartProfitCalc from "./CartProfitCalc";
import CartQuoteForm, { type ZipCheckStatus } from "./CartQuoteForm";

interface CartBarProps {
  units: UnitConfig[];
  grandTotal: number;
  onRemoveUnit: (id: string) => void;
  onToggleIndoorDelivery?: (unitIndex: number, enabled: boolean) => void;
  indoorDeliveryConfig: IndoorDeliveryConfig | null;

  editingLeadId: string | null;
  editingCustomerName?: string;

  // Customer form state
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  customerEmail: string;
  onCustomerEmailChange: (v: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (v: string) => void;
  deliveryZip: string;
  onDeliveryZipChange: (v: string) => void;
  zipCheckStatus: ZipCheckStatus;
  zipCoveringName: string;
  deliveryFeeResult: DeliveryFeeResult | null;

  quoteDiscountCode: string;
  onQuoteDiscountCodeChange: (v: string) => void;

  showDeliveryAddress: boolean;
  onShowDeliveryAddressChange: (v: boolean) => void;
  deliveryLine1: string;
  onDeliveryLine1Change: (v: string) => void;
  deliveryLine2: string;
  onDeliveryLine2Change: (v: string) => void;
  deliveryCity: string;
  onDeliveryCityChange: (v: string) => void;
  deliveryState: string;
  onDeliveryStateChange: (v: string) => void;

  // Actions
  onSendQuote: () => void;
  onGetLink: () => void;
  onUpdateQuote: () => void;
  quoteSending: boolean;
  quoteError: string;

  // Profit calculator data
  displayPrice: number;
  displayMaterials: MaterialBreakdown | null;
  feeBreakdown: BuildFeeBreakdown | null;
  materialPrices: MaterialPrices;

  // Estimated sales tax (derived from delivery ZIP). Optional — line is hidden when absent.
  estimatedTax?: { amount: number; rate: number; stateCode: string } | null;
}

export default function CartBar(props: CartBarProps) {
  const {
    units,
    grandTotal,
    onRemoveUnit,
    onToggleIndoorDelivery,
    indoorDeliveryConfig,
    editingLeadId,
    editingCustomerName,
    deliveryFeeResult,
    zipCheckStatus,
    onSendQuote,
    onGetLink,
    onUpdateQuote,
    quoteSending,
    quoteError,
    displayPrice,
    displayMaterials,
    feeBreakdown,
    materialPrices,
    estimatedTax,
  } = props;

  const [expanded, setExpanded] = useState(false);
  const [showProfit, setShowProfit] = useState(false);

  // Lock body scroll when expanded
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  // Only show the cart bar when there's content or we're editing an existing quote
  if (units.length === 0 && !editingLeadId) return null;

  const itemCount = (() => {
    const groups = new Set<string>();
    let count = 0;
    for (const u of units) {
      if (u.presetGroup) {
        if (!groups.has(u.presetGroup)) {
          groups.add(u.presetGroup);
          count++;
        }
      } else {
        count++;
      }
    }
    return count;
  })();

  const deliveryFee =
    deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0
      ? deliveryFeeResult.fee
      : 0;
  const taxAmount = estimatedTax?.amount && estimatedTax.amount > 0 ? estimatedTax.amount : 0;
  const totalWithDelivery = grandTotal + deliveryFee + taxAmount;

  const isWaitlist = zipCheckStatus === "waitlist";

  const primaryLabel = editingLeadId
    ? "Update Quote"
    : isWaitlist
      ? "Add to Waitlist"
      : "Send Quote";

  const primaryIcon = editingLeadId ? (
    <CheckCircle2 className="h-4 w-4" />
  ) : isWaitlist ? (
    <Clock className="h-4 w-4" />
  ) : (
    <Send className="h-4 w-4" />
  );

  return (
    <>
      {/* Spacer so content isn't hidden behind the bar */}
      <div className="h-28" aria-hidden="true" />

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ height: expanded ? "90vh" : "auto" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col border-t border-yellow-400/30 bg-slate-900 shadow-2xl sm:rounded-t-xl sm:border-x"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Collapsed bar — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10">
            <FileText className="h-5 w-5 text-yellow-400" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-black text-gray-950">
                {itemCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">
                {editingLeadId
                  ? `Editing ${editingCustomerName || "Quote"}`
                  : itemCount === 0
                    ? "Quote is empty"
                    : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
              </p>
            </div>
            <p className="text-xs text-stone-500">
              {deliveryFee > 0
                ? `$${grandTotal.toLocaleString()} + $${deliveryFee} delivery`
                : "Tap to review & send"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl font-black text-yellow-400">
              ${totalWithDelivery.toLocaleString(undefined, { minimumFractionDigits: taxAmount > 0 ? 2 : 0, maximumFractionDigits: 2 })}
            </p>
            <ChevronUp
              className={`h-5 w-5 text-stone-500 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="scrollbar-dark flex-1 overflow-y-auto border-t border-slate-800"
            >
              <div className="mx-auto max-w-2xl space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
                    <FileText className="h-4 w-4 text-yellow-400" />
                    {editingLeadId ? "Edit Quote" : "Review & Send"}
                  </h2>
                  <button
                    onClick={() => setExpanded(false)}
                    className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
                    aria-label="Collapse"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Line items */}
                {units.length > 0 && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      {units.length} unit{units.length > 1 ? "s" : ""} in quote
                    </p>
                    <CartLineItems
                      units={units}
                      onRemoveUnit={onRemoveUnit}
                      indoorDeliveryConfigFee={
                        indoorDeliveryConfig?.enabled
                          ? indoorDeliveryConfig.fee
                          : undefined
                      }
                      onToggleIndoorDelivery={onToggleIndoorDelivery}
                    />

                    {/* Grand total breakdown */}
                    <div className="mt-3 space-y-1.5 border-t border-slate-700 pt-3">
                      {deliveryFee > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-400">
                            <MapPin className="mr-1 inline h-3 w-3 text-yellow-400" />
                            Delivery Fee ({deliveryFeeResult?.distance} mi)
                          </span>
                          <span className="font-semibold text-white">
                            ${deliveryFee.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {estimatedTax && estimatedTax.amount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-400">
                            Est. Sales Tax ({estimatedTax.stateCode}, {(estimatedTax.rate * 100).toFixed(2)}%)
                          </span>
                          <span className="font-semibold text-white">
                            ${estimatedTax.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase text-stone-400">
                          Grand Total
                        </span>
                        <span className="text-xl font-black text-yellow-400">
                          ${totalWithDelivery.toLocaleString(undefined, { minimumFractionDigits: estimatedTax && estimatedTax.amount > 0 ? 2 : 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {units.length === 0 && editingLeadId && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                    <p className="text-sm text-amber-300">
                      Quote is empty. Add items from the tiles above to update the quote.
                    </p>
                  </div>
                )}

                {/* Profit calculator (toggle) */}
                {displayMaterials && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowProfit(!showProfit)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-left transition-colors hover:bg-slate-800"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-300">
                        <Calculator className="h-4 w-4 text-yellow-400" />
                        Profit Calculator
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-stone-500 transition-transform ${
                          showProfit ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {showProfit && (
                      <div className="mt-2">
                        <CartProfitCalc
                          unitCount={units.length}
                          displayPrice={displayPrice}
                          displayMaterials={displayMaterials}
                          feeBreakdown={feeBreakdown}
                          materialPrices={materialPrices}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Customer form */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                    {editingLeadId ? "Customer Info (locked)" : "Customer Info"}
                  </h3>
                  <CartQuoteForm
                    customerName={props.customerName}
                    onCustomerNameChange={props.onCustomerNameChange}
                    customerEmail={props.customerEmail}
                    onCustomerEmailChange={props.onCustomerEmailChange}
                    customerPhone={props.customerPhone}
                    onCustomerPhoneChange={props.onCustomerPhoneChange}
                    deliveryZip={props.deliveryZip}
                    onDeliveryZipChange={props.onDeliveryZipChange}
                    zipCheckStatus={props.zipCheckStatus}
                    zipCoveringName={props.zipCoveringName}
                    deliveryFeeResult={props.deliveryFeeResult}
                    quoteDiscountCode={props.quoteDiscountCode}
                    onQuoteDiscountCodeChange={props.onQuoteDiscountCodeChange}
                    showDeliveryAddress={props.showDeliveryAddress}
                    onShowDeliveryAddressChange={props.onShowDeliveryAddressChange}
                    deliveryLine1={props.deliveryLine1}
                    onDeliveryLine1Change={props.onDeliveryLine1Change}
                    deliveryLine2={props.deliveryLine2}
                    onDeliveryLine2Change={props.onDeliveryLine2Change}
                    deliveryCity={props.deliveryCity}
                    onDeliveryCityChange={props.onDeliveryCityChange}
                    deliveryState={props.deliveryState}
                    onDeliveryStateChange={props.onDeliveryStateChange}
                  />
                </div>

                {quoteError && (
                  <p className="text-center text-xs font-medium text-red-400">
                    {quoteError}
                  </p>
                )}

                {/* Action buttons */}
                {editingLeadId ? (
                  <button
                    onClick={onUpdateQuote}
                    disabled={quoteSending || units.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {quoteSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Update Quote
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={onGetLink}
                      disabled={quoteSending || isWaitlist || units.length === 0}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 py-3 text-sm font-bold uppercase tracking-wider text-yellow-400 transition-all hover:bg-yellow-400/20 disabled:opacity-50"
                      title={
                        isWaitlist
                          ? "No installers in this area — use Email Quote to waitlist the customer"
                          : undefined
                      }
                    >
                      {quoteSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      Get Link
                    </button>
                    <button
                      onClick={onSendQuote}
                      disabled={quoteSending || units.length === 0}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                        isWaitlist
                          ? "bg-orange-500 text-white hover:bg-orange-400"
                          : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                      }`}
                    >
                      {quoteSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        primaryIcon
                      )}
                      {primaryLabel}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
