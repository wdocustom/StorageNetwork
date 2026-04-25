"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { submitNetworkLead, type QuoteItem } from "@/app/actions/submit-lead";
import { submitWaitlistRequest } from "@/app/actions/installer";
import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { expandPresetUnits } from "@/lib/buildEngine.types";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import type { MultiUnitItem } from "@/components/visualizer/RackVisualizer";
import BookingModal from "@/components/booking/BookingModal";
import ScanWizard from "@/components/design/ScanWizard";
import ConfiguratorSidebar from "@/components/design/ConfiguratorSidebar";
import PageViewTracker from "@/components/tracking/PageViewTracker";
const CustomerChatWidget = dynamic(() => import("@/components/chat/CustomerChatWidget"), { ssr: false });
import { AlertTriangle, ArrowLeft, User } from "lucide-react";

import {
  useInstallerContext,
  useUnitBuilder,
  usePresets,
  useProductAddons,
  useOrderCart,
  useBookingForm,
  useServiceArea,
  usePricing,
  useContactInstaller,
} from "@/hooks/configurator";
import type { DesignConfiguratorProps, UnitConfig, ToteType, ToteColor } from "@/hooks/configurator";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DesignConfigurator({
  initialData,
  initialZip,
  mode,
  isDemo = false,
  leadSource = "platform",
  savedSignal,
  initialInstallerAtCapacity = false,
  initialConfig,
}: DesignConfiguratorProps) {

  // ═══════════════════════════════════════════════════════════════════════
  // HOOK INITIALIZATION (ordered by dependency graph)
  // ═══════════════════════════════════════════════════════════════════════

  const installer = useInstallerContext({ initialData });

  const builder = useUnitBuilder({
    pricing: installer.data?.pricing,
    globalTotesDisabled: installer.globalTotesDisabled,
  });

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
    paintFrameColor: builder.paintFrameColor,
    paintDoorColor: builder.paintDoorColor,
    paintSidePanelColor: builder.paintSidePanelColor,
    pricing: installer.data?.pricing,
    addonDefaults: installer.data?.addonDefaults,
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

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTIVE LEAD TIME (3-day minimum when any unit has caster wheels)
  // ═══════════════════════════════════════════════════════════════════════

  const effectiveLeadTime = cart.anyHasWheels
    ? Math.max(installer.effectiveLeadTime, 3)
    : installer.effectiveLeadTime;

  // ═══════════════════════════════════════════════════════════════════════
  // INITIAL CONFIG: single-unit & preset hydration
  // (Multi-unit case is handled inside useOrderCart)
  // ═══════════════════════════════════════════════════════════════════════

  const singleConfigApplied = useRef(false);
  useEffect(() => {
    if (!initialConfig || singleConfigApplied.current) return;
    if (Array.isArray(initialConfig.units)) return;
    singleConfigApplied.current = true;

    if (typeof initialConfig.preset === "string") {
      presets.setActivePreset(initialConfig.preset);
      if (typeof initialConfig.hasTotes === "boolean") presets.setPresetTotes(initialConfig.hasTotes);
      return;
    }

    if (typeof initialConfig.cols === "number") builder.setCols(initialConfig.cols);
    if (typeof initialConfig.rows === "number") builder.setRows(initialConfig.rows);
    if (initialConfig.toteType === "HDX" || initialConfig.toteType === "GM") builder.setToteType(initialConfig.toteType);
    if (initialConfig.toteColor === "black" || initialConfig.toteColor === "clear") builder.setToteColor(initialConfig.toteColor);
    if (initialConfig.unitType === "standard" || initialConfig.unitType === "mini") builder.setUnitType(initialConfig.unitType);
    if (initialConfig.orientation === "standard" || initialConfig.orientation === "sideways") builder.setOrientation(initialConfig.orientation);
    if (typeof initialConfig.hasTotes === "boolean") builder.setHasTotes(initialConfig.hasTotes);
    if (typeof initialConfig.hasWheels === "boolean") builder.setHasWheels(initialConfig.hasWheels);
    if (typeof initialConfig.hasTop === "boolean") builder.setHasTop(initialConfig.hasTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig]);

  // ═══════════════════════════════════════════════════════════════════════
  // RE-PRICE ORDER ITEMS AFTER NETWORK REFERRAL HANDOFF
  // ═══════════════════════════════════════════════════════════════════════

  const prevPricingRef = useRef(installer.data?.pricing);
  useEffect(() => {
    const newPricing = installer.data?.pricing;
    if (newPricing === prevPricingRef.current || cart.orderItems.length === 0) {
      prevPricingRef.current = newPricing;
      return;
    }
    prevPricingRef.current = newPricing;

    if (!serviceArea.handedOff) return;

    (async () => {
      const repriced: UnitConfig[] = [];

      for (const item of cart.orderItems) {
        const matchedPreset = BESTSELLER_PRESETS.find((p) =>
          item.desc.startsWith(p.name),
        );

        if (matchedPreset) {
          try {
            const result = await calculateCompoundBuild({
              presetId: matchedPreset.id,
              hasTotes: item.hasTotes,
              installerPricing: newPricing,
            });
            if (result.success) {
              repriced.push({ ...item, price: result.totalPrice });
            } else {
              repriced.push(item);
            }
          } catch {
            repriced.push(item);
          }
        } else {
          try {
            const result = await calculateBuild({
              cols: item.cols,
              rows: item.rows,
              toteModel: item.toteType as "HDX" | "GM",
              toteColor: item.toteColor,
              unitType: item.unitType,
              orientation: item.orientation,
              addOns: {
                totes: item.hasTotes,
                wheels: item.hasWheels,
                top: item.hasTop,
              },
              mode: "manual",
              installerPricing: newPricing,
            });
            if (result.success) {
              repriced.push({ ...item, price: result.price });
            } else {
              repriced.push(item);
            }
          } catch {
            repriced.push(item);
          }
        }
      }

      cart.setOrderItems(repriced);
    })();
    // orderItems intentionally NOT a dep — read once when pricing changes, write back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installer.data?.pricing, serviceArea.handedOff]);

  // ═══════════════════════════════════════════════════════════════════════
  // CROSS-CUTTING HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleAddUnit = useCallback(() => {
    let unitLabel = builder.unitType === "mini" ? "Mini" : "Standard";
    if (builder.unitType === "standard" && builder.effectiveOrientation === "sideways") {
      unitLabel = "Standard (Sideways)";
    }
    let toteDesc = "";
    if (builder.hasTotes && builder.toteType === "HDX" && builder.unitType === "standard" && builder.effectiveToteColor === "clear") {
      toteDesc = " (Clear Totes)";
    }
    cart.setOrderItems((prev) => [
      ...prev,
      {
        cols: builder.build.cols,
        rows: builder.build.rows,
        toteType: builder.toteType,
        toteColor: builder.effectiveToteColor,
        unitType: builder.unitType,
        orientation: builder.effectiveOrientation,
        hasTotes: builder.hasTotes,
        hasWheels: builder.hasWheels,
        hasTop: builder.effectiveHasTop,
        price: builder.build.price,
        totalW: builder.build.totalW,
        totalH: builder.build.totalH,
        depth: builder.build.depth,
        desc: `${unitLabel}: ${builder.build.cols}W × ${builder.build.rows}H${toteDesc}`,
        addons: [...builder.addons],
        paintFrameColor: builder.paintFrameColor,
        paintDoorColor: builder.paintDoorColor,
        paintSidePanelColor: builder.paintSidePanelColor,
        ...(builder.indoorDelivery && installer.data?.indoorDeliveryConfig?.enabled ? {
          indoorDelivery: true,
          indoorDeliveryFee: installer.data.indoorDeliveryConfig.fee,
        } : {}),
      },
    ]);
    builder.resetForNewUnit();
    presets.setActivePreset(null);
    presets.setCompoundBuild(null);
  }, [
    builder.unitType, builder.effectiveOrientation, builder.hasTotes, builder.toteType,
    builder.effectiveToteColor, builder.hasWheels, builder.effectiveHasTop, builder.build,
    builder.addons, builder.paintFrameColor, builder.paintDoorColor, builder.paintSidePanelColor,
    builder.indoorDelivery, builder.resetForNewUnit,
    cart.setOrderItems, installer.data?.indoorDeliveryConfig,
    presets.setActivePreset, presets.setCompoundBuild,
  ]);

  const handleAddPresetUnit = useCallback((): boolean => {
    if (!presets.compoundBuild || !presets.activePresetObj) return false;

    const subDesc = presets.compoundBuild.subUnits.map((su) => `${su.cols}x${su.rows}`).join(" + ");
    cart.setOrderItems((prev) => [
      ...prev,
      {
        cols: presets.compoundBuild!.subUnits.reduce((s, u) => s + u.cols, 0),
        rows: Math.max(...presets.compoundBuild!.subUnits.map((u) => u.rows)),
        toteType: presets.activePresetObj!.toteModel as ToteType,
        toteColor: presets.activePresetObj!.toteColor as ToteColor,
        unitType: presets.activePresetObj!.unitType,
        orientation: presets.activePresetObj!.orientation,
        hasTotes: presets.presetTotes,
        hasWheels: presets.activePresetObj!.units.some((u) => u.hasWheels),
        hasTop: presets.activePresetObj!.units.some((u) => u.hasTop),
        price: presets.compoundBuild!.totalPrice,
        totalW: presets.compoundBuild!.combinedW,
        totalH: presets.compoundBuild!.maxH,
        depth: presets.compoundBuild!.depth,
        desc: `${presets.activePresetObj!.name} (${subDesc})`,
        addons: [],
        presetUnits: presets.compoundBuild!.subUnits.map((su, idx) => ({
          cols: su.cols,
          rows: su.rows,
          totalW: su.totalW,
          totalH: su.totalH,
          hasTop: presets.activePresetObj!.units[idx]?.hasTop ?? false,
          hasWheels: presets.activePresetObj!.units[idx]?.hasWheels ?? false,
        })),
        drawerSlideRows: presets.activePresetObj!.drawerSlideRows,
        drawerSlideColumns: presets.activePresetObj!.drawerSlideColumns,
        ...(builder.indoorDelivery && installer.data?.indoorDeliveryConfig?.enabled ? {
          indoorDelivery: true,
          indoorDeliveryFee: installer.data.indoorDeliveryConfig.fee,
        } : {}),
      },
    ]);
    builder.setIndoorDelivery(false);
    return true;
  }, [
    presets.compoundBuild, presets.activePresetObj, presets.presetTotes,
    cart.setOrderItems, builder.indoorDelivery, builder.setIndoorDelivery,
    installer.data?.indoorDeliveryConfig,
  ]);

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
          if (pricingState.paintTotal > 0) {
            const paintParts: string[] = [];
            if (builder.paintFrameColor) paintParts.push(`Frame: ${builder.paintFrameColor}`);
            if (builder.paintDoorColor) paintParts.push(`Doors: ${builder.paintDoorColor}`);
            if (builder.paintSidePanelColor) paintParts.push(`Panels: ${builder.paintSidePanelColor}`);
            items.push({
              type: "paint",
              name: `Paint (${paintParts.join(", ")})`,
              price: pricingState.paintTotal,
            });
          }
          return items;
        })(),
        grand_total: pricingState.grandTotal,
        installer_id: installer.installerId || undefined,
        referring_installer_id: serviceArea.referringInstallerId || undefined,
        source: leadSource,
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
    pricingState.paintTotal, pricingState.grandTotal,
    builder.paintFrameColor, builder.paintDoorColor, builder.paintSidePanelColor,
    leadSource,
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
      const compositeAddress = [booking.streetAddress, booking.city, booking.addrState, booking.addrZip].filter(Boolean).join(", ");
      const deliveryAddress = booking.hasDifferentDelivery
        ? [booking.deliveryStreet, booking.deliveryCity, booking.deliveryState, booking.deliveryZip].filter(Boolean).join(", ")
        : undefined;

      const items: QuoteItem[] = [...cart.orderItems];
      if (productAddons.selectedCleanout && productAddons.cleanoutPrice > 0) {
        const svc = installer.data?.servicesConfig?.find((s) => s.id === productAddons.selectedCleanout);
        items.push({ type: "cleanout_service", serviceId: productAddons.selectedCleanout, name: svc?.name || productAddons.selectedCleanout, price: productAddons.cleanoutPrice });
      }
      if (pricingState.paintTotal > 0) {
        const paintParts: string[] = [];
        if (builder.paintFrameColor) paintParts.push(`Frame: ${builder.paintFrameColor}`);
        if (builder.paintDoorColor) paintParts.push(`Doors: ${builder.paintDoorColor}`);
        if (builder.paintSidePanelColor) paintParts.push(`Panels: ${builder.paintSidePanelColor}`);
        items.push({ type: "paint", name: `Paint (${paintParts.join(", ")})`, price: pricingState.paintTotal });
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
    pricingState.paintTotal, pricingState.grandTotal,
    builder.paintFrameColor, builder.paintDoorColor, builder.paintSidePanelColor,
    leadSource,
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // JSX — will be filled in Step 2
  // ═══════════════════════════════════════════════════════════════════════

  return <div id="temp-jsx-placeholder">JSX GOES HERE</div>;
}
