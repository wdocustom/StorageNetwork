"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Package,
  Loader2,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getMaterialPricing,
  saveMaterialPricing,
  resetMaterialPricing,
  type MaterialPricingConfig,
  type ScrewPackage,
} from "@/app/actions/material-pricing";
import { DEFAULT_MATERIAL_PRICES } from "@/utils/calculateMaterials";

// ═══════════════════════════════════════════════════════════════════════════
// Material Cost Settings — Profile section for wholesale material pricing
// and custom screw packaging (e.g. bulk buckets).
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  userId: string;
  embedded?: boolean;
}

// Default box/package sizes for display
const DEFAULT_PACKAGES: Record<string, { count: number; price: number; label: string }> = {
  screw_1in: { count: 90, price: DEFAULT_MATERIAL_PRICES.screw_1in_90ct, label: '90ct box' },
  screw_1_5_8in: { count: 158, price: DEFAULT_MATERIAL_PRICES.screw_1_5_8in_158ct, label: '158ct box' },
  screw_3in: { count: 137, price: DEFAULT_MATERIAL_PRICES.screw_3in_137ct, label: '137ct box' },
  overhead_lag_bolt: { count: 50, price: 15.00, label: '50ct box' },
  overhead_structural_screw: { count: 100, price: 10.00, label: '100ct box' },
};

const SIMPLE_FIELDS: { key: keyof MaterialPricingConfig; label: string; unit: string; defaultPrice: number }[] = [
  { key: "lumber_2x4_8ft", label: "2×4 Lumber (8ft)", unit: "each", defaultPrice: DEFAULT_MATERIAL_PRICES.lumber_2x4_8ft },
  { key: "plywood_sheet", label: "Plywood (4×8 sheet)", unit: "sheet", defaultPrice: DEFAULT_MATERIAL_PRICES.plywood_sheet },
  { key: "tote", label: "27-Gal Tote", unit: "each", defaultPrice: DEFAULT_MATERIAL_PRICES.tote },
  { key: "wheels_4pk", label: "Caster Kit (4pk)", unit: "set", defaultPrice: DEFAULT_MATERIAL_PRICES.wheels_4pk },
];

const SCREW_FIELDS: { key: string; label: string; description: string; usedFor: string }[] = [
  { key: "screw_1_5_8in", label: '1⅝" #8 Screws', description: "Rail screws — tote organizers & shelving", usedFor: "Tote Organizers, Open Shelving" },
  { key: "screw_3in", label: '3" Screws', description: "Frame screws — tote organizers & shelving", usedFor: "Tote Organizers, Open Shelving" },
  { key: "screw_1in", label: '1" Screws', description: "Wheel/caster mounting screws", usedFor: "Caster Kits" },
  { key: "overhead_lag_bolt", label: '5/16" Lag Bolts + Washers', description: "Ceiling mounting — overhead storage", usedFor: "Overhead Storage" },
  { key: "overhead_structural_screw", label: '3" Structural Screws', description: "Frame assembly — overhead storage", usedFor: "Overhead Storage" },
];

