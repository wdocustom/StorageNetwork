"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculateBuild, calculateCompoundBuild, calculateShelvingUnit, calculateOverheadStorageUnit, type CompoundBuildResult } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { OVERHEAD_GRID_PRESETS, type OverheadGridPreset } from "@/lib/overhead-storage";
import { createQuote, checkDeliveryZip, type DeliveryAddress, type ReferralStatus } from "@/app/actions/createQuote";
import { fetchLeadForEdit, updateQuote } from "@/app/actions/jobs";
import { calculateDeliveryFee, getIndoorDeliveryConfig, type DeliveryFeeResult, type IndoorDeliveryConfig } from "@/app/actions/delivery-fee";
import { calculateRaisedBedPriceServer, getRaisedBedOptionPrices } from "@/app/actions/platform-defaults";
import { RAISED_BED_SIZES, getRaisedBedDescription, type RaisedBedConfig } from "@/lib/raised-beds";
import RaisedBedDropdown from "@/components/design/RaisedBedDropdown";
import { checkProTrial } from "@/app/actions/pro-trial";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine.types";
import { type MaterialBreakdown, type MaterialPrices } from "@/utils/calculateMaterials";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { type MaterialInventory, normalizeInventory } from "@/utils/inventoryManager";
import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
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
  ArrowUpFromLine,
  ChevronUp,
  PenLine,
  Package,
  Sparkles,
} from "lucide-react";

import BookingModal from "@/components/booking/BookingModal";
import type { BookingAddress } from "@/components/booking/BookingModal";
import { calculateWeight } from "@/utils/scheduling";
import type { InstallerPricing } from "@/types/viewModels";
import LockedBlueprintsTeaser from "@/components/dashboard/LockedBlueprintsTeaser";
import ProPill from "@/components/dashboard/ProPill";
import { getBuildFeeBreakdown, type BuildFeeBreakdown } from "@/app/actions/fee-engine";
import { logActivityClient } from "@/lib/activity-client";

const AssemblyGuide = lazy(() => import("@/components/visualizer/AssemblyGuide"));
const BuildAssistant = lazy(() => import("@/components/dashboard/BuildAssistant"));

// ═══════════════════════════════════════════════════════════════════════════
// Build Configurator — Estimate, Quote & New Build
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type UnitTypeOption = "standard" | "mini";
type InputMode = "wallFit" | "custom";

// Unit configuration for multi-unit quotes
interface UnitConfig {
  id: string;
  cols: number;
  rows: number;
  toteType: ToteType;
  unitType: UnitTypeOption;
  orientation?: "standard" | "sideways";
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
  /** When set, this unit is an overhead ceiling storage unit */
  overheadGridPresetId?: string;
  /** When set, this unit is a raised bed planter */
  raisedBedConfig?: RaisedBedConfig;
  /** Quantity for this unit (raised beds can have qty > 1) */
  quantity?: number;
  /** Per-section addons (doors, panels, rail removal, shelves) */
  addons?: import("@/types/viewModels").SectionAddon[];
  /** Paint color selections */
  paintFrameColor?: import("@/types/viewModels").PaintColorId | null;
  paintDoorColor?: import("@/types/viewModels").PaintColorId | null;
  paintSidePanelColor?: import("@/types/viewModels").PaintColorId | null;
  /** When true, customer wants this item delivered inside the home */
  indoorDelivery?: boolean;
  /** The indoor delivery fee charged for this item (in dollars) */
  indoorDeliveryFee?: number;
}

