"use client";

import { useState } from "react";
import { Loader2, X, ChevronRight, Check, Plus } from "lucide-react";
import { submitCleanOutLead } from "@/app/actions/submit-cleanout-lead";
import BookingModal from "@/components/booking/BookingModal";
import { formatCurrency } from "@/utils/paymentHelpers";

interface CleanOutBookingProps {
  installerId: string;
  installerSlug: string;
  installerLeadTime?: number;
  installerWorkingDays?: string[];
  /** Custom price for 1-car cleanout (from services_config). Defaults to 349. */
  price1Car?: number;
  /** Custom price for 2-car cleanout (from services_config). Defaults to 549. */
  price2Car?: number;
  /** Custom price for 3+ car cleanout (from services_config). Defaults to 749. */
  price3Car?: number;
  /** Whether to show the 1-car option. Defaults to true. */
  show1Car?: boolean;
  /** Whether to show the 2-car option. Defaults to true. */
  show2Car?: boolean;
  /** Whether to show the 3+ car option. Defaults to true. */
  show3Car?: boolean;
}

type ServiceType = "1_car" | "2_car" | "3_car";
type FlowStep = "select" | "info" | "booking";

export default function CleanOutBooking({
  installerId,
  installerSlug,
  installerLeadTime = 5,
  installerWorkingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  price1Car = 349,
  price2Car = 549,
  price3Car = 749,
  show1Car = true,
  show2Car = true,
  show3Car = true,
}: CleanOutBookingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("select");
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [addOrganizer, setAddOrganizer] = useState(false);

  // Customer info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Booking modal state
  const [leadId, setLeadId] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);

  function handleOpen() {
    setIsOpen(true);
    setAddOrganizer(false);
    setError("");
    // If only one option is available, skip the selection step
    const options = [show1Car && "1_car", show2Car && "2_car", show3Car && "3_car"].filter(Boolean) as ServiceType[];
    if (options.length === 1) {
      setServiceType(options[0]);
      setStep("info");
    } else {
      setStep("select");
      setServiceType(null);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setStep("select");
    setServiceType(null);
    setAddOrganizer(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setError("");
    setLeadId(null);
  }

  function handleSelectService(type: ServiceType) {
    setServiceType(type);
    setStep("info");
    setError("");
  }

  async function handleSubmitInfo() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError("All fields are required.");
      return;
    }
    if (!serviceType) return;

    setSubmitting(true);
    setError("");

    const result = await submitCleanOutLead({
      customer_name: `${firstName.trim()} ${lastName.trim()}`,
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      installer_id: installerId,
      service_type: serviceType,
      add_tote_organizer: addOrganizer,
      source: "partner_link",
      custom_price_1car: price1Car,
      custom_price_2car: price2Car,
      custom_price_3car: price3Car,
    });

    setSubmitting(false);

    if (result.success && result.id) {
      setLeadId(result.id);
      setTotalPrice(result.totalPrice!);
      setDepositAmount(result.depositAmount!);
      setIsOpen(false);
      setShowBookingModal(true);
    } else {
      setError(result.error || "Something went wrong.");
    }
  }

  const TOTE_ORGANIZER_PRICE = 500;
  const basePrice = serviceType === "1_car" ? price1Car : serviceType === "2_car" ? price2Car : serviceType === "3_car" ? price3Car : 0;
  const currentTotal = basePrice + (addOrganizer ? TOTE_ORGANIZER_PRICE : 0);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#0d1220] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-[#111827] sm:flex-row sm:items-start"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
          </svg>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-sm font-black uppercase tracking-wide text-white">
            Garage / Basement Clean Out
          </h3>
          <p className="mt-1 text-xs text-stone-400">
            We come, haul it away. Starting at {formatCurrency(Math.min(show1Car ? price1Car : Infinity, show2Car ? price2Car : Infinity, show3Car ? price3Car : Infinity))}.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-600 transition-transform group-hover:translate-x-0.5 group-hover:text-yellow-400" />
      </button>

      {/* Selection / Info Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            style={{ maxHeight: "85vh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">
                {step === "select" ? "Choose Your Clean Out" : "Your Info"}
              </h3>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="scrollbar-dark flex-1 overflow-y-auto p-5 pb-8">
              {step === "select" ? (
                /* Service Selection */
                <div className="space-y-4">
                  <p className="text-center text-sm text-stone-400">
                    We come and haul everything away. No sorting, no hassle.
                  </p>

                  {/* 1-Car Garage */}
                  {show1Car && (
                    <button
                      onClick={() => handleSelectService("1_car")}
                      className="group w-full rounded-xl border border-slate-700 bg-slate-800/60 p-5 text-left transition-all hover:border-yellow-400/40 hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-black text-white">
                            1-Car Garage
                          </h4>
                          <p className="mt-0.5 text-xs text-stone-400">
                            Single bay / small basement
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-yellow-400">{formatCurrency(price1Car)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-stone-500 transition-colors group-hover:text-yellow-400">
                        Select
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  )}

                  {/* 2-Car Garage */}
                  {show2Car && (
                    <button
                      onClick={() => handleSelectService("2_car")}
                      className="group w-full rounded-xl border border-slate-700 bg-slate-800/60 p-5 text-left transition-all hover:border-yellow-400/40 hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-black text-white">
                            2-Car Garage
                          </h4>
                          <p className="mt-0.5 text-xs text-stone-400">
                            Double bay / large basement
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-yellow-400">{formatCurrency(price2Car)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-stone-500 transition-colors group-hover:text-yellow-400">
                        Select
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  )}

                  {/* 3+ Car Garage */}
                  {show3Car && (
                    <button
                      onClick={() => handleSelectService("3_car")}
                      className="group w-full rounded-xl border border-slate-700 bg-slate-800/60 p-5 text-left transition-all hover:border-yellow-400/40 hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-black text-white">
                            3+ Car Garage
                          </h4>
                          <p className="mt-0.5 text-xs text-stone-400">
                            Triple bay / oversized space
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-yellow-400">{formatCurrency(price3Car)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-stone-500 transition-colors group-hover:text-yellow-400">
                        Select
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                /* Customer Info + Add-on */
                <div className="space-y-4">
                  {/* Selected service summary */}
                  <div className="rounded-xl bg-slate-800 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                          Clean Out
                        </p>
                        <p className="text-sm font-bold text-white">
                          {serviceType === "1_car" ? "1-Car Garage" : serviceType === "2_car" ? "2-Car Garage" : "3+ Car Garage"}
                        </p>
                      </div>
                      <span className="text-lg font-black text-yellow-400">
                        {formatCurrency(basePrice)}
                      </span>
                    </div>

                    {/* Tote Organizer Add-on */}
                    <div className="mt-3 border-t border-slate-700 pt-3">
                      <button
                        onClick={() => setAddOrganizer(!addOrganizer)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${
                          addOrganizer
                            ? "border-yellow-400/40 bg-yellow-400/10"
                            : "border-slate-700 bg-slate-800/80 hover:border-slate-600"
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
                            addOrganizer
                              ? "border-yellow-400 bg-yellow-400"
                              : "border-slate-600 bg-slate-700"
                          }`}
                        >
                          {addOrganizer ? (
                            <Check className="h-3 w-3 text-slate-900" />
                          ) : (
                            <Plus className="h-3 w-3 text-stone-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">
                            4x4 Tote Organizer System
                          </p>
                          <p className="text-[11px] text-stone-400">
                            16-tote storage rack, installed same day
                          </p>
                        </div>
                        <span className={`text-sm font-black ${addOrganizer ? "text-yellow-400" : "text-stone-400"}`}>
                          +$500
                        </span>
                      </button>
                    </div>

                    {/* Total */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-700 pt-3">
                      <span className="text-sm font-bold text-stone-400">Total</span>
                      <span className="text-xl font-black text-white">
                        {formatCurrency(currentTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Back button */}
                  <button
                    onClick={() => { setStep("select"); setServiceType(null); setAddOrganizer(false); }}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-300"
                  >
                    &larr; Change selection
                  </button>

                  {/* Customer info form */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Smith"
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                  </div>

                  {error && (
                    <p className="text-center text-xs font-medium text-red-400">
                      {error}
                    </p>
                  )}

                  <button
                    onClick={handleSubmitInfo}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-4 text-base font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Continue to Booking
                        <ChevronRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal (Address -> Schedule -> Payment) */}
      {showBookingModal && leadId && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setLeadId(null);
            handleClose();
          }}
          leadId={leadId}
          depositAmount={depositAmount}
          totalPrice={totalPrice}
          installerId={installerId}
          source="partner_link"
          customerEmail={email}
          customerName={`${firstName} ${lastName}`}
          installerLeadTime={installerLeadTime}
          installerWorkingDays={installerWorkingDays}
          totalCols={0}
          taxableAmount={addOrganizer ? TOTE_ORGANIZER_PRICE : 0}
        />
      )}
    </>
  );
}
