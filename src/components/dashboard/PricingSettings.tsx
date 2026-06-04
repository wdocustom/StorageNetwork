"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DollarSign,
  Loader2,
  RotateCcw,
  Save,
  CheckCircle2,
  Info,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  PanelLeft,
  Wrench,
  Minus,
  Layers,
  Paintbrush,
} from "lucide-react";
import {
  getInstallerPricing,
  updateInstallerPricing,
  resetInstallerPricing,
} from "@/app/actions/pricing";
import type { InstallerPricing, AddonPricing } from "@/types/viewModels";
import { getPlatformDefaults } from "@/app/actions/platform-defaults";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";

// ═══════════════════════════════════════════════════════════════════════════
// Pricing Settings — Pro installer custom pricing configuration
// ═══════════════════════════════════════════════════════════════════════════

interface PricingSettingsProps {
  userId: string;
  embedded?: boolean;
}

type PricingNumericKey = Exclude<keyof InstallerPricing, "totes_disabled" | "mini_disabled" | "mini_enabled" | "open_shelving_disabled" | "open_shelving_enabled" | "overhead_storage_enabled" | "raised_bed_enabled" | "adirondack_chair_enabled" | "bestseller_indiana_joe_disabled" | "bestseller_long_ranger_disabled" | "bestseller_gas_station_disabled" | "bestseller_rack_city_roller_disabled" | "bestseller_mayor_of_rack_city_disabled" | "addon_pricing">;

interface PriceField {
  key: PricingNumericKey;
  label: string;
  description: string;
  defaultValue: number;
  /** When true, the default is computed dynamically from the installer's
   *  slot/plywood pricing and shown as "Auto" when empty. */
  dynamicDefault?: boolean;
  category: "standard" | "mini" | "addons" | "bestsellers" | "shelving" | "overhead" | "raised_beds_elevated" | "raised_beds_ground" | "raised_beds_addons" | "chairs";
}

/**
 * Compute the platform-default total price for a bestseller preset (with totes).
 * Total = (slots × slot_price) + (slots × tote_price) + (top_sheets × plywood) + wheels.
 * Uses platform defaults for the calculation.
 */
function computePresetDefaultTotal(presetId: string, defs: typeof EMPTY_DEFAULTS): number {
  const preset = BESTSELLER_PRESETS.find((p) => p.id === presetId);
  if (!preset) return 0;

  let totalSlots = 0;
  let totalTopSheets = 0;
  let totalWheelsCost = 0;
  const slotPrice = preset.unitType === "mini"
    ? defs.mini_slot
    : defs.standard_slot;
  const totePrice = preset.unitType === "mini"
    ? defs.mini_tote
    : preset.toteColor === "clear"
      ? defs.standard_tote_clear
      : defs.standard_tote;
  const wheelsPrice = preset.unitType === "mini"
    ? defs.mini_wheels
    : defs.standard_wheels;

  for (const unit of preset.units) {
    const slots = unit.cols * unit.rows;
    totalSlots += slots;

    if (unit.hasTop) {
      totalTopSheets += 1;
    }
    if (unit.hasWheels) {
      totalWheelsCost += wheelsPrice;
    }
  }

  return totalSlots * slotPrice
    + totalSlots * totePrice
    + totalTopSheets * defs.plywood_top
    + totalWheelsCost;
}

