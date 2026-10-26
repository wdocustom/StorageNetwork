import "server-only";

import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { expandPresetUnits } from "@/lib/buildEngine.types";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import { bestsellerInstances, type TotePlanDesign } from "@/lib/tote-plans";
import type { InstallerPricing } from "@/types/viewModels";
import type { QuoteUnit } from "@/app/actions/submit-lead";

// ═══════════════════════════════════════════════════════════════════════════
// Plan design → installer quote lines, priced with THAT installer's rates
//
// Mirrors the design configurator's cart items so the installer sees a
// normal quote: bestsellers go through calculateCompoundBuild (the
// installer's bestseller price, unless they've switched that bestseller
// off) and are expanded into sub-unit lines like the configurator's
// submit; every other unit is a standard calculateBuild unit.
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanBuildQuote {
  units: QuoteUnit[];
  total: number;
  /** Totes included in the price */
  totes: boolean;
}

function bestsellerDisabled(pricing: InstallerPricing | undefined, presetId: string): boolean {
  const key = `bestseller_${presetId.replace(/-/g, "_")}_disabled` as keyof InstallerPricing;
  return pricing?.[key] === true;
}

export async function priceDesignForInstaller(
  design: TotePlanDesign,
  pricing: InstallerPricing | undefined,
  includeTotes: boolean,
): Promise<PlanBuildQuote | null> {
  const totes = includeTotes && pricing?.totes_disabled !== true;
  const instances = bestsellerInstances(design.units).filter((i) => !bestsellerDisabled(pricing, i.presetId));
  const items: (QuoteUnit & Record<string, unknown>)[] = [];

  let i = 0;
  while (i < design.units.length) {
    const inst = instances.find((x) => x.start === i);
    if (inst) {
      const preset = BESTSELLER_PRESETS.find((p) => p.id === inst.presetId)!;
      const units = design.units.slice(i, i + inst.count);
      const res = await calculateCompoundBuild({ presetId: inst.presetId, hasTotes: totes, installerPricing: pricing });
      if (!res.success) return null;
      items.push({
        cols: res.subUnits.reduce((s, u) => s + u.cols, 0),
        rows: Math.max(...res.subUnits.map((u) => u.rows)),
        toteType: units[0].toteType,
        toteColor: "black",
        unitType: "standard",
        orientation: "standard",
        hasTotes: totes && !preset.totesDisabled,
        hasWheels: units.some((u) => u.hasWheels),
        hasTop: units.some((u) => u.hasTop),
        price: res.totalPrice,
        totalW: res.combinedW,
        totalH: res.maxH,
        depth: res.depth,
        desc: `${preset.name} (${res.subUnits.map((s) => `${s.cols}x${s.rows}`).join(" + ")})`,
        addons: [],
        presetUnits: res.subUnits.map((su, k) => ({
          cols: su.cols,
          rows: su.rows,
          totalW: su.totalW,
          totalH: su.totalH,
          hasTop: units[k]?.hasTop ?? false,
          hasWheels: units[k]?.hasWheels ?? false,
        })),
      });
      i += inst.count;
      continue;
    }

    const u = design.units[i];
    const res = await calculateBuild({
      cols: u.cols,
      rows: u.rows,
      toteModel: u.toteType,
      unitType: "standard",
      orientation: "standard",
      addOns: { totes, wheels: u.hasWheels, top: u.hasTop },
      mode: "manual",
      installerPricing: pricing,
    });
    if (!res.success) return null;
    items.push({
      cols: res.cols,
      rows: res.rows,
      toteType: u.toteType,
      toteColor: "black",
      unitType: "standard",
      orientation: "standard",
      hasTotes: res.config.hasTotes,
      hasWheels: res.config.hasWheels,
      hasTop: res.config.hasTop,
      price: res.price,
      totalW: res.dimensions.totalW,
      totalH: res.dimensions.totalH,
      depth: res.dimensions.depth,
      desc: `Standard: ${res.cols}W × ${res.rows}H`,
      addons: [],
    });
    i += 1;
  }

  const total = Math.round(items.reduce((s, it) => s + it.price, 0) * 100) / 100;
  return { units: expandPresetUnits(items), total, totes };
}
