"use server";

// ═══════════════════════════════════════════════════════════════════════════
// Material cost for a DIY plan design — the plan's own shopping list at
// retail prices (src/lib/plan-retail-prices.ts). Shown live in the plans
// designer so buyers see what the build costs before they buy the plan.
// ═══════════════════════════════════════════════════════════════════════════

import { generateDIYPlan } from "@/app/actions/generate-plan";
import { parseTotePlanDesign } from "@/lib/tote-plans";
import { priceShoppingList, type MaterialEstimate } from "@/lib/plan-retail-prices";

export async function estimatePlanMaterials(rawDesign: unknown): Promise<MaterialEstimate | null> {
  const design = parseTotePlanDesign(rawDesign);
  if (!design) return null;
  const plan = await generateDIYPlan(design);
  return priceShoppingList(plan.shoppingList, design);
}
