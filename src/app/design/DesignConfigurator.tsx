"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  checkAvailability,
  getInstallerById,
  rerouteToLocalInstaller,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapAvailabilityToViewModel } from "@/lib/mappers/installerMapper";
import { PLATFORM_DEFAULTS, type DesignPageViewModel } from "@/types/viewModels";
import { submitNetworkLead, type QuoteItem } from "@/app/actions/submit-lead";
import { validateServiceArea, submitWaitlistRequest } from "@/app/actions/installer";
import { calculateBuild, calculateCompoundBuild, calculateShelvingUnit, type UnitType, type Orientation, type CompoundBuildResult } from "@/app/actions/calculator";
import { SHELVING_CONFIGS, type ShelvingConfig } from "@/lib/shelving";
import { calculateDeliveryFee, type DeliveryFeeResult } from "@/app/actions/delivery-fee";
import { getDepositAmount, getDepositLabel } from "@/app/actions/fee-engine";
import { contactInstaller } from "@/app/actions/contact-installer";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import type { VisualizerSubUnit, ShelvingConfig3D } from "@/components/visualizer/RackVisualizer";
import type { SectionAddon, AddonPricing, PaintColorId } from "@/types/viewModels";
import { ADDON_PLATFORM_DEFAULTS } from "@/types/viewModels";
import BookingModal from "@/components/booking/BookingModal";
import ScanWizard from "@/components/design/ScanWizard";
import ConfiguratorSidebar from "@/components/design/ConfiguratorSidebar";
import DatePickerDrawer from "@/components/design/DatePickerDrawer";
import PageViewTracker from "@/components/tracking/PageViewTracker";
import {
  AlertTriangle,
  ArrowLeft,
  User,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Types (display-only — no pricing or math constants)
// ═══════════════════════════════════════════════════════════════════════════
type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";

interface UnitConfig {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  desc: string;
  addons: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
  /** When set, this order item is an open shelving unit (not a tote organizer) */
  shelvingConfigId?: string;
  /** When set, this order item is an overhead ceiling storage unit */
  overheadStorageConfig?: import("@/lib/overhead-storage").OverheadStorageConfig;
}

interface ServerBuild {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  slots: number;
  unitType: UnitType;
  orientation: Orientation;
}

// ═══════════════════════════════════════════════════════════════════════════
// Props — accepts a DesignPageViewModel from the server.
// The client NEVER sees is_pro, business_name, or raw logo_url.
// ═══════════════════════════════════════════════════════════════════════════
interface SavedSignalData {
  quoteData: unknown[] | null;
  sourceInstallerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

interface DesignConfiguratorProps {
  initialData: DesignPageViewModel | null;
  initialZip: string;
  mode: string;
  isDemo?: boolean;
  leadSource?: "platform" | "partner_link";
  savedSignal?: SavedSignalData;
}

// ── Cookie helpers (installer attribution) ─────────────────────────────
function setInstallerCookie(id: string) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `installer_id=${encodeURIComponent(id)};path=/;expires=${expires};SameSite=Lax`;
}

function getInstallerCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)installer_id=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ═══════════════════════════════════════════════════════════════════════════
// DesignConfigurator — Client Component
//
// Renders the DesignPageViewModel. No branding decisions are made here.
// The server already decided what title, subtitle, and logo to show.
// ═══════════════════════════════════════════════════════════════════════════
export default function DesignConfigurator({
  initialData,
  initialZip,
  mode,
  isDemo = false,
  leadSource = "platform",
  savedSignal,
}: DesignConfiguratorProps) {
  // ── Demo mode toast ────────────────────────────────────────────────
  const [demoToast, setDemoToast] = useState(false);

  // ── Installer context (hydrated from server view model) ────────────
  const [installerId, setInstallerId] = useState(initialData?.routing.installerId || "");
  const [data, setData] = useState<DesignPageViewModel | null>(initialData);
  const [installerLocked, setInstallerLocked] = useState(!!initialData);
  const [installerLoading] = useState(false);

  // Set cookie on mount if installer was resolved server-side
  useEffect(() => {
    if (initialData?.routing.installerId) {
      setInstallerCookie(initialData.routing.installerId);
    } else {
      // No installer from server — check cookie fallback
      const cookieId = getInstallerCookie();
      if (cookieId) {
        setInstallerId(cookieId);
        // Also fetch installer data so pricing overrides are loaded
        getInstallerById(cookieId).then((res) => {
          if (res.available) {
            const vm = mapAvailabilityToViewModel(res);
            if (vm) {
              setData(vm);
              setInstallerId(vm.routing.installerId);
            }
          }
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ZIP check ─────────────────────────────────────────────────────────
  const [zip, setZip] = useState(initialZip);
  const [zipChecking, setZipChecking] = useState(false);
  const [zipResult, setZipResult] = useState<AvailabilityResult | null>(null);

  useEffect(() => {
    if (initialZip.length === 5 && !initialData) {
      handleZipCheckAuto(initialZip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleZipCheckAuto(zipCode: string) {
    setZipChecking(true);
    setZipResult(null);
    try {
      const res = await checkAvailability(zipCode);
      setZipResult(res);
      if (res.available && res.installer_id) {
        // Map through the same branding gate used by the server
        const vm = mapAvailabilityToViewModel(res);
        if (vm) {
          setData(vm);
          setInstallerId(vm.routing.installerId);
          setInstallerCookie(vm.routing.installerId);
        }
      }
    } catch {
      setZipResult({
        available: false,
        installer_id: null,
        installer_name: null,
        installer_stripe_id: null,
        installer_avatar_url: null,
        installer_phone: null,
        installer_lead_time: 5,
        installer_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        installer_is_pro: false,
        installer_logo_url: null,
        installer_pricing: null,
        installer_services_config: null,
        message: "Unable to check availability.",
      });
    } finally {
      setZipChecking(false);
    }
  }

  // ── Wall fit ──────────────────────────────────────────────────────────
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [wallFitMsg, setWallFitMsg] = useState("");

  // ── Design inputs ─────────────────────────────────────────────────────
  const [unitType, setUnitType] = useState<UnitType>("standard");
  const [orientation, setOrientation] = useState<Orientation>("standard");
  const [cols, setCols] = useState<number | string>(4);
  const [rows, setRows] = useState<number | string>(4);
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [toteColor, setToteColor] = useState<ToteColor>("black");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);
  const [addons, setAddons] = useState<SectionAddon[]>([]);

  // ── Paint color state ──────────────────────────────────────────────────
  const [paintFrameColor, setPaintFrameColor] = useState<import("@/types/viewModels").PaintColorId | null>(null);
  const [paintDoorColor, setPaintDoorColor] = useState<import("@/types/viewModels").PaintColorId | null>(null);
  const [paintSidePanelColor, setPaintSidePanelColor] = useState<import("@/types/viewModels").PaintColorId | null>(null);

  // ── Server-provided build result ──────────────────────────────────────
  const [build, setBuild] = useState<ServerBuild>({
    cols: 4, rows: 4, price: 0, totalW: 0, totalH: 0, depth: 30, slots: 0, unitType: "standard", orientation: "standard",
  });
  const [buildLoading, setBuildLoading] = useState(false);

  // ── Bestseller preset state ────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<string | null>(null); // null = custom, "indiana-joe" = preset
  const [compoundBuild, setCompoundBuild] = useState<CompoundBuildResult | null>(null);
  const [presetTotes, setPresetTotes] = useState(true);
  const [presetLoading, setPresetLoading] = useState(false);
  const presetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active preset object (null when custom build)
  const activePresetObj = useMemo(() =>
    activePreset ? BESTSELLER_PRESETS.find((p) => p.id === activePreset) ?? null : null,
    [activePreset]
  );

  // Derived: VisualizerSubUnit[] for the visualizer from compoundBuild
  const presetVisUnits: VisualizerSubUnit[] | undefined = useMemo(() => {
    if (!compoundBuild || !activePresetObj) return undefined;
    return compoundBuild.subUnits.map((su, i) => ({
      cols: su.cols,
      rows: su.rows,
      totalW: su.totalW,
      totalH: su.totalH,
      hasTop: activePresetObj.units[i].hasTop,
      hasWheels: activePresetObj.units[i].hasWheels,
    }));
  }, [compoundBuild, activePresetObj]);

  // ── Filtered presets & shelving visibility based on installer pricing ──
  const filteredPresets = useMemo(() => {
    const p = data?.pricing;
    if (!p) return BESTSELLER_PRESETS;
    return BESTSELLER_PRESETS.filter((preset) => {
      const key = `bestseller_${preset.id.replace(/-/g, "_")}_disabled` as keyof typeof p;
      return p[key] !== true;
    });
  }, [data?.pricing]);

  const shelvingEnabled = data?.pricing?.open_shelving_disabled !== true;

  // ── Open Shelving add-on state ───────────────────────────────────────
  const [shelvingConfigId, setShelvingConfigId] = useState<string | null>(null);
  const [shelvingPrice, setShelvingPrice] = useState<number | null>(null);
  const [shelvingLoading, setShelvingLoading] = useState(false);

  // Calculate shelving price when selection changes
  useEffect(() => {
    if (!shelvingConfigId) { setShelvingPrice(null); return; }
    setShelvingLoading(true);
    calculateShelvingUnit({ configId: shelvingConfigId, installerPricing: data?.pricing })
      .then((res) => { if (res.success) setShelvingPrice(res.price); })
      .finally(() => setShelvingLoading(false));
  }, [shelvingConfigId, data?.pricing]);

  // Derive a ShelvingConfig3D for the visualizer when a shelving option is selected
  const activeShelvingConfig: ShelvingConfig3D | undefined = useMemo(() => {
    if (!shelvingConfigId) return undefined;
    const cfg = SHELVING_CONFIGS.find((c) => c.id === shelvingConfigId);
    if (!cfg) return undefined;
    return { widthIn: cfg.widthIn, frameH: cfg.frameH, depth: cfg.depth, shelves: cfg.shelves };
  }, [shelvingConfigId]);

  function handleAddShelvingUnit() {
    if (!shelvingConfigId || shelvingPrice == null) return;
    const cfg = SHELVING_CONFIGS.find((c) => c.id === shelvingConfigId);
    if (!cfg) return;
    const heightLabel = cfg.height === "tall" ? "Tall" : "Short";
    // Replace any existing items — shelving and tote organizers can't be mixed
    setOrderItems([
      {
        cols: 0,
        rows: 0,
        toteType: "HDX" as ToteType,
        toteColor: "black" as ToteColor,
        unitType: "standard",
        orientation: "standard",
        hasTotes: false,
        hasWheels: false,
        hasTop: true,
        price: shelvingPrice,
        totalW: cfg.widthIn,
        totalH: cfg.frameH,
        depth: cfg.depth,
        desc: `Open Shelving: ${cfg.widthFt}' × ${heightLabel} (${cfg.shelves} ${cfg.shelves === 1 ? "shelf" : "shelves"})`,
        addons: [],
        shelvingConfigId: cfg.id,
      },
    ]);
    setShelvingConfigId(null);
    setShelvingPrice(null);
  }

  // ── Overhead Ceiling Storage ──────────────────────────────────────────
  const overheadStorageEnabled = data?.pricing?.overhead_storage_disabled !== true;
  const [overheadPreview, setOverheadPreview] = useState<{ widthIn: number; depthIn: number; dropHeightIn: number } | null>(null);

  function handleAddOverheadUnit(
    result: import("@/lib/overhead-storage").OverheadStorageResult,
    config: import("@/lib/overhead-storage").OverheadStorageConfig,
  ) {
    const sizeLabel = config.sizePresetId
      ? `${result.widthIn / 12}'×${result.depthIn / 12}'`
      : `${result.widthIn}"×${result.depthIn}"`;
    const desc = `Overhead Storage: ${sizeLabel} — ${result.dropHeightIn}" drop`;

    setOrderItems((prev) => [
      ...prev,
      {
        cols: 0,
        rows: 0,
        toteType: "HDX" as ToteType,
        toteColor: "black" as ToteColor,
        unitType: "standard",
        orientation: "standard",
        hasTotes: false,
        hasWheels: false,
        hasTop: false,
        price: result.price,
        totalW: result.widthIn,
        totalH: result.dropHeightIn,
        depth: result.depthIn,
        desc,
        addons: [],
        overheadStorageConfig: config,
      } as UnitConfig,
    ]);
  }

  // ── Multi-unit quote list ─────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);

  // ── Multi-unit 3D visualization toggles ─────────────────────────────
  const [unitVisibility, setUnitVisibility] = useState<Record<number, boolean>>({});
  const [showMultiUnit3D, setShowMultiUnit3D] = useState(false);

  // Build multi-unit items for the visualizer
  const multiUnitItems = useMemo(() => {
    if (!showMultiUnit3D || orderItems.length === 0) return undefined;
    return orderItems
      .filter((item) => !item.shelvingConfigId) // Shelving has separate 3D; tote organizers + overhead supported
      .map((item, i) => ({
        cols: item.cols,
        rows: item.rows,
        toteType: item.toteType,
        toteColor: item.toteColor,
        unitType: item.unitType,
        orientation: item.orientation,
        hasTotes: item.hasTotes,
        hasWheels: item.hasWheels,
        hasTop: item.hasTop,
        totalW: item.totalW,
        totalH: item.totalH,
        depth: item.depth,
        addons: item.addons,
        paintFrameColor: item.paintFrameColor,
        paintDoorColor: item.paintDoorColor,
        paintSidePanelColor: item.paintSidePanelColor,
        shelvingConfigId: item.shelvingConfigId,
        overheadStorageConfig: item.overheadStorageConfig
          ? { widthIn: item.totalW, depthIn: item.depth, dropHeightIn: item.totalH }
          : undefined,
        visible: unitVisibility[i] !== false, // default visible
        desc: item.desc,
      }));
  }, [showMultiUnit3D, orderItems, unitVisibility]);

  // ── Cleanout service add-on (booked with order, not emailed) ────────
  const [selectedCleanout, setSelectedCleanout] = useState<string | null>(null);
  const cleanoutPrice = useMemo(() => {
    if (!selectedCleanout || !data?.servicesConfig) return 0;
    const svc = data.servicesConfig.find((s) => s.id === selectedCleanout);
    return svc?.price ?? 0;
  }, [selectedCleanout, data?.servicesConfig]);

  // ── Booking form ──────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  // Delivery address (if different from installation address)
  const [hasDifferentDelivery, setHasDifferentDelivery] = useState(false);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);

  // ── Contact installer (email inquiry) ──────────────────────────────
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  // Auto-dismiss "Message Sent" after 5 seconds
  useEffect(() => {
    if (!contactSent) return;
    const timer = setTimeout(() => {
      setContactSent(false);
      setShowContactForm(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [contactSent]);

  // ── Service area validation ─────────────────────────────────────────
  const [zipOutOfArea, setZipOutOfArea] = useState(false);
  const [zipCheckMsg, setZipCheckMsg] = useState("");
  const [waitlistSending, setWaitlistSending] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const zipCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Delivery fee (distance-based) ──────────────────────────────────
  const [deliveryFeeResult, setDeliveryFeeResult] = useState<DeliveryFeeResult | null>(null);

  // ── Network Referral Bounty ─────────────────────────────────────────
  // When the customer's installation ZIP is outside the original installer's
  // area, we re-route to a local installer and track the original as referrer.
  const [referringInstallerId, setReferringInstallerId] = useState<string | null>(null);
  // Track the original installer ID from the URL so we don't re-validate
  // against the swapped-in local installer (which would loop).
  const originalInstallerId = useRef(initialData?.routing.installerId || "");
  // Whether a hand-off happened (shows info banner instead of blocking)
  const [handedOff, setHandedOff] = useState(false);
  const [handoffInstallerName, setHandoffInstallerName] = useState("");

  // ── Waitlist re-engagement: hydrate saved build + contact info ────────
  // When a waitlisted customer clicks the activation email, savedSignal
  // contains their previous configurator build and referrer attribution.
  const savedSignalHydrated = useRef(false);
  useEffect(() => {
    if (!savedSignal || savedSignalHydrated.current) return;
    savedSignalHydrated.current = true;

    // Restore referrer attribution so the bounty chain is preserved
    if (savedSignal.sourceInstallerId) {
      setReferringInstallerId(savedSignal.sourceInstallerId);
    }

    // Restore contact info
    if (savedSignal.customerName) {
      const parts = savedSignal.customerName.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (savedSignal.customerEmail) setEmail(savedSignal.customerEmail);
    if (savedSignal.customerPhone) setPhone(savedSignal.customerPhone);

    // Restore saved quote items
    if (Array.isArray(savedSignal.quoteData) && savedSignal.quoteData.length > 0) {
      const restored = savedSignal.quoteData
        .map((raw) => {
          const u = raw as Record<string, unknown>;
          if (typeof u.cols !== "number" || typeof u.rows !== "number") return null;
          return {
            cols: u.cols,
            rows: u.rows,
            toteType: (u.toteType as ToteType) || "HDX",
            toteColor: (u.toteColor as ToteColor) || "black",
            unitType: (u.unitType as UnitType) || "standard",
            orientation: (u.orientation as Orientation) || "landscape",
            hasTotes: u.hasTotes === true,
            hasWheels: u.hasWheels === true,
            hasTop: u.hasTop === true,
            price: typeof u.price === "number" ? u.price : 0,
            totalW: typeof u.totalW === "number" ? u.totalW : 0,
            totalH: typeof u.totalH === "number" ? u.totalH : 0,
            depth: typeof u.depth === "number" ? u.depth : 0,
            desc: typeof u.desc === "string" ? u.desc : `${u.cols}×${u.rows}`,
          } as UnitConfig;
        })
        .filter((u): u is UnitConfig => u !== null);

      if (restored.length > 0) {
        setOrderItems(restored);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time ZIP validation when user enters installation ZIP
  // If "installation address is different" is checked, validate that ZIP instead
  useEffect(() => {
    if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    setZipOutOfArea(false);
    setZipCheckMsg("");
    setWaitlistSent(false);
    setWaitlistError("");
    setDeliveryFeeResult(null);

    const zipToCheck = hasDifferentDelivery ? deliveryZip : addrZip;
    // Validate against the ORIGINAL installer (from URL), not a swapped-in one
    const validationTargetId = originalInstallerId.current;
    if (!validationTargetId || !zipToCheck || zipToCheck.trim().length !== 5) return;

    zipCheckRef.current = setTimeout(async () => {
      const trimmedZip = zipToCheck.trim();
      const result = await validateServiceArea(validationTargetId, trimmedZip);
      if (!result.inArea) {
        // ── Network Referral Bounty: re-route to local installer ──────
        // Instead of blocking, find a local Pro and hand off the lead.
        // The original installer becomes the referrer and earns 30% of the deposit.
        const localResult = await rerouteToLocalInstaller(trimmedZip, validationTargetId);
        if (localResult.available && localResult.installer_id) {
          // Hand off: swap to local installer, track original as referrer
          setReferringInstallerId(validationTargetId);
          setHandedOff(true);
          setHandoffInstallerName(localResult.installer_name || "a local installer");
          const vm = mapAvailabilityToViewModel(localResult);
          if (vm) {
            setData(vm);
            setInstallerId(vm.routing.installerId);
            // Calculate delivery fee against the LOCAL installer
            calculateDeliveryFee(vm.routing.installerId, trimmedZip)
              .then(setDeliveryFeeResult)
              .catch(() => {});
          }
        } else {
          // No local installer found — show waitlist UI
          setZipOutOfArea(true);
          setHandedOff(false);
          setReferringInstallerId(null);
          setZipCheckMsg(
            "We don't have an installer in your area yet, but we'll notify you as soon as one is available."
          );
        }
      } else {
        // ZIP is in-area — clear any previous referral/handoff
        setReferringInstallerId(null);
        setHandedOff(false);
        setHandoffInstallerName("");
        // Calculate delivery fee for this ZIP
        calculateDeliveryFee(validationTargetId, trimmedZip)
          .then(setDeliveryFeeResult)
          .catch(() => {});
      }
    }, 600);

    return () => {
      if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    };
  // Validate against the original installer — installerId is NOT a dep here
  // because it changes during handoff and would cause a loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrZip, deliveryZip, hasDifferentDelivery]);

  // ── Re-price existing order items after handoff ─────────────────────
  // When the installer changes during a referral handoff, existing items
  // in the quote still carry the originating installer's pricing.  This
  // effect detects the handoff and recalculates every item using the
  // covering installer's pricing_config so the customer sees accurate
  // rates for the installer who will actually do the work.
  const prevPricingRef = useRef(data?.pricing);
  useEffect(() => {
    const newPricing = data?.pricing;
    // Only fire when pricing actually changes AND there are items to reprice
    if (newPricing === prevPricingRef.current || orderItems.length === 0) {
      prevPricingRef.current = newPricing;
      return;
    }
    prevPricingRef.current = newPricing;

    if (!handedOff) return; // Only reprice during a handoff, not on initial load

    (async () => {
      const repriced: UnitConfig[] = [];

      for (const item of orderItems) {
        // Check if this is a preset (compound) item by matching its desc
        // against known preset names.  Preset descs look like
        // "Indiana Joe (2x4 + 2x2 + 2x4)"
        const matchedPreset = BESTSELLER_PRESETS.find((p) =>
          item.desc.startsWith(p.name)
        );

        if (matchedPreset) {
          // Re-price via compound build with the new installer's pricing
          try {
            const result = await calculateCompoundBuild({
              presetId: matchedPreset.id,
              hasTotes: item.hasTotes,
              installerPricing: newPricing,
            });
            if (result.success) {
              repriced.push({ ...item, price: result.totalPrice });
            } else {
              repriced.push(item); // Keep original on failure
            }
          } catch {
            repriced.push(item);
          }
        } else {
          // Re-price via standard calculateBuild
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

      setOrderItems(repriced);
    })();
  // orderItems is intentionally NOT a dep — we read it once when pricing
  // changes and write back.  Including it would cause an infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pricing, handedOff]);

  // ── Booking modal ─────────────────────────────────────────────────────
  const [showBookingModal, setShowBookingModal] = useState(false);

  // ── Scan Wizard modal ───────────────────────────────────────────────────
  const [showScanWizard, setShowScanWizard] = useState(false);

  const buildTotal = orderItems.reduce((sum, it) => sum + it.price, 0);
  const deliveryFeeAmount = (deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0) ? deliveryFeeResult.fee : 0;

  // Paint pricing — calculated from installer's addon_pricing or platform defaults
  const paintFramePrice = paintFrameColor ? (data?.pricing?.addon_pricing?.paint_frame_price ?? ADDON_PLATFORM_DEFAULTS.paint_frame_price) : 0;
  const paintDoorsPanelsPrice = data?.pricing?.addon_pricing?.paint_doors_panels_price ?? ADDON_PLATFORM_DEFAULTS.paint_doors_panels_price;
  const paintDoorCost = paintDoorColor ? paintDoorsPanelsPrice : 0;
  const paintPanelCost = paintSidePanelColor ? paintDoorsPanelsPrice : 0;
  const paintTotal = paintFramePrice + paintDoorCost + paintPanelCost;

  const grandTotal = buildTotal + deliveryFeeAmount + cleanoutPrice + paintTotal;

  // Deposit — computed server-side using installer's custom config (min 15% enforced)
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositLabelText, setDepositLabelText] = useState("15%");
  useEffect(() => {
    if (grandTotal > 0) {
      getDepositAmount(grandTotal, installerId || undefined).then(setDepositAmount);
    }
  }, [grandTotal, installerId]);
  useEffect(() => {
    getDepositLabel(installerId || undefined).then(setDepositLabelText);
  }, [installerId]);

  // Does any unit have wheels?
  const anyHasWheels = orderItems.some((it) => it.hasWheels);
  // Total cols of largest unit (for capacity weight)
  const maxCols = orderItems.reduce((max, it) => Math.max(max, it.cols), 0);

  // ── Convenience: routing shortcuts ──────────────────────────────────
  const stripeAccountId = data?.routing.stripeAccountId || null;

  // ── Scheduler (inline in sidebar) ────────────────────────────────────
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [blackoutDates, setBlackoutDates] = useState<{ start_date: string; end_date: string }[]>([]);

  // Fetch blackout dates when installer is known
  useEffect(() => {
    if (!installerId) return;
    (async () => {
      const { getBlackoutDates } = await import("@/app/actions/blackout-dates");
      const result = await getBlackoutDates(installerId);
      if (result.success) {
        setBlackoutDates(result.dates.map((d: { start_date: string; end_date: string }) => ({ start_date: d.start_date, end_date: d.end_date })));
      }
    })();
  }, [installerId]);

  // Effective lead time: 3-day minimum for caster add-ons
  const effectiveLeadTime = anyHasWheels
    ? Math.max(data?.routing.leadTime ?? 5, 3)
    : (data?.routing.leadTime ?? 5);

  // ── Discount code (inline in sidebar) ───────────────────────────────
  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{ code: string; amount: number; discountType?: "fixed" | "percentage"; discountValue?: number } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  async function handleApplyDiscount() {
    if (!discountInput.trim() || !installerId) return;
    setDiscountLoading(true);
    setDiscountError("");
    const { validateDiscountCode } = await import("@/app/actions/discount-codes");
    const result = await validateDiscountCode(discountInput.trim(), installerId, grandTotal);
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

  // ── Debounced server call ─────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBuild = useCallback(
    (
      c: number,
      r: number,
      model: ToteType,
      color: ToteColor,
      unit: UnitType,
      orient: Orientation,
      totes: boolean,
      wheels: boolean,
      top: boolean,
      sectionAddons?: SectionAddon[]
    ) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setBuildLoading(true);
        try {
          const res = await calculateBuild({
            cols: c,
            rows: r,
            toteModel: model,
            toteColor: color,
            unitType: unit,
            orientation: orient,
            addOns: { totes, wheels, top },
            mode: "manual",
            installerPricing: data?.pricing,
            sectionAddons,
          });
          if (res.success) {
            setBuild({
              cols: res.cols,
              rows: res.rows,
              price: res.price,
              totalW: res.dimensions.totalW,
              totalH: res.dimensions.totalH,
              depth: res.dimensions.depth,
              slots: res.config.slots,
              unitType: res.config.unitType,
              orientation: res.config.orientation,
            });
          }
        } catch {
          // keep previous build on error
        } finally {
          setBuildLoading(false);
        }
      }, 500);
    },
    [data?.pricing]
  );

  // ── Fetch compound build for presets ──────────────────────────────────
  const fetchPresetBuild = useCallback(
    (presetId: string, totes: boolean) => {
      if (presetDebounceRef.current) clearTimeout(presetDebounceRef.current);
      presetDebounceRef.current = setTimeout(async () => {
        setPresetLoading(true);
        try {
          const res = await calculateCompoundBuild({
            presetId,
            hasTotes: totes,
            installerPricing: data?.pricing,
          });
          if (res.success) {
            setCompoundBuild(res);
          }
        } catch {
          // keep previous build on error
        } finally {
          setPresetLoading(false);
        }
      }, 300);
    },
    [data?.pricing]
  );

  // Re-fetch preset build when totes toggle changes
  useEffect(() => {
    if (activePreset) {
      fetchPresetBuild(activePreset, presetTotes);
    }
  }, [activePreset, presetTotes, fetchPresetBuild]);

  // Fire on every config change (only when cols/rows are valid numbers)
  const numCols = typeof cols === "number" ? cols : parseInt(cols as string) || 0;
  const numRows = typeof rows === "number" ? rows : parseInt(rows as string) || 0;

  // For mini units, plywood top is always included (mandatory)
  const effectiveHasTop = useMemo(() => unitType === "mini" ? true : hasTop, [unitType, hasTop]);

  // Effective orientation: only applies to standard units
  const effectiveOrientation: Orientation = useMemo(() => unitType === "standard" ? orientation : "standard", [unitType, orientation]);

  // Effective tote color: only applies to HDX standard units with totes included
  const effectiveToteColor: ToteColor = useMemo(() => (toteType === "HDX" && unitType === "standard" && hasTotes) ? toteColor : "black", [toteType, unitType, hasTotes, toteColor]);

  useEffect(() => {
    if (numCols >= 1 && numRows >= 1) {
      fetchBuild(numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, addons);
    }
  }, [numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, addons, fetchBuild]);

  // ── Smart Unit Type Switching: Re-trigger Auto-Fit when unitType changes ──
  const prevUnitTypeRef = useRef(unitType);
  useEffect(() => {
    if (prevUnitTypeRef.current !== unitType) {
      prevUnitTypeRef.current = unitType;
      // If wall dimensions are set, trigger auto-fit for the new unit type
      const wW = parseFloat(wallWidth);
      const wH = parseFloat(wallHeight);
      if (wW > 0 && wH > 0) {
        // Trigger auto-fit with new unit type
        handleWallFit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitType]);

  // ── Smart Orientation Switching: Re-trigger Auto-Fit when orientation changes ──
  const prevOrientationRef = useRef(effectiveOrientation);
  useEffect(() => {
    if (prevOrientationRef.current !== effectiveOrientation) {
      prevOrientationRef.current = effectiveOrientation;
      // If wall dimensions are set, trigger auto-fit for the new orientation
      const wW = parseFloat(wallWidth);
      const wH = parseFloat(wallHeight);
      if (wW > 0 && wH > 0) {
        // Trigger auto-fit with new orientation
        handleWallFit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrientation]);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleZipCheck() {
    if (zip.length < 5) return;
    await handleZipCheckAuto(zip);
  }

  async function handleWallFit() {
    const wW = parseFloat(wallWidth);
    const wH = parseFloat(wallHeight);
    if (!wW || !wH) return;

    setBuildLoading(true);
    try {
      const res = await calculateBuild({
        wallWidth: wW,
        wallHeight: wH,
        toteModel: toteType,
        toteColor: effectiveToteColor,
        unitType,
        orientation: effectiveOrientation,
        addOns: { totes: hasTotes, wheels: hasWheels, top: effectiveHasTop },
        mode: "wallFit",
        installerPricing: data?.pricing,
      });
      if (res.success) {
        setCols(res.cols);
        setRows(res.rows);
        setBuild({
          cols: res.cols,
          rows: res.rows,
          price: res.price,
          totalW: res.dimensions.totalW,
          totalH: res.dimensions.totalH,
          depth: res.dimensions.depth,
          slots: res.config.slots,
          unitType: res.config.unitType,
          orientation: res.config.orientation,
        });
        setWallFitMsg(
          `Max fit: ${res.cols} Wide × ${res.rows} High for that wall.`
        );
      }
    } catch {
      // keep previous state on error
    } finally {
      setBuildLoading(false);
    }
  }

  // Handler for ScanWizard completion
  async function handleScanWizardComplete(width: number, height: number | undefined, toteConfigKey: "HDX" | "GM") {
    // Set wall dimensions from AI measurement (default height to 96" if not detected)
    const effectiveHeight = height ?? 96;
    setWallWidth(width.toFixed(1));
    setWallHeight(effectiveHeight.toFixed(1));
    // Set tote type based on scanned tote
    setToteType(toteConfigKey);
    setWallFitMsg(`AI measured: ${width.toFixed(1)}" wide × ${effectiveHeight.toFixed(1)}" tall${!height ? " (default height)" : ""}`);
    // Call calculateBuild directly with the known values to avoid stale state
    setBuildLoading(true);
    try {
      const res = await calculateBuild({
        wallWidth: width,
        wallHeight: effectiveHeight,
        toteModel: toteConfigKey,
        toteColor: effectiveToteColor,
        unitType,
        orientation: effectiveOrientation,
        addOns: { totes: hasTotes, wheels: hasWheels, top: effectiveHasTop },
        mode: "wallFit",
        installerPricing: data?.pricing,
      });
      if (res.success) {
        setCols(res.cols);
        setRows(res.rows);
        setBuild({
          cols: res.cols,
          rows: res.rows,
          price: res.price,
          totalW: res.dimensions.totalW,
          totalH: res.dimensions.totalH,
          depth: res.dimensions.depth,
          slots: res.config.slots,
          unitType: res.config.unitType,
          orientation: res.config.orientation,
        });
        setWallFitMsg(
          `AI measured: ${width.toFixed(1)}" × ${effectiveHeight.toFixed(1)}"${!height ? " (default height)" : ""} — Max fit: ${res.cols} Wide × ${res.rows} High`
        );
      }
    } catch {
      // keep previous state on error
    } finally {
      setBuildLoading(false);
    }
  }

  function handleAddUnit() {
    let unitLabel = unitType === "mini" ? "Mini" : "Standard";
    if (unitType === "standard" && effectiveOrientation === "sideways") {
      unitLabel = "Standard (Sideways)";
    }
    // Add tote color to description if clear totes are selected
    let toteDesc = "";
    if (hasTotes && toteType === "HDX" && unitType === "standard" && effectiveToteColor === "clear") {
      toteDesc = " (Clear Totes)";
    }
    // Remove any shelving items — tote organizers and shelving can't be mixed
    setOrderItems((prev) => [
      ...prev.filter((it) => !it.shelvingConfigId),
      {
        cols: build.cols,
        rows: build.rows,
        toteType,
        toteColor: effectiveToteColor,
        unitType,
        orientation: effectiveOrientation,
        hasTotes,
        hasWheels,
        hasTop: effectiveHasTop,
        price: build.price,
        totalW: build.totalW,
        totalH: build.totalH,
        depth: build.depth,
        desc: `${unitLabel}: ${build.cols}W × ${build.rows}H${toteDesc}`,
        addons: [...addons],
        paintFrameColor,
        paintDoorColor,
        paintSidePanelColor,
      },
    ]);
    // Reset step 2/3 customization state so the configurator is fresh for a new unit
    setAddons([]);
    setPaintFrameColor(null);
    setPaintDoorColor(null);
    setPaintSidePanelColor(null);
    setHasWheels(true);
    setHasTop(true);
    setHasTotes(true);
    setActivePreset(null);
    setCompoundBuild(null);
  }

  function handleAddPresetUnit() {
    if (!compoundBuild || !activePresetObj) return;

    const subDesc = compoundBuild.subUnits.map((su) => `${su.cols}x${su.rows}`).join(" + ");
    // Replace any shelving items — bestsellers and shelving can't be mixed
    setOrderItems((prev) => [
      ...prev.filter((it) => !it.shelvingConfigId),
      {
        cols: compoundBuild.subUnits.reduce((s, u) => s + u.cols, 0),
        rows: Math.max(...compoundBuild.subUnits.map((u) => u.rows)),
        toteType: activePresetObj.toteModel as ToteType,
        toteColor: activePresetObj.toteColor as ToteColor,
        unitType: activePresetObj.unitType,
        orientation: activePresetObj.orientation,
        hasTotes: presetTotes,
        hasWheels: activePresetObj.units.some((u) => u.hasWheels),
        hasTop: activePresetObj.units.some((u) => u.hasTop),
        price: compoundBuild.totalPrice,
        totalW: compoundBuild.combinedW,
        totalH: compoundBuild.maxH,
        depth: compoundBuild.depth,
        desc: `${activePresetObj.name} (${subDesc})`,
        addons: [],
      },
    ]);
  }

  function handleRemoveUnit(index: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleWaitlist() {
    setWaitlistError("");
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!fullName || !email.trim()) {
      setWaitlistError("Name and email are required to join the waitlist.");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setWaitlistError("Please enter a valid email address.");
      return;
    }
    const zip = hasDifferentDelivery ? deliveryZip.trim() : addrZip.trim();
    if (!zip) {
      setWaitlistError("ZIP code is required.");
      return;
    }
    setWaitlistSending(true);
    try {
      const res = await submitWaitlistRequest({
        installer_id: installerId,
        customer_name: fullName,
        customer_email: email.trim(),
        customer_phone: phone.trim() || undefined,
        customer_zip: zip,
        quote_data: orderItems.length > 0 ? (() => {
          const items: unknown[] = [...orderItems];
          if (selectedCleanout && cleanoutPrice > 0) {
            const svc = data?.servicesConfig?.find((s) => s.id === selectedCleanout);
            items.push({ type: "cleanout_service", serviceId: selectedCleanout, name: svc?.name || selectedCleanout, price: cleanoutPrice });
          }
          return items;
        })() : undefined,
      });
      if (res.success) {
        setWaitlistSent(true);
      } else {
        setWaitlistError(res.error || "Something went wrong.");
      }
    } catch {
      setWaitlistError("Something went wrong. Please try again.");
    } finally {
      setWaitlistSending(false);
    }
  }

  async function handleBookDeposit() {
    setSubmitError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setSubmitError("First name, last name, email, and phone are required.");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (orderItems.length === 0) {
      setSubmitError("Add at least one unit to your quote first.");
      return;
    }
    if (zipOutOfArea) {
      setSubmitError(zipCheckMsg || "Installation ZIP is outside the service area.");
      return;
    }

    setSubmitting(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const compositeAddress = [streetAddress, city, addrState, addrZip].filter(Boolean).join(", ");
      const deliveryAddress = hasDifferentDelivery
        ? [deliveryStreet, deliveryCity, deliveryState, deliveryZip].filter(Boolean).join(", ")
        : undefined;
      const result = await submitNetworkLead({
        customer_name: fullName,
        customer_email: email,
        customer_phone: phone,
        address: compositeAddress,
        address_line1: streetAddress,
        address_city: city,
        address_state: addrState,
        address_zip: addrZip,
        delivery_address: deliveryAddress,
        quote_data: (() => {
          const items: QuoteItem[] = [...orderItems];
          if (selectedCleanout && cleanoutPrice > 0) {
            const svc = data?.servicesConfig?.find((s) => s.id === selectedCleanout);
            items.push({
              type: "cleanout_service",
              serviceId: selectedCleanout,
              name: svc?.name || selectedCleanout,
              price: cleanoutPrice,
            });
          }
          if (paintTotal > 0) {
            const paintParts: string[] = [];
            if (paintFrameColor) paintParts.push(`Frame: ${paintFrameColor}`);
            if (paintDoorColor) paintParts.push(`Doors: ${paintDoorColor}`);
            if (paintSidePanelColor) paintParts.push(`Panels: ${paintSidePanelColor}`);
            items.push({
              type: "paint",
              name: `Paint (${paintParts.join(", ")})`,
              price: paintTotal,
            });
          }
          return items;
        })(),
        grand_total: grandTotal,
        installer_id: installerId || undefined,
        referring_installer_id: referringInstallerId || undefined,
        source: leadSource,
      });

      if (!result.success || !result.id) {
        setSubmitError(result.error || "Submission failed.");
        setSubmitting(false);
        return;
      }

      setLeadId(result.id);

      // Open booking modal for inline deposit payment
      // (Payments route to platform if installer doesn't have Stripe connected)
      if (installerId) {
        setShowBookingModal(true);
      } else {
        // No installer — just show confirmation
        setSubmitted(true);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Contact installer handler ──────────────────────────────────────
  async function handleContactInstaller() {
    if (!contactMessage.trim()) {
      setContactError("Please enter a message.");
      return;
    }
    if (!email.trim()) {
      setContactError("Please enter your email so the installer can reply.");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setContactError("Please enter a valid email address.");
      return;
    }
    if (!installerId) {
      setContactError("No installer assigned yet.");
      return;
    }

    setContactSending(true);
    setContactError("");
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "Customer";
      const result = await contactInstaller({
        installerId,
        customerName: fullName,
        customerEmail: email.trim(),
        customerPhone: phone.trim() || undefined,
        message: contactMessage.trim(),
        quoteTotal: grandTotal > 0 ? grandTotal : undefined,
        quoteData: orderItems.length > 0 ? orderItems : undefined,
        zip: zip || undefined,
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

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — The client blindly renders the view model. No is_pro checks.
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* ── Analytics: track page view for installer ────────────────────── */}
      {installerId && <PageViewTracker installerId={installerId} page="/design" />}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b-4 border-yellow-400 bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3">
          <a
            href="/"
            className="shrink-0 transition-transform hover:scale-105"
            title="Back to Home"
          >
            {data?.branding.logoUrl ? (
              <Image
                src={data.branding.logoUrl}
                alt={data.branding.title}
                width={56}
                height={56}
                className="h-14 w-auto object-contain"
                unoptimized
              />
            ) : (
              <Image src="/Header_avatar_logo.png" alt="Storage Network" width={56} height={56} className="h-14 w-auto object-contain" />
            )}
          </a>
          <div className="flex-1">
            <h1 className="text-base font-extrabold uppercase tracking-widest text-white">
              {data?.branding.title || "Professional Grade Storage"}
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-yellow-400">
              {data?.branding.subtitle || "Build Configurator"}
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
      {installerLocked && data?.branding.isVerified && (
        <div className="shrink-0 bg-emerald-600 px-4 py-2 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <User className="h-3.5 w-3.5" />
            Designing with {data.branding.title}
          </span>
        </div>
      )}

      {/* ── Split Layout ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── LEFT SIDEBAR: Premium Configurator ──────────────────────── */}
        <ConfiguratorSidebar
          // Step 1: Dimensions
          wallWidth={wallWidth}
          wallHeight={wallHeight}
          onWallWidthChange={(v) => { setWallWidth(v); setWallFitMsg(""); }}
          onWallHeightChange={(v) => { setWallHeight(v); setWallFitMsg(""); }}
          onWallFit={handleWallFit}
          wallFitMsg={wallFitMsg}
          buildLoading={buildLoading}
          cols={cols}
          rows={rows}
          onColsChange={setCols}
          onRowsChange={setRows}

          // Step 2: Configuration
          unitType={unitType}
          orientation={orientation}
          onUnitTypeChange={setUnitType}
          onOrientationChange={setOrientation}
          toteType={toteType}
          toteColor={toteColor}
          onToteTypeChange={setToteType}
          onToteColorChange={setToteColor}
          hasTotes={hasTotes}
          hasWheels={hasWheels}
          hasTop={hasTop}
          onHasTotesChange={setHasTotes}
          onHasWheelsChange={setHasWheels}
          onHasTopChange={setHasTop}
          effectiveHasTop={effectiveHasTop}
          miniDisabled={!!data?.pricing?.mini_disabled}

          // Pricing
          pricing={data?.pricing}
          platformDefaults={PLATFORM_DEFAULTS}

          // Build
          build={build}
          onAddUnit={handleAddUnit}

          // Presets
          activePreset={activePreset}
          onPresetChange={(v) => { setActivePreset(v); setCompoundBuild(null); }}
          presetOptions={filteredPresets}
          compoundBuild={compoundBuild}
          presetLoading={presetLoading}
          presetTotes={presetTotes}
          onPresetTotesChange={setPresetTotes}
          onAddPresetUnit={handleAddPresetUnit}
          activePresetObj={activePresetObj}

          // Shelving
          shelvingConfigId={shelvingConfigId}
          onShelvingConfigChange={setShelvingConfigId}
          shelvingPrice={shelvingPrice}
          shelvingLoading={shelvingLoading}
          onAddShelvingUnit={handleAddShelvingUnit}
          shelvingHidden={!shelvingEnabled}

          // Overhead ceiling storage
          overheadStorageHidden={!overheadStorageEnabled}
          onAddOverheadUnit={handleAddOverheadUnit}
          onOverheadConfigPreview={setOverheadPreview}

          // Multi-unit 3D visualization
          showMultiUnit3D={showMultiUnit3D}
          onShowMultiUnit3DChange={setShowMultiUnit3D}
          unitVisibility={unitVisibility}
          onUnitVisibilityChange={(index, visible) => setUnitVisibility((prev) => ({ ...prev, [index]: visible }))}
          onToggleAllUnits={(visible) => {
            const newVis: Record<number, boolean> = {};
            orderItems.forEach((_, i) => { newVis[i] = visible; });
            setUnitVisibility(newVis);
          }}

          // Summary
          orderItems={orderItems}
          onRemoveUnit={handleRemoveUnit}
          grandTotal={grandTotal}
          deliveryFeeAmount={deliveryFeeAmount}
          deliveryFeeResult={deliveryFeeResult}
          depositAmount={depositAmount}
          depositLabelText={depositLabelText}
          stripeAccountId={stripeAccountId}

          // Booking form
          firstName={firstName}
          lastName={lastName}
          email={email}
          phone={phone}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}

          // Address
          streetAddress={streetAddress}
          city={city}
          addrState={addrState}
          addrZip={addrZip}
          onStreetAddressChange={setStreetAddress}
          onCityChange={setCity}
          onAddrStateChange={setAddrState}
          onAddrZipChange={setAddrZip}

          // Delivery address
          hasDifferentDelivery={hasDifferentDelivery}
          onHasDifferentDeliveryChange={setHasDifferentDelivery}
          deliveryStreet={deliveryStreet}
          deliveryCity={deliveryCity}
          deliveryState={deliveryState}
          deliveryZip={deliveryZip}
          onDeliveryStreetChange={setDeliveryStreet}
          onDeliveryCityChange={setDeliveryCity}
          onDeliveryStateChange={setDeliveryState}
          onDeliveryZipChange={setDeliveryZip}

          // Submit
          submitting={submitting}
          submitted={submitted}
          submitError={submitError}
          onBookDeposit={isDemo ? () => setDemoToast(true) : handleBookDeposit}
          isDemo={isDemo}
          onDemoToast={() => setDemoToast(true)}

          // ZIP check
          zip={zip}
          onZipChange={setZip}
          onZipCheck={handleZipCheck}
          zipChecking={zipChecking}
          zipResult={zipResult as { available: boolean; message?: string } | null}
          onZipResultClear={() => setZipResult(null)}
          installerLocked={installerLocked}

          // Waitlist
          zipOutOfArea={zipOutOfArea}
          zipCheckMsg={zipCheckMsg}
          handedOff={handedOff}
          handoffInstallerName={handoffInstallerName}
          waitlistSending={waitlistSending}
          waitlistSent={waitlistSent}
          waitlistError={waitlistError}
          onWaitlist={handleWaitlist}

          // Installer services (cleanout — adds to order)
          servicesConfig={data?.servicesConfig}
          selectedCleanout={selectedCleanout}
          onCleanoutChange={setSelectedCleanout}

          // Contact installer
          installerId={installerId}
          brandingTitle={data?.branding.title || ""}
          showContactForm={showContactForm}
          onShowContactFormChange={setShowContactForm}
          contactMessage={contactMessage}
          onContactMessageChange={setContactMessage}
          contactSending={contactSending}
          contactSent={contactSent}
          contactError={contactError}
          onContactInstaller={handleContactInstaller}

          // Scheduler (inline in sidebar)
          scheduledDate={scheduledDate}
          onScheduledDateChange={setScheduledDate}
          installerLeadTime={effectiveLeadTime}
          installerWorkingDays={data?.routing.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]}
          blackoutDates={blackoutDates}

          // Discount code (inline in sidebar)
          discountInput={discountInput}
          onDiscountInputChange={(v) => { setDiscountInput(v); setDiscountError(""); }}
          discountApplied={discountApplied}
          discountLoading={discountLoading}
          discountError={discountError}
          onApplyDiscount={handleApplyDiscount}
          onRemoveDiscount={handleRemoveDiscount}

          // Organizer Customization (per-section addons)
          addons={addons}
          onAddonsChange={setAddons}
          addonPricing={data?.pricing?.addon_pricing}

          // Paint options
          paintFrameColor={paintFrameColor}
          paintDoorColor={paintDoorColor}
          paintSidePanelColor={paintSidePanelColor}
          onPaintFrameColorChange={setPaintFrameColor}
          onPaintDoorColorChange={setPaintDoorColor}
          onPaintSidePanelColorChange={setPaintSidePanelColor}

          // UI Trigger bridge for 3D model animation
          onPulseVisualizerTrigger={() => {}}
        />

        {/* ── RIGHT: Visualizer (2D/3D Toggle) ────────────────────── */}
        <main className="flex flex-1 flex-col border-l border-stone-200 bg-white">
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: "300px" }}>
            <RackVisualizer
              cols={activePresetObj && compoundBuild ? compoundBuild.subUnits[0].cols : (build.cols || numCols || 1)}
              rows={activePresetObj && compoundBuild ? compoundBuild.subUnits[0].rows : (build.rows || numRows || 1)}
              toteType={activePresetObj ? activePresetObj.toteModel as ToteType : toteType}
              toteColor={activePresetObj ? activePresetObj.toteColor as ToteColor : effectiveToteColor}
              unitType={activePresetObj ? activePresetObj.unitType : unitType}
              orientation={activePresetObj ? activePresetObj.orientation : effectiveOrientation}
              hasTotes={activePresetObj ? presetTotes : hasTotes}
              hasWheels={activePresetObj ? activePresetObj.units.some((u) => u.hasWheels) : hasWheels}
              hasTop={activePresetObj ? activePresetObj.units.some((u) => u.hasTop) : effectiveHasTop}
              totalW={activePresetObj && compoundBuild ? compoundBuild.combinedW : build.totalW}
              totalH={activePresetObj && compoundBuild ? compoundBuild.maxH : build.totalH}
              presetUnits={presetVisUnits}
              addons={activePresetObj ? undefined : addons}
              paintFrameColor={activePresetObj ? null : paintFrameColor}
              paintDoorColor={activePresetObj ? null : paintDoorColor}
              paintSidePanelColor={activePresetObj ? null : paintSidePanelColor}
              shelvingConfig={activeShelvingConfig}
              overheadConfig={overheadPreview ?? undefined}
              multiUnitItems={multiUnitItems as import("@/components/visualizer/RackVisualizer").MultiUnitItem[] | undefined}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm font-medium text-stone-500">
            {overheadPreview ? (
              <>
                {overheadPreview.widthIn}&quot; W &times;{" "}
                {overheadPreview.depthIn}&quot; D &times;{" "}
                {overheadPreview.dropHeightIn}&quot; drop
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Overhead Storage
                </span>
              </>
            ) : activeShelvingConfig ? (
              <>
                {activeShelvingConfig.widthIn}&quot; W &times;{" "}
                {activeShelvingConfig.frameH}&quot; H &times;{" "}
                {activeShelvingConfig.depth}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {activeShelvingConfig.shelves} {activeShelvingConfig.shelves === 1 ? "shelf" : "shelves"} + top
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  Open Shelving
                </span>
              </>
            ) : activePresetObj && compoundBuild ? (
              <>
                {compoundBuild.combinedW.toFixed(1)}&quot; W &times;{" "}
                {compoundBuild.maxH.toFixed(1)}&quot; H &times;{" "}
                {compoundBuild.depth}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {compoundBuild.subUnits.map((su) => `${su.cols}×${su.rows}`).join(" + ")} ={" "}
                  {compoundBuild.totalSlots} slots
                </span>
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {compoundBuild.presetName}
                </span>
              </>
            ) : (
              <>
                {build.totalW > 0 ? build.totalW.toFixed(1) : "—"}&quot; W
                &times;{" "}
                {build.totalH > 0 ? build.totalH.toFixed(1) : "—"}&quot; H
                &times; {build.depth > 0 ? build.depth : (unitType === "mini" ? 12.75 : 30)}&quot; D &nbsp;&mdash;&nbsp;
                <span className="font-bold text-gray-900">
                  {build.cols || numCols || 1} &times; {build.rows || numRows || 1} ={" "}
                  {build.slots || (numCols || 1) * (numRows || 1)} slots
                </span>
                {unitType === "mini" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                    MINI
                  </span>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOOKING MODAL — Address → Schedule → Inline Stripe Payment
      ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Demo Toast ─────────────────────────────────────────────── */}
      {demoToast && (
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
              onClick={() => setDemoToast(false)}
              className="mt-4 w-full rounded-lg bg-yellow-400 py-2.5 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {leadId && installerId && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            // Customer closed the modal without paying — reset so they can
            // modify their order or try again. Do NOT mark as submitted.
            setShowBookingModal(false);
            setLeadId(null);
          }}
          leadId={leadId}
          depositAmount={depositAmount}
          totalPrice={grandTotal}
          installerId={installerId}
          source={leadSource}
          customerEmail={email || undefined}
          customerName={[firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || undefined}
          installerLeadTime={data?.routing.leadTime ?? 5}
          installerWorkingDays={data?.routing.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]}
          hasWheels={anyHasWheels}
          totalCols={maxCols}
          initialAddress={{
            line1: streetAddress || undefined,
            city: city || undefined,
            state: addrState || undefined,
            zip: addrZip || zip || undefined,
          }}
          initialScheduledDate={scheduledDate}
          initialDiscount={discountApplied}
          onSuccess={() => {
            setShowBookingModal(false);
            setSubmitted(true);
          }}
        />
      )}

    </div>
  );
}