function getPriceFields(defs: typeof EMPTY_DEFAULTS): PriceField[] { return [
  // Standard unit pricing
  {
    key: "standard_slot",
    label: "Standard Slot",
    description: "Per tote slot (27-gal unit)",
    defaultValue: defs.standard_slot,
    category: "standard",
  },
  {
    key: "standard_tote",
    label: "Standard Tote (Black)",
    description: "Per HDX black/yellow tote",
    defaultValue: defs.standard_tote,
    category: "standard",
  },
  {
    key: "standard_tote_clear",
    label: "Standard Tote (Clear)",
    description: "Per HDX clear/yellow tote",
    defaultValue: defs.standard_tote_clear,
    category: "standard",
  },
  // Mini unit pricing
  {
    key: "mini_slot",
    label: "Mini Slot",
    description: "Per tote slot (6.5-qt unit)",
    defaultValue: defs.mini_slot,
    category: "mini",
  },
  {
    key: "mini_tote",
    label: "Mini Tote",
    description: "Per 6.5-qt shoebox tote",
    defaultValue: defs.mini_tote,
    category: "mini",
  },
  // Add-on pricing
  {
    key: "standard_wheels",
    label: "Standard Wheels",
    description: "Caster set (standard unit)",
    defaultValue: defs.standard_wheels,
    category: "addons",
  },
  {
    key: "mini_wheels",
    label: "Mini Wheels",
    description: "Caster set (mini unit)",
    defaultValue: defs.mini_wheels,
    category: "addons",
  },
  {
    key: "plywood_top",
    label: "Plywood Top",
    description: "Per 4×8 sheet",
    defaultValue: defs.plywood_top,
    category: "addons",
  },
  // Bestseller total-price overrides (with totes included)
  ...BESTSELLER_PRESETS.map((preset) => {
    const key = `bestseller_${preset.id.replace(/-/g, "_")}` as PricingNumericKey;
    const totalSlots = preset.units.reduce((s, u) => s + u.cols * u.rows, 0);
    return {
      key,
      label: preset.name,
      description: `Total price with ${totalSlots} totes (platform default: $${defs.bestsellers[key] ?? computePresetDefaultTotal(preset.id, defs)})`,
      defaultValue: defs.bestsellers[key] ?? computePresetDefaultTotal(preset.id, defs),
      category: "bestsellers" as const,
    };
  }),
  // Open Shelving unit price overrides
  ...SHELVING_CONFIGS.map((cfg) => {
    const key = `shelving_${cfg.id.replace(/-/g, "_")}` as PricingNumericKey;
    const heightLabel = cfg.height === "tall" ? "Tall" : "Short";
    const shelfText = cfg.shelves === 1 ? "1 shelf + top" : `${cfg.shelves} shelves + top`;
    const defaultPrice = defs.shelving[key] ?? 0;
    return {
      key,
      label: `${cfg.widthFt}' × ${heightLabel}`,
      description: `${cfg.widthIn}" wide, ${shelfText} (platform default: $${defaultPrice})`,
      defaultValue: defaultPrice,
      category: "shelving" as const,
    };
  }),
  // Overhead Ceiling Tote Rail price overrides
  ...OVERHEAD_GRID_PRESETS.map((preset) => {
    const key = `overhead_${preset.id}` as PricingNumericKey;
    const defaultPrice = defs.overhead[key] ?? 0;
    return {
      key,
      label: `${preset.label} grid`,
      description: `${preset.toteCount} totes (platform default: $${defaultPrice})`,
      defaultValue: defaultPrice,
      category: "overhead" as const,
    };
  }),
  // Raised Bed Planter base price overrides — elevated
  ...RAISED_BED_SIZES.filter((b) => b.style === "with_legs").map((bed) => {
    const key = `raised_bed_${bed.id}` as PricingNumericKey;
    const defaultPrice = defs.raisedBeds[key] ?? 0;
    return {
      key,
      label: `${bed.widthIn}"×${bed.lengthIn}" ${bed.hasStringLightPost ? "+ Post" : ""} ${bed.heightIn}"H`,
      description: `Elevated (platform default: $${defaultPrice})`,
      defaultValue: defaultPrice,
      category: "raised_beds_elevated" as const,
    };
  }),
  // Raised Bed Planter base price overrides — ground-level
  ...RAISED_BED_SIZES.filter((b) => b.style === "without_legs").map((bed) => {
    const key = `raised_bed_${bed.id}` as PricingNumericKey;
    const defaultPrice = defs.raisedBeds[key] ?? 0;
    return {
      key,
      label: `${bed.widthIn}"×${bed.lengthIn}" ${bed.heightIn}"H`,
      description: `Ground-level (platform default: $${defaultPrice})`,
      defaultValue: defaultPrice,
      category: "raised_beds_ground" as const,
    };
  }),
  // Raised Bed Addon overrides
  {
    key: "raised_bed_stain_addon" as PricingNumericKey,
    label: "Cedar Stain",
    description: `Add-on price for stain finish (default: $${defs.raisedBedAddons.raised_bed_stain_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_stain_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_liner_addon" as PricingNumericKey,
    label: "Landscape Liner",
    description: `Add-on price for landscape liner (default: $${defs.raisedBedAddons.raised_bed_liner_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_liner_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_paint_white_addon" as PricingNumericKey,
    label: "Painted White",
    description: `Add-on price for painted white finish (default: $${defs.raisedBedAddons.raised_bed_paint_white_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_paint_white_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_depth_increase_addon" as PricingNumericKey,
    label: "Depth Increase to 12\"",
    description: `Add-on for deeper planting area (default: $${defs.raisedBedAddons.raised_bed_depth_increase_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_depth_increase_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_bottom_shelf_addon" as PricingNumericKey,
    label: "Bottom Shelf",
    description: `Add-on for bottom storage shelf on tall beds (default: $${defs.raisedBedAddons.raised_bed_bottom_shelf_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_bottom_shelf_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_post_72_addon" as PricingNumericKey,
    label: "6' Cedar Post",
    description: `Add-on for 6' post on elevated beds (default: $${defs.raisedBedAddons.raised_bed_post_72_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_post_72_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_post_84_addon" as PricingNumericKey,
    label: "7' Cedar Post",
    description: `Add-on for 7' post on elevated beds (default: $${defs.raisedBedAddons.raised_bed_post_84_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_post_84_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_post_96_addon" as PricingNumericKey,
    label: "8' Cedar Post",
    description: `Add-on for 8' post on elevated beds (default: $${defs.raisedBedAddons.raised_bed_post_96_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_post_96_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_hook_addon" as PricingNumericKey,
    label: "Post Hook",
    description: `Add-on hook for hanging plants from post (default: $${defs.raisedBedAddons.raised_bed_hook_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_hook_addon,
    category: "raised_beds_addons" as const,
  },
  {
    key: "raised_bed_high_wind_weighted_addon" as PricingNumericKey,
    label: "High-Wind Weighted Kit",
    description: `Base anchor kit for windy sites — elevated planters only (default: $${defs.raisedBedAddons.raised_bed_high_wind_weighted_addon})`,
    defaultValue: defs.raisedBedAddons.raised_bed_high_wind_weighted_addon,
    category: "raised_beds_addons" as const,
  },
  // Adirondack Chair base price override
  {
    key: "adirondack_chair" as PricingNumericKey,
    label: "Low Boy Adirondack Chair",
    description: "Base price per chair (platform default: $265)",
    defaultValue: 265,
    category: "chairs" as const,
  },
]; }

/** Row component for each addon type — toggle + price input */
function AddonPricingRow({
  icon,
  label,
  description,
  defaultPrice,
  value,
  enabled,
  onValueChange,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  priceKey: string;
  toggleKey: string;
  defaultPrice: number;
  value: string;
  enabled: boolean;
  onValueChange: (v: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className={`mt-2 flex items-center gap-3 rounded-lg border p-3 transition-all ${
      enabled ? "border-slate-700 bg-slate-800/30" : "border-slate-700/50 bg-slate-900/50 opacity-50"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0"
        title={enabled ? `Disable ${label}` : `Enable ${label}`}
      >
        <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-yellow-400" : "bg-slate-600"}`}>
          <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </div>
      </button>
      <div className="flex items-center gap-2">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-stone-500">{description}</p>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-500">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onValueChange(v);
          }}
          placeholder={String(defaultPrice)}
          disabled={!enabled}
          className="w-20 rounded-lg border border-slate-600 bg-slate-800 py-2 pl-6 pr-2 text-right text-sm font-medium text-white placeholder-stone-600 outline-none focus:border-yellow-400 disabled:opacity-50"
        />
      </div>
    </div>
  );
}

// Fallback defaults (used only while server defaults are loading — never exposed in production bundle as pricing)
const EMPTY_DEFAULTS = {
  standard_slot: 0, mini_slot: 0, standard_tote: 0, standard_tote_clear: 0,
  mini_tote: 0, standard_wheels: 0, mini_wheels: 0, plywood_top: 0,
  addon: { plywood_door: 0, side_panel: 0, concealed_hinge_pair: 0, rail_removal: 0, shelf: 0, paint_frame_price: 0, paint_doors_panels_price: 0 },
  bestsellers: {} as Record<string, number>,
  shelving: {} as Record<string, number>,
  overhead: {} as Record<string, number>,
  raisedBeds: {} as Record<string, number>,
  raisedBedAddons: {
    raised_bed_stain_addon: 0, raised_bed_liner_addon: 0, raised_bed_paint_white_addon: 0,
    raised_bed_depth_increase_addon: 0, raised_bed_bottom_shelf_addon: 0,
    raised_bed_post_72_addon: 0, raised_bed_post_84_addon: 0, raised_bed_post_96_addon: 0,
    raised_bed_hook_addon: 0, raised_bed_high_wind_weighted_addon: 0,
  },
};

export default function PricingSettings({ userId, embedded }: PricingSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [defaults, setDefaults] = useState(EMPTY_DEFAULTS);
  const PRICE_FIELDS = getPriceFields(defaults);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Each field can be: a custom number string, or empty (use default)
  const [values, setValues] = useState<Record<string, string>>({});
  const [miniEnabled, setMiniEnabled] = useState(false);
  const [shelvingEnabled, setShelvingEnabled] = useState(false);
  const [overheadEnabled, setOverheadEnabled] = useState(false);
  const [raisedBedEnabled, setRaisedBedEnabled] = useState(false);
  const [chairEnabled, setChairEnabled] = useState(false);
  const [totesDisabled, setTotesDisabled] = useState(false);
  const [use2x4Rails, setUse2x4Rails] = useState(false);
  const [presetToggles, setPresetToggles] = useState<Record<string, boolean>>({});

  // ── Collapsible pricing categories ──────────────────────────────────
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // ── Organizer Customization (addon pricing) state ──────────────────
  const [addonExpanded, setAddonExpanded] = useState(false);
  const [addonEnabled, setAddonEnabled] = useState(true);
  const [addonValues, setAddonValues] = useState<Record<string, string>>({});
  const [addonToggles, setAddonToggles] = useState<Record<string, boolean>>({
    plywood_door_enabled: true,
    side_panel_enabled: true,
    hinge_concealed_enabled: true,
    rail_removal_enabled: true,
    shelf_enabled: true,
    paint_enabled: true,
  });

  // ── Auto-save: debounced save on any state change ──────────────────
  const initialLoadDone = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialLoadDone.current) return; // Skip until first load completes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 800); // 800ms debounce
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, miniEnabled, shelvingEnabled, overheadEnabled, raisedBedEnabled, chairEnabled, totesDisabled, use2x4Rails, presetToggles, addonEnabled, addonValues, addonToggles]);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    // Load platform defaults from server (never in client bundle)
    const platformDefs = await getPlatformDefaults();
    setDefaults(platformDefs);
    const result = await getInstallerPricing(userId);
    if (result.success && result.pricing) {
      const loaded: Record<string, string> = {};
      for (const field of PRICE_FIELDS) {
        const val = result.pricing[field.key];
        loaded[field.key] = val !== undefined && val !== null ? String(val) : "";
      }
      setValues(loaded);
      setTotesDisabled(result.pricing.totes_disabled === true);
      setUse2x4Rails(result.pricing.use_2x4_rails === true);
      setMiniEnabled(result.pricing.mini_enabled === true);
      setShelvingEnabled(result.pricing.open_shelving_enabled === true);
      setOverheadEnabled(result.pricing.overhead_storage_enabled === true);
      setRaisedBedEnabled(result.pricing.raised_bed_enabled === true);
      setChairEnabled(result.pricing.adirondack_chair_enabled === true);
      setPresetToggles({
        indiana_joe: result.pricing.bestseller_indiana_joe_disabled !== true,
        long_ranger: result.pricing.bestseller_long_ranger_disabled !== true,
        gas_station: result.pricing.bestseller_gas_station_disabled !== true,
      });

      // Load addon pricing
      const ap = result.pricing.addon_pricing;
      if (ap) {
        setAddonEnabled(ap.organizer_customization_enabled !== false);
        const loadedAddon: Record<string, string> = {};
        for (const k of ["plywood_door", "side_panel", "concealed_hinge_pair", "rail_removal", "shelf", "paint_frame_price", "paint_doors_panels_price"] as const) {
          const v = ap[k];
          loadedAddon[k] = v !== undefined && v !== null ? String(v) : "";
        }
        setAddonValues(loadedAddon);
        setAddonToggles({
          plywood_door_enabled: ap.plywood_door_enabled !== false,
          side_panel_enabled: ap.side_panel_enabled !== false,
          hinge_concealed_enabled: ap.hinge_concealed_enabled !== false,
          rail_removal_enabled: ap.rail_removal_enabled !== false,
          shelf_enabled: ap.shelf_enabled !== false,
          paint_enabled: ap.paint_enabled !== false,
        });
      }
    }
    setLoading(false);
    // Mark initial load complete so auto-save doesn't fire on mount
    setTimeout(() => { initialLoadDone.current = true; }, 100);
  }, [userId]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  function handleChange(key: string, val: string) {
    // Allow empty (revert to default), or numeric input
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setValues((prev) => ({ ...prev, [key]: val }));
      setMessage("");
    }
  }

  function handleAddonChange(key: string, val: string) {
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setAddonValues((prev) => ({ ...prev, [key]: val }));
      setMessage("");
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const pricing: InstallerPricing = {};
    for (const field of PRICE_FIELDS) {
      const val = values[field.key];
      if (val !== undefined && val !== "") {
        (pricing as Record<string, number>)[field.key] = Number(val);
      }
    }
    if (totesDisabled) pricing.totes_disabled = true;
    if (use2x4Rails) pricing.use_2x4_rails = true;
    if (miniEnabled) pricing.mini_enabled = true;
    if (shelvingEnabled) pricing.open_shelving_enabled = true;
    if (overheadEnabled) pricing.overhead_storage_enabled = true;
    if (raisedBedEnabled) pricing.raised_bed_enabled = true;
    if (chairEnabled) pricing.adirondack_chair_enabled = true;
    if (presetToggles.indiana_joe === false) pricing.bestseller_indiana_joe_disabled = true;
    if (presetToggles.long_ranger === false) pricing.bestseller_long_ranger_disabled = true;
    if (presetToggles.gas_station === false) pricing.bestseller_gas_station_disabled = true;

    // Build addon_pricing
    const addonPricing: AddonPricing = {
      organizer_customization_enabled: addonEnabled,
      ...addonToggles,
    } as AddonPricing;
    for (const k of ["plywood_door", "side_panel", "concealed_hinge_pair", "rail_removal", "shelf", "paint_frame_price", "paint_doors_panels_price"] as const) {
      const v = addonValues[k];
      if (v !== undefined && v !== "") {
        (addonPricing as Record<string, unknown>)[k] = Number(v);
      }
    }
    pricing.addon_pricing = addonPricing;

    const result = await updateInstallerPricing(userId, pricing);
    if (result.success) {
      setMessage("Pricing saved successfully!");
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } else {
      setMessage(result.error || "Failed to save pricing.");
      setMessageType("error");
    }
    setSaving(false);
  }

  async function handleReset() {
    setResetting(true);
    setMessage("");

    const result = await resetInstallerPricing(userId);
    if (result.success) {
      // Clear all custom values
      const cleared: Record<string, string> = {};
      for (const field of PRICE_FIELDS) {
        cleared[field.key] = "";
      }
      setValues(cleared);
      setMiniEnabled(false);
      setShelvingEnabled(false);
      setOverheadEnabled(false);
      setRaisedBedEnabled(false);
      setChairEnabled(false);
      setPresetToggles({});
      setAddonEnabled(true);
      setAddonValues({});
      setAddonToggles({
        plywood_door_enabled: true,
        side_panel_enabled: true,
        hinge_concealed_enabled: true,
        rail_removal_enabled: true,
        shelf_enabled: true,
        paint_enabled: true,
      });
      setMessage("Pricing reset to platform defaults.");
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } else {
      setMessage(result.error || "Failed to reset pricing.");
      setMessageType("error");
    }
    setResetting(false);
  }

  function hasCustomValues(): boolean {
    return miniEnabled
      || shelvingEnabled
      || overheadEnabled
      || raisedBedEnabled
      || chairEnabled
      || Object.values(presetToggles).some((v) => v === false)
      || PRICE_FIELDS.some((f) => values[f.key] !== undefined && values[f.key] !== "")
      || !addonEnabled
      || Object.values(addonToggles).some((v) => !v)
      || Object.values(addonValues).some((v) => v !== undefined && v !== "");
  }

  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    ) : (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
        </div>
      </section>
    );
  }

  const categories: { key: string; label: string; hint?: string; fields: PriceField[] }[] = [
    {
      key: "standard",
      label: "Standard Unit (27 Gal)",
      fields: PRICE_FIELDS.filter((f) => f.category === "standard"),
    },
    {
      key: "mini",
      label: "Mini Unit (6.5 Qt)",
      fields: PRICE_FIELDS.filter((f) => f.category === "mini"),
    },
    {
      key: "addons",
      label: "Add-Ons",
      fields: PRICE_FIELDS.filter((f) => f.category === "addons"),
    },
    {
      key: "bestsellers",
      label: "Bestseller Presets",
      hint: "Set a total price for each bestseller (totes included). Customers can remove totes — your tote rate is subtracted. Leave empty to use the platform default price.",
      fields: PRICE_FIELDS.filter((f) => f.category === "bestsellers"),
    },
    {
      key: "shelving",
      label: "Open Shelving Units",
      hint: "Set a total price for each shelving configuration (plywood shelves + top included). Leave empty to use the platform default.",
      fields: PRICE_FIELDS.filter((f) => f.category === "shelving"),
    },
    {
      key: "overhead",
      label: "Overhead Ceiling Storage",
      hint: "Set a base price for each overhead storage size. Drop height and deck type adjustments are applied on top. Leave empty for platform default.",
      fields: PRICE_FIELDS.filter((f) => f.category === "overhead"),
    },
    {
      key: "raised_beds_elevated",
      label: "Raised Beds — Elevated (with legs)",
      hint: "Base price for each elevated planter size. Leave empty to use platform defaults.",
      fields: PRICE_FIELDS.filter((f) => f.category === "raised_beds_elevated"),
    },
    {
      key: "raised_beds_ground",
      label: "Raised Beds — Ground-Level",
      hint: "Base price for each ground-level planter size. Leave empty to use platform defaults.",
      fields: PRICE_FIELDS.filter((f) => f.category === "raised_beds_ground"),
    },
    {
      key: "raised_beds_addons",
      label: "Raised Bed Add-Ons",
      hint: "Override add-on prices for stain, liner, paint, depth increase, and bottom shelf.",
      fields: PRICE_FIELDS.filter((f) => f.category === "raised_beds_addons"),
    },
    {
      key: "chairs",
      label: "Adirondack Chair",
      hint: "Set your price per chair. Leave empty to use the platform default ($265).",
      fields: PRICE_FIELDS.filter((f) => f.category === "chairs"),
    },
  ];

  const body = (
    <>
      {/* Info Banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
        <p className="text-xs leading-relaxed text-stone-400">
          Set your own customer-facing prices. Leave a field empty to use the
          platform default. Your pricing is shown to customers on your branded
          design page.
        </p>
      </div>

      {/* Global Totes Disabled Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setTotesDisabled(!totesDisabled)}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-all ${
            totesDisabled
              ? "border-red-500/30 bg-red-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className="text-left">
            <p className={`text-xs font-bold ${totesDisabled ? "text-red-400" : "text-stone-400"}`}>
              Frame Only — No Totes
            </p>
            <p className="text-[10px] text-stone-600">
              {totesDisabled ? "Totes are disabled. Customers will not see tote options." : "Toggle on to build frame-only units without totes."}
            </p>
          </div>
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${totesDisabled ? "bg-red-400" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${totesDisabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </button>
      </div>

      {/* 2x4 Rail Construction Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setUse2x4Rails(!use2x4Rails)}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 transition-all ${
            use2x4Rails
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className="text-left">
            <p className={`text-xs font-bold ${use2x4Rails ? "text-yellow-400" : "text-stone-400"}`}>
              2x4 Rail Construction
            </p>
            <p className="text-[10px] text-stone-600">
              {use2x4Rails ? "Using ripped 2x4 rails. 21\" universal openings. Tote type is not relevant." : "Toggle on to use ripped 2x4 rails instead of plywood strips."}
            </p>
          </div>
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${use2x4Rails ? "bg-yellow-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${use2x4Rails ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </button>
      </div>

      {/* Mini Tote Toggle */}
      {!totesDisabled && <div className="mb-5">
        <button
          type="button"
          onClick={() => setMiniEnabled(!miniEnabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            miniEnabled
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${miniEnabled ? "bg-yellow-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${miniEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className={`h-3.5 w-3.5 ${miniEnabled ? "text-yellow-400" : "text-stone-500"}`} />
              <p className={`text-sm font-medium ${miniEnabled ? "text-yellow-400" : "text-white"}`}>
                {miniEnabled ? "Mini Units Enabled" : "Enable Mini Units"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {miniEnabled
                ? "6.5 qt mini tote option is visible on your design page"
                : "Toggle to offer the mini (6.5 qt) tote option to customers"}
            </p>
          </div>
        </button>
      </div>}

      {/* Open Shelving Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShelvingEnabled(!shelvingEnabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            shelvingEnabled
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${shelvingEnabled ? "bg-yellow-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${shelvingEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className={`h-3.5 w-3.5 ${shelvingEnabled ? "text-yellow-400" : "text-stone-500"}`} />
              <p className={`text-sm font-medium ${shelvingEnabled ? "text-yellow-400" : "text-white"}`}>
                {shelvingEnabled ? "Open Shelving Enabled" : "Enable Open Shelving"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {shelvingEnabled
                ? "Open shelving options are visible on your design & build pages"
                : "Toggle to offer open shelving options to customers"}
            </p>
          </div>
        </button>
      </div>

      {/* Overhead Storage Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setOverheadEnabled(!overheadEnabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            overheadEnabled
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${overheadEnabled ? "bg-yellow-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${overheadEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className={`h-3.5 w-3.5 ${overheadEnabled ? "text-yellow-400" : "text-stone-500"}`} />
              <p className={`text-sm font-medium ${overheadEnabled ? "text-yellow-400" : "text-white"}`}>
                {overheadEnabled ? "Overhead Storage Enabled" : "Enable Overhead Storage"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {overheadEnabled
                ? "Ceiling-mounted storage options are visible on your design page"
                : "Toggle to offer overhead ceiling storage to customers"}
            </p>
          </div>
        </button>
      </div>

      {/* Raised Bed Planter Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setRaisedBedEnabled(!raisedBedEnabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            raisedBedEnabled
              ? "border-yellow-500/30 bg-yellow-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${raisedBedEnabled ? "bg-yellow-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${raisedBedEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className={`h-3.5 w-3.5 ${raisedBedEnabled ? "text-yellow-400" : "text-stone-500"}`} />
              <p className={`text-sm font-medium ${raisedBedEnabled ? "text-yellow-400" : "text-white"}`}>
                {raisedBedEnabled ? "Raised Bed Planters Enabled" : "Enable Raised Bed Planters"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {raisedBedEnabled
                ? "Handmade cedar planter options are visible on your design page"
                : "Toggle to offer raised bed planters to customers"}
            </p>
          </div>
        </button>
      </div>

      <div className="mb-5">
        <button
          type="button"
          onClick={() => setChairEnabled(!chairEnabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            chairEnabled
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${chairEnabled ? "bg-amber-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${chairEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium ${chairEnabled ? "text-amber-400" : "text-white"}`}>
                {chairEnabled ? "Adirondack Chair Enabled" : "Enable Adirondack Chair"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {chairEnabled
                ? "Low Boy Adirondack Chair is available on your build page"
                : "Toggle to add the Adirondack Chair to your build menu"}
            </p>
          </div>
        </button>
      </div>

      {/* Pricing Categories — collapsible */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const isCatDisabled =
            (cat.key === "mini" && !miniEnabled) ||
            (cat.key === "shelving" && !shelvingEnabled) ||
            (cat.key === "overhead" && !overheadEnabled) ||
            (cat.key.startsWith("raised_beds") && !raisedBedEnabled) ||
            (cat.key === "chairs" && !chairEnabled);
          const isExpanded = expandedCategory === cat.key;
          const hasCustom = cat.fields.some((f) => values[f.key] !== undefined && values[f.key] !== "");

          return (
            <div key={cat.key} className={isCatDisabled ? "opacity-40 pointer-events-none" : ""}>
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    {cat.label}
                  </h3>
                  {hasCustom && (
                    <span className="rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[8px] font-bold text-yellow-400">Custom</span>
                  )}
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-stone-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <div className="mt-2 space-y-2 pb-2">
                  {cat.hint && (
                    <p className="text-[11px] leading-relaxed text-stone-600 px-1">
                      {cat.hint}
                    </p>
                  )}
              <div className="space-y-2">
                {cat.fields.map((field) => {
                  // For bestsellers, extract the preset id for toggle
                  const presetId = cat.key === "bestsellers"
                    ? field.key.replace("bestseller_", "")
                    : null;
                  const isPresetDisabled = presetId ? presetToggles[presetId] === false : false;

                  return (
                    <div
                      key={field.key}
                      className={`flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3 transition-all ${isPresetDisabled ? "opacity-40" : ""}`}
                    >
                      {/* Per-bestseller toggle */}
                      {presetId && (
                        <button
                          type="button"
                          onClick={() => setPresetToggles((prev) => ({ ...prev, [presetId]: prev[presetId] === false ? true : false }))}
                          className="shrink-0"
                          title={isPresetDisabled ? `Enable ${field.label}` : `Disable ${field.label}`}
                        >
                          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${isPresetDisabled ? "bg-red-500" : "bg-emerald-500"}`}>
                            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${isPresetDisabled ? "translate-x-0.5" : "translate-x-4"}`} />
                          </div>
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {field.label}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {field.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={values[field.key] ?? ""}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.dynamicDefault ? "Auto" : String(field.defaultValue)}
                            disabled={isPresetDisabled}
                            className="w-24 rounded-lg border border-slate-600 bg-slate-800 py-2 pl-6 pr-2 text-right text-sm font-medium text-white placeholder-stone-600 outline-none focus:border-yellow-400 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Organizer Customization (Section Addons) ──────────────── */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setAddonExpanded(!addonExpanded)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left transition-colors hover:bg-slate-800"
        >
          <Wrench className="h-4 w-4 text-yellow-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Organizer Customization</p>
            <p className="text-[11px] text-stone-500">
              Doors, side panels, hinges &amp; rail removal add-ons
            </p>
          </div>
          {addonExpanded ? (
            <ChevronUp className="h-4 w-4 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </button>

        {addonExpanded && (
          <div className="mt-3 space-y-4 rounded-lg border border-slate-700 bg-slate-800/20 p-4">
            {/* Master toggle */}
            <button
              type="button"
              onClick={() => setAddonEnabled(!addonEnabled)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                !addonEnabled
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${addonEnabled ? "bg-emerald-500" : "bg-slate-600"}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${addonEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${addonEnabled ? "text-emerald-400" : "text-red-400"}`}>
                  {addonEnabled ? "Customization Enabled" : "Customization Disabled"}
                </p>
                <p className="text-[11px] text-stone-500">
                  {addonEnabled
                    ? "Customers can add doors, panels & hinges on your design page"
                    : "The entire Organizer Customization section is hidden from customers"}
                </p>
              </div>
            </button>

            {/* Per-addon items (greyed out when master is disabled) */}
            <div className={!addonEnabled ? "opacity-40 pointer-events-none" : ""}>
              {/* Plywood Door — per-door price (installer-facing) */}
              <AddonPricingRow
                icon={<DoorOpen className="h-4 w-4 text-amber-400" />}
                label="Plywood Door"
                description="Per door (full-height column door w/ Blum concealed hinges)"
                priceKey="plywood_door"
                toggleKey="plywood_door_enabled"
                defaultPrice={defaults.addon.plywood_door}
                value={addonValues.plywood_door ?? ""}
                enabled={addonToggles.plywood_door_enabled}
                onValueChange={(v) => handleAddonChange("plywood_door", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, plywood_door_enabled: !prev.plywood_door_enabled }))}
              />

              {/* Side Panel */}
              <AddonPricingRow
                icon={<PanelLeft className="h-4 w-4 text-blue-400" />}
                label="Side Panel"
                description="Per plywood side panel (left or right)"
                priceKey="side_panel"
                toggleKey="side_panel_enabled"
                defaultPrice={defaults.addon.side_panel}
                value={addonValues.side_panel ?? ""}
                enabled={addonToggles.side_panel_enabled}
                onValueChange={(v) => handleAddonChange("side_panel", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, side_panel_enabled: !prev.side_panel_enabled }))}
              />

              {/* Blum Concealed Hinge Pair */}
              <AddonPricingRow
                icon={<Wrench className="h-4 w-4 text-slate-400" />}
                label="Concealed Hinge Pair"
                description="Per pair of Blum concealed hinges (included in door price for customers)"
                priceKey="concealed_hinge_pair"
                toggleKey="hinge_concealed_enabled"
                defaultPrice={defaults.addon.concealed_hinge_pair}
                value={addonValues.concealed_hinge_pair ?? ""}
                enabled={addonToggles.hinge_concealed_enabled}
                onValueChange={(v) => handleAddonChange("concealed_hinge_pair", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, hinge_concealed_enabled: !prev.hinge_concealed_enabled }))}
              />

              {/* Rail Removal */}
              <AddonPricingRow
                icon={<Minus className="h-4 w-4 text-red-400" />}
                label="Rail Removal"
                description="Per rail removed (credit or charge)"
                priceKey="rail_removal"
                toggleKey="rail_removal_enabled"
                defaultPrice={defaults.addon.rail_removal}
                value={addonValues.rail_removal ?? ""}
                enabled={addonToggles.rail_removal_enabled}
                onValueChange={(v) => handleAddonChange("rail_removal", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, rail_removal_enabled: !prev.rail_removal_enabled }))}
              />

              {/* Shelf */}
              <AddonPricingRow
                icon={<Layers className="h-4 w-4 text-blue-400" />}
                label="Plywood Shelf"
                description="Per shelf (3/4&quot; plywood sitting on rails)"
                priceKey="shelf"
                toggleKey="shelf_enabled"
                defaultPrice={defaults.addon.shelf}
                value={addonValues.shelf ?? ""}
                enabled={addonToggles.shelf_enabled}
                onValueChange={(v) => handleAddonChange("shelf", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, shelf_enabled: !prev.shelf_enabled }))}
              />

              {/* ── Paint Options ─────────────────────────────── */}
              <div className="mt-3 border-t border-slate-700/50 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Paintbrush className="h-4 w-4 text-rose-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Paint Options</p>
                  <div className="ml-auto flex gap-1">
                    {[
                      { hex: "#C8102E", label: "Red" },
                      { hex: "#F5F5F0", label: "White" },
                      { hex: "#1C1C1C", label: "Black" },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className="h-3.5 w-3.5 rounded-full border border-slate-600"
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-stone-600 mb-2">
                  Let customers paint their organizer in Red, White, or Black. Separate pricing for frame vs. doors &amp; panels.
                </p>
              </div>

              <AddonPricingRow
                icon={<Paintbrush className="h-4 w-4 text-rose-400" />}
                label="Paint — Frame"
                description="Price to paint the 2×4 frame structure"
                priceKey="paint_frame_price"
                toggleKey="paint_enabled"
                defaultPrice={defaults.addon.paint_frame_price}
                value={addonValues.paint_frame_price ?? ""}
                enabled={addonToggles.paint_enabled}
                onValueChange={(v) => handleAddonChange("paint_frame_price", v)}
                onToggle={() => setAddonToggles((prev) => ({ ...prev, paint_enabled: !prev.paint_enabled }))}
              />

              <AddonPricingRow
                icon={<Paintbrush className="h-4 w-4 text-blue-400" />}
                label="Paint — Doors & Panels"
                description="Price to paint plywood doors and side panels"
                priceKey="paint_doors_panels_price"
                toggleKey="paint_enabled"
                defaultPrice={defaults.addon.paint_doors_panels_price}
                value={addonValues.paint_doors_panels_price ?? ""}
                enabled={addonToggles.paint_enabled}
                onValueChange={(v) => handleAddonChange("paint_doors_panels_price", v)}
                onToggle={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Auto-save indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-stone-600">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
              <span className="text-yellow-400">Saving...</span>
            </>
          ) : message ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          ) : (
            <span>Changes save automatically</span>
          )}
        </div>
        {hasCustomValues() && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Reset to defaults
          </button>
        )}
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-yellow-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Custom Pricing
        </h2>
        <span className="ml-auto rounded-full bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
          Pro
        </span>
      </div>
      {body}
    </section>
  );
}
