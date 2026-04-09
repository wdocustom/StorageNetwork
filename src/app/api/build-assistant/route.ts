// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT API — Two-step: classify → compute → answer
// Uses only generateText + generateObject (both proven in production).
// Zero AI SDK tool-calling APIs. Zero client SDK.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { buildSystemPrompt } from "./prompt";
import {
  calculateBuild,
  calculateCompoundBuild,
} from "@/app/actions/calculator";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { getBuildFeeBreakdown } from "@/app/actions/fee-engine";
import type { InstallerPricing } from "@/types/viewModels";

export const maxDuration = 30;

// ── Step 1 schema: what calculations does the user need? ────────────────

const ActionSchema = z.object({
  actions: z.array(
    z.object({
      type: z
        .enum([
          "build",
          "preset",
          "manifest",
          "materials",
          "profit",
          "list_presets",
        ])
        .describe("Type of calculation to run"),
      cols: z.number().optional().describe("Columns (for manual build/manifest/materials)"),
      rows: z.number().optional().describe("Rows (for manual build/manifest/materials)"),
      wallWidth: z.number().optional().describe("Wall width in inches (for wall-fit build mode)"),
      wallHeight: z.number().optional().describe("Wall height in inches (for wall-fit build mode)"),
      hasTotes: z.boolean().optional(),
      hasWheels: z.boolean().optional(),
      hasTop: z.boolean().optional(),
      unitType: z.enum(["standard", "mini"]).optional().describe("Unit type (default: standard)"),
      orientation: z.enum(["standard", "sideways"]).optional().describe("Orientation (default: standard)"),
      toteModel: z.enum(["HDX", "GM"]).optional().describe("Tote model (default: HDX)"),
      presetId: z
        .enum(["indiana-joe", "cornhusker", "long-ranger", "gas-station"])
        .optional()
        .describe("Preset ID (for preset type)"),
      jobPrice: z.number().optional().describe("Job price (for profit)"),
      materialsCost: z.number().optional().describe("Material cost (for profit)"),
    }),
  ).describe("List of calculations needed. Empty array if question can be answered from context alone."),
});

// ── Calculation executor ────────────────────────────────────────────────

interface ToolContext {
  installerPricing?: InstallerPricing;
  materialPrices?: Record<string, number>;
  installerId?: string;
}

async function runCalculations(
  actions: z.infer<typeof ActionSchema>["actions"],
  ctx: ToolContext,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (const a of actions) {
    try {
      switch (a.type) {
        case "build": {
          const isWallFit = !!(a.wallWidth && a.wallHeight);
          const r = await calculateBuild({
            ...(isWallFit
              ? { wallWidth: a.wallWidth!, wallHeight: a.wallHeight!, mode: "wallFit" as const }
              : { cols: a.cols ?? 4, rows: a.rows ?? 4, mode: "manual" as const }),
            toteModel: a.toteModel ?? "HDX",
            toteColor: "black",
            unitType: a.unitType ?? "standard",
            orientation: a.orientation ?? "standard",
            addOns: {
              totes: a.hasTotes ?? true,
              wheels: a.hasWheels ?? false,
              top: a.hasTop ?? true,
            },
            installerPricing: ctx.installerPricing,
          });
          if (r.success) {
            results.push({
              type: "build",
              mode: isWallFit ? "wallFit" : "manual",
              cols: r.cols,
              rows: r.rows,
              price: r.price,
              dimensions: r.dimensions,
              slots: r.config.slots,
              hasTotes: r.config.hasTotes,
              hasWheels: r.config.hasWheels,
              hasTop: r.config.hasTop,
            });
          } else {
            results.push({ type: "build", error: r.error });
          }
          break;
        }

        case "preset": {
          const r = await calculateCompoundBuild({
            presetId: a.presetId ?? "indiana-joe",
            hasTotes: a.hasTotes ?? true,
            installerPricing: ctx.installerPricing,
          });
          if (r.success) {
            results.push({
              type: "preset",
              presetName: r.presetName,
              totalPrice: r.totalPrice,
              totalSlots: r.totalSlots,
              combinedWidth: r.combinedW,
              maxHeight: r.maxH,
              depth: r.depth,
              subUnits: r.subUnits.map((su) => ({
                config: `${su.cols}x${su.rows}`,
                price: su.price,
                slots: su.slots,
              })),
            });
          }
          break;
        }

        case "manifest": {
          const isWallFitM = !!(a.wallWidth && a.wallHeight);
          const br = await calculateBuild({
            ...(isWallFitM
              ? { wallWidth: a.wallWidth!, wallHeight: a.wallHeight!, mode: "wallFit" as const }
              : { cols: a.cols ?? 4, rows: a.rows ?? 4, mode: "manual" as const }),
            toteModel: a.toteModel ?? "HDX",
            toteColor: "black",
            unitType: a.unitType ?? "standard",
            orientation: a.orientation ?? "standard",
            addOns: {
              totes: a.hasTotes ?? true,
              wheels: a.hasWheels ?? false,
              top: a.hasTop ?? true,
            },
            installerPricing: ctx.installerPricing,
          });
          if (br.success) {
            const manifest = await generateBuildManifestServer([
              {
                cols: br.cols,
                rows: br.rows,
                toteType: (a.toteModel ?? "HDX") as "HDX" | "GM",
                unitType: br.config.unitType,
                orientation: br.config.orientation,
                hasTotes: br.config.hasTotes,
                hasWheels: br.config.hasWheels,
                hasTop: br.config.hasTop,
                price: br.price,
                totalW: br.dimensions.totalW,
                totalH: br.dimensions.totalH,
                depth: br.dimensions.depth,
                desc: `${br.cols}W x ${br.rows}H`,
              },
            ]);
            results.push({
              type: "manifest",
              config: `${br.cols}x${br.rows}`,
              totals: manifest.totals,
              shopping_list: manifest.shopping_list,
              financials: manifest.financials,
            });
          }
          break;
        }

        case "materials": {
          // If wall dimensions given, first resolve to cols/rows
          let matCols = a.cols ?? 4;
          let matRows = a.rows ?? 4;
          if (a.wallWidth && a.wallHeight) {
            const fitResult = await calculateBuild({
              wallWidth: a.wallWidth, wallHeight: a.wallHeight,
              toteModel: a.toteModel ?? "HDX", toteColor: "black",
              unitType: a.unitType ?? "standard", orientation: a.orientation ?? "standard",
              addOns: { totes: a.hasTotes ?? true, wheels: a.hasWheels ?? false, top: a.hasTop ?? true },
              mode: "wallFit", installerPricing: ctx.installerPricing,
            });
            if (fitResult.success) { matCols = fitResult.cols; matRows = fitResult.rows; }
          }
          const r = await calculateMaterialCostServer(
            [
              {
                cols: matCols,
                rows: matRows,
                toteType: (a.toteModel ?? "HDX") as "HDX" | "GM",
                unitType: (a.unitType ?? "standard") as "standard" | "mini",
                hasTotes: a.hasTotes ?? true,
                hasWheels: a.hasWheels ?? false,
                hasTop: a.hasTop ?? true,
              },
            ],
            ctx.materialPrices ?? {},
          );
          results.push({
            type: "materials",
            config: `${matCols}x${matRows}`,
            totalCost: r.totalCost,
            items: r.items,
            rawCounts: r.rawCounts,
          });
          break;
        }

        case "profit": {
          if (a.jobPrice && a.materialsCost != null) {
            const r = await getBuildFeeBreakdown(
              a.jobPrice,
              a.materialsCost,
              ctx.installerId,
            );
            results.push({ type: "profit", ...r });
          }
          break;
        }

        case "list_presets": {
          // Handled by system prompt already, but include for completeness
          results.push({ type: "list_presets", note: "See presets in system context" });
          break;
        }
      }
    } catch {
      results.push({ type: a.type, error: "Calculation failed" });
    }
  }

  return results;
}

