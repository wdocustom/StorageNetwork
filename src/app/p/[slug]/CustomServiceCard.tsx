"use client";

import { useState } from "react";
import { Loader2, X, ChevronRight, Wrench } from "lucide-react";
import { submitCustomServiceLead } from "@/app/actions/submit-custom-service-lead";
import BookingModal from "@/components/booking/BookingModal";
import { formatCurrency } from "@/utils/paymentHelpers";
import type { ServiceOffering } from "@/config/services";

interface CustomServiceCardProps {
  installerId: string;
  installerSlug: string;
  installerLeadTime?: number;
  installerWorkingDays?: string[];
  service: ServiceOffering;
}

export default function CustomServiceCard({
  installerId,
  installerSlug,
  installerLeadTime = 5,
  installerWorkingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
  service,
}: CustomServiceCardProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    setError("");
  }

  function handleClose() {
    setIsOpen(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setError("");
    setLeadId(null);
  }

  async function handleSubmitInfo() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError("All fields are required.");
      return;
    }
    if (!service.price || service.price <= 0) {
      setError("This service is not properly configured.");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await submitCustomServiceLead({
      customer_name: `${firstName.trim()} ${lastName.trim()}`,
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      installer_id: installerId,
      service_name: service.name,
      service_price: service.price,
      source: "partner_link",
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

  return (
    <>
      {/* Trigger card */}
      <button
        onClick={handleOpen}
        className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#0d1220] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-[#111827] sm:flex-row sm:items-start"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          <Wrench className="h-6 w-6 text-yellow-400" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-sm font-black uppercase tracking-wide text-white">
            {service.name}
          </h3>
          {service.description && (
            <p className="mt-1 text-xs text-stone-400">{service.description}</p>
          )}
          {service.price != null && service.price > 0 && (
            <p className="mt-1 text-xs font-bold text-yellow-400">
              {formatCurrency(service.price)}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-600 transition-transform group-hover:translate-x-0.5 group-hover:text-yellow-400" />
      </button>

      {/* Info Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            style={{ maxHeight: "85vh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-bold text-white">{service.name}</h3>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="scrollbar-dark flex-1 overflow-y-auto p-5 pb-8">
              <div className="space-y-4">
                {/* Service summary */}
                <div className="rounded-xl bg-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                        Service
                      </p>
                      <p className="text-sm font-bold text-white">{service.name}</p>
                      {service.description && (
                        <p className="mt-0.5 text-xs text-stone-400">{service.description}</p>
                      )}
                    </div>
                    {service.price != null && service.price > 0 && (
                      <span className="text-xl font-black text-yellow-400">
                        {formatCurrency(service.price)}
                      </span>
                    )}
                  </div>
                </div>

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
                  <p className="text-center text-xs font-medium text-red-400">{error}</p>
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
          taxableAmount={0}
        />
      )}
    </>
  );
}
