"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createCleanoutUpsellCheckout } from "@/app/actions/cleanout-upsell";

// ═══════════════════════════════════════════════════════════════════════════
// Cleanout Upsell Checkout Page
//
// URL: /upsell/[leadId]?service=cleanout_1car
//
// Displays service details and handles Stripe checkout redirect.
// The customer clicks "Add to My Service" in the email → lands here →
// confirms the add-on → redirected to Stripe Checkout for 50% deposit.
// ═══════════════════════════════════════════════════════════════════════════

interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  price: number;
}

// Service lookup — matches config/services.ts IDs
const SERVICE_MAP: Record<string, { name: string; description: string }> = {
  cleanout_1car: { name: "1-Car Garage Clean Out", description: "Single bay / small basement — we'll sort, organize, and remove clutter so you start fresh." },
  cleanout_2car: { name: "2-Car Garage Clean Out", description: "Double bay / large basement — a complete cleanout so your new storage works from day one." },
  cleanout_3car: { name: "3+ Car Garage Clean Out", description: "Triple bay / oversized space — full-service cleanout for maximum impact." },
};

export default function UpsellCheckoutPage({
  params,
}: {
  params: { leadId: string };
}) {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("service") || "";
  const { leadId } = params;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [fetchingService, setFetchingService] = useState(true);

  // Fetch service details from the lead's installer
  useEffect(() => {
    async function fetchService() {
      try {
        const res = await fetch(`/api/upsell/service?lead=${leadId}&service=${serviceId}`);
        const data = await res.json();
        if (data.success && data.service) {
          setServiceInfo(data.service);
        } else {
          // Fallback to static map
          const staticInfo = SERVICE_MAP[serviceId];
          if (staticInfo) {
            setServiceInfo({ id: serviceId, ...staticInfo, price: 0 });
          } else {
            setError("Service not found. Please try again from the email link.");
          }
        }
      } catch {
        // Fallback to static map
        const staticInfo = SERVICE_MAP[serviceId];
        if (staticInfo) {
          setServiceInfo({ id: serviceId, ...staticInfo, price: 0 });
        }
      } finally {
        setFetchingService(false);
      }
    }
    fetchService();
  }, [leadId, serviceId]);

  async function handleCheckout() {
    if (!serviceInfo || serviceInfo.price <= 0) {
      setError("Unable to determine service pricing. Please contact your installer.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createCleanoutUpsellCheckout({
        leadId,
        serviceId: serviceInfo.id,
        serviceName: serviceInfo.name,
        servicePrice: serviceInfo.price,
      });

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (fetchingService) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading service details...</div>
      </div>
    );
  }

  if (!serviceInfo || !serviceId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">&#128533;</div>
          <h1 className="text-xl font-bold text-white mb-2">Service Not Found</h1>
          <p className="text-slate-400 text-sm">
            This link may have expired or the service is no longer available.
            Please check your email for an updated link or contact your installer.
          </p>
        </div>
      </div>
    );
  }

  const depositAmount = Math.round(serviceInfo.price * 0.50);
  const remainingAmount = serviceInfo.price - depositAmount;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/landing_page_logo.png"
            alt="Storage Network"
            className="mx-auto w-20 h-20 mb-4"
          />
          <h1 className="text-2xl font-extrabold text-yellow-400 mb-2">
            Add to Your Appointment
          </h1>
          <p className="text-slate-400 text-sm">
            Effortlessly add this service to your upcoming installation
          </p>
        </div>

        {/* Service Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white mb-1">{serviceInfo.name}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{serviceInfo.description}</p>
          </div>

          <div className="p-6">
            {/* Pricing Breakdown */}
            <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mb-6">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-2 text-slate-400">Service Total</td>
                    <td className="py-2 text-right text-white font-bold text-lg">
                      ${serviceInfo.price.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-700">
                    <td className="pt-3 pb-1 text-slate-400">Deposit Due Today (50%)</td>
                    <td className="pt-3 pb-1 text-right text-green-400 font-bold text-xl">
                      ${depositAmount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-slate-500 text-xs">Remaining at Service</td>
                    <td className="py-1 text-right text-slate-400 text-xs">
                      ${remainingAmount.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* What's Included */}
            <div className="mb-6">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">
                What&rsquo;s Included
              </p>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>Professional cleanout by your installer</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>Sorting, organizing, and removal of clutter</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>Added to your existing appointment — no extra trip needed</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-400/50 text-slate-900 font-bold py-4 rounded-xl text-base uppercase tracking-wider transition-colors"
            >
              {loading ? "Processing..." : `Pay $${depositAmount} Deposit → Secure Checkout`}
            </button>

            <p className="text-center text-slate-500 text-xs mt-3">
              Powered by Stripe &bull; 256-bit encryption &bull; Secure payment
            </p>
          </div>
        </div>

        {/* No Obligation Note */}
        <p className="text-center text-slate-500 text-xs leading-relaxed">
          Changed your mind? No problem — simply close this page.
          Your installation is already confirmed regardless.
        </p>
      </div>
    </div>
  );
}
