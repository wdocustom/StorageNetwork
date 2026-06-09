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
import { expandPresetUnits } from "@/lib/buildEngine.types";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import type { MultiUnitItem } from "@/components/visualizer/RackVisualizer";
import BookingModal from "@/components/booking/BookingModal";
import ScanWizard from "@/components/design/ScanWizard";
import ConfiguratorSidebar from "@/components/design/ConfiguratorSidebar";
import DesignEntryModal, {
  DESIGN_ENTRY_DONE_KEY,
  type EntryCommit,
} from "@/components/design/DesignEntryModal";
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
  parentLeadId,
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

  // Chair configurator state (flows through Steps 1→3→4)
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
  // DESIGN ENTRY MODAL — front-loaded dimension capture
  //
  // First-time visitors see a modal asking "Do you have your dimensions?"
  // before the configurator. Skip when:
  //   - demo mode
  //   - a saved signal is resuming (returning customer)
  //   - the URL already provided a config (chat handoff, share link)
  //   - localStorage flag is set from a prior visit
  // ═══════════════════════════════════════════════════════════════════════

  const skipEntryModal =
    isDemo ||
    !!savedSignal ||
    !!initialConfig ||
    cart.initialStep > 1;

  const [entryModalOpen, setEntryModalOpen] = useState(false);

  useEffect(() => {
    if (skipEntryModal) return;
    try {
      const done = window.localStorage.getItem(DESIGN_ENTRY_DONE_KEY);
      if (!done) setEntryModalOpen(true);
    } catch {
      setEntryModalOpen(true);
    }
  }, [skipEntryModal]);

  const markEntryDone = useCallback(() => {
    try {
      window.localStorage.setItem(DESIGN_ENTRY_DONE_KEY, "1");
    } catch {
      // ignore (private mode etc.)
    }
  }, []);

  const handleEntryCommit = useCallback((commit: EntryCommit) => {
    // The modal has already run the wall-fit (or grid) calculation for its
    // live preview, so we just plumb the resulting cols/rows into the
    // builder. The builder's existing cols/rows → fetchBuild effect will
    // recompute the build/visualizer automatically. Setting wallWidth/
    // wallHeight too keeps Step 1's Auto-Fit Calculator in sync if the
    // customer ever back-navigates.
    if (commit.kind === "wall") {
      builder.setWallWidth(commit.widthInches.toFixed(1));
      builder.setWallHeight(commit.heightInches.toFixed(1));
      builder.setWallFitMsg(
        `Max fit: ${commit.cols} Wide × ${commit.rows} High for that wall.`,
      );
    }
    builder.setCols(commit.cols);
    builder.setRows(commit.rows);
    cart.setSidebarStep(2);
    markEntryDone();
    setEntryModalOpen(false);
  }, [builder, cart, markEntryDone]);

  const handleEntryDismiss = useCallback(() => {
    markEntryDone();
    setEntryModalOpen(false);
  }, [markEntryDone]);

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
    pricingState.paintTotal, pricingState.grandTotal,
    builder.paintFrameColor, builder.paintDoorColor, builder.paintSidePanelColor,
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
    pricingState.paintTotal, pricingState.grandTotal,
    builder.paintFrameColor, builder.paintDoorColor, builder.paintSidePanelColor,
    leadSource,
  ]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* ── Design Entry Modal — first-visit dimension capture ─────────── */}
      {entryModalOpen && (
        <DesignEntryModal
          installerId={installer.installerId || null}
          defaultZip={serviceArea.zip}
          unitType={builder.unitType}
          use2x4Rails={installer.data?.pricing?.use_2x4_rails === true}
          toteType={builder.toteType}
          toteColor={builder.toteColor}
          orientation={builder.orientation}
          installerPricing={installer.data?.pricing}
          onCommit={handleEntryCommit}
          onDismiss={handleEntryDismiss}
        />
      )}

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
        {/* ── SIDEBAR: Configurator ── */}
        <ConfiguratorSidebar
          initialStep={cart.initialStep}
          forceStep={cart.sidebarStep}
          // Step 1: Dimensions
          wallWidth={builder.wallWidth}
          wallHeight={builder.wallHeight}
          onWallWidthChange={(v) => { builder.setWallWidth(v); builder.setWallFitMsg(""); }}
          onWallHeightChange={(v) => { builder.setWallHeight(v); builder.setWallFitMsg(""); }}
          onWallFit={builder.handleWallFit}
          wallFitMsg={builder.wallFitMsg}
          buildLoading={builder.buildLoading}
          cols={builder.cols}
          rows={builder.rows}
          onColsChange={builder.setCols}
          onRowsChange={builder.setRows}

          // Step 2: Configuration
          unitType={builder.unitType}
          orientation={builder.orientation}
          onUnitTypeChange={builder.setUnitType}
          onOrientationChange={builder.setOrientation}
          toteType={builder.toteType}
          toteColor={builder.toteColor}
          onToteTypeChange={builder.setToteType}
          onToteColorChange={builder.setToteColor}
          hasTotes={builder.hasTotes}
          hasWheels={builder.hasWheels}
          hasTop={builder.hasTop}
          onHasTotesChange={builder.setHasTotes}
          onHasWheelsChange={builder.setHasWheels}
          onHasTopChange={builder.setHasTop}
          effectiveHasTop={builder.effectiveHasTop}
          miniDisabled={installer.data?.pricing?.mini_enabled !== true}
          totesDisabled={installer.data?.pricing?.totes_disabled === true}
          use2x4Rails={installer.data?.pricing?.use_2x4_rails === true}

          // Pricing
          pricing={installer.data?.pricing}
          platformDefaults={installer.data?.platformDefaults || { standard_slot: 0, mini_slot: 0, standard_tote: 0, standard_tote_clear: 0, mini_tote: 0, standard_wheels: 0, mini_wheels: 0, plywood_top: 0 }}

          // Build
          build={builder.build}
          onAddUnit={handleAddUnit}

          // Presets
          activePreset={presets.activePreset}
          onPresetChange={(v) => { presets.setActivePreset(v); presets.setCompoundBuild(null); productAddons.setRaisedBedPreview(null); productAddons.setOverheadPreview(null); setChairSelected(false); productAddons.setChairPreview(null); }}
          presetOptions={installer.filteredPresets}
          compoundBuild={presets.compoundBuild}
          presetLoading={presets.presetLoading}
          presetTotes={presets.presetTotes}
          onPresetTotesChange={presets.setPresetTotes}
          onAddPresetUnit={handleAddPresetUnit}
          activePresetObj={presets.activePresetObj}

          // Shelving
          shelvingConfigId={productAddons.shelvingConfigId}
          onShelvingConfigChange={productAddons.setShelvingConfigId}
          shelvingPrice={productAddons.shelvingPrice}
          shelvingLoading={productAddons.shelvingLoading}
          onAddShelvingUnit={productAddons.handleAddShelvingUnit}
          shelvingHidden={!installer.shelvingEnabled}

          // Overhead ceiling storage
          overheadStorageHidden={!installer.overheadStorageEnabled}
          onAddOverheadUnit={productAddons.handleAddOverheadUnit}
          onOverheadConfigPreview={(v) => { productAddons.setOverheadPreview(v); if (v) { productAddons.setRaisedBedPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } }}

          // Raised Bed Planters
          raisedBedHidden={!installer.raisedBedEnabled}
          raisedBedPreviewPrice={productAddons.raisedBedPreviewPrice}
          onRaisedBedPriceChange={productAddons.setRaisedBedPreviewPrice}
          onAddRaisedBed={productAddons.handleAddRaisedBed}
          onRaisedBedPreview={(v) => { productAddons.setRaisedBedPreview(v); if (v) { productAddons.setOverheadPreview(null); productAddons.setChairPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } }}

          // Adirondack Chair
          chairHidden={!installer.chairEnabled}
          chairSelected={chairSelected}
          onChairSelect={() => {
            setChairSelected(true);
            setChairFinish("natural");
            setChairQuantity(1);
            productAddons.setChairPreview({ finish: "natural" });
            productAddons.setOverheadPreview(null);
            productAddons.setRaisedBedPreview(null);
            presets.setActivePreset(null);
            presets.setCompoundBuild(null);
          }}
          chairFinish={chairFinish}
          onChairFinishChange={(f) => {
            setChairFinish(f);
            productAddons.setChairPreview({ finish: f });
          }}
          chairQuantity={chairQuantity}
          onChairQuantityChange={setChairQuantity}
          chairPreviewPrice={productAddons.chairPreviewPrice}
          onChairPriceChange={productAddons.setChairPreviewPrice}
          onAddChair={(config, price, desc) => {
            productAddons.handleAddChair(config, price, desc);
            setChairSelected(false);
            productAddons.setChairPreview(null);
          }}
          onChairPreview={(v) => { productAddons.setChairPreview(v); if (v) { productAddons.setOverheadPreview(null); productAddons.setRaisedBedPreview(null); presets.setActivePreset(null); presets.setCompoundBuild(null); } }}
          chairInstallerPricing={installer.data?.pricing as Record<string, unknown> | undefined}

          // Multi-unit 3D visualization
          showMultiUnit3D={cart.showMultiUnit3D}
          onShowMultiUnit3DChange={cart.setShowMultiUnit3D}
          unitVisibility={cart.unitVisibility}
          onUnitVisibilityChange={cart.handleUnitVisibilityChange}
          onToggleAllUnits={(visible) => cart.handleToggleAllUnits(visible, cart.orderItems)}

          // Summary
          orderItems={cart.orderItems}
          onRemoveUnit={cart.handleRemoveUnit}
          onQuantityChange={cart.handleQuantityChange}
          grandTotal={pricingState.grandTotal}
          deliveryFeeAmount={pricingState.deliveryFeeAmount}
          deliveryFeeResult={serviceArea.deliveryFeeResult}
          depositAmount={pricingState.depositAmount}
          depositLabelText={pricingState.depositLabelText}
          stripeAccountId={installer.stripeAccountId}

          // Booking form
          firstName={booking.firstName}
          lastName={booking.lastName}
          email={booking.email}
          phone={booking.phone}
          onFirstNameChange={booking.setFirstName}
          onLastNameChange={booking.setLastName}
          onEmailChange={booking.setEmail}
          onPhoneChange={booking.setPhone}

          // Address
          streetAddress={booking.streetAddress}
          city={booking.city}
          addrState={booking.addrState}
          addrZip={booking.addrZip}
          onStreetAddressChange={booking.setStreetAddress}
          onCityChange={booking.setCity}
          onAddrStateChange={booking.setAddrState}
          onAddrZipChange={booking.setAddrZip}

          // Delivery address
          hasDifferentDelivery={booking.hasDifferentDelivery}
          onHasDifferentDeliveryChange={booking.setHasDifferentDelivery}
          deliveryStreet={booking.deliveryStreet}
          deliveryCity={booking.deliveryCity}
          deliveryState={booking.deliveryState}
          deliveryZip={booking.deliveryZip}
          onDeliveryStreetChange={booking.setDeliveryStreet}
          onDeliveryCityChange={booking.setDeliveryCity}
          onDeliveryStateChange={booking.setDeliveryState}
          onDeliveryZipChange={booking.setDeliveryZip}

          // Submit
          submitting={booking.submitting}
          submitted={booking.submitted}
          submitError={booking.submitError}
          onBookDeposit={isDemo ? () => installer.setDemoToast(true) : handleBookDeposit}
          isDemo={isDemo}
          onDemoToast={() => installer.setDemoToast(true)}

          // ZIP check
          zip={serviceArea.zip}
          onZipChange={serviceArea.setZip}
          onZipCheck={serviceArea.handleZipCheck}
          zipChecking={serviceArea.zipChecking}
          zipResult={serviceArea.zipResult as { available: boolean; message?: string } | null}
          onZipResultClear={() => serviceArea.setZipResult(null)}
          installerLocked={installer.installerLocked}

          // Waitlist
          zipOutOfArea={serviceArea.zipOutOfArea}
          zipCheckMsg={serviceArea.zipCheckMsg}
          handedOff={serviceArea.handedOff}
          handoffInstallerName={serviceArea.handoffInstallerName}
          waitlistSending={serviceArea.waitlistSending}
          waitlistSent={serviceArea.waitlistSent}
          waitlistError={serviceArea.waitlistError}
          onWaitlist={handleWaitlist}

          // Trial cap waitlist (hostage lead)
          installerAtCapacity={serviceArea.installerAtCapacity}
          trialCapWaitlistSending={serviceArea.trialCapWaitlistSending}
          trialCapWaitlistSent={serviceArea.trialCapWaitlistSent}
          trialCapWaitlistError={serviceArea.trialCapWaitlistError}
          onJoinTrialCapWaitlist={handleJoinTrialCapWaitlist}

          // Installer services (cleanout — adds to order)
          servicesConfig={installer.data?.servicesConfig}
          selectedCleanout={productAddons.selectedCleanout}
          onCleanoutChange={productAddons.setSelectedCleanout}

          // Contact installer
          installerId={installer.installerId}
          installerSlug={installer.data?.routing.slug ?? null}
          installerPhone={installer.data?.routing.phone ?? null}
          brandingTitle={installer.data?.branding.title || ""}
          showContactForm={contact.showContactForm}
          onShowContactFormChange={contact.setShowContactForm}
          contactMessage={contact.contactMessage}
          onContactMessageChange={contact.setContactMessage}
          contactSending={contact.contactSending}
          contactSent={contact.contactSent}
          contactError={contact.contactError}
          onContactInstaller={contact.handleContactInstaller}

          // Scheduler (inline in sidebar)
          schedulingEnabled={installer.data?.routing.schedulingEnabled ?? true}
          scheduledDate={booking.scheduledDate}
          onScheduledDateChange={booking.setScheduledDate}
          installerLeadTime={effectiveLeadTime}
          installerWorkingDays={installer.data?.routing.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]}
          blackoutDates={booking.blackoutDates}

          // Discount code (inline in sidebar)
          discountInput={pricingState.discountInput}
          onDiscountInputChange={(v) => { pricingState.setDiscountInput(v); pricingState.setDiscountError(""); }}
          discountApplied={pricingState.discountApplied}
          discountLoading={pricingState.discountLoading}
          discountError={pricingState.discountError}
          onApplyDiscount={pricingState.handleApplyDiscount}
          onRemoveDiscount={pricingState.handleRemoveDiscount}

          // Organizer Customization (per-section addons)
          addons={builder.addons}
          onAddonsChange={builder.setAddons}
          addonPricing={installer.data?.pricing?.addon_pricing}
          addonDefaults={installer.data?.addonDefaults}

          // Paint options
          paintFrameColor={builder.paintFrameColor}
          paintDoorColor={builder.paintDoorColor}
          paintSidePanelColor={builder.paintSidePanelColor}
          onPaintFrameColorChange={builder.setPaintFrameColor}
          onPaintDoorColorChange={builder.setPaintDoorColor}
          onPaintSidePanelColorChange={builder.setPaintSidePanelColor}

          // Indoor delivery
          indoorDeliveryConfig={installer.data?.indoorDeliveryConfig}
          indoorDelivery={builder.indoorDelivery}
          onIndoorDeliveryChange={builder.setIndoorDelivery}

          // UI Trigger bridge for 3D model animation
          onPulseVisualizerTrigger={() => {}}

          // Step tracking
          onStepChange={cart.setSidebarStep}
        />

        {/* ── 3D VISUALIZER ── */}
        <main className="order-1 sticky top-0 z-10 flex h-[35vh] shrink-0 flex-col border-b border-stone-800 bg-white lg:static lg:order-2 lg:z-auto lg:h-auto lg:flex-1 lg:border-b-0 lg:border-l lg:border-stone-200">
          <div className="relative min-h-0 flex-1 overflow-hidden lg:min-h-[300px]">
            <RackVisualizer
              cols={presets.activePresetObj && presets.compoundBuild ? presets.compoundBuild.subUnits[0].cols : (builder.build.cols || builder.numCols || 1)}
              rows={presets.activePresetObj && presets.compoundBuild ? presets.compoundBuild.subUnits[0].rows : (builder.build.rows || builder.numRows || 1)}
              toteType={presets.activePresetObj ? presets.activePresetObj.toteModel as ToteType : builder.toteType}
              toteColor={presets.activePresetObj ? presets.activePresetObj.toteColor as ToteColor : builder.effectiveToteColor}
              unitType={presets.activePresetObj ? presets.activePresetObj.unitType : builder.unitType}
              orientation={presets.activePresetObj ? presets.activePresetObj.orientation : builder.effectiveOrientation}
              hasTotes={presets.activePresetObj ? presets.presetTotes : builder.hasTotes}
              hasWheels={presets.activePresetObj ? presets.activePresetObj.units.some((u) => u.hasWheels) : builder.hasWheels}
              hasTop={presets.activePresetObj ? presets.activePresetObj.units.some((u) => u.hasTop) : builder.effectiveHasTop}
              totalW={presets.activePresetObj && presets.compoundBuild ? presets.compoundBuild.combinedW : builder.build.totalW}
              totalH={presets.activePresetObj && presets.compoundBuild ? presets.compoundBuild.maxH : builder.build.totalH}
              presetUnits={presets.presetVisUnits}
              drawerSlideRows={presets.activePresetObj?.drawerSlideRows}
              drawerSlideColumns={presets.activePresetObj?.drawerSlideColumns}
              hasDrawerSlides={(presets.activePresetObj?.drawerSlideColumns?.length ?? 0) > 0 || (presets.activePresetObj?.drawerSlideRows ?? 0) > 0}
              addons={presets.activePresetObj ? undefined : builder.addons}
              paintFrameColor={presets.activePresetObj ? null : builder.paintFrameColor}
              paintDoorColor={presets.activePresetObj ? null : builder.paintDoorColor}
              paintSidePanelColor={presets.activePresetObj ? null : builder.paintSidePanelColor}
              shelvingConfig={productAddons.activeShelvingConfig}
              overheadConfig={productAddons.overheadPreview ? { slotsWide: productAddons.overheadPreview.slotsWide, slotsDeep: productAddons.overheadPreview.slotsDeep, toteType: productAddons.overheadPreview.toteType, hasTotes: productAddons.overheadPreview.hasTotes } : undefined}
              raisedBedConfig={productAddons.raisedBedPreview || undefined}
              chairConfig={productAddons.chairPreview || undefined}
              watermarkText={installer.data?.branding.title || "Storage-Network.app"}
              use2x4Rails={installer.data?.pricing?.use_2x4_rails === true}
              multiUnitItems={cart.multiUnitItems as MultiUnitItem[] | undefined}
              multiUnitControls={cart.orderItems.length >= 1 ? {
                showMultiUnit3D: cart.showMultiUnit3D,
                onShowMultiUnit3DChange: cart.setShowMultiUnit3D,
                unitVisibility: cart.unitVisibility,
                onUnitVisibilityChange: cart.handleUnitVisibilityChange,
                orderItems: cart.expandedMultiUnitDescs,
              } : undefined}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-2 py-1.5 text-center text-xs font-medium text-stone-500 lg:px-4 lg:py-3 lg:text-sm">
            {productAddons.overheadPreview ? (
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
            ) : cart.showMultiUnit3D && cart.orderItems.length > 0 && cart.orderItems.every((it) => it.raisedBedConfig) ? (
              <>
                {cart.orderItems.reduce((s, it) => s + (it.quantity || 1), 0)} Raised Bed{cart.orderItems.reduce((s, it) => s + (it.quantity || 1), 0) > 1 ? "s" : ""}
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Planter Order
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
            ) : presets.activePresetObj && presets.compoundBuild ? (
              <>
                {presets.compoundBuild.combinedW.toFixed(1)}&quot; W &times;{" "}
                {presets.compoundBuild.maxH.toFixed(1)}&quot; H &times;{" "}
                {presets.compoundBuild.depth}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {presets.compoundBuild.subUnits.map((su) => `${su.cols}×${su.rows}`).join(" + ")} ={" "}
                  {presets.compoundBuild.totalSlots} slots
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {presets.compoundBuild.presetName}
                </span>
              </>
            ) : cart.showMultiUnit3D && cart.orderItems.every((it) => !!it.chairConfig) ? (
              (() => {
                const totalChairs = cart.orderItems.reduce((s, it) => s + (it.quantity || 1), 0);
                return (
                  <>
                    30&quot; W &times; 34&quot; H &times; 38&quot; D
                    {totalChairs > 1 && (
                      <span className="ml-1 font-bold text-gray-900">
                        &times; {totalChairs}
                      </span>
                    )}
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                      Adirondack Chair{totalChairs > 1 ? "s" : ""}
                    </span>
                  </>
                );
              })()
            ) : cart.showMultiUnit3D && cart.orderItems.some((it) => !it.raisedBedConfig && !it.overheadStorageConfig && !it.chairConfig) ? (
              (() => {
                const rackItems = cart.orderItems.filter(
                  (it) => !it.raisedBedConfig && !it.overheadStorageConfig && !it.chairConfig,
                );
                const combinedW = rackItems.reduce(
                  (s, it) => s + (it.totalW || 0) * (it.quantity || 1), 0,
                );
                const maxH = Math.max(...rackItems.map((it) => it.totalH || 0));
                const depth = rackItems[0]?.depth || 30;
                const slotParts: string[] = [];
                let totalSlots = 0;
                for (const it of rackItems) {
                  const qty = it.quantity || 1;
                  const slots = it.presetUnits
                    ? it.presetUnits.reduce((s, su) => s + su.cols * su.rows, 0)
                    : it.cols * it.rows;
                  for (let q = 0; q < qty; q++) {
                    slotParts.push(`${it.cols}×${it.rows}`);
                    totalSlots += slots;
                  }
                }
                return (
                  <>
                    {combinedW > 0 ? combinedW.toFixed(1) : "—"}&quot; W &times;{" "}
                    {maxH > 0 ? maxH.toFixed(1) : "—"}&quot; H &times;{" "}
                    {depth}&quot; D &nbsp;&mdash;&nbsp;
                    <span className="font-bold text-gray-900">
                      {slotParts.join(" + ")} ={" "}
                      {totalSlots} slots
                    </span>
                  </>
                );
              })()
            ) : (
              <>
                {builder.build.totalW > 0 ? builder.build.totalW.toFixed(1) : "—"}&quot; W
                &times;{" "}
                {builder.build.totalH > 0 ? builder.build.totalH.toFixed(1) : "—"}&quot; H
                &times; {builder.build.depth > 0 ? builder.build.depth : (builder.unitType === "mini" ? 12.75 : builder.orientation === "sideways" ? 20 : 30)}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {builder.build.cols || builder.numCols || 1} &times; {builder.build.rows || builder.numRows || 1} ={" "}
                  {builder.build.slots || (builder.numCols || 1) * (builder.numRows || 1)} slots
                </span>
                {builder.unitType === "mini" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                    MINI
                  </span>
                )}
                {/* Inputs caption — surface which selections produced these dims */}
                <div className="mt-0.5 text-[10px] font-normal text-stone-500">
                  {builder.unitType === "mini"
                    ? "Mini totes"
                    : (() => {
                        const is2x4 = installer.data?.pricing?.use_2x4_rails === true;
                        const isSideways = builder.orientation === "sideways";
                        const slotLabel = is2x4
                          ? "21″ universal slot"
                          : isSideways
                          ? "30.25″ sideways slot"
                          : builder.toteType === "GM"
                          ? "20¾″ slot (Wider Totes)"
                          : "19¾″ slot (Standard Totes)";
                        const rails = is2x4 ? "2×4 rails" : "plywood rails";
                        const orient = isSideways ? "sideways" : "standard orientation";
                        return `${slotLabel} · ${orient} · ${rails}`;
                      })()}
                  {builder.buildLoading && (
                    <span className="ml-1 italic text-stone-400">· recalculating…</span>
                  )}
                </div>
              </>
            )}
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
          cart.setSidebarStep(4);
        }}
      />

    </div>
  );
}