export default function BuildConfiguratorPage() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();

  // Edit mode — when ?edit={leadId} is in the URL
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState("");

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
  const [orientation, setOrientation] = useState<"standard" | "sideways">("standard");
  const [unitType, setUnitType] = useState<UnitTypeOption>("standard");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(false);
  const [indoorDelivery, setIndoorDelivery] = useState(false);

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

  // Indoor delivery fee config (fetched from installer profile)
  const [indoorDeliveryConfig, setIndoorDeliveryConfig] = useState<IndoorDeliveryConfig | null>(null);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [installerStripeId, setInstallerStripeId] = useState<string | null>(null);
  const [leadIdForBooking, setLeadIdForBooking] = useState<string | null>(null);

  // Installer pricing from profile
  const [installerPricing, setInstallerPricing] = useState<InstallerPricing | undefined>();

  // Smart inventory (offcuts, screws, plywood strips)
  const [installerInventory, setInstallerInventory] = useState<MaterialInventory | null>(null);

  // Bestseller preset state
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetHasTotes, setPresetHasTotes] = useState(true);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetResult, setPresetResult] = useState<CompoundBuildResult | null>(null);
  const [presetAdded, setPresetAdded] = useState(false);
  const quoteBuilderRef = useRef<HTMLElement>(null);

  // (tab state removed — unified build configurator)

  // AI Builder state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<Array<{ cols: number; rows: number; toteColor: string; hasTotes: boolean; hasWheels: boolean; hasTop: boolean; presetId?: string; overheadGridPresetId?: string; raisedBedConfig?: { sizeId: string; finish: string; hasLiner: boolean; depthIncrease: boolean; bottomShelf: boolean; pestCover: string; postHeight: number | null; hasHook: boolean; highWindWeighted?: boolean; quantity: number } | null; customPrice?: number | null; description: string; indoorDelivery?: boolean }> | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [aiAdded, setAiAdded] = useState(false);

  async function handleAiBuild() {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setAiNotes("");
    try {
      const res = await fetch("/api/build-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: aiInput }),
      });
      if (!res.ok) {
        setAiError("Failed to parse build. Try being more specific.");
        setAiLoading(false);
        return;
      }
      const data = await res.json();
      if (data.units && data.units.length > 0) {
        setAiResult(data.units);
        if (data.notes) setAiNotes(data.notes);
      } else {
        setAiError("Couldn't parse that into a build config. Try something like '4x4 with totes and wheels'.");
      }
    } catch {
      setAiError("Something went wrong. Try again.");
    }
    setAiLoading(false);
  }

  async function handleAddAiUnits() {
    if (!aiResult) return;
    setAiAdded(false);
    for (const unit of aiResult) {
      const hasCustomPrice = typeof unit.customPrice === "number" && unit.customPrice > 0;

      // Overhead ceiling storage unit
      if (unit.overheadGridPresetId) {
        const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === unit.overheadGridPresetId);
        if (preset) {
          const toteType = (unit.toteColor === "clear" ? "HDX" : "HDX") as "HDX" | "GM";
          const overheadResult = await calculateOverheadStorageUnit({
            config: { gridPresetId: preset.id, toteType, hasTotes: unit.hasTotes },
            installerPricing: installerPricing || undefined,
          });
          if (overheadResult.success && overheadResult.result) {
            const finalPrice = hasCustomPrice ? unit.customPrice! : overheadResult.result.price;
            setUnits((prev) => [...prev, {
              id: `ai-overhead-${Date.now()}-${Math.random()}`,
              cols: preset.slotsWide, rows: preset.slotsDeep,
              toteType, unitType: "standard",
              hasTotes: unit.hasTotes, hasWheels: false, hasTop: false,
              price: finalPrice, totalW: 0, totalH: 0, depth: 0,
              slots: preset.toteCount,
              desc: `Overhead Ceiling Storage: ${preset.label} (${preset.toteCount} totes)`,
              overheadGridPresetId: preset.id,
            }]);
          }
        }
        continue;
      }

      // Raised bed planter — calculate price server-side
      if (unit.raisedBedConfig?.sizeId) {
        const rbConfig: RaisedBedConfig = {
          sizeId: unit.raisedBedConfig.sizeId,
          finish: unit.raisedBedConfig.finish as RaisedBedConfig["finish"],
          hasLiner: unit.raisedBedConfig.hasLiner,
          depthIncrease: unit.raisedBedConfig.depthIncrease,
          bottomShelf: unit.raisedBedConfig.bottomShelf,
          pestCover: unit.raisedBedConfig.pestCover as RaisedBedConfig["pestCover"],
          postHeight: unit.raisedBedConfig.postHeight,
          hasHook: unit.raisedBedConfig.hasHook,
          highWindWeighted: unit.raisedBedConfig.highWindWeighted,
        };
        const result = await calculateRaisedBedPriceServer({ ...rbConfig, installerPricing });
        const qty = unit.raisedBedConfig.quantity || 1;
        const desc = getRaisedBedDescription(rbConfig);
        const bed = RAISED_BED_SIZES.find((s) => s.id === rbConfig.sizeId);
        setUnits((prev) => [...prev, {
          id: `ai-rb-${Date.now()}-${Math.random()}`,
          cols: 0, rows: 0, toteType: "HDX", unitType: "standard",
          hasTotes: false, hasWheels: false, hasTop: false,
          price: hasCustomPrice ? unit.customPrice! : result.total * qty,
          totalW: bed?.widthIn ?? 0, totalH: bed?.heightIn ?? 0, depth: bed?.lengthIn ?? 0,
          desc: qty > 1 ? `${desc} (×${qty})` : desc,
          raisedBedConfig: rbConfig,
          quantity: qty,
        }]);
        continue;
      }

      // Pure custom line item (no cols/rows, just description + price)
      if (unit.cols === 0 && unit.rows === 0 && !unit.presetId && hasCustomPrice) {
        setUnits((prev) => [...prev, {
          id: `ai-custom-${Date.now()}-${Math.random()}`,
          cols: 0, rows: 0, toteType: "HDX", unitType: "standard",
          hasTotes: false, hasWheels: false, hasTop: false,
          price: unit.customPrice!, totalW: 0, totalH: 0, depth: 0,
          desc: unit.description,
        }]);
        continue;
      }

      // Preset units
      if (unit.presetId) {
        const preset = BESTSELLER_PRESETS.find((p) => p.id === unit.presetId);
        const effectiveHasTotes = preset?.totesDisabled ? false : unit.hasTotes;
        const result = await calculateCompoundBuild({
          presetId: unit.presetId,
          hasTotes: effectiveHasTotes,
          installerPricing: installerPricing || undefined,
        });
        if ("totalPrice" in result && preset) {
          const groupId = `ai-preset-${Date.now()}`;
          const totalSlots = result.subUnits.reduce((s, u) => s + u.cols * u.rows, 0);
          // Use customPrice if specified, otherwise use calculated price
          const finalTotalPrice = hasCustomPrice ? unit.customPrice! : result.totalPrice;
          result.subUnits.forEach((su, idx) => {
            const subSlots = su.cols * su.rows;
            const subPrice = totalSlots > 0 ? Math.round((finalTotalPrice * subSlots) / totalSlots) : 0;
            setUnits((prev) => [...prev, {
              id: `ai-${Date.now()}-${idx}`,
              cols: su.cols, rows: su.rows,
              toteType: "HDX", unitType: "standard",
              hasTotes: effectiveHasTotes,
              hasWheels: preset.units[idx]?.hasWheels ?? false,
              hasTop: preset.units[idx]?.hasTop ?? false,
              price: subPrice,
              totalW: su.totalW, totalH: su.totalH, depth: 30,
              slots: subSlots, presetName: preset.name, presetGroup: groupId,
              desc: `${preset.name} (${su.cols}×${su.rows})`,
            }]);
          });
        }
      } else {
        // Standard unit — calculate with real calculator, then optionally override price
        const result = await calculateBuild({
          cols: unit.cols, rows: unit.rows,
          toteModel: "HDX", toteColor: unit.toteColor as "black" | "clear",
          unitType: "standard", orientation: "standard",
          addOns: { totes: unit.hasTotes, wheels: unit.hasWheels, top: unit.hasTop },
          mode: "manual", installerPricing: installerPricing || undefined,
        });
        if ("price" in result) {
          setUnits((prev) => [...prev, {
            id: `ai-${Date.now()}-${Math.random()}`,
            cols: result.cols, rows: result.rows,
            toteType: "HDX", unitType: "standard",
            hasTotes: unit.hasTotes, hasWheels: unit.hasWheels, hasTop: unit.hasTop,
            price: hasCustomPrice ? unit.customPrice! : result.price,
            totalW: result.dimensions.totalW, totalH: result.dimensions.totalH,
            depth: result.dimensions.depth, slots: result.config.slots,
            desc: unit.description,
            ...(unit.indoorDelivery && indoorDeliveryConfig?.enabled ? { indoorDelivery: true, indoorDeliveryFee: indoorDeliveryConfig.fee } : {}),
          }]);
        }
      }
    }
    setAiAdded(true);
    setTimeout(() => { setAiAdded(false); setAiResult(null); setAiInput(""); }, 2000);
    setTimeout(() => {
      quoteBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  // Open Shelving state
  const [selectedShelving, setSelectedShelving] = useState<string>("");
  const [shelvingPrice, setShelvingPrice] = useState<number | null>(null);
  const [shelvingLoading, setShelvingLoading] = useState(false);
  const [shelvingAdded, setShelvingAdded] = useState(false);

  // Overhead Ceiling Storage state
  const [overheadPresetId, setOverheadPresetId] = useState<string>("");
  const [overheadToteType, setOverheadToteType] = useState<ToteType>("HDX");
  const [overheadHasTotes, setOverheadHasTotes] = useState(true);
  const [overheadPrice, setOverheadPrice] = useState<number | null>(null);
  const [overheadLoading, setOverheadLoading] = useState(false);
  const [overheadAdded, setOverheadAdded] = useState(false);
  const [overheadCollapsed, setOverheadCollapsed] = useState(false);

  // Custom material pricing (loaded from DB material_pricing_config)
  const [materialPrices, setMaterialPrices] = useState<MaterialPrices>({});

  // Soft lock: trial expired but active jobs remain — block new quotes
  const [softLocked, setSoftLocked] = useState(false);
  // Job cap: 3 trial jobs reached but trial time remains — block new quotes with softer message
  const [jobCapReached, setJobCapReached] = useState(false);

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

    // Check trial status — block /build during soft lock or job cap
    const trialStatus = await checkProTrial(user.id);
    if (trialStatus.softLocked) {
      setSoftLocked(true);
      setLoading(false);
      return;
    }
    if (trialStatus.jobCapReached && trialStatus.onTrial) {
      setJobCapReached(true);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("is_pro, subscription_tier, business_name, first_name, phone, stripe_account_id, pricing_config, material_inventory, material_pricing_config")
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
      if (data.material_inventory) {
        setInstallerInventory(normalizeInventory(data.material_inventory));
      }
      // Load material pricing from DB (material_pricing_config)
      if (data.material_pricing_config) {
        const mpc = data.material_pricing_config as MaterialPricingConfig;
        const p: Record<string, number> = {};
        if (mpc.lumber_2x4_8ft !== undefined) p.lumber_2x4_8ft = mpc.lumber_2x4_8ft;
        if (mpc.plywood_sheet !== undefined) p.plywood_sheet = mpc.plywood_sheet;
        if (mpc.tote !== undefined) p.tote = mpc.tote;
        if (mpc.wheels_4pk !== undefined) p.wheels_4pk = mpc.wheels_4pk;
        // Normalize custom screw packages to equivalent default-box-size price
        if (mpc.screw_1in) p.screw_1in_90ct = mpc.screw_1in.price / mpc.screw_1in.count * 90;
        if (mpc.screw_1_5_8in) p.screw_1_5_8in_158ct = mpc.screw_1_5_8in.price / mpc.screw_1_5_8in.count * 158;
        if (mpc.screw_3in) p.screw_3in_137ct = mpc.screw_3in.price / mpc.screw_3in.count * 137;
        setMaterialPrices(p as MaterialPrices);
      }
    }

    // Fetch indoor delivery config
    getIndoorDeliveryConfig(user.id).then(setIndoorDeliveryConfig);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Edit mode: load existing quote from ?edit={leadId} ────────────────
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !userId || editingLeadId) return;

    (async () => {
      const result = await fetchLeadForEdit(editId);
      if (!result.success || !result.lead) {
        console.error("[EditMode]", result.error);
        return;
      }

      const lead = result.lead;
      setEditingLeadId(lead.id);
      setEditingCustomerName(lead.customer_name);

      // Pre-populate customer info
      setCustomerName(lead.customer_name);
      setCustomerEmail(lead.customer_email || "");
      setCustomerPhone(lead.customer_phone || "");
      if (lead.discount_code) setQuoteDiscountCode(lead.discount_code);

      // Pre-populate delivery address
      if (lead.delivery_address_line1) {
        setDeliveryLine1(lead.delivery_address_line1);
        setDeliveryLine2(lead.delivery_address_line2 || "");
        setDeliveryCity(lead.delivery_address_city || "");
        setDeliveryState(lead.delivery_address_state || "");
        setShowDeliveryAddress(true);
      }
      if (lead.delivery_address_zip) {
        setDeliveryZip(lead.delivery_address_zip);
      }

      // Reconstruct UnitConfig[] from saved QuoteUnit[]
      const loadedUnits: UnitConfig[] = (lead.quote_data || []).map((q: any, i: number) => ({
        id: `edit-${i}-${Date.now()}`,
        cols: q.cols || 0,
        rows: q.rows || 0,
        toteType: (q.toteType || "HDX") as ToteType,
        unitType: (q.unitType || "standard") as UnitTypeOption,
        orientation: q.orientation || "standard",
        hasTotes: q.hasTotes ?? false,
        hasWheels: q.hasWheels ?? false,
        hasTop: q.hasTop ?? false,
        price: q.price || 0,
        totalW: q.totalW || 0,
        totalH: q.totalH || 0,
        depth: q.depth || 0,
        desc: q.desc || `${q.cols}×${q.rows}`,
        shelvingConfigId: q.shelvingConfigId,
        overheadGridPresetId: q.overheadGridPresetId,
        addons: q.addons,
        paintFrameColor: q.paintFrameColor,
        paintDoorColor: q.paintDoorColor,
        paintSidePanelColor: q.paintSidePanelColor,
        indoorDelivery: q.indoorDelivery,
        indoorDeliveryFee: q.indoorDeliveryFee,
      }));
      setUnits(loadedUnits);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, searchParams]);

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
        unitType: "standard" as UnitTypeOption,
        hasTotes: preset.totesDisabled ? false : presetHasTotes,
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

  // ── Overhead Ceiling Storage calculation ──────────────────────────────
  useEffect(() => {
    if (!overheadPresetId) { setOverheadPrice(null); return; }
    setOverheadLoading(true);
    calculateOverheadStorageUnit({
      config: { gridPresetId: overheadPresetId, toteType: overheadToteType, hasTotes: overheadHasTotes },
      installerPricing,
    })
      .then((res) => { if (res.success) setOverheadPrice(res.result.price); else setOverheadPrice(null); })
      .finally(() => setOverheadLoading(false));
  }, [overheadPresetId, overheadToteType, overheadHasTotes, installerPricing]);

  function handleAddOverhead() {
    if (!overheadPresetId || overheadPrice == null) return;
    const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === overheadPresetId);
    if (!preset) return;
    const newUnit: UnitConfig = {
      id: `overhead-${Date.now()}`,
      cols: preset.slotsWide,
      rows: preset.slotsDeep,
      toteType: overheadToteType,
      unitType: "standard",
      hasTotes: overheadHasTotes,
      hasWheels: false,
      hasTop: false,
      price: overheadPrice,
      totalW: 0,
      totalH: 0,
      depth: 0,
      slots: preset.toteCount,
      desc: `Overhead Ceiling Storage: ${preset.label} (${preset.toteCount} totes)`,
      overheadGridPresetId: preset.id,
    };
    setUnits((prev) => [...prev, newUnit]);
    setOverheadAdded(true);
    setOverheadCollapsed(true);
    setTimeout(() => setOverheadAdded(false), 2000);
    setTimeout(() => {
      quoteBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

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
      unitType: "standard",
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

  function handleAddRaisedBed(config: RaisedBedConfig, price: number, desc: string) {
    const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
    const newUnit: UnitConfig = {
      id: `raised-bed-${Date.now()}`,
      cols: 0,
      rows: 0,
      toteType: "HDX",
      unitType: "standard",
      hasTotes: false,
      hasWheels: false,
      hasTop: false,
      price,
      totalW: bed?.widthIn ?? 0,
      totalH: bed?.heightIn ?? 0,
      depth: bed?.lengthIn ?? 0,
      slots: 0,
      desc,
      raisedBedConfig: config,
    };
    setUnits((prev) => [...prev, newUnit]);
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
        unitType,
        orientation: unitType === "standard" ? orientation : "standard",
        addOns: { totes: hasTotes, wheels: hasWheels, top: unitType === "mini" ? true : hasTop },
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
        use2x4Rails: installerPricing?.use_2x4_rails === true,
      };
      generateBuildManifestServer([unit]).then(setManifest).catch(() => {});

      // Calculate material cost for profit breakdown (server action)
      calculateMaterialCostServer({
        cols: res.cols,
        rows: res.rows,
        toteType,
        unitType,
        orientation: res.config.orientation,
        hasTotes,
        hasWheels,
        hasTop: unitType === "mini" ? true : hasTop,
        use2x4Rails: installerPricing?.use_2x4_rails === true,
      }, materialPrices, installerInventory).then(setMaterialBreakdown).catch(() => {});
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
      unitType,
      orientation: buildResult.orientation,
      hasTotes,
      hasWheels,
      hasTop: unitType === "mini" ? true : hasTop,
      price: buildResult.price,
      totalW: buildResult.totalW,
      totalH: buildResult.totalH,
      depth: buildResult.depth,
      slots: buildResult.slots,
      ...(indoorDelivery && indoorDeliveryConfig?.enabled ? { indoorDelivery: true, indoorDeliveryFee: indoorDeliveryConfig.fee } : {}),
    };

    setUnits((prev) => [...prev, newUnit]);
    setIndoorDelivery(false);
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
  const grandTotal = units.reduce((sum, u) => sum + (u.price || 0) + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee : 0), 0);

  // Calculate aggregate material breakdown and manifest for all units in Quote Builder
  const [aggregateMaterials, setAggregateMaterials] = useState<MaterialBreakdown | null>(null);
  useEffect(() => {
    if (units.length === 0) { setAggregateMaterials(null); return; }
    const configs = units.map((u) => ({
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      unitType: u.unitType as "standard" | "mini" | undefined,
      orientation: (u.orientation ?? "standard") as "standard" | "sideways",
      hasTotes: u.hasTotes,
      hasWheels: u.hasWheels,
      hasTop: u.unitType === "mini" ? true : u.hasTop,
      shelvingConfigId: u.shelvingConfigId,
      overheadGridPresetId: u.overheadGridPresetId,
      addons: u.addons,
      use2x4Rails: installerPricing?.use_2x4_rails === true,
    }));
    calculateMaterialCostServer(configs, materialPrices, installerInventory).then(setAggregateMaterials).catch(() => {});
  }, [units, materialPrices, installerInventory]);

  const [aggregateManifest, setAggregateManifest] = useState<BuildManifest | null>(null);
  useEffect(() => {
    if (units.length === 0) { setAggregateManifest(null); return; }
    const quoteUnits: QuoteUnit[] = units.map((u) => ({
      cols: u.cols,
      rows: u.rows,
      toteType: u.toteType,
      unitType: u.unitType ?? ("standard" as const),
      orientation: u.orientation ?? ("standard" as const),
      hasTotes: u.hasTotes,
      hasWheels: u.hasWheels,
      hasTop: u.hasTop,
      price: u.price || 0,
      totalW: u.totalW || 0,
      totalH: u.totalH || 0,
      depth: u.depth || 30,
      desc: u.desc || `${u.cols} Wide × ${u.rows} High`,
      shelvingConfigId: u.shelvingConfigId,
      overheadGridPresetId: u.overheadGridPresetId,
      addons: u.addons,
      paintFrameColor: u.paintFrameColor,
      paintDoorColor: u.paintDoorColor,
      paintSidePanelColor: u.paintSidePanelColor,
      use2x4Rails: installerPricing?.use_2x4_rails === true,
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
    const quoteUnits: QuoteUnit[] = [];
    const processedGroups = new Set<string>();

    for (const u of units) {
      // Consolidate preset groups into a single line item
      if (u.presetGroup) {
        if (processedGroups.has(u.presetGroup)) continue;
        processedGroups.add(u.presetGroup);
        const groupUnits = units.filter((g) => g.presetGroup === u.presetGroup);
        const groupPrice = groupUnits.reduce((s, g) => s + (g.price || 0), 0);
        const groupSlots = groupUnits.reduce((s, g) => s + (g.slots || 0), 0);
        const subDesc = groupUnits.map((g) => `${g.cols}×${g.rows}`).join(" + ");
        const features: string[] = [];
        if (groupUnits[0]?.hasTotes) features.push("Totes");
        if (groupUnits.some((g) => g.hasWheels)) features.push("Wheels");
        if (groupUnits.some((g) => g.hasTop)) features.push("Top");
        const desc = `${u.presetName} (${subDesc} — ${groupSlots} slots${features.length ? `, ${features.join(", ")}` : ""})`;

        quoteUnits.push({
          cols: groupUnits[0].cols,
          rows: groupUnits[0].rows,
          toteType: groupUnits[0].toteType,
          unitType: groupUnits[0].unitType ?? ("standard" as const),
          orientation: (groupUnits[0].orientation ?? "standard") as "standard" | "sideways",
          hasTotes: groupUnits[0].hasTotes,
          hasWheels: groupUnits.some((g) => g.hasWheels),
          hasTop: groupUnits.some((g) => g.hasTop),
          price: groupPrice,
          totalW: groupUnits[0].totalW || 0,
          totalH: groupUnits[0].totalH || 0,
          depth: groupUnits[0].depth || 30,
          desc,
          use2x4Rails: installerPricing?.use_2x4_rails === true,
          ...(groupUnits[0].indoorDelivery ? { indoorDelivery: true, indoorDeliveryFee: groupUnits[0].indoorDeliveryFee } : {}),
        });
        continue;
      }

      quoteUnits.push({
        cols: u.cols,
        rows: u.rows,
        toteType: u.toteType,
        unitType: u.unitType ?? ("standard" as const),
        orientation: (u.orientation ?? "standard") as "standard" | "sideways",
        hasTotes: u.hasTotes,
        hasWheels: u.hasWheels,
        hasTop: u.hasTop,
        price: u.price || 0,
        totalW: u.totalW || 0,
        totalH: u.totalH || 0,
        depth: u.depth || 30,
        desc: u.desc || `${u.cols} Wide × ${u.rows} High`,
        shelvingConfigId: u.shelvingConfigId,
        overheadGridPresetId: u.overheadGridPresetId,
        addons: u.addons,
        paintFrameColor: u.paintFrameColor,
        paintDoorColor: u.paintDoorColor,
        paintSidePanelColor: u.paintSidePanelColor,
        use2x4Rails: installerPricing?.use_2x4_rails === true,
        ...(u.indoorDelivery ? { indoorDelivery: true, indoorDeliveryFee: u.indoorDeliveryFee } : {}),
      });
    }

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
        use2x4Rails: installerPricing?.use_2x4_rails === true,
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
      const indoorTotal = quoteUnits.reduce((sum, u) => sum + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee : 0), 0);
      const deliveryFee = deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0;
      const totalPrice = buildTotal + indoorTotal + deliveryFee;

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
      const indoorTotal = quoteUnits.reduce((sum, u) => sum + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee : 0), 0);
      const deliveryFee = deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0;
      const totalPrice = buildTotal + indoorTotal + deliveryFee;

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

        // Log that the installer created a quote
        logActivityClient({ action: "quote_created", pagePath: "/build", detail: { lead_id: result.lead_id } });

        // Copy link to clipboard (isolated try/catch so clipboard errors
        // don't mask a successful quote creation)
        try {
          const url = `${window.location.origin}/pay/${result.lead_id}`;
          await navigator.clipboard.writeText(url);
          setQuoteLinkCopied(true);
          setTimeout(() => setQuoteLinkCopied(false), 3000);

          // Log that the pay link was copied
          logActivityClient({ action: "quote_link_copied", pagePath: "/build", detail: { lead_id: result.lead_id } });
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

  async function handleUpdateQuote() {
    if (!editingLeadId) return;
    const quoteUnits = buildQuoteUnits();
    if (!quoteUnits) {
      setQuoteError("No items in quote.");
      return;
    }

    setQuoteError("");
    setQuoteSending(true);

    try {
      const buildTotal = quoteUnits.reduce((sum, u) => sum + u.price, 0);
      const indoorTotal = quoteUnits.reduce((sum, u) => sum + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee : 0), 0);
      const deliveryFee = deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0;
      const totalPrice = buildTotal + indoorTotal + deliveryFee;

      const result = await updateQuote({
        leadId: editingLeadId,
        quote_data: quoteUnits,
        grand_total: totalPrice,
        delivery_fee: deliveryFee,
        discount_code: quoteDiscountCode.trim() || undefined,
      });

      if (!result.success) {
        setQuoteError(result.error || "Failed to update quote.");
        return;
      }

      setQuoteLeadId(editingLeadId);
      setQuoteSent(true);

      logActivityClient({ action: "quote_updated", pagePath: "/build", detail: { lead_id: editingLeadId } });
    } catch (err) {
      console.error("[UpdateQuote] Failed:", err);
      setQuoteError("Failed to update quote. Please try again.");
    } finally {
      setQuoteSending(false);
    }
  }

  function resetQuoteModal() {
    setShowQuoteModal(false);
    setQuoteSent(false);
    setQuoteError("");
    setQuoteLinkCopied(false);
    if (!editingLeadId) {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setQuoteDiscountCode("");
      setQuoteLeadId(null);
      setQuoteReferralStatus("none");
      setQuoteCoveringName("");
      setZipCheckStatus("idle");
      setZipCoveringName("");
      setDeliveryFeeResult(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  // Soft lock gate: trial expired, active jobs remain — no new quotes
  if (softLocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10">
            <HardHat className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="mb-2 text-xl font-black text-white">Finish Your Active Jobs</h1>
          <p className="mb-6 text-sm text-stone-400">
            Your trial has ended. Complete your current jobs, then subscribe to
            send new quotes and accept new bookings.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/upgrade"
              className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Subscribe Now
            </a>
            <a
              href="/dashboard"
              className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Job cap gate: 3 trial jobs reached but trial still active — block new quotes
  if (jobCapReached) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/10">
            <HardHat className="h-8 w-8 text-yellow-400" />
          </div>
          <h1 className="mb-2 text-xl font-black text-white">3 Free Trial Jobs Used</h1>
          <p className="mb-4 text-sm text-stone-400">
            You&apos;ve completed all 3 jobs included in your free trial.
            New quotes and bookings cannot be sent or accepted until you subscribe to Pro.
          </p>
          <p className="mb-6 text-xs text-stone-500">
            Your existing jobs are unaffected — finish them as normal.
            Any new customers who find your page will be waitlisted until you upgrade.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/upgrade"
              className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Subscribe to Pro
            </a>
            <a
              href="/dashboard"
              className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
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

      {editingLeadId && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <p className="text-xs font-bold text-amber-300">
              <PenLine className="mr-1.5 inline h-3.5 w-3.5" />
              Editing quote for {editingCustomerName}
            </p>
            <a
              href={`/dashboard/leads/${editingLeadId}`}
              className="text-[10px] font-semibold text-amber-400 hover:text-amber-300"
            >
              Back to Job Ticket
            </a>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* ── Build Configurator — unified bestseller + AI builder ── */}
        <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            Build Configurator
          </h2>

          {/* ── Quick-select bestseller dropdown ── */}
          <div className="mb-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-600">Quick Select — Bestsellers</label>
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

              {selectedPreset && (() => {
                const activePresetObj = BESTSELLER_PRESETS.find((p) => p.id === selectedPreset);
                return (
                <div className="mt-3 space-y-3">
                  {/* Totes toggle — hidden for mandatory-tote presets like Track Norris */}
                  {activePresetObj?.totesAreMandatory ? (
                    <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-stone-400">
                      <Package className="h-4 w-4 text-yellow-400" />
                      Totes included — drawer slide system
                    </div>
                  ) : activePresetObj?.totesDisabled ? (
                    <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-stone-400">
                      <Package className="h-4 w-4 text-stone-500" />
                      Frame only — no totes
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={presetHasTotes}
                        onChange={(e) => setPresetHasTotes(e.target.checked)}
                        className="h-4 w-4 accent-yellow-400"
                      />
                      <span className="text-sm text-stone-300">Include Totes</span>
                    </label>
                  )}

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
                );
              })()}
          </div>

          {/* ── AI Builder — describe anything ── */}
          <div className="mt-3 border-t border-slate-800 pt-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-600">
                Or describe what to build
                </label>
                {/* Quick scenario chips */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[
                    "Indiana Joe with clear totes",
                    "4x4 on wheels with a top",
                    "Cornhusker no totes",
                    "36x24 planter box with shelf $350",
                    "120x96 wall fit",
                    "Garage cleanout $349",
                  ].map((scenario) => (
                    <button
                      key={scenario}
                      type="button"
                      onClick={() => { setAiInput(scenario); setAiError(""); }}
                      className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium text-stone-500 transition-all hover:border-yellow-400/40 hover:bg-yellow-400/10 hover:text-yellow-300"
                    >
                      {scenario}
                    </button>
                  ))}
                </div>
                <textarea
                  value={aiInput}
                  onChange={(e) => { setAiInput(e.target.value); setAiError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiBuild(); } }}
                  placeholder='e.g. "4x4 with totes and wheels" or "Indiana Joe no totes" or "36x24 raised planter box with shelf $350" or "garage cleanout $200"'
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
                  disabled={aiLoading}
                />
              </div>

              {aiError && <p className="text-xs font-medium text-red-400">{aiError}</p>}

              {!aiResult && (
                <button
                  onClick={handleAiBuild}
                  disabled={!aiInput.trim() || aiLoading}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                    aiInput.trim() && !aiLoading
                      ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                      : "cursor-not-allowed bg-slate-700 text-stone-500"
                  }`}
                >
                  {aiLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Parsing...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Build</>
                  )}
                </button>
              )}

              {/* AI Result Preview — installer reviews before adding */}
              {aiResult && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Preview — confirm before adding</p>
                  {aiResult.map((unit, i) => (
                    <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">{unit.description}</p>
                        <div className="flex items-center gap-2">
                          {unit.customPrice && (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">${unit.customPrice}</span>
                          )}
                          {unit.presetId && (
                            <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">Preset</span>
                          )}
                          {unit.overheadGridPresetId && (
                            <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">Ceiling</span>
                          )}
                          {unit.raisedBedConfig && (
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">Raised Bed</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-stone-400">
                        {unit.raisedBedConfig ? (
                          <span>
                            {(() => { const bed = RAISED_BED_SIZES.find((s) => s.id === unit.raisedBedConfig!.sizeId); return bed ? `${bed.widthIn}"×${bed.lengthIn}"×${bed.heightIn}" ${bed.style === "with_legs" ? "(with legs)" : "(ground)"}` : unit.raisedBedConfig!.sizeId; })()}
                            {unit.raisedBedConfig.finish !== "natural" && ` • ${unit.raisedBedConfig.finish === "stain" ? "Stain" : "Painted White"}`}
                            {unit.raisedBedConfig.hasLiner && " • Liner"}
                            {unit.raisedBedConfig.depthIncrease && " • 12\" Depth"}
                            {unit.raisedBedConfig.postHeight && ` • ${unit.raisedBedConfig.postHeight === 72 ? "6'" : unit.raisedBedConfig.postHeight === 84 ? "7'" : "8'"} Post`}
                            {unit.raisedBedConfig.hasHook && " • Hook"}
                            {unit.raisedBedConfig.highWindWeighted && " • High-Wind Weighted"}
                            {unit.raisedBedConfig.quantity > 1 && ` • Qty: ${unit.raisedBedConfig.quantity}`}
                          </span>
                        ) : unit.overheadGridPresetId ? (
                          <span>Overhead {unit.overheadGridPresetId} grid{unit.hasTotes ? ` • Totes (${unit.toteColor})` : ""}</span>
                        ) : unit.cols === 0 && unit.rows === 0 && unit.customPrice ? (
                          <span>Custom item</span>
                        ) : (
                          <>
                            {!unit.presetId && <span>{unit.cols}×{unit.rows}</span>}
                            {unit.hasTotes && <span>Totes ({unit.toteColor})</span>}
                            {!unit.hasTotes && <span>No totes</span>}
                            {unit.hasWheels && <span>Wheels</span>}
                            {unit.hasTop && <span>Top</span>}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiNotes && <p className="text-xs text-stone-500 italic">{aiNotes}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAiResult(null); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-stone-400 transition-colors hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleAddAiUnits}
                      className={`flex flex-[2] items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                        aiAdded
                          ? "bg-emerald-500 text-white"
                          : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                      }`}
                    >
                      {aiAdded ? (
                        <><Check className="h-4 w-4" /> Added to Quote</>
                      ) : (
                        <><Plus className="h-4 w-4" /> Add to Quote</>
                      )}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </section>

        {/* ── Open Shelving ──────────────────────────────────────────── */}
        {installerPricing?.open_shelving_enabled === true && <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
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

        {/* ── Overhead Ceiling Storage ─────────────────────────────────── */}
        {installerPricing?.overhead_storage_enabled === true && (
          <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
            <button
              onClick={() => setOverheadCollapsed(!overheadCollapsed)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                <ArrowUpFromLine className="h-4 w-4 text-yellow-400" />
                Overhead Ceiling Storage
              </h2>
              <div className="flex items-center gap-2">
                {overheadCollapsed && overheadPresetId && (
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                    {OVERHEAD_GRID_PRESETS.find((p) => p.id === overheadPresetId)?.label} • {overheadToteType}
                    {overheadHasTotes ? " • Totes" : ""}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 text-stone-500 transition-transform ${overheadCollapsed ? "" : "rotate-180"}`} />
              </div>
            </button>

            {!overheadCollapsed && (
              <div className="mt-3 space-y-3">
                {/* Grid preset buttons */}
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-stone-500">
                    Grid Size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {OVERHEAD_GRID_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setOverheadPresetId(overheadPresetId === preset.id ? "" : preset.id);
                          setOverheadAdded(false);
                        }}
                        className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
                          overheadPresetId === preset.id
                            ? "border-yellow-400 bg-yellow-400/10"
                            : "border-slate-700 hover:border-stone-600"
                        }`}
                      >
                        <div className="text-sm font-bold text-white">{preset.label}</div>
                        <div className="text-[10px] text-stone-500">{preset.toteCount} totes</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tote type toggle */}
                {overheadPresetId && (
                  <>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase text-stone-500">
                        Tote Size
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setOverheadToteType("HDX")}
                          className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                            overheadToteType === "HDX"
                              ? "border-yellow-400 bg-yellow-400/10"
                              : "border-slate-700 hover:border-stone-600"
                          }`}
                        >
                          <div className="text-xs font-bold text-stone-200">Standard (HDX)</div>
                          <div className="text-[9px] text-stone-500">19-3/4&quot; slot</div>
                        </button>
                        <button
                          onClick={() => setOverheadToteType("GM")}
                          className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                            overheadToteType === "GM"
                              ? "border-yellow-400 bg-yellow-400/10"
                              : "border-slate-700 hover:border-stone-600"
                          }`}
                        >
                          <div className="text-xs font-bold text-stone-200">Wide (GM)</div>
                          <div className="text-[9px] text-stone-500">20-3/4&quot; slot</div>
                        </button>
                      </div>
                    </div>

                    {/* Include totes toggle */}
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={overheadHasTotes}
                        onChange={(e) => setOverheadHasTotes(e.target.checked)}
                        className="h-4 w-4 accent-yellow-400"
                      />
                      <span className="text-sm text-stone-300">Include Totes</span>
                    </label>

                    {/* Loading / Result */}
                    {overheadLoading && (
                      <div className="flex items-center justify-center gap-2 py-3 text-sm text-stone-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculating…
                      </div>
                    )}

                    {overheadPrice != null && !overheadLoading && (
                      <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="rounded-lg bg-slate-800 p-2">
                            <p className="text-lg font-black text-white">
                              {OVERHEAD_GRID_PRESETS.find((p) => p.id === overheadPresetId)?.label}
                            </p>
                            <p className="text-[10px] font-bold uppercase text-stone-500">
                              {OVERHEAD_GRID_PRESETS.find((p) => p.id === overheadPresetId)?.toteCount} totes • {overheadToteType}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-800 p-2">
                            <p className="text-lg font-black text-yellow-400">
                              ${overheadPrice.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold uppercase text-stone-500">
                              Overhead Storage
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleAddOverhead}
                          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                            overheadAdded
                              ? "bg-emerald-500 text-white"
                              : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                          }`}
                        >
                          {overheadAdded ? (
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
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Raised Bed Planters ──────────────────────────────────────── */}
        {installerPricing?.raised_bed_enabled === true && (
          <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
            <RaisedBedDropdown
              onAddRaisedBed={handleAddRaisedBed}
              installerPricing={installerPricing}
            />
          </section>
        )}

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
                    max={installerPricing?.use_2x4_rails ? "5" : "20"}
                    value={customRows}
                    onChange={(e) => setCustomRows(e.target.value)}
                    placeholder={installerPricing?.use_2x4_rails ? "e.g. 4 (max 5)" : "e.g. 5"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-stone-500">
                {installerPricing?.use_2x4_rails
                  ? "Enter the number of columns and rows (max 5 tiers for 2x4 rail construction)."
                  : "Enter the number of tote columns and rows for your unit."}
              </p>
            </>
          )}

          {/* ── 2x4 Rail Construction Mode Indicator ─────────────── */}
          {installerPricing?.use_2x4_rails === true && (
            <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">2x4 Rail Construction</div>
              <div className="mt-1 text-xs text-stone-400">
                21&quot; universal openings &middot; Ripped 2x4 rails &middot; Max 5 tiers
              </div>
            </div>
          )}

          {/* ── Unit Size Toggle (Standard vs Mini) — hidden in 2x4 rail mode ── */}
          {installerPricing?.mini_enabled === true && installerPricing?.use_2x4_rails !== true && (
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
                Unit Size
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUnitType("standard")}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    unitType === "standard"
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-slate-700 hover:border-stone-600"
                  }`}
                >
                  <div className="text-sm font-bold text-stone-200">Standard</div>
                  <div className="mt-0.5 text-[10px] text-stone-500">27 Gallon Totes</div>
                </button>
                <button
                  onClick={() => {
                    setUnitType("mini");
                    setHasTop(true);
                    setOrientation("standard");
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    unitType === "mini"
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-slate-700 hover:border-stone-600"
                  }`}
                >
                  <div className="text-sm font-bold text-stone-200">Mini</div>
                  <div className="mt-0.5 text-[10px] text-stone-500">6.5 Quart Totes</div>
                </button>
              </div>
            </div>
          )}

          {/* ── Orientation (Standard units only) ── */}
          {unitType === "standard" && (
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-bold uppercase text-stone-500">
              Tote Orientation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrientation("standard")}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  orientation === "standard"
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 hover:border-stone-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-stone-200">Standard</div>
                  {orientation === "standard" && (
                    <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">30&quot; Deep</div>
              </button>
              <button
                onClick={() => setOrientation("sideways")}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  orientation === "sideways"
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-slate-700 hover:border-stone-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-stone-200">Sideways</div>
                  {orientation === "sideways" && (
                    <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">20&quot; Deep</div>
              </button>
            </div>
          </div>
          )}

          {/* ── Tote Size (Standard units only, hidden in 2x4 rail mode) ── */}
          {installerPricing?.use_2x4_rails !== true && unitType === "standard" ? (
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
          ) : installerPricing?.use_2x4_rails !== true ? (
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Tote Type</div>
              <div className="mt-1 text-sm font-medium text-stone-300">
                6.5 Quart Clear Totes (Yellow Lids)
              </div>
            </div>
          ) : null}

          {/* Toggles */}
          <div className="mt-3 space-y-2">
            {[
              { val: hasTotes, set: setHasTotes, label: unitType === "mini" ? "Include Clear Totes" : "Totes", disabled: false },
              { val: hasWheels, set: setHasWheels, label: "Wheels", disabled: false },
              { val: unitType === "mini" ? true : hasTop, set: setHasTop, label: "Plywood Top", disabled: unitType === "mini" },
            ].map(({ val, set, label, disabled }) => (
              <label
                key={label}
                className={`flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 ${disabled ? "opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">{label}</span>
                {disabled && <span className="text-[9px] text-stone-600">(always included)</span>}
              </label>
            ))}
            {indoorDeliveryConfig?.enabled && (
              <label className="flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indoorDelivery}
                  onChange={(e) => setIndoorDelivery(e.target.checked)}
                  className="h-4 w-4 accent-yellow-400"
                />
                <span className="text-sm text-stone-300">Indoor Delivery (+${indoorDeliveryConfig.fee})</span>
              </label>
            )}
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
                &quot; H × {toFraction(buildResult.depth)}&quot; D — {buildResult.slots} slots
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
                  onClick={() => editingLeadId ? setShowQuoteModal(true) : setShowQuoteModal(true)}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                    editingLeadId
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                      : "border-yellow-400 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                  }`}
                >
                  {editingLeadId ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {editingLeadId ? "Update Quote" : "Send Quote"}
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
                              {groupUnits.some((u) => u.indoorDelivery) && " • Indoor Delivery"}
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
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        unit.overheadGridPresetId
                          ? "border-yellow-400/20 bg-slate-800"
                          : "border-slate-700 bg-slate-800"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {unit.raisedBedConfig ? (
                            unit.desc
                          ) : unit.cols === 0 && unit.rows === 0 && !unit.overheadGridPresetId && !unit.shelvingConfigId ? (
                            <>
                              <PenLine className="mr-1 inline h-3 w-3 text-yellow-400" />
                              {unit.desc}
                            </>
                          ) : unit.overheadGridPresetId ? (
                            <>
                              <ArrowUpFromLine className="mr-1 inline h-3 w-3 text-yellow-400" />
                              {unit.desc}
                            </>
                          ) : unit.shelvingConfigId ? (
                            unit.desc
                          ) : (
                            <>Unit {index + 1}: {unit.cols} × {unit.rows}</>
                          )}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {unit.raisedBedConfig ? (
                            <>Raised Bed{unit.quantity && unit.quantity > 1 ? ` • Qty: ${unit.quantity}` : ""}</>
                          ) : unit.cols === 0 && unit.rows === 0 && !unit.overheadGridPresetId && !unit.shelvingConfigId ? (
                            "Custom item"
                          ) : unit.overheadGridPresetId ? (
                            <>{unit.toteType}{unit.hasTotes && " • Totes"}</>
                          ) : (
                            <>
                              {unit.unitType === "mini" ? "Mini" : unit.toteType} • {unit.slots} slots
                              {unit.hasTotes && " • Totes"}
                              {unit.hasWheels && " • Wheels"}
                              {unit.hasTop && " • Top"}
                              {unit.indoorDelivery && " • Indoor Delivery"}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-yellow-400">
                          ${((unit.price || 0) + (unit.indoorDelivery && unit.indoorDeliveryFee ? unit.indoorDeliveryFee : 0)).toLocaleString()}
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
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all ${
                editingLeadId
                  ? "bg-emerald-500 text-white hover:bg-emerald-400"
                  : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
              }`}
            >
              {editingLeadId ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              {editingLeadId ? "Update Quote" : "Send Quote"}
            </button>
          </section>
        )}

        {(buildResult || units.length > 0) && (
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

                    {/* Custom pricing indicator — configured in Profile > Material Costs */}
                    {Object.keys(materialPrices).length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-1.5">
                        <span className="rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                          CUSTOM
                        </span>
                        <span className="text-[10px] text-stone-500">
                          Material prices from your profile settings
                        </span>
                      </div>
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
                  {editingLeadId ? "Update Quote" : "Create Quote"}
                </h3>
                <p className="mb-5 text-center text-sm text-stone-400">
                  {editingLeadId ? `Editing quote for ${editingCustomerName}` : "Send a professional quote to your customer"}
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
                            <div key={u.id} className="text-sm">
                              <div className="flex justify-between">
                                <span className="text-stone-400">
                                  {u.cols === 0 && u.rows === 0 && !u.overheadGridPresetId && !u.shelvingConfigId ? (
                                    <><PenLine className="mr-1 inline h-3 w-3 text-yellow-400" />{u.desc}</>
                                  ) : u.overheadGridPresetId ? (
                                    <><ArrowUpFromLine className="mr-1 inline h-3 w-3 text-yellow-400" />{u.desc}</>
                                  ) : (
                                    <>Unit {idx + 1}: {u.cols}×{u.rows}</>
                                  )}
                                </span>
                                <span className="font-semibold text-white">
                                  ${((u.price || 0) + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee * (u.quantity || 1) : 0)).toLocaleString()}
                                </span>
                              </div>
                              {indoorDeliveryConfig?.enabled && (
                                <label className="mt-0.5 flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!u.indoorDelivery}
                                    onChange={(e) => {
                                      setUnits((prev) => prev.map((p, i) => i === idx ? { ...p, indoorDelivery: e.target.checked, indoorDeliveryFee: indoorDeliveryConfig.fee } : p));
                                    }}
                                    className="h-3 w-3 rounded border-slate-600 bg-slate-700 text-yellow-400 focus:ring-yellow-400/50"
                                  />
                                  <span className="text-[10px] text-stone-500">Indoor delivery (+${indoorDeliveryConfig.fee})</span>
                                </label>
                              )}
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
                          ${(units.reduce((sum, u) => sum + (u.price || 0) + (u.indoorDelivery && u.indoorDeliveryFee ? u.indoorDeliveryFee * (u.quantity || 1) : 0), 0) + (deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0 ? deliveryFeeResult.fee : 0)).toLocaleString()}
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
                {editingLeadId ? (
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => { resetQuoteModal(); window.location.href = `/dashboard/leads/${editingLeadId}`; }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-bold uppercase tracking-wider text-stone-400 transition-all hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateQuote}
                      disabled={quoteSending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
                    >
                      {quoteSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Update Quote
                    </button>
                  </div>
                ) : (
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
                )}

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
                  {editingLeadId
                    ? "Quote Updated!"
                    : quoteReferralStatus === "waitlisted"
                      ? "Customer Waitlisted"
                      : quoteReferralStatus === "handed_off"
                        ? "Quote Sent & Referred"
                        : "Quote Created!"}
                </h3>
                <p className="mb-5 text-sm text-stone-400">
                  {editingLeadId
                    ? "The quote has been updated. Your customer's pay link will show the new items and total."
                    : quoteReferralStatus === "waitlisted"
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
                          logActivityClient({ action: "quote_link_copied", pagePath: "/build", detail: { lead_id: quoteLeadId } });
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

                {editingLeadId ? (
                  <div className="flex gap-2">
                    <button
                      onClick={resetQuoteModal}
                      className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
                    >
                      Keep Editing
                    </button>
                    <a
                      href={`/dashboard/leads/${editingLeadId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
                    >
                      View Job Ticket
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={resetQuoteModal}
                    className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
                  >
                    Done
                  </button>
                )}
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

      {/* ═══════════════════════════════════════════════════════════════════
          BUILD ASSISTANT — AI Chat FAB
      ═══════════════════════════════════════════════════════════════════ */}
      <Suspense fallback={null}>
        <BuildAssistant
          buildResult={buildResult}
          units={units.map(u => ({ ...u, price: u.price ?? 0 }))}
          materialBreakdown={displayMaterials}
          feeBreakdown={feeBreakdown}
          manifest={displayManifest}
          installerPricing={installerPricing}
          materialPrices={materialPrices}
          userId={userId}
        />
      </Suspense>
    </div>
  );
}

