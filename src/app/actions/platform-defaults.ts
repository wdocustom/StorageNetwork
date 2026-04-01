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
} from "@/lib/server/pricing-constants";

// ── Server-side raised bed price calculator ──────────────────────────────

export async function calculateRaisedBedPriceServer(config: {
  sizeId: string;
  finish: string;
  hasLiner: boolean;
  depthIncrease: boolean;
  bottomShelf: boolean;
  pestCover: string;
}): Promise<{ total: number; breakdown: { label: string; amount: number }[] }> {
  const prices = RAISED_BED_PRICES[config.sizeId];
  if (!prices) return { total: 0, breakdown: [] };

  const breakdown: { label: string; amount: number }[] = [];
  breakdown.push({ label: "Raised Bed", amount: prices.basePrice });

  if (config.finish === "stain") breakdown.push({ label: "Cedar Stain", amount: prices.stainPrice });
  else if (config.finish === "painted_white") breakdown.push({ label: "Painted White", amount: prices.paintedWhitePrice });

  if (config.hasLiner) breakdown.push({ label: "Landscape Liner", amount: prices.linerPrice });
  if (config.depthIncrease && prices.depthIncreasePrice > 0) breakdown.push({ label: "Increase Depth to 12\"", amount: prices.depthIncreasePrice });
  if (config.bottomShelf && prices.bottomShelfPrice > 0) breakdown.push({ label: "Bottom Shelf", amount: prices.bottomShelfPrice });

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

export async function getRaisedBedOptionPrices(sizeId: string): Promise<{
  basePrice: number;
  stainPrice: number;
  linerPrice: number;
  paintedWhitePrice: number;
  depthIncreasePrice: number;
  bottomShelfPrice: number;
  pestCovers: Record<string, { price_2x4: number; price_2x6: number }>;
} | null> {
  const prices = RAISED_BED_PRICES[sizeId];
  if (!prices) return null;
  return {
    ...prices,
    pestCovers: Object.fromEntries(
      Object.entries(PEST_COVER_PRICES).map(([k, v]) => [k, { price_2x4: v.price_2x4, price_2x6: v.price_2x6 }])
    ),
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
  };
}
