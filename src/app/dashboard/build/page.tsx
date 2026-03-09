"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculateBuild, calculateCompoundBuild, calculateShelvingUnit, type CompoundBuildResult } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { createQuote, checkDeliveryZip, type DeliveryAddress, type ReferralStatus } from "@/app/actions/createQuote";
import { calculateDeliveryFee, type DeliveryFeeResult } from "@/app/actions/delivery-fee";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine.types";
import { DEFAULT_MATERIAL_PRICES, type MaterialBreakdown, type MaterialPrices } from "@/utils/calculateMaterials";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { toFraction } from "@/lib/utils";
import {
  ArrowLeft,
  HardHat,
  Loader2,
  Maximize2,
  ShoppingCart,
  FileText,
  X,
  Send,
  CheckCircle2,
  Box,
  Calculator,
  TrendingUp,
  Grid3X3,
  Plus,
  Trash2,
  Tag,
  Settings,
  DollarSign,
  ChevronDown,
  Link2,
  Copy,
  Check,
  Star,
  AlertTriangle,
  MapPin,
  Clock,
} from "lucide-react";

import BookingModal from "@/components/booking/BookingModal";
import type { BookingAddress } from "@/components/booking/BookingModal";
import { calculateWeight } from "@/utils/scheduling";
import type { InstallerPricing } from "@/types/viewModels";
import LockedBlueprintsTeaser from "@/components/dashboard/LockedBlueprintsTeaser";
import ProPill from "@/components/dashboard/ProPill";
import { getBuildFeeBreakdown, type BuildFeeBreakdown } from "@/app/actions/fee-engine";

const AssemblyGuide = lazy(() => import("@/components/visualizer/AssemblyGuide"));

// ═══════════════════════════════════════════════════════════════════════════
// Build Configurator — Estimate, Quote & New Build
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type InputMode = "wallFit" | "custom";

// Unit configuration for multi-unit quotes
interface UnitConfig {
  id: string;
  cols: number;
  rows: number;
  toteType: ToteType;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price?: number;
  totalW?: number;
  totalH?: number;
  depth?: number;
  slots?: number;
  /** When set, this unit came from a bestseller preset */
  presetName?: string;
  /** Human-readable description override */
  desc?: string;
  /** Groups multiple sub-units from the same preset together for display */
  presetGroup?: string;
  /** When set, this unit is an open shelving unit (not a tote organizer) */
  shelvingConfigId?: string;
}

