"use client";

import {
  Loader2,
  Tag,
  ChevronDown,
  AlertTriangle,
  MapPin,
  Clock,
  DollarSign,
} from "lucide-react";
import type { DeliveryFeeResult } from "@/app/actions/delivery-fee";

export type ZipCheckStatus =
  | "idle"
  | "checking"
  | "in_area"
  | "referral"
  | "waitlist";

interface CartQuoteFormProps {
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

  disableZipField?: boolean;
}

export default function CartQuoteForm({
  customerName,
  onCustomerNameChange,
  customerEmail,
  onCustomerEmailChange,
  customerPhone,
  onCustomerPhoneChange,
  deliveryZip,
  onDeliveryZipChange,
  zipCheckStatus,
  zipCoveringName,
  deliveryFeeResult,
  quoteDiscountCode,
  onQuoteDiscountCodeChange,
  showDeliveryAddress,
  onShowDeliveryAddressChange,
  deliveryLine1,
  onDeliveryLine1Change,
  deliveryLine2,
  onDeliveryLine2Change,
  deliveryCity,
  onDeliveryCityChange,
  deliveryState,
  onDeliveryStateChange,
  disableZipField,
}: CartQuoteFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
          Customer Name *
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="John Smith"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
          Email {zipCheckStatus === "waitlist" ? "*" : "(optional)"}
        </label>
        <input
          type="email"
          value={customerEmail}
          onChange={(e) => onCustomerEmailChange(e.target.value)}
          placeholder="john@email.com"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
          Phone (optional)
        </label>
        <input
          type="tel"
          value={customerPhone}
          onChange={(e) => onCustomerPhoneChange(e.target.value)}
          placeholder="(555) 123-4567"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
          Customer ZIP Code *
        </label>
        <input
          type="text"
          value={deliveryZip}
          onChange={(e) => onDeliveryZipChange(e.target.value)}
          placeholder="e.g. 30301"
          maxLength={5}
          disabled={disableZipField}
          className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none disabled:opacity-50"
        />
        <p className="mt-1 text-[10px] text-stone-600">
          Used to verify installer coverage for this customer.
        </p>

        {zipCheckStatus === "checking" && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-stone-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking service area...
          </div>
        )}
        {zipCheckStatus === "in_area" && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400">
            <MapPin className="h-3 w-3" />
            This ZIP is in your service area.
          </div>
        )}
        {deliveryFeeResult?.applicable &&
          deliveryFeeResult.fee > 0 &&
          zipCheckStatus !== "checking" && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-yellow-400">
              <DollarSign className="h-3 w-3" />
              Delivery fee: ${deliveryFeeResult.fee} ({deliveryFeeResult.tierLabel} —{" "}
              {deliveryFeeResult.distance} mi)
            </div>
          )}
        {deliveryFeeResult?.applicable &&
          deliveryFeeResult.fee === 0 &&
          zipCheckStatus === "in_area" && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-stone-500">
              Free delivery ({deliveryFeeResult.distance} mi)
            </div>
          )}
        {zipCheckStatus === "referral" && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
              <div>
                <p className="text-[11px] font-semibold text-amber-300">
                  Outside your service area
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-stone-400">
                  <strong className="text-white">{zipCoveringName}</strong> covers this
                  area. The quote will be handed off to them and you&apos;ll earn a
                  referral bounty (30% of deposit, min $15).
                </p>
              </div>
            </div>
          </div>
        )}
        {zipCheckStatus === "waitlist" && (
          <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2.5">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
              <div>
                <p className="text-[11px] font-semibold text-orange-300">
                  No installer in this area yet
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-stone-400">
                  The customer will be added to the waitlist and notified when an
                  installer is available. You&apos;ll still earn referral credit.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-stone-500">
          <Tag className="h-3 w-3" />
          Discount Code (optional)
        </label>
        <input
          type="text"
          value={quoteDiscountCode}
          onChange={(e) => onQuoteDiscountCodeChange(e.target.value.toUpperCase())}
          placeholder="e.g. SPRING25"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-stone-600">
          Attach a promo code — customer can apply it at checkout.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => onShowDeliveryAddressChange(!showDeliveryAddress)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-stone-500 hover:text-stone-400"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showDeliveryAddress ? "rotate-180" : ""}`}
          />
          Delivery / Install Address (optional)
        </button>
        {showDeliveryAddress && (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
            <input
              type="text"
              value={deliveryLine1}
              onChange={(e) => onDeliveryLine1Change(e.target.value)}
              placeholder="Street address"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
            />
            <input
              type="text"
              value={deliveryLine2}
              onChange={(e) => onDeliveryLine2Change(e.target.value)}
              placeholder="Apt / Suite (optional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={deliveryCity}
                onChange={(e) => onDeliveryCityChange(e.target.value)}
                placeholder="City"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
              <input
                type="text"
                value={deliveryState}
                onChange={(e) => onDeliveryStateChange(e.target.value.toUpperCase())}
                placeholder="ST"
                maxLength={2}
                className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
