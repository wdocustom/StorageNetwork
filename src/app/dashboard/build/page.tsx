"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { calculateBuild, calculateCompoundBuild, calculateShelvingUnit, calculateOverheadStorageUnit, type CompoundBuildResult } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";
import { createQuote, checkDeliveryZip, type DeliveryAddress, type ReferralStatus } from "@/app/actions/createQuote";
import { fetchLeadForEdit, updateQuote } from "@/app/actions/jobs";
import { calculateDeliveryFee, getIndoorDeliveryConfig, type DeliveryFeeResult, type IndoorDeliveryConfig } from "@/app/actions/delivery-fee";
import { calculateRaisedBedPriceServer } from "@/app/actions/platform-defaults";
import { RAISED_BED_SIZES, getRaisedBedDescription, type RaisedBedConfig } from "@/lib/raised-beds";
import { checkProTrial } from "@/app/actions/pro-trial";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import type { BuildManifest, QuoteUnit } from "@/lib/buildEngine.types";
import { type MaterialBreakdown, type MaterialPrices } from "@/utils/calculateMaterials";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { type MaterialInventory, normalizeInventory } from "@/utils/inventoryManager";
import type { MaterialPricingConfig } from "@/app/actions/material-pricing";
import { ArrowLeft, HardHat, Loader2, PenLine } from "lucide-react";

import BookingModal from "@/components/booking/BookingModal";
import type { InstallerPricing } from "@/types/viewModels";
import ProPill from "@/components/dashboard/ProPill";
import { getBuildFeeBreakdown, getEstimatedSalesTax, type BuildFeeBreakdown } from "@/app/actions/fee-engine";
import { logActivityClient } from "@/lib/activity-client";

// POS-style build configurator components
import AICommandBar, { type AiResultUnit } from "@/components/build/AICommandBar";
import ProductTilesGrid, { type DrawerType } from "@/components/build/ProductTilesGrid";
import BestsellerDrawer from "@/components/build/BestsellerDrawer";
import CustomUnitDrawer from "@/components/build/CustomUnitDrawer";
import ShelvingDrawer from "@/components/build/ShelvingDrawer";
import OverheadDrawer from "@/components/build/OverheadDrawer";
import RaisedBedDrawer from "@/components/build/RaisedBedDrawer";
import CartBar from "@/components/build/CartBar";
import QuoteSuccessModal from "@/components/build/QuoteSuccessModal";
import type { UnitConfig as BuildUnitConfig } from "@/components/build/types";

const AssemblyGuide = lazy(() => import("@/components/visualizer/AssemblyGuide"));

// ═══════════════════════════════════════════════════════════════════════════
// Build Configurator — Estimate, Quote & New Build
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type UnitTypeOption = "standard" | "mini";
type InputMode = "wallFit" | "custom";

// Use the shared UnitConfig type (kept in sync across build components)
type UnitConfig = BuildUnitConfig;

