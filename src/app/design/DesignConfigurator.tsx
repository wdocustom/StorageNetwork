"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  checkAvailability,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapAvailabilityToViewModel } from "@/lib/mappers/installerMapper";
import { PLATFORM_DEFAULTS, type DesignPageViewModel } from "@/types/viewModels";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import { validateServiceArea, submitWaitlistRequest } from "@/app/actions/installer";
import { calculateBuild, type UnitType, type Orientation } from "@/app/actions/calculator";
import RackVisualizer from "@/components/visualizer/RackVisualizer";
import BookingModal from "@/components/booking/BookingModal";
import ScanWizard from "@/components/design/ScanWizard";
import PageViewTracker from "@/components/tracking/PageViewTracker";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Send,
  Plus,
  X,
  Maximize2,
  ArrowLeft,
  User,
  CreditCard,
  Scan,
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
interface DesignConfiguratorProps {
  initialData: DesignPageViewModel | null;
  initialZip: string;
  mode: string;
  isDemo?: boolean;
  leadSource?: "platform" | "partner_link";
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
      if (cookieId) setInstallerId(cookieId);
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

  // ── Server-provided build result ──────────────────────────────────────
  const [build, setBuild] = useState<ServerBuild>({
    cols: 4, rows: 4, price: 0, totalW: 0, totalH: 0, depth: 30, slots: 0, unitType: "standard", orientation: "standard",
  });
  const [buildLoading, setBuildLoading] = useState(false);

  // ── Multi-unit quote list ─────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);

  // ── Booking form ──────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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

  // ── Service area validation ─────────────────────────────────────────
  const [zipOutOfArea, setZipOutOfArea] = useState(false);
  const [zipCheckMsg, setZipCheckMsg] = useState("");
  const [waitlistSending, setWaitlistSending] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const zipCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time ZIP validation when user enters installation ZIP
  // If "installation address is different" is checked, validate that ZIP instead
  useEffect(() => {
    if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    setZipOutOfArea(false);
    setZipCheckMsg("");

    const zipToCheck = hasDifferentDelivery ? deliveryZip : addrZip;
    if (!installerId || !zipToCheck || zipToCheck.trim().length !== 5) return;

    zipCheckRef.current = setTimeout(async () => {
      const result = await validateServiceArea(installerId, zipToCheck.trim());
      if (!result.inArea) {
        setZipOutOfArea(true);
        setZipCheckMsg(
          result.radiusMiles
            ? `ZIP ${zipToCheck.trim()} is outside the installer's ${result.radiusMiles}-mile service area.`
            : "This ZIP code is outside the installer's service area."
        );
      }
    }, 600);

    return () => {
      if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    };
  }, [addrZip, deliveryZip, hasDifferentDelivery, installerId]);

  // ── Booking modal ─────────────────────────────────────────────────────
  const [showBookingModal, setShowBookingModal] = useState(false);

  // ── Scan Wizard modal ───────────────────────────────────────────────────
  const [showScanWizard, setShowScanWizard] = useState(false);

  const grandTotal = orderItems.reduce((sum, it) => sum + it.price, 0);
  const depositAmount = Math.round(grandTotal * 0.15 * 100) / 100;

  // Does any unit have wheels?
  const anyHasWheels = orderItems.some((it) => it.hasWheels);
  // Total cols of largest unit (for capacity weight)
  const maxCols = orderItems.reduce((max, it) => Math.max(max, it.cols), 0);

