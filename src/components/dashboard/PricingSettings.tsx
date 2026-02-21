"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  Loader2,
  RotateCcw,
  Save,
  CheckCircle2,
  Info,
  EyeOff,
} from "lucide-react";
import {
  getInstallerPricing,
  updateInstallerPricing,
  resetInstallerPricing,
} from "@/app/actions/pricing";
import { PLATFORM_DEFAULTS } from "@/types/viewModels";
import type { InstallerPricing } from "@/types/viewModels";
import { BESTSELLER_PRESETS } from "@/lib/presets";

// ═══════════════════════════════════════════════════════════════════════════
// Pricing Settings — Pro installer custom pricing configuration
// ═══════════════════════════════════════════════════════════════════════════

interface PricingSettingsProps {
  userId: string;
}

type PricingNumericKey = Exclude<keyof InstallerPricing, "mini_disabled">;

interface PriceField {
  key: PricingNumericKey;
  label: string;
  description: string;
  defaultValue: number;
  /** When true, the default is computed dynamically from the installer's
   *  slot/plywood pricing and shown as "Auto" when empty. */
  dynamicDefault?: boolean;
  category: "standard" | "mini" | "addons" | "bestsellers";
}

/**
 * Compute the platform-default total price for a bestseller preset (with totes).
 * Total = (slots × slot_price) + (slots × tote_price) + (top_sheets × plywood) + wheels.
 * Uses platform defaults for the calculation.
 */
function computePresetDefaultTotal(presetId: string): number {
  const preset = BESTSELLER_PRESETS.find((p) => p.id === presetId);
  if (!preset) return 0;

  let totalSlots = 0;
  let totalTopSheets = 0;
  let totalWheelsCost = 0;
  const slotPrice = preset.unitType === "mini"
    ? PLATFORM_DEFAULTS.mini_slot
    : PLATFORM_DEFAULTS.standard_slot;
  const totePrice = preset.unitType === "mini"
    ? PLATFORM_DEFAULTS.mini_tote
    : preset.toteColor === "clear"
      ? PLATFORM_DEFAULTS.standard_tote_clear
      : PLATFORM_DEFAULTS.standard_tote;
  const wheelsPrice = preset.unitType === "mini"
    ? PLATFORM_DEFAULTS.mini_wheels
    : PLATFORM_DEFAULTS.standard_wheels;

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
    + totalTopSheets * PLATFORM_DEFAULTS.plywood_top
    + totalWheelsCost;
}

const PRICE_FIELDS: PriceField[] = [
  // Standard unit pricing
  {
    key: "standard_slot",
    label: "Standard Slot",
    description: "Per tote slot (27-gal unit)",
    defaultValue: PLATFORM_DEFAULTS.standard_slot,
    category: "standard",
  },
  {
    key: "standard_tote",
    label: "Standard Tote (Black)",
    description: "Per HDX black/yellow tote",
    defaultValue: PLATFORM_DEFAULTS.standard_tote,
    category: "standard",
  },
  {
    key: "standard_tote_clear",
    label: "Standard Tote (Clear)",
    description: "Per HDX clear/yellow tote",
    defaultValue: PLATFORM_DEFAULTS.standard_tote_clear,
    category: "standard",
  },
  // Mini unit pricing
  {
    key: "mini_slot",
    label: "Mini Slot",
    description: "Per tote slot (6.5-qt unit)",
    defaultValue: PLATFORM_DEFAULTS.mini_slot,
    category: "mini",
  },
  {
    key: "mini_tote",
    label: "Mini Tote",
    description: "Per 6.5-qt shoebox tote",
    defaultValue: PLATFORM_DEFAULTS.mini_tote,
    category: "mini",
  },
  // Add-on pricing
  {
    key: "standard_wheels",
    label: "Standard Wheels",
    description: "Caster set (standard unit)",
    defaultValue: PLATFORM_DEFAULTS.standard_wheels,
    category: "addons",
  },
  {
    key: "mini_wheels",
    label: "Mini Wheels",
    description: "Caster set (mini unit)",
    defaultValue: PLATFORM_DEFAULTS.mini_wheels,
    category: "addons",
  },
  {
    key: "plywood_top",
    label: "Plywood Top",
    description: "Per 4×8 sheet",
    defaultValue: PLATFORM_DEFAULTS.plywood_top,
    category: "addons",
  },
  // Bestseller total-price overrides (with totes included)
  ...BESTSELLER_PRESETS.map((preset) => ({
    key: `bestseller_${preset.id.replace(/-/g, "_")}` as PricingNumericKey,
    label: preset.name,
    description: `Total price with ${preset.units.reduce((s, u) => s + u.cols * u.rows, 0)} totes included`,
    defaultValue: computePresetDefaultTotal(preset.id),
    dynamicDefault: true,
    category: "bestsellers" as const,
  })),
];