export default function BuildConfiguratorPage() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();

  // Edit mode — when ?edit={leadId} is in the URL
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState("");

  // POS-style drawer coordination — only one open at a time
  const [activeDrawer, setActiveDrawer] = useState<DrawerType | null>(null);

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

  // Quote state (form is now in CartBar; success is QuoteSuccessModal)
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
  const [estimatedTax, setEstimatedTax] = useState<{ amount: number; rate: number; stateCode: string } | null>(null);

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
  // (tab state removed — unified build configurator)

  // AI Builder — units are added via handleAddAiUnits, called from AICommandBar
  async function handleAddAiUnits(unitsToAdd: AiResultUnit[]) {
    if (!unitsToAdd || unitsToAdd.length === 0) return;
    for (const unit of unitsToAdd) {
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
        const calculatedPrice = result.total * qty;
        // If server returns $0 (invalid config), fall back to customPrice
        if (calculatedPrice === 0 && hasCustomPrice) {
          setUnits((prev) => [...prev, {
            id: `ai-custom-${Date.now()}-${Math.random()}`,
            cols: 0, rows: 0, toteType: "HDX", unitType: "standard",
            hasTotes: false, hasWheels: false, hasTop: false,
            price: unit.customPrice!, totalW: 0, totalH: 0, depth: 0,
            desc: unit.description,
          }]);
          continue;
        }
        const desc = getRaisedBedDescription(rbConfig);
        const bed = RAISED_BED_SIZES.find((s) => s.id === rbConfig.sizeId);
        setUnits((prev) => [...prev, {
          id: `ai-rb-${Date.now()}-${Math.random()}`,
          cols: 0, rows: 0, toteType: "HDX", unitType: "standard",
          hasTotes: false, hasWheels: false, hasTop: false,
          price: calculatedPrice,
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

    // Visual feedback — briefly show "Added" then close drawer
    setPresetAdded(true);
    setTimeout(() => {
      setPresetAdded(false);
      setActiveDrawer(null);
    }, 900);
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
    setTimeout(() => {
      setOverheadAdded(false);
      setActiveDrawer(null);
    }, 900);
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
    setTimeout(() => {
      setShelvingAdded(false);
      setActiveDrawer(null);
    }, 900);
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
    setActiveDrawer(null);
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
    setActiveDrawer(null);
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

  // ── Estimated Sales Tax Preview ─────────────────────────────────────────
  // Recompute whenever ZIP or units change. Taxable amount = sum(unit.price),
  // which already excludes distance delivery fees and indoor delivery fees
  // (those are tracked separately and are tax-exempt). Cleanout/custom_service
  // items don't appear in this build flow's UnitConfig so no service-item
  // filter is needed here — server-side createQuote applies it as a safety net.
  useEffect(() => {
    const zip = deliveryZip.trim();
    if (!zip || !/^\d{5}$/.test(zip) || units.length === 0) {
      setEstimatedTax(null);
      return;
    }

    const taxable = units.reduce((sum, u) => sum + (u.price || 0), 0);

    let cancelled = false;
    getEstimatedSalesTax(taxable, zip, userId || undefined).then((result) => {
      if (cancelled) return;
      if (!result.stateCode || result.taxAmount <= 0) {
        setEstimatedTax(null);
        return;
      }
      setEstimatedTax({
        amount: result.taxAmount,
        rate: result.taxRate,
        stateCode: result.stateCode,
      });
    }).catch(() => {
      if (!cancelled) setEstimatedTax(null);
    });

    return () => { cancelled = true; };
  }, [deliveryZip, units]);

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
        {/* ── AI Command Center — top of POS layout ─────────────────────── */}
        <AICommandBar
          buildContext={{
            buildResult,
            units: units.map(u => ({ ...u, price: u.price ?? 0 })),
            materialBreakdown: displayMaterials ? { totalCost: displayMaterials.totalCost, items: displayMaterials.items, rawCounts: displayMaterials.rawCounts } : null,
            feeBreakdown,
            manifest: displayManifest,
            installerPricing,
            materialPrices,
            installerId: userId,
          }}
          onAddUnits={handleAddAiUnits}
        />

        {/* ── Product Tiles Grid ────────────────────────────────────────── */}
        <ProductTilesGrid
          installerPricing={installerPricing}
          onTileTap={(type) => setActiveDrawer(type)}
        />

        {/* ── Back Link ──────────────────────────────────────────────── */}
        <div className="pb-2 text-center">
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
          POS DRAWERS — one open at a time, triggered by tile tap
      ═══════════════════════════════════════════════════════════════════ */}
      <BestsellerDrawer
        isOpen={activeDrawer === "bestseller"}
        onClose={() => setActiveDrawer(null)}
        installerPricing={installerPricing}
        selectedPreset={selectedPreset}
        onSelectedPresetChange={setSelectedPreset}
        presetHasTotes={presetHasTotes}
        onPresetHasTotesChange={setPresetHasTotes}
        presetLoading={presetLoading}
        presetResult={presetResult}
        presetAdded={presetAdded}
        onAddPreset={handleAddPreset}
      />

      <CustomUnitDrawer
        isOpen={activeDrawer === "custom"}
        onClose={() => setActiveDrawer(null)}
        installerPricing={installerPricing}
        indoorDeliveryConfig={indoorDeliveryConfig}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        wallWidth={wallWidth}
        onWallWidthChange={setWallWidth}
        wallHeight={wallHeight}
        onWallHeightChange={setWallHeight}
        customCols={customCols}
        onCustomColsChange={setCustomCols}
        customRows={customRows}
        onCustomRowsChange={setCustomRows}
        toteType={toteType}
        onToteTypeChange={setToteType}
        orientation={orientation}
        onOrientationChange={setOrientation}
        unitType={unitType}
        onUnitTypeChange={setUnitType}
        hasTotes={hasTotes}
        onHasTotesChange={setHasTotes}
        hasWheels={hasWheels}
        onHasWheelsChange={setHasWheels}
        hasTop={hasTop}
        onHasTopChange={setHasTop}
        indoorDelivery={indoorDelivery}
        onIndoorDeliveryChange={setIndoorDelivery}
        calculating={calculating}
        calcError={calcError}
        buildResult={buildResult}
        onCalculate={handleCalculate}
        onAddUnit={handleAddUnit}
        onOpenAssemblyGuide={() => setShowAssemblyGuide(true)}
      />

      <ShelvingDrawer
        isOpen={activeDrawer === "shelving"}
        onClose={() => setActiveDrawer(null)}
        selectedShelving={selectedShelving}
        onSelectedShelvingChange={(id) => { setSelectedShelving(id); setShelvingAdded(false); }}
        shelvingPrice={shelvingPrice}
        shelvingLoading={shelvingLoading}
        shelvingAdded={shelvingAdded}
        onAddShelving={handleAddShelving}
      />

      <OverheadDrawer
        isOpen={activeDrawer === "overhead"}
        onClose={() => setActiveDrawer(null)}
        overheadPresetId={overheadPresetId}
        onOverheadPresetIdChange={(id) => { setOverheadPresetId(id); setOverheadAdded(false); }}
        overheadToteType={overheadToteType}
        onOverheadToteTypeChange={setOverheadToteType}
        overheadHasTotes={overheadHasTotes}
        onOverheadHasTotesChange={setOverheadHasTotes}
        overheadPrice={overheadPrice}
        overheadLoading={overheadLoading}
        overheadAdded={overheadAdded}
        onAddOverhead={handleAddOverhead}
      />

      <RaisedBedDrawer
        isOpen={activeDrawer === "raisedBed"}
        onClose={() => setActiveDrawer(null)}
        installerPricing={installerPricing}
        onAddRaisedBed={handleAddRaisedBed}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY CART BAR — bottom of screen
      ═══════════════════════════════════════════════════════════════════ */}
      <CartBar
        units={units}
        grandTotal={grandTotal}
        onRemoveUnit={handleRemoveUnit}
        onToggleIndoorDelivery={(idx, enabled) => {
          setUnits((prev) =>
            prev.map((p, i) =>
              i === idx
                ? {
                    ...p,
                    indoorDelivery: enabled,
                    indoorDeliveryFee: indoorDeliveryConfig?.fee,
                  }
                : p
            )
          );
        }}
        indoorDeliveryConfig={indoorDeliveryConfig}
        editingLeadId={editingLeadId}
        editingCustomerName={editingCustomerName}
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
        customerEmail={customerEmail}
        onCustomerEmailChange={setCustomerEmail}
        customerPhone={customerPhone}
        onCustomerPhoneChange={setCustomerPhone}
        deliveryZip={deliveryZip}
        onDeliveryZipChange={setDeliveryZip}
        zipCheckStatus={zipCheckStatus}
        zipCoveringName={zipCoveringName}
        deliveryFeeResult={deliveryFeeResult}
        quoteDiscountCode={quoteDiscountCode}
        onQuoteDiscountCodeChange={setQuoteDiscountCode}
        showDeliveryAddress={showDeliveryAddress}
        onShowDeliveryAddressChange={setShowDeliveryAddress}
        deliveryLine1={deliveryLine1}
        onDeliveryLine1Change={setDeliveryLine1}
        deliveryLine2={deliveryLine2}
        onDeliveryLine2Change={setDeliveryLine2}
        deliveryCity={deliveryCity}
        onDeliveryCityChange={setDeliveryCity}
        deliveryState={deliveryState}
        onDeliveryStateChange={setDeliveryState}
        onSendQuote={handleSendQuote}
        onGetLink={handleGetLink}
        onUpdateQuote={handleUpdateQuote}
        quoteSending={quoteSending}
        quoteError={quoteError}
        displayPrice={displayPrice}
        displayMaterials={displayMaterials}
        feeBreakdown={feeBreakdown}
        materialPrices={materialPrices}
        estimatedTax={estimatedTax}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          QUOTE SUCCESS MODAL — shown after successful create/update
      ═══════════════════════════════════════════════════════════════════ */}
      <QuoteSuccessModal
        isOpen={quoteSent}
        onClose={resetQuoteModal}
        editingLeadId={editingLeadId}
        quoteLeadId={quoteLeadId}
        quoteReferralStatus={quoteReferralStatus}
        quoteCoveringName={quoteCoveringName}
        customerEmail={customerEmail}
      />


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

      {/* BuildAssistant FAB removed — assistant integrated into AI Command Center */}
    </div>
  );
}