export default function BuildConfiguratorPage() {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [installerFirstName, setInstallerFirstName] = useState("");
  const [installerPhone, setInstallerPhone] = useState("");

  // Input mode toggle
  const [inputMode, setInputMode] = useState<InputMode>("wallFit");

  // Wall fit inputs
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");

  // Custom grid inputs
  const [customCols, setCustomCols] = useState("3");
  const [customRows, setCustomRows] = useState("4");

  // Common inputs
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(false);

  // Multiple units for quotes
  const [units, setUnits] = useState<UnitConfig[]>([]);

  // Results
  const [buildResult, setBuildResult] = useState<{
    cols: number;
    rows: number;
    price: number;
    totalW: number;
    totalH: number;
    depth: number;
    slots: number;
    unitType: "standard" | "mini";
    orientation: "standard" | "sideways";
  } | null>(null);
  const [manifest, setManifest] = useState<BuildManifest | null>(null);
  const [materialBreakdown, setMaterialBreakdown] = useState<MaterialBreakdown | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  // Assembly guide overlay
  const [showAssemblyGuide, setShowAssemblyGuide] = useState(false);

  // Quote modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quoteDiscountCode, setQuoteDiscountCode] = useState("");
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLeadId, setQuoteLeadId] = useState<string | null>(null);
  const [quoteLinkCopied, setQuoteLinkCopied] = useState(false);

  // Delivery address state
  const [deliveryLine1, setDeliveryLine1] = useState("");
  const [deliveryLine2, setDeliveryLine2] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [showDeliveryAddress, setShowDeliveryAddress] = useState(false);

  // Referral / handoff state (real-time ZIP check)
  const [zipCheckStatus, setZipCheckStatus] = useState<"idle" | "checking" | "in_area" | "referral" | "waitlist">("idle");
  const [zipCoveringName, setZipCoveringName] = useState("");
  const [quoteReferralStatus, setQuoteReferralStatus] = useState<ReferralStatus>("none");
  const [quoteCoveringName, setQuoteCoveringName] = useState("");
  const zipCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delivery fee state (calculated when ZIP is entered)
  const [deliveryFeeResult, setDeliveryFeeResult] = useState<DeliveryFeeResult | null>(null);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [installerStripeId, setInstallerStripeId] = useState<string | null>(null);
  const [leadIdForBooking, setLeadIdForBooking] = useState<string | null>(null);

  // Installer pricing from profile
  const [installerPricing, setInstallerPricing] = useState<InstallerPricing | undefined>();

  // Bestseller preset state
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetHasTotes, setPresetHasTotes] = useState(true);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetResult, setPresetResult] = useState<CompoundBuildResult | null>(null);
  const [presetAdded, setPresetAdded] = useState(false);
  const quoteBuilderRef = useRef<HTMLElement>(null);

  // Open Shelving state
  const [selectedShelving, setSelectedShelving] = useState<string>("");
  const [shelvingPrice, setShelvingPrice] = useState<number | null>(null);
  const [shelvingLoading, setShelvingLoading] = useState(false);
  const [shelvingAdded, setShelvingAdded] = useState(false);

  // Custom material pricing (stored in localStorage)
  const [materialPrices, setMaterialPrices] = useState<MaterialPrices>({});
  const [showMaterialPricing, setShowMaterialPricing] = useState(false);

  // Check if user is PRO
  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("is_pro, subscription_tier, business_name, first_name, phone, stripe_account_id, pricing_config")
      .eq("id", user.id)
      .single();

    if (data) {
      setBusinessName(data.business_name || data.first_name || "Your Business");
      if (data.first_name) setInstallerFirstName(data.first_name);
      if (data.phone) setInstallerPhone(data.phone);
      if (data.stripe_account_id) setInstallerStripeId(data.stripe_account_id);
      if (data.pricing_config) {
        setInstallerPricing(data.pricing_config as InstallerPricing);
      }
      // Load custom material prices from localStorage
      try {
        const saved = localStorage.getItem(`sn_material_prices_${user.id}`);
        if (saved) setMaterialPrices(JSON.parse(saved));
      } catch { /* ignore parse errors */ }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Bestseller preset calculation ──────────────────────────────────────
  const fetchPresetBuild = useCallback(async (presetId: string, withTotes: boolean) => {
    if (!presetId) { setPresetResult(null); return; }
    setPresetLoading(true);
    try {
      const res = await calculateCompoundBuild({
        presetId,
        hasTotes: withTotes,
        installerPricing,
      });
      if (res.success) setPresetResult(res);
      else setPresetResult(null);
    } catch {
      setPresetResult(null);
    } finally {
      setPresetLoading(false);
    }
  }, [installerPricing]);

  // Re-fetch when preset or totes toggle changes
  useEffect(() => {
    if (selectedPreset) fetchPresetBuild(selectedPreset, presetHasTotes);
    else setPresetResult(null);
  }, [selectedPreset, presetHasTotes, fetchPresetBuild]);

  // Real-time delivery ZIP check — debounced, fires when ZIP field changes.
  // Shows referral/waitlist status inline so the installer has immediate feedback.
  // Also calculates delivery fee based on distance tiers.
  useEffect(() => {
    if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    setZipCheckStatus("idle");
    setZipCoveringName("");
    setDeliveryFeeResult(null);

    const zip = deliveryZip.trim();
    if (!userId || !zip || zip.length !== 5 || !/^\d{5}$/.test(zip)) return;

    setZipCheckStatus("checking");
    zipCheckRef.current = setTimeout(async () => {
      try {
        const [areaResult, feeResult] = await Promise.all([
          checkDeliveryZip(userId, zip),
          calculateDeliveryFee(userId, zip),
        ]);

        // Set delivery fee result (even if $0 — shows distance info)
        if (feeResult.applicable) {
          setDeliveryFeeResult(feeResult);
        }

        if (areaResult.in_area) {
          setZipCheckStatus("in_area");
        } else if (areaResult.waitlist) {
          setZipCheckStatus("waitlist");
        } else {
          setZipCheckStatus("referral");
          setZipCoveringName(areaResult.covering_installer_name || "a local installer");
        }
      } catch {
        setZipCheckStatus("idle");
      }
    }, 600);

    return () => {
      if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    };
  }, [deliveryZip, userId]);

  // Add a bestseller preset to the quote builder — expands compound presets
  // into individual sub-units so cut plans generate correctly for each frame.
  function handleAddPreset() {
    if (!presetResult) return;
    const preset = BESTSELLER_PRESETS.find((p) => p.id === presetResult.presetId);
    if (!preset) return;

    const groupId = `preset-${Date.now()}`;
    const totalSlots = presetResult.subUnits.reduce((s, u) => s + u.slots, 0);

    // Distribute total price across sub-units proportionally by slot count
    // so each QuoteUnit carries its fair share (cut plans use per-unit data).
    let priceRemaining = presetResult.totalPrice;
    const newUnits: UnitConfig[] = presetResult.subUnits.map((su, i) => {
      const isLast = i === presetResult.subUnits.length - 1;
      const proportion = su.slots / totalSlots;
      const unitPrice = isLast
        ? priceRemaining  // last unit gets remainder to avoid rounding drift
        : Math.round(presetResult.totalPrice * proportion);
      if (!isLast) priceRemaining -= unitPrice;

      return {
        id: `unit-${Date.now()}-${i}`,
        cols: su.cols,
        rows: su.rows,
        toteType: preset.toteModel as ToteType,
        hasTotes: presetHasTotes,
        hasWheels: preset.units[i].hasWheels,
        hasTop: preset.units[i].hasTop,
        price: unitPrice,
        totalW: su.totalW,
        totalH: su.totalH,
        depth: su.depth,
        slots: su.slots,
        presetName: preset.name,
        presetGroup: groupId,
        desc: `${preset.name} — ${su.cols}×${su.rows}`,
      };
    });

    setUnits((prev) => [...prev, ...newUnits]);

    // Visual feedback + scroll to quote builder
    setPresetAdded(true);
    setTimeout(() => setPresetAdded(false), 2000);
    setTimeout(() => {
      quoteBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  // ── Open Shelving calculation ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedShelving) { setShelvingPrice(null); return; }
    setShelvingLoading(true);
    calculateShelvingUnit({ configId: selectedShelving, installerPricing })
      .then((res) => { if (res.success) setShelvingPrice(res.price); else setShelvingPrice(null); })
      .finally(() => setShelvingLoading(false));
  }, [selectedShelving, installerPricing]);

  function handleAddShelving() {
    if (!selectedShelving || shelvingPrice == null) return;
    const cfg = SHELVING_CONFIGS.find((c) => c.id === selectedShelving);
    if (!cfg) return;
    const heightLabel = cfg.height === "tall" ? "Tall" : "Short";
    const newUnit: UnitConfig = {
      id: `shelving-${Date.now()}`,
      cols: 0,
      rows: 0,
      toteType: "HDX",
      hasTotes: false,
      hasWheels: false,
      hasTop: true,
      price: shelvingPrice,
      totalW: cfg.widthIn,
      totalH: cfg.frameH,
      depth: cfg.depth,
      slots: 0,
      desc: `Open Shelving: ${cfg.widthFt}' × ${heightLabel} (${cfg.shelves} ${cfg.shelves === 1 ? "shelf" : "shelves"})`,
      shelvingConfigId: cfg.id,
    };
    setUnits((prev) => [...prev, newUnit]);
    setShelvingAdded(true);
    setTimeout(() => setShelvingAdded(false), 2000);
    setTimeout(() => {
      quoteBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleCalculate() {
    // Validate inputs based on mode
    if (inputMode === "wallFit") {
      const wW = parseFloat(wallWidth);
      const wH = parseFloat(wallHeight);
      if (!wW || !wH) {
        setCalcError("Enter valid wall dimensions.");
        return;
      }
    } else {
      const cols = parseInt(customCols);
      const rows = parseInt(customRows);
      if (!cols || cols < 1 || !rows || rows < 1) {
        setCalcError("Enter valid columns and rows.");
        return;
      }
    }

    setCalcError("");
    setCalculating(true);
    setBuildResult(null);
    setManifest(null);
    setMaterialBreakdown(null);

    try {
      const res = await calculateBuild({
        wallWidth: inputMode === "wallFit" ? parseFloat(wallWidth) : undefined,
        wallHeight: inputMode === "wallFit" ? parseFloat(wallHeight) : undefined,
        cols: inputMode === "custom" ? parseInt(customCols) : undefined,
        rows: inputMode === "custom" ? parseInt(customRows) : undefined,
        toteModel: toteType,
        addOns: { totes: hasTotes, wheels: hasWheels, top: hasTop },
        mode: inputMode === "wallFit" ? "wallFit" : "manual",
        installerPricing,
      });

      if (!res.success) {
        setCalcError("error" in res ? res.error : "Calculation failed.");
        return;
      }

      const result = {
        cols: res.cols,
        rows: res.rows,
        price: res.price,
        totalW: res.dimensions.totalW,
        totalH: res.dimensions.totalH,
        depth: res.dimensions.depth,
        slots: res.config.slots,
        unitType: res.config.unitType,
        orientation: res.config.orientation,
      };
      setBuildResult(result);

      // Generate manifest for cut plans
      const unit: QuoteUnit = {
        cols: res.cols,
        rows: res.rows,
        toteType,
        unitType: res.config.unitType,
        orientation: res.config.orientation,
        hasTotes,
        hasWheels,
        hasTop,
        price: res.price,
        totalW: res.dimensions.totalW,
        totalH: res.dimensions.totalH,
        depth: res.dimensions.depth,
        desc: `${res.cols} Wide × ${res.rows} High`,
      };
      generateBuildManifestServer([unit]).then(setManifest).catch(() => {});

      // Calculate material cost for profit breakdown (server action)
      calculateMaterialCostServer({
        cols: res.cols,
        rows: res.rows,
        toteType,
        hasTotes,
        hasWheels,
        hasTop,
      }, materialPrices).then(setMaterialBreakdown).catch(() => {});
    } catch {
      setCalcError("Calculation failed. Please try again.");
    } finally {
      setCalculating(false);
    }
  }

  // Add current build to units list
  function handleAddUnit() {
    if (!buildResult) return;

    const newUnit: UnitConfig = {
      id: `unit-${Date.now()}`,
      cols: buildResult.cols,
      rows: buildResult.rows,
      toteType,
      hasTotes,
      hasWheels,
      hasTop,
      price: buildResult.price,
      totalW: buildResult.totalW,
      totalH: buildResult.totalH,
      depth: buildResult.depth,
      slots: buildResult.slots,
    };

    setUnits((prev) => [...prev, newUnit]);
  }

  // Remove unit from list — if it's part of a preset group, remove all sub-units
  function handleRemoveUnit(unitId: string) {
    setUnits((prev) => {
      const target = prev.find((u) => u.id === unitId);
      if (target?.presetGroup) {
        return prev.filter((u) => u.presetGroup !== target.presetGroup);
      }
      return prev.filter((u) => u.id !== unitId);
    });
  }

  // Calculate grand total from all units in Quote Builder only
  const grandTotal = units.reduce((sum, u) => sum + (u.price || 0), 0);

  // Calculate aggregate material breakdown and manifest for all units in Quote Builder
  const [aggregateMaterials, setAggregateMaterials] = useState<MaterialBreakdown | null>(null);
  useEffect(() => {
    if (units.length === 0) { setAggregateMaterials(null); return; }
    const configs = units.map((u) => ({
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      hasTotes: u.hasTotes,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
    }));
    calculateMaterialCostServer(configs, materialPrices).then(setAggregateMaterials).catch(() => {});
  }, [units, materialPrices]);

  const [aggregateManifest, setAggregateManifest] = useState<BuildManifest | null>(null);
  useEffect(() => {
    if (units.length === 0) { setAggregateManifest(null); return; }
    const quoteUnits: QuoteUnit[] = units.map((u) => ({
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      unitType: "standard" as const,
      orientation: "standard" as const,
      hasTotes: u.hasTotes,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
      price: u.price || 0,
      totalW: u.totalW || 0,
      totalH: u.totalH || 0,
      depth: u.depth || 30,
      desc: u.desc || `${u.cols} Wide × ${u.rows} High`,
    }));
    generateBuildManifestServer(quoteUnits).then(setAggregateManifest).catch(() => {});
  }, [units]);

  // Use aggregate values when units exist, otherwise use single build values
  const displayPrice = units.length > 0 ? units.reduce((sum, u) => sum + (u.price || 0), 0) : buildResult?.price || 0;
  const displayMaterials = units.length > 0 ? aggregateMaterials : materialBreakdown;
  const displayManifest = units.length > 0 ? aggregateManifest : manifest;

  // Fee breakdown — computed server-side using installer's custom deposit config
  const [feeBreakdown, setFeeBreakdown] = useState<BuildFeeBreakdown | null>(null);
  useEffect(() => {
    if (displayPrice > 0 && displayMaterials) {
      getBuildFeeBreakdown(displayPrice, displayMaterials.totalCost, userId || undefined).then(setFeeBreakdown);
    }
  }, [displayPrice, displayMaterials, userId]);

  /** Build the quote units array from current state. */
  function buildQuoteUnits(): QuoteUnit[] | null {
    const quoteUnits: QuoteUnit[] = units.map((u) => ({
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      unitType: "standard" as const,
      orientation: "standard" as const,
      hasTotes: u.hasTotes,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
      price: u.price || 0,
      totalW: u.totalW || 0,
      totalH: u.totalH || 0,
      depth: u.depth || 30,
      desc: u.desc || `${u.cols} Wide × ${u.rows} High`,
    }));

    if (buildResult && units.length === 0) {
      quoteUnits.push({
        cols: buildResult.cols,
        rows: buildResult.rows,
        toteType,
        unitType: buildResult.unitType,
        orientation: buildResult.orientation,
        hasTotes,
        hasWheels,
        hasTop,
        price: buildResult.price,
        totalW: buildResult.totalW,
        totalH: buildResult.totalH,
        depth: buildResult.depth,
        desc: `${buildResult.cols} Wide × ${buildResult.rows} High`,
      });
    }

    return quoteUnits.length > 0 ? quoteUnits : null;
  }

  async function handleSendQuote() {
    if (!customerName.trim()) {
      setQuoteError("Customer name is required.");
      return;
    }
    const zip = deliveryZip.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      setQuoteError("Customer ZIP code is required to check installer coverage.");
      return;
    }
    if (zipCheckStatus === "checking") {
      setQuoteError("Still checking service area — please wait a moment.");
      return;
    }
    if (zipCheckStatus === "waitlist" && !customerEmail.trim()) {
      setQuoteError("Email is required to add this customer to the waitlist.");
      return;
    }
    const quoteUnits = buildQuoteUnits();
    if (!quoteUnits || !userId) {
      setQuoteError("No build calculated or not logged in.");
      return;
    }

    setQuoteError("");
    setQuoteSending(true);

    try {
      const buildTotal = quoteUnits.reduce((sum, u) => sum + u.price, 0);
      const deliveryFee = deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0;
      const totalPrice = buildTotal + deliveryFee;

      // Build delivery address object if fields are filled
      let delivery_address: DeliveryAddress | undefined;
      if (deliveryLine1.trim()) {
        delivery_address = {
          line1: deliveryLine1.trim(),
          line2: deliveryLine2.trim() || undefined,
          city: deliveryCity.trim(),
          state: deliveryState.trim(),
          zip: deliveryZip.trim(),
        };
      }

      const result = await createQuote({
        installer_id: userId,
        installer_business_name: businessName,
        installer_first_name: installerFirstName || undefined,
        installer_phone: installerPhone || undefined,
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        customer_zip: deliveryZip.trim(),
        quote_data: quoteUnits,
        grand_total: totalPrice,
        discount_code: quoteDiscountCode.trim() || undefined,
        delivery_address,
        delivery_fee: deliveryFee,
      });

      if (!result.success) {
        setQuoteError(result.error || "Failed to send quote.");
        return;
      }

      // Track referral/handoff status for success screen messaging
      setQuoteReferralStatus(result.referral_status || "none");
      setQuoteCoveringName(result.covering_installer_name || "");
      setQuoteSent(true);
      if (result.lead_id) setQuoteLeadId(result.lead_id);
      setUnits([]);
    } catch (err) {
      console.error("[SendQuote] Quote creation failed:", err);
      setQuoteError("Failed to send quote. Please try again.");
    } finally {
      setQuoteSending(false);
    }
  }

  async function handleGetLink() {
    if (!customerName.trim()) {
      setQuoteError("Customer name is required.");
      return;
    }
    const zip = deliveryZip.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      setQuoteError("Customer ZIP code is required to check installer coverage.");
      return;
    }
    if (zipCheckStatus === "checking") {
      setQuoteError("Still checking service area — please wait a moment.");
      return;
    }
    const quoteUnits = buildQuoteUnits();
    if (!quoteUnits || !userId) {
      setQuoteError("No build calculated or not logged in.");
      return;
    }

    setQuoteError("");
    setQuoteSending(true);

    try {
      const buildTotal = quoteUnits.reduce((sum, u) => sum + u.price, 0);
      const deliveryFee = deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0;
      const totalPrice = buildTotal + deliveryFee;

      // Build delivery address object if fields are filled
      let delivery_address: DeliveryAddress | undefined;
      if (deliveryLine1.trim()) {
        delivery_address = {
          line1: deliveryLine1.trim(),
          line2: deliveryLine2.trim() || undefined,
          city: deliveryCity.trim(),
          state: deliveryState.trim(),
          zip: deliveryZip.trim(),
        };
      }

      const result = await createQuote({
        installer_id: userId,
        installer_business_name: businessName,
        installer_first_name: installerFirstName || undefined,
        installer_phone: installerPhone || undefined,
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        customer_zip: deliveryZip.trim(),
        quote_data: quoteUnits,
        grand_total: totalPrice,
        discount_code: quoteDiscountCode.trim() || undefined,
        delivery_address,
        delivery_fee: deliveryFee,
      });

      if (!result.success) {
        setQuoteError(result.error || "Failed to create quote.");
        return;
      }

      if (result.lead_id) {
        setQuoteLeadId(result.lead_id);
        // Copy link to clipboard (isolated try/catch so clipboard errors
        // don't mask a successful quote creation)
        try {
          const url = `${window.location.origin}/pay/${result.lead_id}`;
          await navigator.clipboard.writeText(url);
          setQuoteLinkCopied(true);
          setTimeout(() => setQuoteLinkCopied(false), 3000);
        } catch {
          // Clipboard failed but quote was created — user can still copy manually
        }
      }
      setQuoteReferralStatus(result.referral_status || "none");
      setQuoteCoveringName(result.covering_installer_name || "");
      setQuoteSent(true);
      setUnits([]);
    } catch (err) {
      console.error("[GetLink] Quote creation failed:", err);
      setQuoteError("Failed to create quote. Please try again.");
    } finally {
      setQuoteSending(false);
    }
  }

  function resetQuoteModal() {
    setShowQuoteModal(false);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setQuoteDiscountCode("");
    setQuoteSent(false);
    setQuoteError("");
    setQuoteLeadId(null);
    setQuoteLinkCopied(false);
    setQuoteReferralStatus("none");
    setQuoteCoveringName("");
    setZipCheckStatus("idle");
    setZipCoveringName("");
    setDeliveryFeeResult(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-yellow-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Build Configurator
            </h1>
            <p className="text-[10px] text-stone-500">
              Estimate, Quote & New Build
            </p>
          </div>
          <ProPill />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* ── Bestseller Presets ─────────────────────────────────────── */}
        <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Star className="h-4 w-4 text-yellow-400" />
            Bestsellers
          </h2>

          <select
            value={selectedPreset}
            onChange={(e) => {
              setSelectedPreset(e.target.value);
              setPresetHasTotes(true);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            <option value="">Choose a bestseller…</option>
            {BESTSELLER_PRESETS.filter((p) => {
              const key = `bestseller_${p.id.replace(/-/g, "_")}_disabled` as keyof InstallerPricing;
              return installerPricing?.[key] !== true;
            }).map((p) => {
              const subDesc = p.units.map((u) => `${u.cols}×${u.rows}`).join(" + ");
              return (
                <option key={p.id} value={p.id}>
                  {p.name} — {subDesc} ({p.units.reduce((s, u) => s + u.cols * u.rows, 0)} slots)
                </option>
              );
            })}
          </select>

          {selectedPreset && (
            <div className="mt-3 space-y-3">
              {/* Totes toggle */}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={presetHasTotes}
                  onChange={(e) => setPresetHasTotes(e.target.checked)}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">Include Totes</span>
              </label>

              {/* Result */}
              {presetLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating…
                </div>
              )}

              {presetResult && !presetLoading && (
                <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-slate-800 p-2">
                      <p className="text-lg font-black text-white">{presetResult.totalSlots} slots</p>
                      <p className="text-[10px] font-bold uppercase text-stone-500">
                        {presetResult.subUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ")}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-800 p-2">
                      <p className="text-lg font-black text-yellow-400">
                        ${presetResult.totalPrice.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-stone-500">
                        {presetResult.presetName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAddPreset}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                      presetAdded
                        ? "bg-emerald-500 text-white"
                        : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                    }`}
                  >
                    {presetAdded ? (
                      <>
                        <Check className="h-4 w-4" />
                        Added to Quote
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add to Quote
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Open Shelving ──────────────────────────────────────────── */}
        {installerPricing?.open_shelving_disabled !== true && <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Grid3X3 className="h-4 w-4 text-yellow-400" />
            Open Shelving
          </h2>

          <select
            value={selectedShelving}
            onChange={(e) => {
              setSelectedShelving(e.target.value);
              setShelvingAdded(false);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400 focus:outline-none"
          >
            <option value="">Choose a shelving unit…</option>
            {SHELVING_CONFIGS.map((cfg) => {
              const heightLabel = cfg.height === "tall" ? `Tall (${cfg.frameH}"H)` : `Short (${cfg.frameH}"H)`;
              const shelfText = cfg.shelves === 1 ? "1 shelf + top" : `${cfg.shelves} shelves + top`;
              return (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.widthFt}&apos; Wide × {heightLabel} — {shelfText}
                </option>
              );
            })}
          </select>

          {selectedShelving && (
            <div className="mt-3 space-y-3">
              {shelvingLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating…
                </div>
              )}

              {shelvingPrice != null && !shelvingLoading && (
                <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-slate-800 p-2">
                      <p className="text-lg font-black text-white">
                        {SHELVING_CONFIGS.find((c) => c.id === selectedShelving)?.widthFt}&apos; × {SHELVING_CONFIGS.find((c) => c.id === selectedShelving)?.height === "tall" ? "Tall" : "Short"}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-stone-500">
                        {SHELVING_CONFIGS.find((c) => c.id === selectedShelving)?.widthIn}&quot; × {SHELVING_CONFIGS.find((c) => c.id === selectedShelving)?.frameH}&quot; × 30&quot;
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-800 p-2">
                      <p className="text-lg font-black text-yellow-400">
                        ${shelvingPrice.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-stone-500">
                        Open Shelving
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAddShelving}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                      shelvingAdded
                        ? "bg-emerald-500 text-white"
                        : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                    }`}
                  >
                    {shelvingAdded ? (
                      <>
                        <Check className="h-4 w-4" />
                        Added to Quote
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add to Quote
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>}

        {/* ── Input Card ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          {/* Mode Toggle */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setInputMode("wallFit")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
                inputMode === "wallFit"
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                  : "border-slate-700 text-stone-400 hover:border-stone-600"
              }`}
            >
              <Maximize2 className="h-4 w-4" />
              Wall Fit
            </button>
            <button
              onClick={() => setInputMode("custom")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase transition-colors ${
                inputMode === "custom"
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                  : "border-slate-700 text-stone-400 hover:border-stone-600"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              Custom Grid
            </button>
          </div>

          {/* Wall Fit Mode */}
          {inputMode === "wallFit" && (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Maximize2 className="h-4 w-4 text-yellow-400" />
                Wall Dimensions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Width (in)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={wallWidth}
                    onChange={(e) => setWallWidth(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Height (in)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={wallHeight}
                    onChange={(e) => setWallHeight(e.target.value)}
                    placeholder="e.g. 96"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Custom Grid Mode */}
          {inputMode === "custom" && (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Grid3X3 className="h-4 w-4 text-yellow-400" />
                Grid Configuration
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Columns (Wide)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="20"
                    value={customCols}
                    onChange={(e) => setCustomCols(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                    Rows (High)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="20"
                    value={customRows}
                    onChange={(e) => setCustomRows(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-stone-500">
                Enter the number of tote columns and rows for your unit.
              </p>
            </>
          )}

          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
              Tote Size
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setToteType("HDX")}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  toteType === "HDX"
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 hover:border-stone-600"
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
                  19-3/4&quot; Opening
                </div>
                <div className="text-sm font-bold text-stone-200">Standard</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                    HDX
                  </span>
                  <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                    Performax
                  </span>
                </div>
                <div className="mt-1 text-[9px] text-stone-600">
                  Home Depot &middot; Menards
                </div>
              </button>

              <button
                onClick={() => setToteType("GM")}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  toteType === "GM"
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 hover:border-stone-600"
                }`}
              >
                <div className="text-[9px] font-bold uppercase tracking-wide text-stone-500">
                  20-3/4&quot; Opening
                </div>
                <div className="text-sm font-bold text-stone-200">Wide</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                    GreenMade
                  </span>
                  <span className="inline-block rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">
                    Project Source
                  </span>
                </div>
                <div className="mt-1 text-[9px] text-stone-600">
                  Costco &middot; Lowe&apos;s &middot; Walmart
                </div>
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="mt-3 space-y-2">
            {[
              { val: hasTotes, set: setHasTotes, label: "Totes" },
              { val: hasWheels, set: setHasWheels, label: "Wheels" },
              { val: hasTop, set: setHasTop, label: "Plywood Top" },
            ].map(({ val, set, label }) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {calculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardHat className="h-4 w-4" />
            )}
            {calculating ? "Calculating…" : "Calculate Build"}
          </button>

          {calcError && (
            <p className="mt-3 text-xs font-medium text-red-400">{calcError}</p>
          )}
        </section>

        {/* ── Results ────────────────────────────────────────────────── */}
        {buildResult && (
          <>
            {/* Specs + Price */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-800 p-3">
                  <p className="text-2xl font-black text-white">
                    {buildResult.cols} × {buildResult.rows}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Max Fit
                  </p>
                </div>
                <div className="rounded-lg bg-slate-800 p-3">
                  <p className="text-2xl font-black text-yellow-400">
                    ${buildResult.price.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Est. Price
                  </p>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-stone-500">
                {toFraction(buildResult.totalW)}&quot; W × {toFraction(buildResult.totalH)}
                &quot; H × 30&quot; D — {buildResult.slots} slots
              </div>

              {/* ACTION BUTTONS */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={handleAddUnit}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-blue-400 bg-blue-400/10 py-3 text-xs font-bold uppercase tracking-wider text-blue-400 transition-all hover:bg-blue-400/20"
                >
                  <Plus className="h-4 w-4" />
                  Add Unit
                </button>
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 bg-yellow-400/10 py-3 text-xs font-bold uppercase tracking-wider text-yellow-400 transition-all hover:bg-yellow-400/20"
                >
                  <FileText className="h-4 w-4" />
                  Send Quote
                </button>
                <button
                  onClick={() => setShowAssemblyGuide(true)}
                  className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-400 bg-emerald-400/10 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-400/20"
                >
                  <Box className="h-4 w-4" />
                  How-To Guide
                </button>
              </div>

            </section>
          </>
        )}

        {/* ── Quote Builder (Multiple Units) ────────────────────────── */}
        {/* Lives outside buildResult gate so preset-only quotes are visible */}
        {units.length > 0 && (
          <section ref={quoteBuilderRef} className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
              <ShoppingCart className="h-4 w-4" />
              Quote Builder ({units.length} unit{units.length > 1 ? "s" : ""})
            </h2>

            <div className="space-y-2">
              {(() => {
                const rendered = new Set<string>();
                return units.map((unit, index) => {
                  if (unit.presetGroup) {
                    if (rendered.has(unit.presetGroup)) return null;
                    rendered.add(unit.presetGroup);
                    const groupUnits = units.filter((u) => u.presetGroup === unit.presetGroup);
                    const groupPrice = groupUnits.reduce((s, u) => s + (u.price || 0), 0);
                    const groupSlots = groupUnits.reduce((s, u) => s + (u.slots || 0), 0);
                    return (
                      <div
                        key={unit.presetGroup}
                        className="rounded-lg border border-yellow-400/20 bg-slate-800 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              <Star className="mr-1 inline h-3 w-3 text-yellow-400" />
                              {unit.presetName}
                            </p>
                            <p className="text-[11px] text-stone-500">
                              {groupUnits.map((u) => `${u.cols}×${u.rows}`).join(" + ")} • {groupSlots} slots
                              {groupUnits[0].hasTotes && " • Totes"}
                              {groupUnits.some((u) => u.hasWheels) && " • Wheels"}
                              {groupUnits.some((u) => u.hasTop) && " • Top"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-yellow-400">
                              ${groupPrice.toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleRemoveUnit(unit.id)}
                              className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Unit {index + 1}: {unit.cols} × {unit.rows}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {unit.toteType} • {unit.slots} slots
                          {unit.hasTotes && " • Totes"}
                          {unit.hasWheels && " • Wheels"}
                          {unit.hasTop && " • Top"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-yellow-400">
                          ${unit.price?.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleRemoveUnit(unit.id)}
                          className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-400/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Grand Total */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3">
              <span className="text-sm font-bold uppercase text-stone-400">Grand Total</span>
              <span className="text-xl font-black text-yellow-400">
                ${grandTotal.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => setShowQuoteModal(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
            >
              <FileText className="h-4 w-4" />
              Send Quote
            </button>
          </section>
        )}

        {buildResult && (
          <>
            {/* ── Profit Calculator ────────────────────────────────────── */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Calculator className="h-4 w-4 text-yellow-400" />
                Profit Calculator {units.length > 0 && <span className="text-yellow-400">({units.length} units)</span>}
              </h2>

              {displayMaterials && (
                <div className="space-y-4">
                  {/* Material Cost Breakdown */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-stone-500">Est. Material Cost</span>
                      <span className="text-lg font-black text-orange-400">
                        ${displayMaterials.totalCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-stone-400">
                      {displayMaterials.items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{item.name} × {item.qty}</span>
                          <span className="font-mono">${item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Custom Material Pricing Toggle */}
                    <button
                      onClick={() => setShowMaterialPricing(!showMaterialPricing)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2 text-left transition-colors hover:border-stone-600"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          Custom Material Prices
                        </span>
                        {Object.keys(materialPrices).length > 0 && (
                          <span className="rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-3 w-3 text-stone-500 transition-transform ${showMaterialPricing ? "rotate-180" : ""}`} />
                    </button>

                    {showMaterialPricing && (
                      <MaterialPricingEditor
                        prices={materialPrices}
                        onChange={(p) => {
                          setMaterialPrices(p);
                          if (userId) {
                            try { localStorage.setItem(`sn_material_prices_${userId}`, JSON.stringify(p)); } catch {}
                          }
                          // Recalculate if build exists (server action)
                          if (buildResult) {
                            calculateMaterialCostServer({
                              cols: buildResult.cols,
                              rows: buildResult.rows,
                              toteType,
                              hasTotes,
                              hasWheels,
                              hasTop,
                            }, p).then(setMaterialBreakdown).catch(() => {});
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Profit Scenarios Grid (values from server, no fee constants in client) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Network Lead Scenario */}
                    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                      <div className="mb-2 text-center">
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                          NETWORK LEAD
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-stone-400">
                          <span>Job Price</span>
                          <span>${displayPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                          <span>Network Fee ({feeBreakdown?.networkFeePercent ?? "..."})</span>
                          <span>-${(feeBreakdown?.networkFeeAmount ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-stone-400">
                          <span>You Collect</span>
                          <span>${(feeBreakdown?.networkCollect ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-orange-400">
                          <span>Materials</span>
                          <span>-${displayMaterials.totalCost.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 border-t border-slate-600 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-300">Net Profit</span>
                            <span className="text-lg font-black text-emerald-400">
                              ${(feeBreakdown?.networkNetProfit ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Direct Lead Scenario */}
                    <div className="relative rounded-lg border p-3 border-yellow-400/50 bg-yellow-400/5">
                      <div className="mb-2 text-center">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-yellow-400/20 text-yellow-400">
                          DIRECT LEAD
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-stone-400">
                          <span>Job Price</span>
                          <span>${displayPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                          <span>Maintenance Fee ({feeBreakdown?.directFeePercent ?? "..."})</span>
                          <span>-${(feeBreakdown?.directFeeAmount ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-stone-400">
                          <span>You Collect</span>
                          <span>${(feeBreakdown?.directCollect ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-orange-400">
                          <span>Materials</span>
                          <span>-${displayMaterials.totalCost.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 border-t border-slate-600 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-300">Net Profit</span>
                            <span className="text-lg font-black text-emerald-400">
                              ${(feeBreakdown?.directNetProfit ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── Locked Blueprints Teaser ─────────────────────────────── */}
            <LockedBlueprintsTeaser />
          </>
        )}

        {/* ── Back Link ──────────────────────────────────────────────── */}
        <div className="pb-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </a>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          QUOTE MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="scrollbar-dark relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-gray-900 p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={resetQuoteModal}
              className="absolute right-4 top-4 text-stone-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {!quoteSent ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
                  <FileText className="h-7 w-7 text-yellow-400" />
                </div>

                <h3 className="mb-1 text-center text-lg font-bold text-white">
                  Create Quote
                </h3>
                <p className="mb-5 text-center text-sm text-stone-400">
                  Send a professional quote to your customer
                </p>

                {/* Quote Details - Show multi-unit summary if units exist, else current build */}
                {units.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-stone-500">
                      {units.length} Unit{units.length > 1 ? "s" : ""} in Quote
                    </p>
                    <div className="space-y-1">
                      {(() => {
                        const seen = new Set<string>();
                        return units.map((u, idx) => {
                          if (u.presetGroup) {
                            if (seen.has(u.presetGroup)) return null;
                            seen.add(u.presetGroup);
                            const group = units.filter((g) => g.presetGroup === u.presetGroup);
                            const groupPrice = group.reduce((s, g) => s + (g.price || 0), 0);
                            return (
                              <div key={u.presetGroup} className="flex justify-between text-sm">
                                <span className="text-stone-400">
                                  <Star className="mr-1 inline h-3 w-3 text-yellow-400" />
                                  {u.presetName} ({group.map((g) => `${g.cols}×${g.rows}`).join(" + ")})
                                </span>
                                <span className="font-semibold text-white">${groupPrice.toLocaleString()}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={u.id} className="flex justify-between text-sm">
                              <span className="text-stone-400">Unit {idx + 1}: {u.cols}×{u.rows}</span>
                              <span className="font-semibold text-white">${u.price?.toLocaleString()}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="mt-2 border-t border-slate-700 pt-2 space-y-1">
                      {deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-400">
                            <MapPin className="mr-1 inline h-3 w-3 text-yellow-400" />
                            Delivery Fee ({deliveryFeeResult.distance} mi)
                          </span>
                          <span className="font-semibold text-white">${deliveryFeeResult.fee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-stone-400">Total</span>
                        <span className="text-xl font-black text-yellow-400">
                          ${(units.reduce((sum, u) => sum + (u.price || 0), 0) + (deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : buildResult && (
                  <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center">
                    <p className="text-sm text-stone-400">
                      {buildResult.cols}×{buildResult.rows} Unit
                    </p>
                    <p className="text-2xl font-black text-yellow-400">
                      ${buildResult.price.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Customer Form */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
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
                      onChange={(e) => setCustomerEmail(e.target.value)}
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
                      onChange={(e) => setCustomerPhone(e.target.value)}
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
                      onChange={(e) => setDeliveryZip(e.target.value)}
                      placeholder="e.g. 30301"
                      maxLength={5}
                      className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-stone-600">
                      Used to verify installer coverage for this customer.
                    </p>

                    {/* ── Real-time ZIP area check feedback ── */}
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
                    {deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 && zipCheckStatus !== "checking" && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-yellow-400">
                        <DollarSign className="h-3 w-3" />
                        Delivery fee: ${deliveryFeeResult.fee} ({deliveryFeeResult.tierLabel} — {deliveryFeeResult.distance} mi)
                      </div>
                    )}
                    {deliveryFeeResult?.applicable && deliveryFeeResult.fee === 0 && zipCheckStatus === "in_area" && (
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
                              <strong className="text-white">{zipCoveringName}</strong> covers this area.
                              The quote will be handed off to them and you&apos;ll earn a referral bounty (30% of deposit, min $15).
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
                              The customer will be added to the waitlist and notified when an installer is available. You&apos;ll still earn referral credit.
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
                      onChange={(e) => setQuoteDiscountCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SPRING25"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-stone-600">
                      Attach a promo code — customer can apply it at checkout.
                    </p>
                  </div>

                  {/* Delivery Address (collapsible) — street/city/state only, ZIP is above */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDeliveryAddress(!showDeliveryAddress)}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-stone-500 hover:text-stone-400"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${showDeliveryAddress ? "rotate-180" : ""}`} />
                      Delivery / Install Address (optional)
                    </button>
                    {showDeliveryAddress && (
                      <div className="mt-2 space-y-2 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
                        <input
                          type="text"
                          value={deliveryLine1}
                          onChange={(e) => setDeliveryLine1(e.target.value)}
                          placeholder="Street address"
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={deliveryLine2}
                          onChange={(e) => setDeliveryLine2(e.target.value)}
                          placeholder="Apt / Suite (optional)"
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={deliveryCity}
                            onChange={(e) => setDeliveryCity(e.target.value)}
                            placeholder="City"
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={deliveryState}
                            onChange={(e) => setDeliveryState(e.target.value.toUpperCase())}
                            placeholder="ST"
                            maxLength={2}
                            className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={handleGetLink}
                    disabled={quoteSending || zipCheckStatus === "waitlist"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 py-3 text-sm font-bold uppercase tracking-wider text-yellow-400 transition-all hover:bg-yellow-400/20 disabled:opacity-50"
                    title={zipCheckStatus === "waitlist" ? "No installers in this area — use Email Quote to waitlist the customer" : undefined}
                  >
                    {quoteSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Get Link
                  </button>
                  <button
                    onClick={handleSendQuote}
                    disabled={quoteSending}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                      zipCheckStatus === "waitlist"
                        ? "bg-orange-500 text-white hover:bg-orange-400"
                        : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                    }`}
                  >
                    {quoteSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : zipCheckStatus === "waitlist" ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {zipCheckStatus === "waitlist" ? "Add to Waitlist" : "Email Quote"}
                  </button>
                </div>

                {quoteError && (
                  <p className="mt-3 text-center text-xs font-medium text-red-400">
                    {quoteError}
                  </p>
                )}
              </>
            ) : (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
                <h3 className="mb-1 text-lg font-bold text-white">
                  {quoteReferralStatus === "waitlisted"
                    ? "Customer Waitlisted"
                    : quoteReferralStatus === "handed_off"
                      ? "Quote Sent & Referred"
                      : "Quote Created!"}
                </h3>
                <p className="mb-5 text-sm text-stone-400">
                  {quoteReferralStatus === "waitlisted"
                    ? "No installer covers this area yet. The customer has been added to the waitlist and will be notified when one is available. You'll earn the referral bounty when they book."
                    : quoteReferralStatus === "handed_off"
                      ? `The quote was handed off to ${quoteCoveringName}. The customer will receive the email from them. You'll earn a referral bounty (30% of deposit, min $15) when they book.`
                      : customerEmail?.trim()
                        ? "Your customer will receive an email with their quote and a link to confirm."
                        : "Copy the link below to send it to your customer via text, message, or any channel."}
                </p>

                {/* Referral bounty info */}
                {quoteReferralStatus === "handed_off" && (
                  <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
                    <p className="text-[11px] font-semibold text-amber-300">
                      Referral Bounty Pending
                    </p>
                    <p className="mt-1 text-[10px] text-stone-400">
                      Track your referrals and bounty earnings in your <strong className="text-white">Referrals</strong> dashboard.
                    </p>
                  </div>
                )}

                {/* ── Shareable Quote Link ── */}
                {quoteLeadId && (
                  <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Quote Link
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                        <p className="truncate text-xs text-stone-300">
                          {typeof window !== "undefined"
                            ? `${window.location.origin}/pay/${quoteLeadId}`
                            : `/pay/${quoteLeadId}`}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/pay/${quoteLeadId}`;
                          await navigator.clipboard.writeText(url);
                          setQuoteLinkCopied(true);
                          setTimeout(() => setQuoteLinkCopied(false), 2500);
                        }}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                          quoteLinkCopied
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                        }`}
                      >
                        {quoteLinkCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={resetQuoteModal}
                  className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ASSEMBLY GUIDE OVERLAY
      ═══════════════════════════════════════════════════════════════════ */}
      {showAssemblyGuide && buildResult && (
        <div className="fixed inset-0 z-50">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
              </div>
            }
          >
            <AssemblyGuide
              cols={buildResult.cols}
              rows={buildResult.rows}
              toteType={toteType}
              hasWheels={hasWheels}
              hasTop={hasTop}
              onClose={() => setShowAssemblyGuide(false)}
            />
          </Suspense>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          BOOKING MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {buildResult && userId && leadIdForBooking && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          leadId={leadIdForBooking}
          depositAmount={feeBreakdown?.depositAmount ?? 0}
          totalPrice={buildResult.price}
          installerId={userId}
          source="installer_manual"
          customerEmail={customerEmail || undefined}
          customerName={customerName || undefined}
          hasWheels={hasWheels}
          totalCols={buildResult.cols}
          onSuccess={() => {
            setShowBookingModal(false);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Material Pricing Editor — Inline custom pricing for internal cost tracking
// ═══════════════════════════════════════════════════════════════════════════

const MATERIAL_FIELDS: { key: keyof typeof DEFAULT_MATERIAL_PRICES; label: string; unit: string }[] = [
  { key: "lumber_2x4_8ft", label: "2×4 Lumber (8ft)", unit: "each" },
  { key: "plywood_sheet", label: "Plywood (4×8 sheet)", unit: "sheet" },
  { key: "tote", label: "27-Gal Tote", unit: "each" },
  { key: "screw_1_5_8in_158ct", label: '1⅝" Screws (158ct box)', unit: "box" },
  { key: "screw_3in_137ct", label: '3" Screws (137ct box)', unit: "box" },
  { key: "screw_1in_90ct", label: '1" Screws (90ct box)', unit: "box" },
  { key: "wheels_4pk", label: "Caster Kit (4pk)", unit: "set" },
];

function MaterialPricingEditor({
  prices,
  onChange,
}: {
  prices: MaterialPrices;
  onChange: (prices: MaterialPrices) => void;
}) {
  function handleChange(key: keyof typeof DEFAULT_MATERIAL_PRICES, val: string) {
    const num = parseFloat(val);
    const next = { ...prices };
    if (isNaN(num) || val === "") {
      delete next[key];
    } else {
      next[key] = num;
    }
    onChange(next);
  }

  function resetAll() {
    onChange({});
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Your Local Material Prices
        </p>
        {Object.keys(prices).length > 0 && (
          <button
            onClick={resetAll}
            className="text-[10px] font-semibold text-red-400 hover:text-red-300"
          >
            Reset to Defaults
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MATERIAL_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-0.5 block text-[9px] font-semibold uppercase text-stone-600">
              {f.label}
            </label>
            <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
              <span className="flex items-center bg-slate-700/50 px-2 text-[10px] font-bold text-stone-500">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={DEFAULT_MATERIAL_PRICES[f.key].toFixed(2)}
                value={prices[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none"
              />
              <span className="flex items-center bg-slate-700/50 px-2 text-[9px] text-stone-600">/{f.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-stone-600">
        Prices are saved locally. Customers never see these.
      </p>
    </div>
  );
}