  // ── Convenience: routing shortcuts ──────────────────────────────────
  const stripeAccountId = data?.routing.stripeAccountId || null;

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
      top: boolean
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
      fetchBuild(numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop);
    }
  }, [numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, fetchBuild]);

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
  function handleScanWizardComplete(width: number, height: number | undefined, toteConfigKey: "HDX" | "GM") {
    // Set wall dimensions from AI measurement
    setWallWidth(width.toFixed(1));
    if (height) {
      setWallHeight(height.toFixed(1));
    }
    // Set tote type based on scanned tote
    setToteType(toteConfigKey);
    setWallFitMsg(`AI measured: ${width.toFixed(1)}" wide${height ? ` × ${height.toFixed(1)}" tall` : ""}`);
    // Trigger auto-fit if we have both dimensions
    if (height) {
      // Small delay to let state update, then trigger auto-fit
      setTimeout(() => handleWallFit(), 100);
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
    setOrderItems((prev) => [
      ...prev,
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
        quote_data: orderItems,
        grand_total: grandTotal,
        installer_id: installerId || undefined,
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
              <Image src="/logo-storage-network.png" alt="Storage Network" width={56} height={56} className="h-14 w-auto object-contain" />
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
        {/* ── LEFT SIDEBAR: Controls ──────────────────────────────────── */}
        <aside className="flex w-full shrink-0 flex-col lg:w-[38%] xl:w-[35%]">
          <div className="flex-1 space-y-4 overflow-y-auto bg-stone-100 p-4">
            {/* ── Find My Local Pro (hidden when installer locked) ──── */}
            {!installerLocked && (
              <section className="rounded-xl border-2 border-dashed border-yellow-400 bg-yellow-50 p-4">
                <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
                  <MapPin className="h-4 w-4 text-yellow-600" />
                  Find My Local Pro
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={zip}
                    onChange={(e) => {
                      setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                      setZipResult(null);
                    }}
                    placeholder="ZIP Code"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  <button
                    onClick={handleZipCheck}
                    disabled={zip.length < 5 || zipChecking}
                    className="shrink-0 rounded-lg bg-gray-950 px-4 py-2 text-xs font-bold uppercase text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
                  >
                    {zipChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Check"
                    )}
                  </button>
                </div>
                {zipResult?.available && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {zipResult.message}
                  </div>
                )}
                {zipResult && !zipResult.available && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {zipResult.message}
                  </div>
                )}
              </section>
            )}

            {/* ── Installer loading state ──────────────────────────── */}
            {installerLoading && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 p-4 text-xs font-semibold text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading installer profile…
              </div>
            )}

            {/* ── Auto-Fit Wall Calculator ──────────────────────────── */}
            <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-gray-800">
                <Maximize2 className="h-4 w-4 text-yellow-600" />
                Auto-Fit Wall Calculator
              </h2>

              {/* Scan Wall Button - Coming Soon */}
              <div className="relative mb-3">
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-100 py-3 text-sm font-bold uppercase tracking-wide text-stone-400"
                >
                  <Scan className="h-5 w-5" />
                  Scan Wall with AI
                </button>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-900 shadow-lg">
                    Coming Soon
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Wall Width (in)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={wallWidth}
                    onChange={(e) => {
                      setWallWidth(e.target.value);
                      setWallFitMsg("");
                    }}
                    placeholder="e.g. 100"
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Wall Height (in)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={wallHeight}
                    onChange={(e) => {
                      setWallHeight(e.target.value);
                      setWallFitMsg("");
                    }}
                    placeholder="e.g. 96"
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                </div>
              </div>
              <button
                onClick={handleWallFit}
                disabled={!wallWidth || !wallHeight || buildLoading}
                className="mt-3 w-full rounded-lg bg-gray-950 py-2.5 text-xs font-bold uppercase tracking-wide text-yellow-400 transition-colors hover:bg-gray-800 disabled:opacity-40"
              >
                {buildLoading ? "Calculating…" : "Find Max Size →"}
              </button>
              {wallFitMsg && (
                <p className="mt-2 text-center text-xs font-semibold text-emerald-600">
                  {wallFitMsg}
                </p>
              )}
            </section>

            {/* ── Manual Configuration ──────────────────────────────── */}
            <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
              <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-gray-700">
                Manual Configuration
              </h2>

              {/* Unit Size Selector — hidden when installer disabled mini */}
              {!data?.pricing?.mini_disabled && (
              <div className="mb-4">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                  Unit Size
                </label>
                <select
                  value={unitType}
                  onChange={(e) => {
                    setUnitType(e.target.value as UnitType);
                    // Reset orientation when switching unit types
                    if (e.target.value === "mini") {
                      setOrientation("standard");
                    }
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="standard">Standard (27 Gallon Totes)</option>
                  <option value="mini">Mini (6.5 Quart Totes)</option>
                </select>
                {unitType === "mini" && (
                  <p className="mt-1 text-[10px] italic text-amber-600">
                    Mini units use compact 6.5qt shoebox totes with 1&quot; plywood rails.
                  </p>
                )}
              </div>
              )}

              {/* Orientation Selector - Only for Standard units */}
              {unitType === "standard" && (
                <div className="mb-4">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Tote Orientation
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  >
                    <option value="standard">Standard (30&quot; Deep)</option>
                    <option value="sideways">Sideways (20&quot; Deep)</option>
                  </select>
                  {orientation === "sideways" && (
                    <p className="mt-1 text-[10px] italic text-amber-600">
                      Sideways orientation: Totes rotated 90° for shallower depth (20&quot;).
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Columns
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cols}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCols(v === "" ? "" : parseInt(v) || "");
                    }}
                    onBlur={() => {
                      const n = typeof cols === "number" ? cols : parseInt(cols as string);
                      setCols(Math.min(12, Math.max(1, n || 1)));
                    }}
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Tiers High
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={unitType === "mini" ? 4 : 10}
                    value={rows}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows(v === "" ? "" : parseInt(v) || "");
                    }}
                    onBlur={() => {
                      const n = typeof rows === "number" ? rows : parseInt(rows as string);
                      const maxTiers = unitType === "mini" ? 4 : 10;
                      setRows(Math.min(maxTiers, Math.max(1, n || 1)));
                    }}
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />
                  {unitType === "mini" && (
                    <p className="mt-1 text-[10px] italic text-amber-600">
                      Max 4 tiers to prevent tipping. Taller units require custom anchoring.
                    </p>
                  )}
                </div>
              </div>

              {/* Tote Model - Only show for Standard units */}
              {unitType === "standard" ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                      Tote Size
                    </label>
                    <select
                      value={toteType}
                      onChange={(e) => {
                        setToteType(e.target.value as ToteType);
                        // Reset color to black when switching tote types
                        if (e.target.value !== "HDX") setToteColor("black");
                      }}
                      className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    >
                      <option value="HDX">HDX 27 Gallon (19.75&quot; Wide)</option>
                      <option value="GM">Greenmade 27 Gallon (20.75&quot; Wide)</option>
                    </select>
                    <p className="mt-1 text-[10px] italic text-stone-400">
                      Select tote size based on what you have or plan to use.
                    </p>
                  </div>

                  {/* HDX Color Selection - Only show when HDX is selected and totes are included */}
                  {toteType === "HDX" && hasTotes && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase text-yellow-700">
                        HDX Tote Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setToteColor("black")}
                          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all ${
                            toteColor === "black"
                              ? "border-yellow-500 bg-white shadow-sm"
                              : "border-stone-200 bg-white/50 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 bg-gray-900">
                            <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-900">Black / Yellow</div>
                            <div className="text-[10px] text-stone-500">${data?.pricing?.standard_tote ?? PLATFORM_DEFAULTS.standard_tote}/tote</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setToteColor("clear")}
                          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all ${
                            toteColor === "clear"
                              ? "border-yellow-500 bg-white shadow-sm"
                              : "border-stone-200 bg-white/50 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 bg-gradient-to-b from-stone-100 to-stone-200">
                            <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-900">Clear / Yellow</div>
                            <div className="text-[10px] text-amber-600 font-medium">${data?.pricing?.standard_tote_clear ?? PLATFORM_DEFAULTS.standard_tote_clear}/tote (+${(data?.pricing?.standard_tote_clear ?? PLATFORM_DEFAULTS.standard_tote_clear) - (data?.pricing?.standard_tote ?? PLATFORM_DEFAULTS.standard_tote)})</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-stone-500">
                    Tote Type
                  </label>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-gray-700">
                    6.5 Quart Clear Totes (Yellow Lids)
                  </div>
                  <p className="mt-1 text-[10px] italic text-stone-400">
                    Mini units use standard 6.5qt shoebox totes (8&quot; × 12.75&quot; × 6.25&quot;).
                  </p>
                </div>
              )}

              {/* Toggles */}
              <div className="mt-4 space-y-2">
                <Toggle
                  checked={hasTotes}
                  onChange={setHasTotes}
                  label={unitType === "mini" ? "Include Clear Totes (Yellow Lids)" : "Totes"}
                />
                <Toggle
                  checked={hasWheels}
                  onChange={setHasWheels}
                  label={unitType === "mini" ? `Wheels (+$${data?.pricing?.mini_wheels ?? PLATFORM_DEFAULTS.mini_wheels})` : "Wheels"}
                />
                {unitType === "standard" ? (
                  <Toggle
                    checked={hasTop}
                    onChange={setHasTop}
                    label="Plywood Top"
                  />
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded border border-emerald-400 bg-emerald-400">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="flex-1 text-sm font-medium text-emerald-800">
                      Plywood Top (Included)
                    </span>
                  </div>
                )}
              </div>

              {/* Price + Add to Quote */}
              <div className="mt-5 flex items-center gap-3 border-t border-stone-200 pt-4">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-black text-gray-900">
                    {buildLoading ? "…" : `$${build.price.toLocaleString()}`}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    Current Unit
                  </div>
                </div>
                <button
                  onClick={handleAddUnit}
                  disabled={buildLoading || build.price === 0}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add to Quote
                </button>
              </div>
            </section>

            {/* ── Quote List ────────────────────────────────────────── */}
            {orderItems.length > 0 && (
              <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
                <h2 className="mb-3 border-b border-stone-200 pb-2 text-xs font-extrabold uppercase tracking-wider text-gray-700">
                  Your Quote List
                </h2>

                <ul className="space-y-2">
                  {orderItems.map((item, index) => {
                    const extras: string[] = [];
                    if (item.hasTotes) {
                      // Add tote color info for HDX standard units
                      if (item.toteType === "HDX" && item.unitType === "standard" && item.toteColor === "clear") {
                        extras.push("Clear Totes");
                      } else {
                        extras.push("Totes");
                      }
                    }
                    if (item.hasWheels) extras.push("Wheels");
                    if (item.hasTop) extras.push("Top");
                    const extraStr =
                      extras.length > 0 ? extras.join(", ") : "Frame Only";

                    return (
                      <li
                        key={index}
                        className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Unit #{index + 1}: {item.desc}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {extraStr}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-900">
                            ${item.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleRemoveUnit(index)}
                            className="text-red-400 transition-colors hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Grand Total */}
                <div className="mt-4 border-t-2 border-dashed border-stone-300 pt-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    Estimated Grand Total
                  </div>
                  <div className="mt-1 text-4xl font-black text-gray-900">
                    ${grandTotal.toLocaleString()}
                  </div>
                  {stripeAccountId && (
                    <div className="mt-1 text-xs text-stone-500">
                      Deposit (15%):{" "}
                      <span className="font-bold text-yellow-600">
                        ${depositAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Booking Form */}
                <div className="mt-4 border-t border-stone-200 pt-4">
                  {!submitted ? (
                    <div className="space-y-2">
                      {/* Name fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First Name *"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last Name *"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </div>
                      {/* Contact info */}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email *"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone *"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </div>
                      {/* Billing address */}
                      <div className="pt-1">
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-500">
                          Billing Address
                        </label>
                        <input
                          type="text"
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                          placeholder="Street Address"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <input
                          type="text"
                          value={addrState}
                          onChange={(e) => setAddrState(e.target.value)}
                          placeholder="State"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <input
                          type="text"
                          value={addrZip}
                          onChange={(e) => setAddrZip(e.target.value)}
                          placeholder="Zip"
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </div>
                      {/* Service area warning + waitlist */}
                      {zipOutOfArea && !waitlistSent && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                          <div className="mb-2 flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <p className="text-xs font-medium text-amber-700">{zipCheckMsg}</p>
                          </div>
                          <p className="mb-3 text-xs text-stone-500">
                            Want this installer to know you&apos;re interested? Join the waitlist and they&apos;ll be notified.
                          </p>
                          <button
                            onClick={handleWaitlist}
                            disabled={waitlistSending}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400 bg-amber-100 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-200 disabled:opacity-50"
                          >
                            {waitlistSending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                            {waitlistSending ? "Sending…" : "Join Waitlist"}
                          </button>
                          {waitlistError && (
                            <p className="mt-2 text-xs font-medium text-red-600">{waitlistError}</p>
                          )}
                        </div>
                      )}
                      {waitlistSent && (
                        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center">
                          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                          <p className="text-sm font-semibold text-gray-900">Waitlist Request Sent</p>
                          <p className="mt-1 text-xs text-stone-500">
                            The installer has been notified. They&apos;ll reach out if they can accommodate your area.
                          </p>
                        </div>
                      )}
                      {/* Installation address toggle */}
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 transition-colors hover:bg-stone-100">
                        <input
                          type="checkbox"
                          checked={hasDifferentDelivery}
                          onChange={(e) => setHasDifferentDelivery(e.target.checked)}
                          className="h-4 w-4 rounded border-stone-300 accent-yellow-400"
                        />
                        <span className="text-xs font-medium text-stone-600">
                          Installation address is different from billing
                        </span>
                      </label>
                      {/* Installation address fields (conditional) */}
                      {hasDifferentDelivery && (
                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <label className="block text-[10px] font-semibold uppercase text-amber-700">
                            Installation Address
                          </label>
                          <input
                            type="text"
                            value={deliveryStreet}
                            onChange={(e) => setDeliveryStreet(e.target.value)}
                            placeholder="Street Address"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={deliveryCity}
                              onChange={(e) => setDeliveryCity(e.target.value)}
                              placeholder="City"
                              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            />
                            <input
                              type="text"
                              value={deliveryState}
                              onChange={(e) => setDeliveryState(e.target.value)}
                              placeholder="State"
                              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            />
                            <input
                              type="text"
                              value={deliveryZip}
                              onChange={(e) => setDeliveryZip(e.target.value)}
                              placeholder="Zip"
                              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            />
                          </div>
                        </div>
                      )}
                      {!zipOutOfArea && (
                        <>
                          <button
                            onClick={isDemo ? () => setDemoToast(true) : handleBookDeposit}
                            disabled={submitting}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 ${
                              isDemo
                                ? "bg-stone-400 text-white shadow-stone-400/20 cursor-not-allowed"
                                : "bg-yellow-400 text-gray-950 shadow-yellow-400/30 hover:bg-yellow-300 hover:-translate-y-0.5"
                            }`}
                          >
                            {submitting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : stripeAccountId ? (
                              <CreditCard className="h-4 w-4" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            {isDemo
                              ? "Demo Mode — No Payment"
                              : submitting
                              ? "Submitting…"
                              : stripeAccountId
                              ? "Pay Deposit & Book"
                              : "Submit Quote Request"}
                          </button>
                          <p className="text-[11px] text-stone-500 text-center">
                            By placing this order, you agree to our{" "}
                            <a href="/terms" className="underline hover:text-yellow-600">
                              Terms of Service
                            </a>.
                          </p>
                        </>
                      )}
                      {submitError && (
                        <p className="text-xs font-medium text-red-600">
                          {submitError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                      <p className="font-bold text-gray-900">
                        Booking Received!
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        We&apos;ll reach out within 24 hours.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* ── RIGHT: Visualizer (2D/3D Toggle) ────────────────────── */}
        <main className="flex flex-1 flex-col border-l border-stone-200 bg-white">
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: "300px" }}>
            <RackVisualizer
              cols={build.cols || numCols || 1}
              rows={build.rows || numRows || 1}
              toteType={toteType}
              toteColor={effectiveToteColor}
              unitType={unitType}
              orientation={effectiveOrientation}
              hasTotes={hasTotes}
              hasWheels={hasWheels}
              hasTop={effectiveHasTop}
              totalW={build.totalW}
              totalH={build.totalH}
            />
          </div>
          {/* Dimensions bar */}
          <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm font-medium text-stone-500">
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
            setShowBookingModal(false);
            setSubmitted(true);
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
          onSuccess={() => {
            setShowBookingModal(false);
            setSubmitted(true);
          }}
        />
      )}

      {/* ── Scan-to-Build Wizard ───────────────────────────────────────── */}
      <ScanWizard
        isOpen={showScanWizard}
        onClose={() => setShowScanWizard(false)}
        onComplete={handleScanWizardComplete}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Toggle component (no pricing details exposed)
// ═══════════════════════════════════════════════════════════════════════════
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 transition-colors hover:bg-stone-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-stone-300 accent-yellow-400 focus:ring-yellow-400"
      />
      <span className="flex-1 text-sm font-medium text-gray-800">
        {label}
      </span>
    </label>
  );
}