export default function PricingSettings({ userId }: PricingSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Each field can be: a custom number string, or empty (use default)
  const [values, setValues] = useState<Record<string, string>>({});
  const [miniDisabled, setMiniDisabled] = useState(false);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    const result = await getInstallerPricing(userId);
    if (result.success && result.pricing) {
      const loaded: Record<string, string> = {};
      for (const field of PRICE_FIELDS) {
        const val = result.pricing[field.key];
        loaded[field.key] = val !== undefined && val !== null ? String(val) : "";
      }
      setValues(loaded);
      setMiniDisabled(result.pricing.mini_disabled === true);
    }
    setLoading(false);
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

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const pricing: InstallerPricing = {};
    for (const field of PRICE_FIELDS) {
      const val = values[field.key];
      if (val !== undefined && val !== "") {
        pricing[field.key] = Number(val);
      }
    }
    if (miniDisabled) pricing.mini_disabled = true;

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
      setMiniDisabled(false);
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
    return miniDisabled || PRICE_FIELDS.some((f) => values[f.key] !== undefined && values[f.key] !== "");
  }

  if (loading) {
    return (
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
      hint: "Set a total price for each bestseller (totes included). Customers can still remove totes — your tote rate is subtracted. Leave empty to auto-calculate from your slot, tote & plywood rates.",
      fields: PRICE_FIELDS.filter((f) => f.category === "bestsellers"),
    },
  ];

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

      {/* Info Banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
        <p className="text-xs leading-relaxed text-stone-400">
          Set your own customer-facing prices. Leave a field empty to use the
          platform default. Your pricing is shown to customers on your branded
          design page.
        </p>
      </div>

      {/* Mini Tote Toggle */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setMiniDisabled(!miniDisabled)}
          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
            miniDisabled
              ? "border-red-500/30 bg-red-500/5"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <div className={`flex h-5 w-9 items-center rounded-full transition-colors ${miniDisabled ? "bg-red-500" : "bg-slate-600"}`}>
            <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${miniDisabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EyeOff className={`h-3.5 w-3.5 ${miniDisabled ? "text-red-400" : "text-stone-500"}`} />
              <p className={`text-sm font-medium ${miniDisabled ? "text-red-400" : "text-white"}`}>
                {miniDisabled ? "Mini Units Disabled" : "Disable Mini Units"}
              </p>
            </div>
            <p className="text-[11px] text-stone-500">
              {miniDisabled
                ? "6.5 qt mini tote option is hidden from your design page"
                : "Toggle to hide the mini (6.5 qt) tote option from customers"}
            </p>
          </div>
        </button>
      </div>

      {/* Pricing Categories */}
      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.key} className={cat.key === "mini" && miniDisabled ? "opacity-40 pointer-events-none" : ""}>
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              {cat.label}
            </h3>
            {cat.hint && (
              <p className="mb-3 text-[11px] leading-relaxed text-stone-600">
                {cat.hint}
              </p>
            )}
            <div className="space-y-2">
              {cat.fields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3"
                >
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
                        className="w-24 rounded-lg border border-slate-600 bg-slate-800 py-2 pl-6 pr-2 text-right text-sm font-medium text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Pricing"}
        </button>

        {hasCustomValues() && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-stone-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
            title="Reset to platform defaults"
          >
            {resetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-medium ${
            messageType === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {messageType === "success" && (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {message}
        </div>
      )}
    </section>
  );
}
