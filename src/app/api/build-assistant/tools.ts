// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT — Tool Definitions
// Each tool wraps existing server-side calculation logic so the AI can
// answer material, pricing, and profit questions with real data.
// ═══════════════════════════════════════════════════════════════════════════

import { tool } from "ai";
import { z } from "zod";

// Server-side imports — safe because this file only runs in the API route
import {
  calculateBuild,
  calculateCompoundBuild,
} from "@/app/actions/calculator";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { getBuildFeeBreakdown } from "@/app/actions/fee-engine";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import type { InstallerPricing } from "@/types/viewModels";

// ── Shared context passed from the API route ────────────────────────────

interface ToolContext {
  installerPricing?: InstallerPricing;
  materialPrices?: Record<string, number>;
  installerId?: string;
}

export function buildTools(ctx: ToolContext) {
  return {
    // ── Tool 1: Calculate a custom build ─────────────────────────────────
    calculate_build: tool({
      description:
        "Calculate pricing and dimensions for a custom tote storage unit. Use this for hypothetical questions like 'what would a 5x3 with wheels cost?' or 'how big is a 4x4?'",
      inputSchema: z.object({
        cols: z.number().min(1).max(20).describe("Number of tote columns (width)"),
        rows: z.number().min(1).max(20).describe("Number of tote rows (height)"),
        toteModel: z.enum(["HDX", "GM"]).default("HDX").describe("HDX = standard 19-3/4 inch, GM = wide 20-3/4 inch"),
        unitType: z.enum(["standard", "mini"]).default("standard"),
        orientation: z.enum(["standard", "sideways"]).default("standard"),
        hasTotes: z.boolean().default(true).describe("Include totes in price"),
        hasWheels: z.boolean().default(false).describe("Include locking casters"),
        hasTop: z.boolean().default(true).describe("Include plywood top"),
      }),
      execute: async (params) => {
        const result = await calculateBuild({
          cols: params.cols,
          rows: params.rows,
          toteModel: params.toteModel,
          toteColor: "black",
          unitType: params.unitType,
          orientation: params.orientation,
          addOns: {
            totes: params.hasTotes,
            wheels: params.hasWheels,
            top: params.unitType === "mini" ? true : params.hasTop,
          },
          mode: "manual",
          installerPricing: ctx.installerPricing,
        });

        if (!result.success) {
          return { error: "error" in result ? result.error : "Calculation failed" };
        }

        return {
          cols: result.cols,
          rows: result.rows,
          price: result.price,
          dimensions: result.dimensions,
          slots: result.config.slots,
          hasTotes: result.config.hasTotes,
          hasWheels: result.config.hasWheels,
          hasTop: result.config.hasTop,
          topSheets: result.config.topSheets,
        };
      },
    }),

    // ── Tool 2: Calculate a bestseller preset ────────────────────────────
    calculate_preset: tool({
      description:
        "Calculate pricing for a bestseller preset (Indiana Joe, Cornhusker, Long Ranger, Gas Station). Returns total price and per-sub-unit breakdown.",
      inputSchema: z.object({
        presetId: z
          .enum(["indiana-joe", "cornhusker", "long-ranger", "gas-station"])
          .describe("The preset identifier"),
        hasTotes: z.boolean().default(true).describe("Include totes in price"),
      }),
      execute: async (params) => {
        const result = await calculateCompoundBuild({
          presetId: params.presetId,
          hasTotes: params.hasTotes,
          installerPricing: ctx.installerPricing,
        });

        if (!result.success) {
          return { error: "error" in result ? result.error : "Preset calculation failed" };
        }

        const preset = BESTSELLER_PRESETS.find((p) => p.id === params.presetId);
        return {
          presetName: result.presetName,
          totalPrice: result.totalPrice,
          totalSlots: result.totalSlots,
          combinedWidth: result.combinedW,
          maxHeight: result.maxH,
          depth: result.depth,
          subUnits: result.subUnits.map((su, i) => ({
            config: `${su.cols}x${su.rows}`,
            price: su.price,
            slots: su.slots,
            width: su.totalW,
            height: su.totalH,
            hasTop: preset?.units[i].hasTop ?? false,
            hasWheels: preset?.units[i].hasWheels ?? false,
          })),
        };
      },
    }),

    // ── Tool 3: Get detailed build manifest (screws, boards, plywood) ───
    get_build_manifest: tool({
      description:
        "Get detailed material breakdown: exact screw counts by size, lumber boards needed, plywood sheets, shopping list. Use for questions like 'how many screws in a 4x4?' or 'how many 2x4s?'",
      inputSchema: z.object({
        units: z.array(
          z.object({
            cols: z.number().min(1).max(20),
            rows: z.number().min(1).max(20),
            toteModel: z.enum(["HDX", "GM"]).default("HDX"),
            unitType: z.enum(["standard", "mini"]).default("standard"),
            orientation: z.enum(["standard", "sideways"]).default("standard"),
            hasTotes: z.boolean().default(true),
            hasWheels: z.boolean().default(false),
            hasTop: z.boolean().default(true),
          })
        ).describe("Array of units to calculate materials for"),
      }),
      execute: async (params) => {
        // First calculate prices for each unit
        const quoteUnits = [];
        for (const u of params.units) {
          const buildResult = await calculateBuild({
            cols: u.cols,
            rows: u.rows,
            toteModel: u.toteModel,
            toteColor: "black",
            unitType: u.unitType,
            orientation: u.orientation,
            addOns: {
              totes: u.hasTotes,
              wheels: u.hasWheels,
              top: u.unitType === "mini" ? true : u.hasTop,
            },
            mode: "manual",
            installerPricing: ctx.installerPricing,
          });

          if (!buildResult.success) continue;

          quoteUnits.push({
            cols: buildResult.cols,
            rows: buildResult.rows,
            toteType: u.toteModel as "HDX" | "GM",
            unitType: buildResult.config.unitType,
            orientation: buildResult.config.orientation,
            hasTotes: buildResult.config.hasTotes,
            hasWheels: buildResult.config.hasWheels,
            hasTop: buildResult.config.hasTop,
            price: buildResult.price,
            totalW: buildResult.dimensions.totalW,
            totalH: buildResult.dimensions.totalH,
            depth: buildResult.dimensions.depth,
            desc: `${buildResult.cols}W x ${buildResult.rows}H`,
          });
        }

        if (quoteUnits.length === 0) {
          return { error: "No valid units to calculate" };
        }

        const manifest = await generateBuildManifestServer(quoteUnits);

        return {
          totals: manifest.totals,
          shopping_list: manifest.shopping_list,
          financials: manifest.financials,
        };
      },
    }),

    // ── Tool 4: Calculate material costs ─────────────────────────────────
    calculate_material_cost: tool({
      description:
        "Calculate the total material cost for a build — itemized line items with quantities and dollar amounts. Use for questions about material cost, profit margins, cost breakdown.",
      inputSchema: z.object({
        units: z.array(
          z.object({
            cols: z.number().min(1).max(20),
            rows: z.number().min(1).max(20),
            toteType: z.enum(["HDX", "GM"]).default("HDX"),
            unitType: z.enum(["standard", "mini"]).default("standard"),
            hasTotes: z.boolean().default(true),
            hasWheels: z.boolean().default(false),
            hasTop: z.boolean().default(true),
          })
        ).describe("Array of units to calculate material costs for"),
      }),
      execute: async (params) => {
        const result = await calculateMaterialCostServer(
          params.units,
          ctx.materialPrices ?? {},
        );
        return {
          totalCost: result.totalCost,
          items: result.items,
          rawCounts: {
            lumber_boards: result.rawCounts.lumber_boards,
            plywood_top_sheets: result.rawCounts.plywood_top_sheets,
            totes: result.rawCounts.totes,
            wheel_kits: result.rawCounts.wheel_kits,
            screws_1_5_8: result.rawCounts.screws_1_5_8,
            screws_3: result.rawCounts.screws_3,
            screws_1: result.rawCounts.screws_1,
          },
        };
      },
    }),

    // ── Tool 5: Calculate profit ─────────────────────────────────────────
    calculate_profit: tool({
      description:
        "Calculate installer profit for a job. Shows both network lead and direct lead scenarios with fee breakdowns. Use for 'how much will I make?' questions.",
      inputSchema: z.object({
        jobPrice: z.number().min(1).describe("Total job price (what the customer pays)"),
        materialsCost: z.number().min(0).describe("Total material cost"),
      }),
      execute: async (params) => {
        const breakdown = await getBuildFeeBreakdown(
          params.jobPrice,
          params.materialsCost,
          ctx.installerId,
        );
        return breakdown;
      },
    }),

    // ── Tool 6: List available presets ────────────────────────────────────
    list_presets: tool({
      description:
        "List all available bestseller presets with their configurations. Use when the installer asks 'what presets are available?' or 'show me bestsellers'.",
      inputSchema: z.object({}),
      execute: async () => {
        return BESTSELLER_PRESETS.map((p) => ({
          id: p.id,
          name: p.name,
          label: p.label,
          toteModel: p.toteModel,
          unitType: p.unitType,
          orientation: p.orientation,
          subUnits: p.units.map((u) => ({
            cols: u.cols,
            rows: u.rows,
            hasTop: u.hasTop,
            hasWheels: u.hasWheels,
          })),
        }));
      },
    }),
  };
}