// ── Route handler ───────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, buildContext } = body as {
      messages: ChatMessage[];
      buildContext: Record<string, unknown>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const model = google("gemini-2.0-flash");

    const ctx: ToolContext = {
      installerPricing: (buildContext?.installerPricing as InstallerPricing) ?? undefined,
      materialPrices: (buildContext?.materialPrices as Record<string, number>) ?? undefined,
      installerId: (buildContext?.installerId as string) ?? undefined,
    };

    const systemPrompt = buildSystemPrompt(buildContext ?? {});
    const recentMessages = messages.slice(-20);
    const conversation = recentMessages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n");

    const latestQuestion = recentMessages[recentMessages.length - 1]?.text ?? "";

    // ── Step 1: Classify what calculations are needed ────────────────
    const plan = await generateObject({
      model,
      schema: ActionSchema,
      system: `You are a routing assistant for a storage unit build calculator.
Given the user's question and the current build context, determine what server-side calculations are needed.

Available calculation types:
- "build": Calculate price/dimensions for a unit. Two modes:
  - Wall-fit: provide wallWidth + wallHeight (in inches) — automatically calculates how many cols/rows fit
  - Manual: provide cols + rows directly
- "manifest": Get detailed 2x4 board counts, screw counts, plywood sheets, shopping list. USE THIS for any question about lumber, boards, 2x4s, screws, or hardware. Also supports wallWidth/wallHeight for wall-fit.
- "materials": Get itemized material COSTS (dollar amounts). Also supports wallWidth/wallHeight.
- "preset": Calculate a bestseller preset (indiana-joe, cornhusker, long-ranger, gas-station)
- "profit": Calculate installer profit (needs jobPrice and materialsCost)
- "list_presets": List available presets

IMPORTANT routing rules:
- When user gives wall dimensions (e.g. "149 x 89"), use wallWidth/wallHeight — do NOT guess cols/rows
- When user asks about 2x4s, boards, screws, lumber → use "manifest" (NOT "build")
- When user asks about material costs/pricing → use "materials"
- When user asks what fits a wall AND about materials → use BOTH "build" (for dimensions) AND "manifest" (for material counts) with the same wallWidth/wallHeight
- You can combine multiple actions in the array

Return an EMPTY actions array if the question can be answered from the context below.

${systemPrompt}`,
      prompt: `Latest question: ${latestQuestion}\n\nFull conversation:\n${conversation}`,
    });

    // ── Step 2: Run calculations ─────────────────────────────────────
    const calcResults = await runCalculations(plan.object.actions, ctx);

    // ── Step 3: Generate final answer ────────────────────────────────
    const calcContext =
      calcResults.length > 0
        ? `\n\n## Fresh Calculation Results\n\`\`\`json\n${JSON.stringify(calcResults, null, 2)}\n\`\`\``
        : "";

    const answer = await generateText({
      model,
      system: systemPrompt + calcContext,
      prompt: conversation,
    });

    return NextResponse.json({ text: answer.text });
  } catch (error: unknown) {
    console.error("Build assistant error:", error);

    const message =
      error instanceof Error
        ? error.cause instanceof Error
          ? error.cause.message
          : error.message
        : String(error);

    if (message.includes("quota") || message.includes("rate") || message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit reached. Wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: `Assistant error: ${message}` }, { status: 500 });
  }
}
