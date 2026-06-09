"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Platform Default Pricing — Server Actions (async functions only)
//
// Constants live in src/lib/server/pricing-constants.ts
// This file only exports async functions (required by "use server").
// ═══════════════════════════════════════════════════════════════════════════

import {
  PLATFORM_DEFAULTS,
  PLATFORM_BESTSELLER_DEFAULTS,
  PLATFORM_SHELVING_DEFAULTS,
  PLATFORM_OVERHEAD_DEFAULTS,
  ADDON_PLATFORM_DEFAULTS,
  RAISED_BED_PRICES,
  PEST_COVER_PRICES,
  RAISED_BED_POST_PRICES,
} from "@/lib/server/pricing-constants";
import type { InstallerPricing } from "@/types/viewModels";

// Pick the first defined override value, else the fallback
function pick(override: number | undefined | null, fallback: number): number {
  return override !== undefined && override !== null ? override : fallback;
}

// ── Server-side raised bed price calculator ──────────────────────────────

export async function calculateRaisedBedPriceServer(config: {
  sizeId: string;
  finish: string;
  hasLiner: boolean;
  depthIncrease: boolean;
  bottomShelf: boolean;
  pestCover: string;
  postHeight?: number | null;
  hasHook?: boolean;
  highWindWeighted?: boolean;
  installerPricing?: InstallerPricing;
}): Promise<{ total: number; breakdown: { label: string; amount: number }[] }> {
  const prices = RAISED_BED_PRICES[config.sizeId];
  if (!prices) return { total: 0, breakdown: [] };

  const ip = config.installerPricing;
  const sizeKey = `raised_bed_${config.sizeId}` as keyof InstallerPricing;
  const basePrice = pick(ip?.[sizeKey] as number | undefined, prices.basePrice);
  const stainPrice = pick(ip?.raised_bed_stain_addon, prices.stainPrice);
  const linerPrice = pick(ip?.raised_bed_liner_addon, prices.linerPrice);
  const paintedWhitePrice = pick(ip?.raised_bed_paint_white_addon, prices.paintedWhitePrice);
  const depthIncreasePrice = pick(ip?.raised_bed_depth_increase_addon, prices.depthIncreasePrice);
  const bottomShelfPrice = pick(ip?.raised_bed_bottom_shelf_addon, prices.bottomShelfPrice);
  const post72Price = pick(ip?.raised_bed_post_72_addon, RAISED_BED_POST_PRICES.post_72);
  const post84Price = pick(ip?.raised_bed_post_84_addon, RAISED_BED_POST_PRICES.post_84);
  const post96Price = pick(ip?.raised_bed_post_96_addon, RAISED_BED_POST_PRICES.post_96);
  const hookPrice = pick(ip?.raised_bed_hook_addon, RAISED_BED_POST_PRICES.hook);
  const weightedPrice = pick(ip?.raised_bed_high_wind_weighted_addon, RAISED_BED_POST_PRICES.high_wind_weighted);

  const breakdown: { label: string; amount: number }[] = [];
  breakdown.push({ label: "Raised Bed", amount: basePrice });

  if (config.finish === "stain") breakdown.push({ label: "Cedar Stain", amount: stainPrice });
  else if (config.finish === "painted_white") breakdown.push({ label: "Painted White", amount: paintedWhitePrice });

  if (config.hasLiner) breakdown.push({ label: "Landscape Liner", amount: linerPrice });
  if (config.depthIncrease && depthIncreasePrice > 0) breakdown.push({ label: "Increase Depth to 12\"", amount: depthIncreasePrice });
  if (config.bottomShelf && bottomShelfPrice > 0) breakdown.push({ label: "Bottom Shelf", amount: bottomShelfPrice });

  if (config.postHeight === 72) breakdown.push({ label: "6' Post", amount: post72Price });
  else if (config.postHeight === 84) breakdown.push({ label: "7' Post", amount: post84Price });
  else if (config.postHeight === 96) breakdown.push({ label: "8' Post", amount: post96Price });

  if (config.hasHook) breakdown.push({ label: "Hook", amount: hookPrice });
  if (config.highWindWeighted) breakdown.push({ label: "High-Wind Weighted Kit", amount: weightedPrice });

  if (config.pestCover && config.pestCover !== "none") {
    const coverPrices = PEST_COVER_PRICES[config.pestCover as keyof typeof PEST_COVER_PRICES];
    if (coverPrices) {
      const isLarge = config.sizeId.includes("72") && !config.sizeId.includes("12x");
      const base = isLarge ? coverPrices.price_2x6 : coverPrices.price_2x4;
      const stainAddon = config.finish === "stain" ? (isLarge ? coverPrices.stainAddon_2x6 : coverPrices.stainAddon_2x4) : 0;
      const coverLabels: Record<string, string> = { hoop: "Hoop Netting", rigid_cage: "Rigid Cage", cabinet_24: "24\" Cabinet Cage", cabinet_48: "48\" Tall Cabinet Cage" };
      breakdown.push({ label: coverLabels[config.pestCover] || "Pest Cover", amount: base + stainAddon });
    }
  }

  return { total: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
}

// ── Get option prices for a raised bed size (for UI display) ─────────────

export async function getRaisedBedOptionPrices(sizeId: string, installerPricing?: InstallerPricing): Promise<{
  basePrice: number;
  stainPrice: number;
  linerPrice: number;
  paintedWhitePrice: number;
  depthIncreasePrice: number;
  bottomShelfPrice: number;
  pestCovers: Record<string, { price_2x4: number; price_2x6: number }>;
  post72Price: number;
  post84Price: number;
  post96Price: number;
  hookPrice: number;
  highWindWeightedPrice: number;
} | null> {
  const prices = RAISED_BED_PRICES[sizeId];
  if (!prices) return null;
  const ip = installerPricing;
  const sizeKey = `raised_bed_${sizeId}` as keyof InstallerPricing;
  return {
    basePrice: pick(ip?.[sizeKey] as number | undefined, prices.basePrice),
    stainPrice: pick(ip?.raised_bed_stain_addon, prices.stainPrice),
    linerPrice: pick(ip?.raised_bed_liner_addon, prices.linerPrice),
    paintedWhitePrice: pick(ip?.raised_bed_paint_white_addon, prices.paintedWhitePrice),
    depthIncreasePrice: pick(ip?.raised_bed_depth_increase_addon, prices.depthIncreasePrice),
    bottomShelfPrice: pick(ip?.raised_bed_bottom_shelf_addon, prices.bottomShelfPrice),
    pestCovers: Object.fromEntries(
      Object.entries(PEST_COVER_PRICES).map(([k, v]) => [k, { price_2x4: v.price_2x4, price_2x6: v.price_2x6 }])
    ),
    post72Price: pick(ip?.raised_bed_post_72_addon, RAISED_BED_POST_PRICES.post_72),
    post84Price: pick(ip?.raised_bed_post_84_addon, RAISED_BED_POST_PRICES.post_84),
    post96Price: pick(ip?.raised_bed_post_96_addon, RAISED_BED_POST_PRICES.post_96),
    hookPrice: pick(ip?.raised_bed_hook_addon, RAISED_BED_POST_PRICES.hook),
    highWindWeightedPrice: pick(ip?.raised_bed_high_wind_weighted_addon, RAISED_BED_POST_PRICES.high_wind_weighted),
  };
}

// ── Helper: get all platform defaults as a plain object for client ────────

export async function getPlatformDefaults() {
  return {
    ...PLATFORM_DEFAULTS,
    addon: ADDON_PLATFORM_DEFAULTS,
    bestsellers: PLATFORM_BESTSELLER_DEFAULTS,
    shelving: PLATFORM_SHELVING_DEFAULTS,
    overhead: PLATFORM_OVERHEAD_DEFAULTS,
    raisedBeds: Object.fromEntries(
      Object.entries(RAISED_BED_PRICES).map(([k, v]) => [`raised_bed_${k}`, v.basePrice])
    ) as Record<string, number>,
    raisedBedAddons: {
      raised_bed_stain_addon: 35,
      raised_bed_liner_addon: 25,
      raised_bed_paint_white_addon: 90,
      raised_bed_depth_increase_addon: 30,
      raised_bed_bottom_shelf_addon: 50,
      raised_bed_post_72_addon: RAISED_BED_POST_PRICES.post_72,
      raised_bed_post_84_addon: RAISED_BED_POST_PRICES.post_84,
      raised_bed_post_96_addon: RAISED_BED_POST_PRICES.post_96,
      raised_bed_hook_addon: RAISED_BED_POST_PRICES.hook,
      raised_bed_high_wind_weighted_addon: RAISED_BED_POST_PRICES.high_wind_weighted,
    },
  };
}

// ── Server-side chair price calculator ─────────────────────────────────

export async function calculateChairPriceServer(config: {
  finish: string;
  quantity: number;
  installerPricing?: Record<string, unknown>;
}): Promise<{ total: number; breakdown: { label: string; amount: number }[] }> {
  const basePrice = Number(config.installerPricing?.adirondack_chair_base) || 350;
  const paintAddon = Number(config.installerPricing?.adirondack_chair_paint_addon) || 75;

  const breakdown: { label: string; amount: number }[] = [];
  breakdown.push({ label: "Low Boy Adirondack Chair", amount: basePrice });

  if (config.finish === "white" || config.finish === "black") {
    const finishLabel = config.finish === "white" ? "White Paint" : "Black Paint";
    breakdown.push({ label: finishLabel, amount: paintAddon });
  }

  const perUnit = breakdown.reduce((sum, item) => sum + item.amount, 0);

  if (config.quantity > 1) {
    return {
      total: perUnit * config.quantity,
      breakdown: [{ label: `${config.quantity}× Low Boy Adirondack`, amount: perUnit * config.quantity }],
    };
  }

  return { total: perUnit, breakdown };
}

// ── Get chair option prices (for UI display) ───────────────────────────

export async function getChairOptionPrices(installerPricing?: Record<string, unknown>): Promise<{
  basePrice: number;
  paintAddon: number;
}> {
  return {
    basePrice: Number(installerPricing?.adirondack_chair_base) || 350,
    paintAddon: Number(installerPricing?.adirondack_chair_paint_addon) || 75,
  };
}