export default function MaterialCostSettings({ userId, embedded }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Simple price values (string for input binding)
  const [simpleValues, setSimpleValues] = useState<Record<string, string>>({});

  // Screw package values
  const [screwValues, setScrewValues] = useState<Record<string, { count: string; price: string; label: string }>>({});

  // Expand/collapse screws section
  const [screwsExpanded, setScrewsExpanded] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const result = await getMaterialPricing(userId);
    if (result.success && result.config) {
      const cfg = result.config;

      // Load simple values
      const sv: Record<string, string> = {};
      for (const f of SIMPLE_FIELDS) {
        const val = cfg[f.key];
        sv[f.key as string] = (val !== undefined && val !== null && typeof val === "number") ? String(val) : "";
      }
      setSimpleValues(sv);

      // Load screw packages
      const screws: Record<string, { count: string; price: string; label: string }> = {};
      for (const f of SCREW_FIELDS) {
        const pkg = cfg[f.key as keyof MaterialPricingConfig] as ScrewPackage | undefined;
        const def = DEFAULT_PACKAGES[f.key];
        screws[f.key] = {
          count: pkg?.count !== undefined ? String(pkg.count) : "",
          price: pkg?.price !== undefined ? String(pkg.price) : "",
          label: pkg?.label ?? "",
        };
        // Ensure defaults are available
        if (!def) continue;
      }
      setScrewValues(screws);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function handleSimpleChange(key: string, val: string) {
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setSimpleValues((prev) => ({ ...prev, [key]: val }));
      setMessage("");
    }
  }

  function handleScrewChange(key: string, field: "count" | "price" | "label", val: string) {
    if (field === "label") {
      setScrewValues((prev) => ({
        ...prev,
        [key]: { ...prev[key], label: val },
      }));
    } else if (field === "count") {
      if (val === "" || /^\d+$/.test(val)) {
        setScrewValues((prev) => ({
          ...prev,
          [key]: { ...prev[key], count: val },
        }));
      }
    } else {
      if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
        setScrewValues((prev) => ({
          ...prev,
          [key]: { ...prev[key], price: val },
        }));
      }
    }
    setMessage("");
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const config: MaterialPricingConfig = {};

    // Build simple values
    for (const f of SIMPLE_FIELDS) {
      const val = simpleValues[f.key as string];
      if (val !== undefined && val !== "") {
        (config as Record<string, unknown>)[f.key] = Number(val);
      }
    }

    // Build screw packages
    for (const f of SCREW_FIELDS) {
      const sv = screwValues[f.key];
      if (!sv) continue;
      const count = sv.count ? parseInt(sv.count, 10) : 0;
      const price = sv.price ? parseFloat(sv.price) : 0;

      // Only save if at least count or price was provided
      if (count > 0 || price > 0) {
        const def = DEFAULT_PACKAGES[f.key];
        (config as Record<string, unknown>)[f.key] = {
          count: count > 0 ? count : def.count,
          price: price > 0 ? price : def.price,
          label: sv.label || undefined,
        };
      }
    }

    const result = await saveMaterialPricing(userId, config);
    if (result.success) {
      setMessage("Material pricing saved!");
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } else {
      setMessage(result.error || "Failed to save.");
      setMessageType("error");
    }
    setSaving(false);
  }

  async function handleReset() {
    setResetting(true);
    setMessage("");

    const result = await resetMaterialPricing(userId);
    if (result.success) {
      setSimpleValues({});
      setScrewValues({});
      setMessage("Reset to defaults.");
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } else {
      setMessage(result.error || "Failed to reset.");
      setMessageType("error");
    }
    setResetting(false);
  }

  function hasCustomValues(): boolean {
    return (
      Object.values(simpleValues).some((v) => v !== "") ||
      Object.values(screwValues).some(
        (sv) => sv.count !== "" || sv.price !== "" || sv.label !== ""
      )
    );
  }

  if (loading) {
    return embedded ? (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    ) : (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
        </div>
      </section>
    );
  }

  const body = (
    <>
      {/* Info Banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
        <p className="text-xs leading-relaxed text-stone-400">
          Set your actual wholesale material costs. These are used by the profit
          calculator on the Build page. Customers never see these prices.
          For screws and fasteners, you can enter custom bulk packaging (e.g. a 25 lbs
          bucket) and the inventory system will track counts using your package size.
        </p>
      </div>

      {/* ── Simple Material Prices ───────────────────────────────────── */}
      <div className="mb-5">
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Base Materials
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SIMPLE_FIELDS.map((f) => (
            <div key={f.key as string}>
              <label className="mb-0.5 block text-[9px] font-semibold uppercase text-stone-600">
                {f.label}
              </label>
              <div className="flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 focus-within:border-yellow-400">
                <span className="flex items-center bg-zinc-700/50 px-2 text-[10px] font-bold text-stone-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder={f.defaultPrice.toFixed(2)}
                  value={simpleValues[f.key as string] ?? ""}
                  onChange={(e) => handleSimpleChange(f.key as string, e.target.value)}
                  className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none"
                />
                <span className="flex items-center bg-zinc-700/50 px-2 text-[9px] text-stone-600">/{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Screws & Fasteners ────────────────────────────────────────── */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setScrewsExpanded(!screwsExpanded)}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-left transition-colors hover:bg-zinc-800"
        >
          <Package className="h-4 w-4 text-yellow-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Screws & Fasteners</p>
            <p className="text-[11px] text-stone-500">
              Custom quantities & bulk pricing for all screw types
            </p>
          </div>
          {screwsExpanded ? (
            <ChevronUp className="h-4 w-4 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </button>

        {screwsExpanded && (
          <div className="mt-3 space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/20 p-4">
            <p className="text-[11px] leading-relaxed text-stone-500">
              By default, screws are purchased in standard retail boxes. If you buy
              in bulk (e.g. a 25 lbs bucket), enter the count and price per package
              below. The inventory system will track individual screws and calculate
              purchases using your custom package size.
            </p>

            {SCREW_FIELDS.map((f) => {
              const def = DEFAULT_PACKAGES[f.key];
              const sv = screwValues[f.key] ?? { count: "", price: "", label: "" };

              return (
                <div
                  key={f.key}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-3"
                >
                  <div className="mb-2">
                    <p className="text-sm font-medium text-white">{f.label}</p>
                    <p className="text-[11px] text-stone-500">{f.description}</p>
                    <p className="mt-0.5 text-[10px] text-stone-600">
                      Used for: <span className="text-stone-500">{f.usedFor}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Package Label */}
                    <div>
                      <label className="mb-0.5 block text-[9px] font-semibold uppercase text-stone-600">
                        Package Name
                      </label>
                      <input
                        type="text"
                        placeholder={def.label}
                        value={sv.label}
                        onChange={(e) => handleScrewChange(f.key, "label", e.target.value)}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                      />
                    </div>

                    {/* Count per Package */}
                    <div>
                      <label className="mb-0.5 block text-[9px] font-semibold uppercase text-stone-600">
                        Qty per Package
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={String(def.count)}
                        value={sv.count}
                        onChange={(e) => handleScrewChange(f.key, "count", e.target.value)}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                      />
                    </div>

                    {/* Price per Package */}
                    <div>
                      <label className="mb-0.5 block text-[9px] font-semibold uppercase text-stone-600">
                        Price / Package
                      </label>
                      <div className="flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 focus-within:border-yellow-400">
                        <span className="flex items-center bg-zinc-700/50 px-2 text-[10px] font-bold text-stone-500">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder={def.price.toFixed(2)}
                          value={sv.price}
                          onChange={(e) => handleScrewChange(f.key, "price", e.target.value)}
                          className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder-stone-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Default info */}
                  <p className="mt-1.5 text-[9px] text-stone-600">
                    Default: {def.label} — {def.count} ct @ ${def.price.toFixed(2)}
                    {" "}(${(def.price / def.count).toFixed(4)}/ea)
                    {sv.count && sv.price && Number(sv.count) > 0 && Number(sv.price) > 0 && (
                      <span className="ml-2 text-yellow-400/80">
                        Your cost: ${(Number(sv.price) / Number(sv.count)).toFixed(4)}/ea
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Action Buttons ────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Material Costs"}
        </button>

        {hasCustomValues() && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-stone-400 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            title="Reset to defaults"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
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
          {messageType === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {message}
        </div>
      )}
    </>
  );

  if (embedded) return body;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-yellow-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Material Costs
        </h2>
        {hasCustomValues() && (
          <span className="ml-auto rounded-full bg-yellow-400/20 px-2 py-0.5 text-[9px] font-bold text-yellow-400">
            CUSTOM
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
