"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  ShieldCheck,
  ArrowLeft,
  MapPin,
  ChevronRight,
  Receipt,
  Tag,
  X,
  Mail,
  Send,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { fetchPendingLead, type PendingLeadDetails } from "@/app/actions/abandoned-cart";
import { createDepositIntent, type LeadSource } from "@/app/actions/payments";
import { recordPayLinkView, recordPayLinkStep } from "@/app/actions/pay-link-tracking";
import { validateDiscountCode } from "@/app/actions/discount-codes";
import { formatCurrency, formatTaxRate } from "@/utils/paymentHelpers";
import { getSalesTax, getDepositAmount, type SalesTaxResult } from "@/app/actions/fee-engine";
import { contactInstaller } from "@/app/actions/contact-installer";
import { updateLeadWithAddons } from "@/app/actions/cleanout-upsell";

// ═══════════════════════════════════════════════════════════════════════════
// Resume Payment Page — /pay/[leadId]
//
// Flow:
//   1. Customer lands on page from quote email
//   2. Enters/confirms billing address (for sales tax)
//   3. Reviews order with tax calculated
//   4. Enters payment details via Stripe
// ═══════════════════════════════════════════════════════════════════════════

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

type Step = "address" | "review" | "payment";

interface BillingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export default function ResumePaymentPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<PendingLeadDetails | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Discount code state
  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number; discountType?: "fixed" | "percentage"; discountValue?: number } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  // Contact installer state
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  // Selected add-on services (inline upsell — no separate page)
  const [selectedAddons, setSelectedAddons] = useState<Map<string, { id: string; name: string; description: string; price: number }>>(new Map());
  const [addonDeposit, setAddonDeposit] = useState<number | null>(null);

  // Address state
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState<BillingAddress>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });
  // Email capture — shown only when lead has no customer_email
  const [customerEmailInput, setCustomerEmailInput] = useState("");

  // Fetch lead details on mount
  useEffect(() => {
    async function loadLead() {
      if (!leadId) {
        setError("Invalid order link.");
        setLoading(false);
        return;
      }

      const result = await fetchPendingLead(leadId);
      if (!result.success || !result.lead) {
        setError(result.error || "Order not found.");
        setLoading(false);
        return;
      }

      setLead(result.lead);

      // Track that the customer opened this pay link
      recordPayLinkView(leadId).catch(() => {});
      recordPayLinkStep(leadId, "address").catch(() => {});

      // Pre-fill address if available from lead
      if (result.lead.address) {
        // Try to parse address if it's a single line
        const parts = result.lead.address.split(",").map(s => s.trim());
        if (parts.length >= 3) {
          const stateZip = parts[parts.length - 1].split(" ");
          setAddress({
            line1: parts[0] || "",
            line2: "",
            city: parts[parts.length - 2] || "",
            state: stateZip[0] || "",
            zip: stateZip[1] || "",
          });
        }
      }

      // Auto-fill discount code if installer attached one to the quote
      if (result.lead.discount_code) {
        setDiscountInput(result.lead.discount_code);
        // Auto-validate it
        if (result.lead.installer_id) {
          const discountResult = await validateDiscountCode(
            result.lead.discount_code,
            result.lead.installer_id,
            result.lead.estimated_price
          );
          if (discountResult.valid) {
            setDiscountApplied({ code: discountResult.code!, amount: discountResult.discountAmount, discountType: discountResult.discountType, discountValue: discountResult.discountValue });
          }
        }
      }

      setLoading(false);
    }

    loadLead();
  }, [leadId]);

  // Delivery fee from the lead (already included in estimated_price, tax-exempt)
  const deliveryFee = lead?.delivery_fee || 0;

  // Indoor delivery fees (per-unit, already included in estimated_price)
  const indoorDeliveryTotal = (Array.isArray(lead?.quote_data) ? lead.quote_data : []).reduce((sum: number, u: any) =>
    sum + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee * (u.quantity || 1) : 0), 0);

  // Build-only price (estimated_price includes delivery fee + indoor delivery)
  const buildTotal = lead ? lead.estimated_price - deliveryFee - indoorDeliveryTotal : 0;

  // Add-on totals (selected inline — services added directly to this quote)
  const addonTotal = Array.from(selectedAddons.values()).reduce((s, a) => s + a.price, 0);
  const effectiveEstimatedPrice = (lead?.estimated_price || 0) + addonTotal;
  const effectiveBuildTotal = buildTotal + addonTotal;

  // Recalculate deposit when add-ons change
  useEffect(() => {
    if (!lead?.installer_id || addonTotal === 0) {
      setAddonDeposit(null);
      return;
    }
    getDepositAmount(effectiveEstimatedPrice, lead.installer_id).then(setAddonDeposit);
  }, [effectiveEstimatedPrice, lead?.installer_id, addonTotal]);

  // Determine taxable amount from quote_data:
  // - Delivery fee is tax-exempt
  // - Cleanout / custom service items are tax-exempt (labor services)
  // - Tote organizer add-ons ARE taxable (physical product)
  // - Regular tote builds (no cleanout/custom_service toteType) are fully taxable
  const taxableAmount = (() => {
    if (!lead) return 0;
    const units = Array.isArray(lead.quote_data) ? lead.quote_data : [];
    const hasServiceItem = units.some(
      (u: any) => u.toteType === "cleanout" || u.toteType === "custom_service"
    );
    if (!hasServiceItem) return buildTotal; // regular tote build — fully taxable (excludes delivery fee)
    // Service order: only tax tote organizer add-ons (physical product)
    return units
      .filter((u: any) => u.toteType !== "cleanout" && u.toteType !== "custom_service")
      .reduce((sum: number, u: any) => sum + (u.price || 0), 0);
  })();

  // Sales tax — computed server-side (tax rates stay in the black box).
  // Effective state = customer's typed billing state (if valid) else the
  // state derived from the quote's delivery ZIP at creation time. This lets
  // the customer see the estimate immediately AND have it recalc if their
  // billing address ends up in a different state.
  const [taxInfo, setTaxInfo] = useState<SalesTaxResult | null>(null);
  useEffect(() => {
    if (!lead) {
      setTaxInfo(null);
      return;
    }
    const enteredState = address.state && address.state.length === 2 ? address.state : null;
    const effectiveState = enteredState || lead.billing_state || null;
    if (!effectiveState) {
      setTaxInfo(null);
      return;
    }
    if (taxableAmount <= 0) {
      setTaxInfo({ taxRate: 0, taxAmount: 0, subtotal: 0, total: 0, stateName: effectiveState });
      return;
    }
    getSalesTax(taxableAmount, effectiveState, lead?.installer_id || undefined).then(setTaxInfo);
  }, [lead, taxableAmount, address.state]);

  // Discount only reduces balance, not deposit. Installer absorbs their own discounts.
  const discountAmount = discountApplied?.amount || 0;

  // Deposit uses installer's configured rate (min 15%) — recalculated when add-ons selected
  const effectiveDeposit = addonDeposit ?? (lead?.deposit_amount || 0);

  // Balance at installation = remaining build cost - discount + sales tax
  const balanceAtInstall = lead
    ? (effectiveEstimatedPrice - effectiveDeposit - discountAmount) + (taxInfo?.taxAmount || 0)
    : 0;

  // Address validation
  function handleAddressNext() {
    if (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError("Please fill in all required address fields.");
      return;
    }
    if (address.state.length !== 2) {
      setError("Please enter a valid 2-letter state code (e.g., TX, CA).");
      return;
    }
    // Validate email if the lead doesn't already have one
    if (!lead?.customer_email && customerEmailInput.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmailInput.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    if (!lead?.customer_email && !customerEmailInput.trim()) {
      setError("Please enter your email address so we can send your receipt.");
      return;
    }
    setError(null);
    setStep("review");
    recordPayLinkStep(leadId, "review").catch(() => {});
  }

  // Apply discount code
  async function handleApplyDiscount() {
    if (!discountInput.trim() || !lead?.installer_id) return;
    setDiscountLoading(true);
    setDiscountError("");
    const result = await validateDiscountCode(discountInput.trim(), lead.installer_id, lead.estimated_price);
    setDiscountLoading(false);
    if (result.valid) {
      setDiscountApplied({ code: result.code!, amount: result.discountAmount, discountType: result.discountType, discountValue: result.discountValue });
      setDiscountError("");
    } else {
      setDiscountApplied(null);
      setDiscountError(result.error || "Invalid code.");
    }
  }

  function handleRemoveDiscount() {
    setDiscountApplied(null);
    setDiscountInput("");
    setDiscountError("");
  }

  // Toggle an add-on service selection (inline upsell)
  function toggleAddon(svc: { id: string; name: string; description: string; price: number }) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(svc.id)) {
        next.delete(svc.id);
      } else {
        next.set(svc.id, svc);
      }
      return next;
    });
  }

  // Contact installer handler
  async function handleContactInstaller() {
    if (!contactMessage.trim()) {
      setContactError("Please enter a message.");
      return;
    }
    if (!lead?.installer_id) {
      setContactError("No installer assigned to this order.");
      return;
    }

    setContactSending(true);
    setContactError("");
    try {
      const result = await contactInstaller({
        installerId: lead.installer_id,
        customerName: lead.customer_name,
        customerEmail: lead.customer_email,
        customerPhone: lead.customer_phone || undefined,
        message: contactMessage.trim(),
        quoteTotal: lead.estimated_price,
        leadId: lead.id,
      });

      if (!result.success) {
        setContactError(result.error || "Failed to send message.");
        return;
      }

      setContactSent(true);
      setContactMessage("");
    } catch {
      setContactError("Failed to send message. Please try again.");
    } finally {
      setContactSending(false);
    }
  }

  // Initialize Stripe payment
  const initializePayment = useCallback(async () => {
    if (!lead) return;

    setInitializingPayment(true);
    setError(null);

    try {
      let paymentTotal = lead.estimated_price;
      let paymentDeposit = lead.deposit_amount;

      // If add-ons are selected, update the lead first so the DB
      // reflects the correct total before the payment intent is created
      if (selectedAddons.size > 0) {
        const addons = Array.from(selectedAddons.values()).map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
        }));
        const addonResult = await updateLeadWithAddons({
          leadId: lead.id,
          services: addons,
        });
        if (!addonResult.success) {
          setError(addonResult.error || "Failed to add services to quote.");
          setInitializingPayment(false);
          return;
        }
        paymentTotal = addonResult.newTotal;
        paymentDeposit = addonResult.newDeposit;
      }

      const result = await createDepositIntent({
        leadId: lead.id,
        amount: paymentDeposit,
        totalPrice: paymentTotal,
        installerId: lead.installer_id || undefined,
        customerEmail: lead.customer_email || customerEmailInput.trim() || undefined,
        customerName: lead.customer_name || undefined,
        source: (lead.source as LeadSource) || "platform",
        // Tax info for records (collected at installation)
        salesTaxAmount: taxInfo?.taxAmount || 0,
        billingState: address.state,
        // Discount code
        discountCode: discountApplied?.code,
        discountCodeAmount: discountApplied?.amount,
      });

      if (!result.success || !result.clientSecret) {
        setError(result.error || "Failed to initialize payment.");
        setInitializingPayment(false);
        return;
      }

      setClientSecret(result.clientSecret);
      setStep("payment");
      recordPayLinkStep(leadId, "payment").catch(() => {});
    } catch (err) {
      setError("Failed to initialize payment. Please try again.");
      console.error("Payment init error:", err);
    } finally {
      setInitializingPayment(false);
    }
  }, [lead, selectedAddons, taxInfo, address.state, discountApplied, customerEmailInput]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Loading State
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-400" />
          <p className="mt-4 text-sm text-stone-400">Loading your order...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Error State
  // ═══════════════════════════════════════════════════════════════════════════

  if (error && !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Order Not Found</h1>
          <p className="mb-6 text-sm text-stone-400">{error}</p>
          <a
            href="/design"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Start a New Order
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Success State
  // ═══════════════════════════════════════════════════════════════════════════

  if (paymentSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-2xl border border-emerald-800 bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Payment Complete!</h1>
          <p className="mb-6 text-sm text-stone-400">
            Your order has been confirmed. You&apos;ll receive a confirmation email shortly
            with your installation details.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Main Payment Page
  // ═══════════════════════════════════════════════════════════════════════════

  if (!lead) return null;

  // Parse quote data for display
  const units = Array.isArray(lead.quote_data) ? lead.quote_data : [];
  // Count display units (consolidate old-format preset sub-units like "Name — NxN")
  const presetNamePattern = /^(.+?) — \d+×\d+$/;
  const uniquePresetNames = new Set(
    units.map((u: any) => u.desc?.match(presetNamePattern)?.[1]).filter(Boolean)
  );
  const unitCount = units.length - units.filter((u: any) => u.desc?.match(presetNamePattern)).length + uniquePresetNames.size;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 py-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Complete Your Order</h1>
          {lead.installer_name && (
            <p className="mt-1 text-sm text-stone-400">
              with <span className="font-semibold text-yellow-400">{lead.installer_name}</span>
            </p>
          )}
        </div>

        {/* Step Indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {(["address", "review", "payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === s
                    ? "bg-yellow-400 text-slate-900"
                    : (["address", "review", "payment"].indexOf(step) > i)
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-stone-600"
                }`}
              >
                {(["address", "review", "payment"].indexOf(step) > i) ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && <div className="h-px w-8 bg-slate-800" />}
            </div>
          ))}
        </div>

        {/* Order Summary Card - Always visible */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Order Summary
            </h2>
          </div>

          {/* Units — consolidate preset sub-units (old format "Name — NxN") into single lines */}
          <div className="mb-4 space-y-2">
            {(() => {
              // Detect old-format preset sub-units: descs matching "PresetName — NxN"
              const presetPattern = /^(.+?) — \d+×\d+$/;
              const presetGroups = new Map<string, { units: any[]; indices: number[] }>();
              const standalone: { unit: any; idx: number }[] = [];

              units.forEach((unit: any, idx: number) => {
                const match = unit.desc?.match(presetPattern);
                if (match) {
                  const name = match[1];
                  const group = presetGroups.get(name) || { units: [], indices: [] };
                  group.units.push(unit);
                  group.indices.push(idx);
                  presetGroups.set(name, group);
                } else {
                  standalone.push({ unit, idx });
                }
              });

              const items: React.ReactNode[] = [];
              const rendered = new Set<string>();
              let itemNum = 0;

              units.forEach((unit: any, idx: number) => {
                const match = unit.desc?.match(presetPattern);
                if (match) {
                  const name = match[1];
                  if (rendered.has(name)) return;
                  rendered.add(name);
                  const group = presetGroups.get(name)!;
                  itemNum++;

                  // Consolidate: single card for the whole preset group
                  const groupPrice = group.units.reduce((s: number, u: any) => s + (u.price || 0), 0);
                  const dims = group.units.map((u: any) => `${u.cols}×${u.rows}`).join(" + ");
                  const totalSlots = group.units.reduce((s: number, u: any) => s + (u.cols || 0) * (u.rows || 0), 0);
                  const features = [
                    group.units[0]?.hasTotes && "Totes",
                    group.units.some((u: any) => u.hasWheels) && "Wheels",
                    group.units.some((u: any) => u.hasTop) && "Top",
                    group.units.some((u: any) => u.indoorDelivery) && "Indoor Delivery",
                  ].filter(Boolean).join(", ");

                  items.push(
                    <div key={`preset-${name}`} className="flex items-center justify-between rounded-lg border border-yellow-400/30 bg-slate-800 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Unit #{itemNum}: {name} ({dims} — {totalSlots} slots)
                        </p>
                        <p className="text-xs text-stone-400">{features || "Frame Only"}</p>
                      </div>
                      <span className="text-sm font-bold text-white">{formatCurrency(groupPrice)}</span>
                    </div>
                  );
                } else {
                  itemNum++;
                  items.push(
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Unit #{itemNum}: {unit.desc || `${unit.cols}W × ${unit.rows}H`}
                        </p>
                        <p className="text-xs text-stone-400">
                          {[unit.hasTotes && "Totes", unit.hasWheels && "Wheels", unit.hasTop && "Top", unit.indoorDelivery && "Indoor Delivery"].filter(Boolean).join(", ") || "Frame Only"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white">{formatCurrency(unit.price || 0)}</span>
                    </div>
                  );
                }
              });

              return items;
            })()}
          </div>

          {/* Selected Add-On Services (shown as line items) */}
          {selectedAddons.size > 0 && (
            <div className="mb-4 space-y-2">
              {Array.from(selectedAddons.values()).map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">Add-On: {addon.name}</p>
                      <p className="text-xs text-stone-400">{addon.description}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(addon.price)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add-On Service Picker */}
          {lead.installer_services && lead.installer_services.length > 0 && !units.some((u: any) => u.toteType === "cleanout" || u.toteType === "custom_service") && (
            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                Add-On Services
              </p>
              <p className="mb-3 text-sm text-stone-300">
                Want us to clean out your space before installation?
              </p>
              <div className="space-y-2">
                {lead.installer_services.map((svc) => {
                  const isSelected = selectedAddons.has(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleAddon(svc)}
                      className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-700 bg-slate-800 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{svc.name}</p>
                        <p className="text-xs text-stone-400">{svc.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-400">
                          {formatCurrency(svc.price)}
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-stone-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedAddons.size > 0 ? (
                <p className="mt-2 text-[11px] text-emerald-400 text-center font-medium">
                  {selectedAddons.size} add-on{selectedAddons.size > 1 ? "s" : ""} included in your deposit below
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-stone-500 text-center">
                  Click to add — included in your single deposit payment
                </p>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-400">{deliveryFee > 0 || addonTotal > 0 || indoorDeliveryTotal > 0 ? "Build" : "Total"} ({unitCount} unit{unitCount !== 1 ? "s" : ""})</span>
              <span className="font-bold text-white">{formatCurrency(deliveryFee > 0 || addonTotal > 0 || indoorDeliveryTotal > 0 ? buildTotal : lead.estimated_price)}</span>
            </div>
            {addonTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-400">Add-On Services</span>
                <span className="font-bold text-emerald-400">{formatCurrency(addonTotal)}</span>
              </div>
            )}
            {indoorDeliveryTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-400">Indoor Delivery</span>
                <span className="font-bold text-white">{formatCurrency(indoorDeliveryTotal)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-stone-400">
                  <MapPin className="h-3 w-3 text-yellow-400" />
                  Delivery Fee
                </span>
                <span className="font-bold text-white">{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            {(deliveryFee > 0 || addonTotal > 0 || indoorDeliveryTotal > 0) && (
              <div className="flex items-center justify-between text-sm border-t border-slate-700/50 pt-2">
                <span className="text-stone-400">Total</span>
                <span className="font-bold text-white">{formatCurrency(effectiveEstimatedPrice)}</span>
              </div>
            )}

            {/* Due Today = Deposit (adjusts when add-ons are included) */}
            <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2">
              <span className="font-bold text-stone-300">Due Today (Deposit)</span>
              <span className="text-xl font-black text-yellow-400">
                {formatCurrency(effectiveDeposit)}
              </span>
            </div>
            {addonTotal > 0 && lead && effectiveDeposit > lead.deposit_amount && (
              <p className="text-[11px] text-yellow-400/70 text-center">
                Deposit adjusted from {formatCurrency(lead.deposit_amount)} to include add-on services
              </p>
            )}

            {/* Balance at installation */}
            <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Remaining Balance</span>
                <span className="text-stone-400">{formatCurrency(effectiveEstimatedPrice - effectiveDeposit)}</span>
              </div>
              {discountApplied && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Tag className="h-3 w-3" />
                    Code: {discountApplied.code}
                  </span>
                  <span className="text-emerald-400 font-bold">-{formatCurrency(discountApplied.amount)}</span>
                </div>
              )}
              {/* Tax line - show calculated or notice */}
              {step === "address" ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 italic">Sales Tax</span>
                  <span className="text-xs text-stone-500 italic">Calculated after address</span>
                </div>
              ) : taxInfo && taxInfo.taxAmount > 0 ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">
                    Sales Tax ({formatTaxRate(taxInfo.taxRate)} - {taxInfo.stateName})
                  </span>
                  <span className="text-stone-400">{formatCurrency(taxInfo.taxAmount)}</span>
                </div>
              ) : null}
              {step !== "address" && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                  <span className="text-stone-400 font-medium">Total at Installation</span>
                  <span className="text-stone-300 font-semibold">{formatCurrency(balanceAtInstall)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            Customer Details
          </h3>
          <div className="space-y-1 text-sm">
            <p className="text-white">{lead.customer_name}</p>
            <p className="text-stone-400">{lead.customer_email || customerEmailInput || "—"}</p>
            {lead.customer_phone && (
              <p className="text-stone-400">{lead.customer_phone}</p>
            )}
          </div>
        </div>

        {/* ── Contact Installer ──────────────────────────────────────── */}
        {lead.installer_id && lead.installer_name && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            {!showContactForm && !contactSent ? (
              <button
                onClick={() => setShowContactForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-semibold text-stone-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <Mail className="h-4 w-4 text-yellow-400" />
                Have a Question? Email {lead.installer_name}
              </button>
            ) : contactSent ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                <p className="text-sm font-semibold text-white">Message Sent!</p>
                <p className="mt-1 text-xs text-stone-400">
                  {lead.installer_name} will get back to you shortly.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                    <Mail className="h-4 w-4 text-yellow-400" />
                    Email {lead.installer_name}
                  </span>
                  <button
                    onClick={() => { setShowContactForm(false); setContactError(""); }}
                    className="text-stone-500 hover:text-stone-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Ask about scheduling, installation process, your quote, or anything else..."
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
                {contactError && (
                  <p className="mt-1.5 text-xs font-medium text-red-400">{contactError}</p>
                )}
                <button
                  onClick={handleContactInstaller}
                  disabled={contactSending || !contactMessage.trim()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                >
                  {contactSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {contactSending ? "Sending…" : "Send Message"}
                </button>
                <p className="mt-2 text-[11px] text-stone-500 text-center">
                  Your name and email will be shared so they can reply directly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP: ADDRESS
        ═══════════════════════════════════════════════════════════════════ */}
        {step === "address" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Billing Address
              </h2>
            </div>
            <p className="mb-4 text-sm text-stone-400">
              Enter your billing address to calculate applicable sales tax.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  placeholder="123 Main St"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Apt / Suite
                </label>
                <input
                  type="text"
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  placeholder="Apt 4B"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    City *
                  </label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Austin"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    State *
                  </label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="TX"
                    maxLength={2}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Zip *
                  </label>
                  <input
                    type="text"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    placeholder="78701"
                    maxLength={5}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Email capture — only shown when lead has no customer_email */}
            {!lead.customer_email && (
              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={customerEmailInput}
                  onChange={(e) => setCustomerEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-stone-500">
                  For your payment receipt and booking confirmation.
                </p>
              </div>
            )}

            <button
              onClick={handleAddressNext}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
            >
              <MapPin className="h-4 w-4" />
              Continue to Review
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP: REVIEW (with tax calculated)
        ═══════════════════════════════════════════════════════════════════ */}
        {step === "review" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Review & Pay
              </h2>
            </div>

            {/* Address display */}
            <div className="mb-4 rounded-lg bg-slate-800 p-3">
              <p className="text-xs font-bold uppercase text-stone-500 mb-1">Billing Address</p>
              <p className="text-sm text-white">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
              <p className="text-sm text-stone-400">{address.city}, {address.state} {address.zip}</p>
              <button
                onClick={() => setStep("address")}
                className="mt-2 text-xs text-yellow-400 hover:text-yellow-300"
              >
                Edit Address
              </button>
            </div>

            {/* Payment breakdown */}
            <div className="mb-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-stone-400">Build Total</span>
                <span className="text-white">{formatCurrency(buildTotal)}</span>
              </div>
              {addonTotal > 0 && (
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-emerald-400">Add-On Services</span>
                  <span className="text-emerald-400">{formatCurrency(addonTotal)}</span>
                </div>
              )}
              {indoorDeliveryTotal > 0 && (
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-stone-400">Indoor Delivery</span>
                  <span className="text-white">{formatCurrency(indoorDeliveryTotal)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-1 text-stone-400">
                    <MapPin className="h-3 w-3 text-yellow-400" />
                    Delivery Fee
                  </span>
                  <span className="text-white">{formatCurrency(deliveryFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-yellow-400/20 pt-2 mt-2">
                <span className="font-bold text-white">Due Today (Deposit)</span>
                <span className="text-xl font-black text-yellow-400">
                  {formatCurrency(effectiveDeposit)}
                </span>
              </div>
              {addonTotal > 0 && lead && effectiveDeposit > lead.deposit_amount && (
                <p className="text-[11px] text-yellow-400/70 text-center mt-1">
                  Deposit adjusted from {formatCurrency(lead.deposit_amount)} to include add-on services
                </p>
              )}
              {/* Balance at installation — discount applied here */}
              <div className="mt-3 pt-2 border-t border-yellow-400/10 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Remaining Balance</span>
                  <span className="text-stone-400">{formatCurrency(effectiveEstimatedPrice - effectiveDeposit)}</span>
                </div>
                {discountApplied && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <Tag className="h-3 w-3" />
                      Code: {discountApplied.code}
                      <button onClick={handleRemoveDiscount} className="ml-1 text-stone-500 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                    <span className="text-emerald-400 font-bold">-{formatCurrency(discountApplied.amount)}</span>
                  </div>
                )}
                {taxInfo && taxInfo.taxAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">Sales Tax ({formatTaxRate(taxInfo.taxRate)})</span>
                    <span className="text-stone-400">{formatCurrency(taxInfo.taxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-yellow-400/10">
                  <span className="text-stone-400 font-medium">Total at Installation</span>
                  <span className="text-stone-300 font-semibold">{formatCurrency(balanceAtInstall)}</span>
                </div>
              </div>
            </div>

            <p className="mb-4 text-xs text-stone-500 text-center">
              Sales tax will be collected by your installer at installation.
            </p>

            {/* Discount Code Input */}
            {!discountApplied ? (
              <div className="mb-4">
                <label className="mb-1.5 block text-[10px] font-bold uppercase text-stone-500">
                  Discount Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountInput}
                    onChange={(e) => { setDiscountInput(e.target.value.toUpperCase()); setDiscountError(""); }}
                    placeholder="Enter code"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") handleApplyDiscount(); }}
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={!discountInput.trim() || discountLoading}
                    className="rounded-lg bg-slate-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                  >
                    {discountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                  </button>
                </div>
                {discountError && (
                  <p className="mt-1.5 text-xs text-red-400">{discountError}</p>
                )}
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                <Tag className="h-4 w-4 text-emerald-400" />
                <span className="flex-1 text-sm font-semibold text-emerald-400">
                  {discountApplied.code} — {discountApplied.discountType === "percentage" ? `${discountApplied.discountValue}% off` : `${formatCurrency(discountApplied.amount)} off`}
                </span>
                <button onClick={handleRemoveDiscount} className="text-stone-500 hover:text-red-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              onClick={initializePayment}
              disabled={initializingPayment}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
            >
              {initializingPayment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {initializingPayment ? "Initializing..." : `Pay ${formatCurrency(effectiveDeposit)}`}
            </button>

            {/* Trust Badges */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Secure Checkout
              </span>
              <span>•</span>
              <span>Powered by Stripe</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP: PAYMENT (Stripe Elements)
        ═══════════════════════════════════════════════════════════════════ */}
        {step === "payment" && clientSecret && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Enter Payment Details
              </h2>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#facc15",
                    colorBackground: "#1e293b",
                    colorText: "#f8fafc",
                    colorDanger: "#ef4444",
                    fontFamily: "system-ui, sans-serif",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <PaymentForm
                totalAmount={effectiveDeposit}
                onSuccess={() => setPaymentSuccess(true)}
                onError={setError}
              />
            </Elements>
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Payment Form Component (uses Stripe Elements context)
// ═══════════════════════════════════════════════════════════════════════════

function PaymentForm({
  totalAmount,
  onSuccess,
  onError,
}: {
  totalAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "Payment validation failed.");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      onError(confirmError.message || "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    // Payment succeeded
    onSuccess();
    setProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-4 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {processing ? "Processing..." : `Pay ${formatCurrency(totalAmount)}`}
      </button>

      <p className="mt-3 text-center text-xs text-stone-500">
        Your card will be charged {formatCurrency(totalAmount)} for the deposit.
        Sales tax will be collected by your installer at installation.
      </p>
    </form>
  );
}
