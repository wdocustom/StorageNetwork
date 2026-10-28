"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { submitNetworkLead, type QuoteItem } from "@/app/actions/submit-lead";
import { captureCanvasBlob } from "@/utils/captureCanvas";
import { uploadBuildSnapshot } from "@/utils/uploadImage";
import { submitWaitlistRequest } from "@/app/actions/installer";
import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { DEFAULT_TOTE_UNIT, type StudioRules } from "@/lib/studio";
import { expandPresetUnits } from "@/lib/buildEngine.types";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import type { MultiUnitItem } from "@/components/visualizer/RackVisualizer";
import BookingModal from "@/components/booking/BookingModal";
import type { ConfiguratorSidebarProps } from "@/components/design/configurator-types";
import StudioPanel from "@/components/design/studio/StudioPanel";
import StudioDimensions from "@/components/design/studio/StudioDimensions";
import type { StudioPrices } from "@/components/design/studio/StudioUnitEditor";
import PageViewTracker from "@/components/tracking/PageViewTracker";
const CustomerChatWidget = dynamic(() => import("@/components/chat/CustomerChatWidget"), { ssr: false });
import { AlertTriangle, ArrowLeft, User } from "lucide-react";

import {
  useInstallerContext,
  usePresets,
  useProductAddons,
  useOrderCart,
  useBookingForm,
  useServiceArea,
  usePricing,
  useContactInstaller,
} from "@/hooks/configurator";
import { useStudio } from "@/hooks/configurator/useStudio";
import type { DesignConfiguratorProps, UnitConfig, ToteType, ToteColor } from "@/hooks/configurator";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DesignConfigurator({
  initialData,
  initialZip,
  mode,
  isDemo = false,
  leadSource = "platform",
  parentLeadId,
  savedSignal,
  initialInstallerAtCapacity = false,
  initialConfig,
}: DesignConfiguratorProps) {

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK INITIALIZATION (ordered by dependency graph)
  // ═══════════════════════════════════════════════════════════════════════

  const installer = useInstallerContext({ initialData });

  const presets = usePresets({
    pricing: installer.data?.pricing,
    globalTotesDisabled: installer.globalTotesDisabled,
  });

  const cart = useOrderCart({
    initialConfig: initialConfig ?? null,
    pricing: installer.data?.pricing,
  });

  const productAddons = useProductAddons({
    pricing: installer.data?.pricing,
    servicesConfig: installer.data?.servicesConfig,
    setOrderItems: cart.setOrderItems,
  });

  // Chair options while it's being configured in the studio's "+" view
  const [chairSelected, setChairSelected] = useState(false);
  const [chairFinish, setChairFinish] = useState<import("@/lib/chairs").ChairFinish>("natural");
  const [chairQuantity, setChairQuantity] = useState(1);

  const booking = useBookingForm({
    installerId: installer.installerId,
  });

  const serviceArea = useServiceArea({
    initialZip,
    initialData,
    initialInstallerAtCapacity,
    savedSignal,
    addrZip: booking.addrZip,
    deliveryZip: booking.deliveryZip,
    hasDifferentDelivery: booking.hasDifferentDelivery,
    orderItems: cart.orderItems,
    setData: installer.setData,
    setInstallerId: installer.setInstallerId,
    setOrderItems: cart.setOrderItems,
    setFirstName: booking.setFirstName,
    setLastName: booking.setLastName,
    setEmail: booking.setEmail,
    setPhone: booking.setPhone,
  });

  const pricingState = usePricing({
    orderItems: cart.orderItems,
    deliveryFeeResult: serviceArea.deliveryFeeResult,
    cleanoutPrice: productAddons.cleanoutPrice,
    installerId: installer.installerId,
  });

  const contact = useContactInstaller({
    installerId: installer.installerId,
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    grandTotal: pricingState.grandTotal,
    orderItems: cart.orderItems,
    zip: serviceArea.zip,
  });

  // Single-page design studio (replaces the 4-step sidebar when `studio`)
  const studioRules: StudioRules = {
    use2x4Rails: installer.data?.pricing?.use_2x4_rails === true,
    totesDisabled: installer.globalTotesDisabled,
    miniEnabled: installer.data?.pricing?.mini_enabled === true,
  };
  const studioState = useStudio({
    orderItems: cart.orderItems,
    setOrderItems: cart.setOrderItems,
    pricing: installer.data?.pricing,
    rules: studioRules,
    // Same paint rates usePricing / the quote card use
    paintPrices: {
      frame: installer.data?.pricing?.addon_pricing?.paint_frame_price ?? installer.data?.addonDefaults?.paint_frame_price ?? 75,
      doorsPanels: installer.data?.pricing?.addon_pricing?.paint_doors_panels_price ?? installer.data?.addonDefaults?.paint_doors_panels_price ?? 30,
    },
    initialConfig,
  });
  // A shelving / ceiling rail / raised bed / chair being configured in the
  // studio's "+" view is previewed in the 3D instead of the whole order.
  const studioPreviewing = !!(
    presets.activePreset ||
    productAddons.activeShelvingConfig ||
    productAddons.overheadPreview ||
    productAddons.raisedBedPreview ||
    productAddons.chairPreview
  );
  const preview =
    presets.activePresetObj && presets.compoundBuild
      ? { preset: presets.activePresetObj, compound: presets.compoundBuild }
      : null;
  const clearStudioPreviews = useCallback(() => {
    productAddons.setShelvingConfigId(null);
    productAddons.setOverheadPreview(null);
    productAddons.setRaisedBedPreview(null);
    productAddons.setChairPreview(null);
    setChairSelected(false);
    presets.setActivePreset(null);
    presets.setCompoundBuild(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // One preview at a time: a bestseller replaces any product preview
  const previewStudioBestseller = useCallback((presetId: string) => {
    productAddons.setShelvingConfigId(null);
    productAddons.setOverheadPreview(null);
    productAddons.setRaisedBedPreview(null);
    productAddons.setChairPreview(null);
    setChairSelected(false);
    presets.setCompoundBuild(null);
    presets.setActivePreset(presetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTIVE LEAD TIME (3-day minimum when any unit has caster wheels)
  // ═══════════════════════════════════════════════════════════════════════

  const effectiveLeadTime = cart.anyHasWheels
    ? Math.max(installer.effectiveLeadTime, 3)
    : installer.effectiveLeadTime;

  // ═══════════════════════════════════════════════════════════════════════
  // CROSS-CUTTING HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleWaitlist = useCallback(async () => {
    serviceArea.setWaitlistError("");
    const fullName = [booking.firstName.trim(), booking.lastName.trim()].filter(Boolean).join(" ");
    if (!fullName || !booking.email.trim()) {
      serviceArea.setWaitlistError("Name and email are required to join the waitlist.");
      return;
    }
    if (!EMAIL_REGEX.test(booking.email.trim())) {
      serviceArea.setWaitlistError("Please enter a valid email address.");
      return;
    }
    const waitlistZip = booking.hasDifferentDelivery ? booking.deliveryZip.trim() : booking.addrZip.trim();
    if (!waitlistZip) {
      serviceArea.setWaitlistError("ZIP code is required.");
      return;
    }
    serviceArea.setWaitlistSending(true);
    try {
      const res = await submitWaitlistRequest({
        installer_id: installer.installerId,
        customer_name: fullName,
        customer_email: booking.email.trim(),
        customer_phone: booking.phone.trim() || undefined,
        customer_zip: waitlistZip,
        quote_data: cart.orderItems.length > 0 ? (() => {
          const items: unknown[] = [...expandPresetUnits(cart.orderItems)];
          if (productAddons.selectedCleanout && productAddons.cleanoutPrice > 0) {
            const svc = installer.data?.servicesConfig?.find((s) => s.id === productAddons.selectedCleanout);
            items.push({ type: "cleanout_service", serviceId: productAddons.selectedCleanout, name: svc?.name || productAddons.selectedCleanout, price: productAddons.cleanoutPrice });
          }
          return items;
        })() : undefined,
      });
      if (res.success) {
        serviceArea.setWaitlistSent(true);
      } else {
        serviceArea.setWaitlistError(res.error || "Something went wrong.");
      }
    } catch {
      serviceArea.setWaitlistError("Something went wrong. Please try again.");
    } finally {
      serviceArea.setWaitlistSending(false);
    }
  }, [
    booking.firstName, booking.lastName, booking.email, booking.phone,
    booking.hasDifferentDelivery, booking.deliveryZip, booking.addrZip,
    installer.installerId, installer.data?.servicesConfig,
    cart.orderItems, productAddons.selectedCleanout, productAddons.cleanoutPrice,
    serviceArea.setWaitlistError, serviceArea.setWaitlistSending, serviceArea.setWaitlistSent,
  ]);

  const handleBookDeposit = useCallback(async () => {
    booking.setSubmitError("");
    if (!booking.firstName.trim() || !booking.lastName.trim() || !booking.email.trim() || !booking.phone.trim()) {
      booking.setSubmitError("First name, last name, email, and phone are required.");
      return;
    }
    if (!EMAIL_REGEX.test(booking.email.trim())) {
      booking.setSubmitError("Please enter a valid email address.");
      return;
    }
    if (cart.orderItems.length === 0) {
      booking.setSubmitError("Add at least one unit to your quote first.");
      return;
    }
    if (serviceArea.zipOutOfArea) {
      booking.setSubmitError(serviceArea.zipCheckMsg || "Installation ZIP is outside the service area.");
      return;
    }

    booking.setSubmitting(true);
    try {
      const blob = await captureCanvasBlob("canvas");
      const snapshotUrl = blob ? await uploadBuildSnapshot(blob) : undefined;

      const fullName = [booking.firstName.trim(), booking.lastName.trim()].filter(Boolean).join(" ");
      const compositeAddress = [booking.streetAddress, booking.city, booking.addrState, booking.addrZip].filter(Boolean).join(", ");
      const deliveryAddress = booking.hasDifferentDelivery
        ? [booking.deliveryStreet, booking.deliveryCity, booking.deliveryState, booking.deliveryZip].filter(Boolean).join(", ")
        : undefined;
      const result = await submitNetworkLead({
        customer_name: fullName,
        customer_email: booking.email,
        customer_phone: booking.phone,
        address: compositeAddress,
        address_line1: booking.streetAddress,
        address_city: booking.city,
        address_state: booking.addrState,
        address_zip: booking.addrZip,
        delivery_address: deliveryAddress,
        quote_data: (() => {
          const expandedUnits = expandPresetUnits(cart.orderItems);
          const items: QuoteItem[] = [...expandedUnits];
          if (productAddons.selectedCleanout && productAddons.cleanoutPrice > 0) {
            const svc = installer.data?.servicesConfig?.find((s) => s.id === productAddons.selectedCleanout);
            items.push({
              type: "cleanout_service",
              serviceId: productAddons.selectedCleanout,
              name: svc?.name || productAddons.selectedCleanout,
              price: productAddons.cleanoutPrice,
            });
          }
          // Paint is priced into each unit's line (studio), not a separate line
          return items;
        })(),
        grand_total: pricingState.grandTotal,
        installer_id: installer.installerId || undefined,
        referring_installer_id: serviceArea.referringInstallerId || undefined,
        source: leadSource,
        parent_lead_id: parentLeadId || undefined,
        build_snapshot_url: snapshotUrl || undefined,
      });

      if (!result.success || !result.id) {
        booking.setSubmitError(result.error || "Submission failed.");
        booking.setSubmitting(false);
        return;
      }

      booking.setLeadId(result.id);

      if (installer.installerId) {
        booking.setShowBookingModal(true);
      } else {
        booking.setSubmitted(true);
      }
    } catch (err) {
      booking.setSubmitError(
        err instanceof Error ? err.message : "Submission failed.",
      );
    } finally {
      booking.setSubmitting(false);
    }
  }, [
    booking.firstName, booking.lastName, booking.email, booking.phone,
    booking.streetAddress, booking.city, booking.addrState, booking.addrZip,
    booking.hasDifferentDelivery, booking.deliveryStreet, booking.deliveryCity,
    booking.deliveryState, booking.deliveryZip,
    booking.setSubmitError, booking.setSubmitting, booking.setLeadId,
    booking.setShowBookingModal, booking.setSubmitted,
    cart.orderItems, serviceArea.zipOutOfArea, serviceArea.zipCheckMsg,
    serviceArea.referringInstallerId, installer.installerId, installer.data?.servicesConfig,
    productAddons.selectedCleanout, productAddons.cleanoutPrice,
    pricingState.grandTotal,
    leadSource, parentLeadId,
  ]);

  const handleJoinTrialCapWaitlist = useCallback(async () => {
    serviceArea.setTrialCapWaitlistError("");
    const fullName = [booking.firstName.trim(), booking.lastName.trim()].filter(Boolean).join(" ");
    if (!fullName || !booking.email.trim() || !booking.phone.trim()) {
      serviceArea.setTrialCapWaitlistError("Name, email, and phone are required.");
      return;
    }
    if (!EMAIL_REGEX.test(booking.email.trim())) {
      serviceArea.setTrialCapWaitlistError("Please enter a valid email address.");
      return;
    }
    if (cart.orderItems.length === 0) {
      serviceArea.setTrialCapWaitlistError("Add at least one unit to your quote first.");
      return;
    }

    serviceArea.setTrialCapWaitlistSending(true);
    try {
      const blob = await captureCanvasBlob("canvas");
      const snapshotUrl = blob ? await uploadBuildSnapshot(blob) : undefined;

      const compositeAddress = [booking.streetAddress, booking.city, booking.addrState, booking.addrZip].filter(Boolean).join(", ");
      const deliveryAddress = booking.hasDifferentDelivery
        ? [booking.deliveryStreet, booking.deliveryCity, booking.deliveryState, booking.deliveryZip].filter(Boolean).join(", ")
        : undefined;

      const items: QuoteItem[] = [...cart.orderItems];
      if (productAddons.selectedCleanout && productAddons.cleanoutPrice > 0) {
        const svc = installer.data?.servicesConfig?.find((s) => s.id === productAddons.selectedCleanout);
        items.push({ type: "cleanout_service", serviceId: productAddons.selectedCleanout, name: svc?.name || productAddons.selectedCleanout, price: productAddons.cleanoutPrice });
      }

      const result = await submitNetworkLead({
        customer_name: fullName,
        customer_email: booking.email.trim(),
        customer_phone: booking.phone.trim(),
        address: compositeAddress,
        address_line1: booking.streetAddress,
        address_city: booking.city,
        address_state: booking.addrState,
        address_zip: booking.addrZip,
        delivery_address: deliveryAddress,
        quote_data: items,
        grand_total: pricingState.grandTotal,
        installer_id: installer.installerId || undefined,
        referring_installer_id: serviceArea.referringInstallerId || undefined,
        source: leadSource,
        waitlisted: true,
        build_snapshot_url: snapshotUrl || undefined,
      });

      if (!result.success || !result.id) {
        serviceArea.setTrialCapWaitlistError(result.error || "Something went wrong.");
        return;
      }

      serviceArea.setTrialCapWaitlistSent(true);
    } catch {
      serviceArea.setTrialCapWaitlistError("Something went wrong. Please try again.");
    } finally {
      serviceArea.setTrialCapWaitlistSending(false);
    }
  }, [
    booking.firstName, booking.lastName, booking.email, booking.phone,
    booking.streetAddress, booking.city, booking.addrState, booking.addrZip,
    booking.hasDifferentDelivery, booking.deliveryStreet, booking.deliveryCity,
    booking.deliveryState, booking.deliveryZip,
    cart.orderItems, installer.installerId, installer.data?.servicesConfig,
    serviceArea.referringInstallerId,
    serviceArea.setTrialCapWaitlistError, serviceArea.setTrialCapWaitlistSending,
    serviceArea.setTrialCapWaitlistSent,
    productAddons.selectedCleanout, productAddons.cleanoutPrice,
    pricingState.grandTotal,
    leadSource,
  ]);

  const sidebarDefaults = installer.data?.platformDefaults || { standard_slot: 0, mini_slot: 0, standard_tote: 0, standard_tote_clear: 0, mini_tote: 0, standard_wheels: 0, mini_wheels: 0, plywood_top: 0 };
  const studioPrices: StudioPrices = {
    standardTote: installer.data?.pricing?.standard_tote ?? sidebarDefaults.standard_tote,
    standardToteClear: installer.data?.pricing?.standard_tote_clear ?? sidebarDefaults.standard_tote_clear,
    miniTote: installer.data?.pricing?.mini_tote ?? sidebarDefaults.mini_tote,
    standardWheels: installer.data?.pricing?.standard_wheels ?? sidebarDefaults.standard_wheels,
    miniWheels: installer.data?.pricing?.mini_wheels ?? sidebarDefaults.mini_wheels,
    plywoodTop: installer.data?.pricing?.plywood_top ?? sidebarDefaults.plywood_top,
  };

  const sidebarProps: ConfiguratorSidebarProps = {
    // Pricing
    pricing: installer.data?.pricing,
    platformDefaults: sidebarDefaults,
    // Shelving
    shelvingConfigId: productAddons.shelvingConfigId,
    onShelvingConfigChange: productAddons.setShelvingConfigId,
    shelvingPrice: productAddons.shelvingPrice,
    shelvingLoading: productAddons.shelvingLoading,
    onAddShelvingUnit: productAddons.handleAddShelvingUnit,
    shelvingHidden: !installer.shelvingEnabled,
    // Overhead ceiling storage
    overheadStorageHidden: !installer.overheadStorageEnabled,
    onAddOverheadUnit: productAddons.handleAddOverheadUnit,
    onOverheadConfigPreview: (v) => { productAddons.setOverheadPreview(v); if (v) { productAddons.setRaisedBedPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } },
    // Raised Bed Planters
    raisedBedHidden: !installer.raisedBedEnabled,
    onRaisedBedPriceChange: productAddons.setRaisedBedPreviewPrice,
    onAddRaisedBed: productAddons.handleAddRaisedBed,
    onRaisedBedPreview: (v) => { productAddons.setRaisedBedPreview(v); if (v) { productAddons.setOverheadPreview(null); productAddons.setChairPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } },
    // Adirondack Chair
    chairHidden: !installer.chairEnabled,
    chairSelected,
    onChairSelect: () => {
              setChairSelected(true);
              setChairFinish("natural");
              setChairQuantity(1);
              productAddons.setChairPreview({ finish: "natural" });
              productAddons.setOverheadPreview(null);
              productAddons.setRaisedBedPreview(null);
              presets.setActivePreset(null);
              presets.setCompoundBuild(null);
            },
    chairFinish,
    onChairFinishChange: (f) => {
              setChairFinish(f);
              productAddons.setChairPreview({ finish: f });
            },
    chairQuantity,
    onChairQuantityChange: setChairQuantity,
    chairPreviewPrice: productAddons.chairPreviewPrice,
    onChairPriceChange: productAddons.setChairPreviewPrice,
    onAddChair: (config, price, desc) => {
              productAddons.handleAddChair(config, price, desc);
              setChairSelected(false);
              productAddons.setChairPreview(null);
            },
    onChairPreview: (v) => { productAddons.setChairPreview(v); if (v) { productAddons.setOverheadPreview(null); productAddons.setRaisedBedPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } },
    chairInstallerPricing: installer.data?.pricing as Record<string, unknown> | undefined,
    // Summary
    orderItems: cart.orderItems,
    onRemoveUnit: cart.handleRemoveUnit,
    onQuantityChange: cart.handleQuantityChange,
    grandTotal: pricingState.grandTotal,
    deliveryFeeAmount: pricingState.deliveryFeeAmount,
    depositAmount: pricingState.depositAmount,
    stripeAccountId: installer.stripeAccountId,
    // Booking form
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    onFirstNameChange: booking.setFirstName,
    onLastNameChange: booking.setLastName,
    onEmailChange: booking.setEmail,
    onPhoneChange: booking.setPhone,
    // Address
    streetAddress: booking.streetAddress,
    city: booking.city,
    addrState: booking.addrState,
    addrZip: booking.addrZip,
    onStreetAddressChange: booking.setStreetAddress,
    onCityChange: booking.setCity,
    onAddrStateChange: booking.setAddrState,
    onAddrZipChange: booking.setAddrZip,
    // Delivery address
    hasDifferentDelivery: booking.hasDifferentDelivery,
    onHasDifferentDeliveryChange: booking.setHasDifferentDelivery,
    deliveryStreet: booking.deliveryStreet,
    deliveryCity: booking.deliveryCity,
    deliveryState: booking.deliveryState,
    deliveryZip: booking.deliveryZip,
    onDeliveryStreetChange: booking.setDeliveryStreet,
    onDeliveryCityChange: booking.setDeliveryCity,
    onDeliveryStateChange: booking.setDeliveryState,
    onDeliveryZipChange: booking.setDeliveryZip,
    // Submit
    submitting: booking.submitting,
    submitted: booking.submitted,
    submitError: booking.submitError,
    onBookDeposit: isDemo ? () => installer.setDemoToast(true) : handleBookDeposit,
    isDemo,
    onDemoToast: () => installer.setDemoToast(true),
    // ZIP check
    zip: serviceArea.zip,
    onZipChange: serviceArea.setZip,
    onZipCheck: serviceArea.handleZipCheck,
    zipChecking: serviceArea.zipChecking,
    zipResult: serviceArea.zipResult as { available: boolean; message?: string } | null,
    onZipResultClear: () => serviceArea.setZipResult(null),
    installerLocked: installer.installerLocked,
    // Waitlist
    zipOutOfArea: serviceArea.zipOutOfArea,
    zipCheckMsg: serviceArea.zipCheckMsg,
    handedOff: serviceArea.handedOff,
    handoffInstallerName: serviceArea.handoffInstallerName,
    waitlistSending: serviceArea.waitlistSending,
    waitlistSent: serviceArea.waitlistSent,
    waitlistError: serviceArea.waitlistError,
    onWaitlist: handleWaitlist,
    // Trial cap waitlist (hostage lead)
    installerAtCapacity: serviceArea.installerAtCapacity,
    trialCapWaitlistSending: serviceArea.trialCapWaitlistSending,
    trialCapWaitlistSent: serviceArea.trialCapWaitlistSent,
    trialCapWaitlistError: serviceArea.trialCapWaitlistError,
    onJoinTrialCapWaitlist: handleJoinTrialCapWaitlist,
    // Installer services (cleanout — adds to order)
    servicesConfig: installer.data?.servicesConfig,
    selectedCleanout: productAddons.selectedCleanout,
    onCleanoutChange: productAddons.setSelectedCleanout,
    // Contact installer
    installerId: installer.installerId,
    brandingTitle: installer.data?.branding.title || "",
    showContactForm: contact.showContactForm,
    onShowContactFormChange: contact.setShowContactForm,
    contactMessage: contact.contactMessage,
    onContactMessageChange: contact.setContactMessage,
    contactSending: contact.contactSending,
    contactSent: contact.contactSent,
    contactError: contact.contactError,
    onContactInstaller: contact.handleContactInstaller,
    // Scheduler (inline in sidebar)
    schedulingEnabled: installer.data?.routing.schedulingEnabled ?? true,
    scheduledDate: booking.scheduledDate,
    onScheduledDateChange: booking.setScheduledDate,
    installerLeadTime: effectiveLeadTime,
    installerWorkingDays: installer.data?.routing.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
    blackoutDates: booking.blackoutDates,
    // Discount code (inline in sidebar)
    discountInput: pricingState.discountInput,
    onDiscountInputChange: (v) => { pricingState.setDiscountInput(v); pricingState.setDiscountError(""); },
    discountApplied: pricingState.discountApplied,
    discountLoading: pricingState.discountLoading,
    discountError: pricingState.discountError,
    onApplyDiscount: pricingState.handleApplyDiscount,
    onRemoveDiscount: pricingState.handleRemoveDiscount,
    addonPricing: installer.data?.pricing?.addon_pricing,
    addonDefaults: installer.data?.addonDefaults,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* ── Analytics: track page view for installer ────────────────────── */}
      {installer.installerId && <PageViewTracker installerId={installer.installerId} page="/design" />}

      {/* ── Header (slim on mobile, full on desktop) ──────────────────── */}
      <header className="shrink-0 border-b-2 border-yellow-400 bg-gray-950 px-3 py-2 lg:border-b-4 lg:px-4 lg:py-3">
        <div className="mx-auto flex max-w-[1800px] items-center gap-2 lg:gap-3">
          <a
            href="/"
            className="shrink-0 transition-transform hover:scale-105"
            title="Back to Home"
          >
            <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-yellow-400/30 bg-slate-800 shadow-lg shadow-yellow-400/5 lg:h-12 lg:w-12 lg:border-[3px]">
              {installer.data?.branding.logoUrl ? (
                <Image
                  src={installer.data.branding.logoUrl}
                  alt={installer.data.branding.title}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image src="/Header_avatar_logo.png" alt="Storage Network" width={48} height={48} className="h-full w-full object-cover" />
              )}
            </div>
          </a>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-sm font-extrabold uppercase tracking-widest text-white lg:text-base">
              {installer.data?.branding.title || "Professional Grade Storage"}
            </h1>
            <p className="hidden text-[10px] uppercase tracking-wider text-yellow-400 lg:block">
              {installer.data?.branding.subtitle || "Build Configurator"}
            </p>
          </div>
          <a
            href="/"
            className="hidden items-center gap-1 text-xs font-semibold text-stone-400 transition-colors hover:text-yellow-400 sm:flex"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </a>
        </div>
      </header>

      {/* ── Shipping mode banner ─────────────────────────────────────── */}
      {mode === "shipping" && (
        <div className="shrink-0 bg-amber-500 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-950">
          We ship nationwide! Design your unit below and we&apos;ll deliver it
          to your door.
        </div>
      )}

      {/* ── Installer locked banner ──────────────────────────────────── */}
      {installer.installerLocked && installer.data?.branding.isVerified && (
        <div className="shrink-0 bg-emerald-600 px-4 py-2 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <User className="h-3.5 w-3.5" />
            Designing with {installer.data.branding.title}
            {installer.data.socialProof && installer.data.socialProof.totalReviews > 0 && (
              <span className="ml-1 opacity-90">
                · {installer.data.socialProof.averageRating.toFixed(1)}★ ({installer.data.socialProof.totalReviews} review{installer.data.socialProof.totalReviews !== 1 ? "s" : ""})
              </span>
            )}
            {installer.data.socialProof && installer.data.socialProof.completedJobs > 0 && (
              <span className="ml-1 opacity-90">
                · {installer.data.socialProof.completedJobs} builds completed
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Trial cap banner — installer at full capacity ────────────── */}
      {serviceArea.installerAtCapacity && !serviceArea.trialCapWaitlistSent && (
        <div className="shrink-0 bg-amber-600/90 px-4 py-2 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
            This installer is at full capacity — design your build &amp; join the waitlist
          </span>
        </div>
      )}

      {/* ── Split Layout ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ── DESIGN STUDIO (left on desktop, under the 3D on phones) ── */}
        <StudioPanel
            props={sidebarProps}
            studio={studioState}
            rules={studioRules}
            prices={studioPrices}
            presets={installer.filteredPresets}
            pricing={installer.data?.pricing}
            organizer={
              // Opt-in: only installers who turned Organizer Customization on
              installer.installerId && installer.data?.pricing?.addon_pricing?.organizer_customization_enabled === true
                ? { addonPricing: installer.data?.pricing?.addon_pricing, addonDefaults: installer.data?.addonDefaults }
                : null
            }
            indoorFee={installer.data?.indoorDeliveryConfig?.enabled ? installer.data.indoorDeliveryConfig.fee : null}
            onClearPreviews={clearStudioPreviews}
            previewingPreset={presets.activePreset}
            onPreviewBestseller={previewStudioBestseller}
          />

        {/* ── 3D VISUALIZER ── */}
        <main className="order-1 sticky top-0 z-10 flex h-[35vh] shrink-0 flex-col border-b border-stone-800 bg-white lg:static lg:order-2 lg:z-auto lg:h-auto lg:flex-1 lg:border-b-0 lg:border-l lg:border-stone-200">
          <div className="relative min-h-0 flex-1 overflow-hidden lg:min-h-[300px]">
            <RackVisualizer
              // A bestseller previewed from the "+" view, or the studio's
              // default unit when the order is empty; otherwise the whole order.
              cols={preview ? preview.compound.subUnits[0].cols : DEFAULT_TOTE_UNIT.cols}
              rows={preview ? preview.compound.subUnits[0].rows : DEFAULT_TOTE_UNIT.rows}
              toteType={preview ? (preview.preset.toteModel as ToteType) : DEFAULT_TOTE_UNIT.toteType}
              toteColor={preview ? (preview.preset.toteColor as ToteColor) : DEFAULT_TOTE_UNIT.toteColor}
              unitType={preview ? preview.preset.unitType : DEFAULT_TOTE_UNIT.unitType}
              orientation={preview ? preview.preset.orientation : DEFAULT_TOTE_UNIT.orientation}
              hasTotes={preview ? presets.presetTotes : DEFAULT_TOTE_UNIT.hasTotes}
              hasWheels={preview ? preview.preset.units.some((u) => u.hasWheels) : DEFAULT_TOTE_UNIT.hasWheels}
              hasTop={preview ? preview.preset.units.some((u) => u.hasTop) : DEFAULT_TOTE_UNIT.hasTop}
              totalW={preview ? preview.compound.combinedW : 0}
              totalH={preview ? preview.compound.maxH : 0}
              presetUnits={presets.presetVisUnits}
              drawerSlideRows={preview?.preset.drawerSlideRows}
              drawerSlideColumns={preview?.preset.drawerSlideColumns}
              hasDrawerSlides={(preview?.preset.drawerSlideColumns?.length ?? 0) > 0 || (preview?.preset.drawerSlideRows ?? 0) > 0}
              shelvingConfig={productAddons.activeShelvingConfig}
              overheadConfig={productAddons.overheadPreview ? { slotsWide: productAddons.overheadPreview.slotsWide, slotsDeep: productAddons.overheadPreview.slotsDeep, toteType: productAddons.overheadPreview.toteType, hasTotes: productAddons.overheadPreview.hasTotes } : undefined}
              raisedBedConfig={productAddons.raisedBedPreview || undefined}
              chairConfig={productAddons.chairPreview || undefined}
              watermarkText={installer.data?.branding.title || "Storage-Network.app"}
              use2x4Rails={installer.data?.pricing?.use_2x4_rails === true}
              multiUnitItems={
                studioPreviewing
                  ? undefined
                  // Lines still waiting on their first price have no size yet
                  : (cart.multiUnitItems?.filter((u) => u.totalW > 0) as MultiUnitItem[] | undefined)
              }
              systemView={!studioPreviewing}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-xs font-medium text-stone-500 lg:px-4 lg:py-3 lg:text-sm">
            {!studioPreviewing ? (
              <StudioDimensions items={cart.orderItems} repricing={studioState.repricing} />
            ) : productAddons.overheadPreview ? (
              <>
                {productAddons.overheadPreview.slotsWide} &times; {productAddons.overheadPreview.slotsDeep} grid · {productAddons.overheadPreview.toteType}
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Ceiling Tote Rail
                </span>
              </>
            ) : productAddons.raisedBedPreview ? (
              <>
                {productAddons.raisedBedPreview.widthIn}&quot; &times;{" "}
                {productAddons.raisedBedPreview.lengthIn}&quot; &times;{" "}
                {productAddons.raisedBedPreview.heightIn}&quot;
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Raised Bed
                </span>
              </>
            ) : productAddons.chairPreview ? (
              <>
                30&quot; W &times; 34&quot; H &times; 38&quot; D
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Adirondack Chair
                </span>
              </>
            ) : productAddons.activeShelvingConfig ? (
              <>
                {productAddons.activeShelvingConfig.widthIn}&quot; W &times;{" "}
                {productAddons.activeShelvingConfig.frameH}&quot; H &times;{" "}
                {productAddons.activeShelvingConfig.depth}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {productAddons.activeShelvingConfig.shelves} {productAddons.activeShelvingConfig.shelves === 1 ? "shelf" : "shelves"} + top
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Open Shelving
                </span>
              </>
            ) : preview ? (
              <>
                {preview.compound.combinedW.toFixed(1)}&quot; W &times;{" "}
                {preview.compound.maxH.toFixed(1)}&quot; H &times;{" "}
                {preview.compound.depth}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {preview.compound.subUnits.map((su) => `${su.cols}×${su.rows}`).join(" + ")} ={" "}
                  {preview.compound.totalSlots} slots
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {preview.compound.presetName}
                </span>
              </>
            ) : null}
          </div>
        </main>
      </div>
      {/* ── Demo Toast ── */}
      {installer.demoToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-2xl border border-stone-700 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/20">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Demo Mode</h3>
            <p className="mt-2 text-sm text-stone-400">
              This is a demo preview. No payment will be processed and no records will be created.
            </p>
            <button
              onClick={() => installer.setDemoToast(false)}
              className="mt-4 w-full rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* ── Booking Modal — Address → Schedule → Inline Stripe Payment ── */}
      {booking.leadId && installer.installerId && (
        <BookingModal
          isOpen={booking.showBookingModal}
          onClose={() => {
            booking.setShowBookingModal(false);
            booking.setLeadId(null);
          }}
          leadId={booking.leadId}
          depositAmount={pricingState.depositAmount}
          totalPrice={pricingState.grandTotal}
          installerId={installer.installerId}
          source={leadSource}
          customerEmail={booking.email || undefined}
          customerName={[booking.firstName.trim(), booking.lastName.trim()].filter(Boolean).join(" ") || undefined}
          installerLeadTime={installer.data?.routing.leadTime ?? 5}
          installerWorkingDays={installer.data?.routing.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]}
          schedulingEnabled={installer.data?.routing.schedulingEnabled ?? true}
          hasWheels={cart.anyHasWheels}
          totalCols={cart.maxCols}
          unitCount={cart.orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0)}
          initialAddress={{
            line1: booking.streetAddress || undefined,
            city: booking.city || undefined,
            state: booking.addrState || undefined,
            zip: booking.addrZip || serviceArea.zip || undefined,
          }}
          initialScheduledDate={booking.scheduledDate}
          initialDiscount={pricingState.discountApplied}
          onSuccess={() => {
            booking.setShowBookingModal(false);
            booking.setSubmitted(true);
          }}
        />
      )}

      {/* ── AI Design Assistant — with direct add-to-order callback ── */}
      <CustomerChatWidget
        installerId={installer.data?.routing.installerId}
        installerSlug={installer.data?.routing.slug || undefined}
        skipWelcome={leadSource === "platform" || !!initialConfig}
        installerContext={{
          installerName: installer.data?.branding.title,
          standardSlot: installer.data?.pricing?.standard_slot,
          miniSlot: installer.data?.pricing?.mini_slot,
          standardTote: installer.data?.pricing?.standard_tote,
          standardToteClear: installer.data?.pricing?.standard_tote_clear,
          miniTote: installer.data?.pricing?.mini_tote,
          standardWheels: installer.data?.pricing?.standard_wheels,
          miniWheels: installer.data?.pricing?.mini_wheels,
          plywoodTop: installer.data?.pricing?.plywood_top,
          totesDisabled: installer.data?.pricing?.totes_disabled === true,
          use2x4Rails: installer.data?.pricing?.use_2x4_rails === true,
          miniEnabled: installer.data?.pricing?.mini_enabled === true,
          shelvingEnabled: installer.data?.pricing?.open_shelving_enabled === true,
          overheadEnabled: installer.data?.pricing?.overhead_storage_enabled === true,
          raisedBedEnabled: installer.data?.pricing?.raised_bed_enabled === true,
          disabledPresets: [
            installer.data?.pricing?.bestseller_indiana_joe_disabled ? "indiana-joe" : "",
            installer.data?.pricing?.bestseller_long_ranger_disabled ? "long-ranger" : "",
            installer.data?.pricing?.bestseller_gas_station_disabled ? "gas-station" : "",
            installer.data?.pricing?.bestseller_track_norris_disabled ? "track-norris" : "",
          ].filter(Boolean),
        }}
        onCustomerInfo={(info) => {
          if (info.firstName) booking.setFirstName(info.firstName);
          if (info.lastName) booking.setLastName(info.lastName);
          if (info.email) booking.setEmail(info.email);
          if (info.phone) booking.setPhone(info.phone);
          if (info.address) booking.setStreetAddress(info.address);
          if (info.city) booking.setCity(info.city);
          if (info.state) booking.setAddrState(info.state);
          if (info.zip) booking.setAddrZip(info.zip);
        }}
        onAddUnits={async (configs) => {
          for (const cfg of configs) {
            const result = await calculateBuild({
              cols: cfg.cols,
              rows: cfg.rows,
              toteModel: cfg.toteType || "HDX",
              toteColor: cfg.toteColor || "black",
              unitType: cfg.unitType || "standard",
              orientation: cfg.orientation || "standard",
              addOns: { totes: cfg.hasTotes, wheels: cfg.hasWheels, top: cfg.hasTop },
              mode: "manual",
              installerPricing: installer.data?.pricing,
            });
            if ("price" in result) {
              const colorLabel = cfg.hasTotes && cfg.toteColor === "clear" ? " (Clear Totes)" : "";
              cart.setOrderItems((prev) => [...prev, {
                cols: result.cols,
                rows: result.rows,
                toteType: cfg.toteType || "HDX",
                toteColor: cfg.toteColor || "black",
                unitType: cfg.unitType || "standard",
                orientation: cfg.orientation || "standard",
                hasTotes: cfg.hasTotes,
                hasWheels: cfg.hasWheels,
                hasTop: cfg.hasTop,
                price: result.price,
                totalW: result.dimensions.totalW,
                totalH: result.dimensions.totalH,
                depth: result.dimensions.depth,
                desc: `Standard: ${result.cols}W × ${result.rows}H${colorLabel}`,
                addons: [],
              }]);
            }
          }
        }}
      />

    </div>
  );
}
