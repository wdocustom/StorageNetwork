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
  calculateOverheadStorageUnit,
} from "@/app/actions/calculator";
import { generateBuildManifestServer } from "@/app/actions/build-manifest";
import { calculateMaterialCostServer } from "@/app/actions/calculate-materials";
import { getBuildFeeBreakdown } from "@/app/actions/fee-engine";
import { getServiceClient } from "@/lib/supabase-server";
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
          "custom_item",
          "overhead",
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
      customDescription: z.string().optional().describe("Description for custom line item (planter box, cleanout, etc.)"),
      customPrice: z.number().optional().describe("Price for custom line item"),
      overheadGridPresetId: z.enum(["2x2", "2x3", "3x2", "3x3", "3x4", "4x4"]).optional().describe("Overhead ceiling storage grid size"),
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
          const is2x4Manifest = ctx.installerPricing?.use_2x4_rails === true;
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
                use2x4Rails: is2x4Manifest,
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
          const is2x4Materials = ctx.installerPricing?.use_2x4_rails === true;
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
                orientation: (a.orientation ?? "standard") as "standard" | "sideways",
                hasTotes: a.hasTotes ?? true,
                hasWheels: a.hasWheels ?? false,
                hasTop: a.hasTop ?? true,
                use2x4Rails: is2x4Materials,
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

        case "custom_item": {
          // Custom line item (planter box, cleanout, etc.) — no calculation needed
          results.push({
            type: "custom_item",
            description: a.customDescription || "Custom item",
            price: a.customPrice || 0,
            note: "This is a custom line item. The installer can add it to their quote via the AI Builder text box.",
          });
          break;
        }

        case "overhead": {
          const gridId = a.overheadGridPresetId ?? "3x3";
          const toteType = (a.toteModel ?? "HDX") as "HDX" | "GM";
          const r = await calculateOverheadStorageUnit({
            config: { gridPresetId: gridId, toteType, hasTotes: a.hasTotes ?? true },
            installerPricing: ctx.installerPricing,
          });
          if (r.success) {
            results.push({
              type: "overhead",
              gridPreset: gridId,
              slotsWide: r.result.slotsWide,
              slotsDeep: r.result.slotsDeep,
              toteCount: r.result.toteCount,
              toteType: r.result.toteType,
              hasTotes: r.result.hasTotes,
              systemWidth: r.result.systemWidthIn,
              systemDepth: r.result.systemDepthIn,
              price: r.result.price,
              totePrice: r.result.totePrice,
              materials: r.result.materials,
            });
          } else {
            results.push({ type: "overhead", error: r.error });
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

// ── Learned corrections — fetched from DB, injected into prompt ─────────

async function fetchLearnedCorrections(): Promise<string> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("build_assistant_logs")
      .select("user_message, feedback_text")
      .eq("feedback_score", -1)
      .not("feedback_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return "";

    const corrections = data
      .map((r) => `- When asked "${r.user_message.slice(0, 80)}…" → Correction: ${r.feedback_text}`)
      .join("\n");

    return `\n\n## Learned Corrections (from past mistakes)\n${corrections}\n`;
  } catch {
    return "";
  }
}

// ── Silent conversation logging (fire-and-forget) ──────────────────────

// ── Auto-quality detection ──────────────────────────────────────────────

function detectQualityFlags(params: {
  userMessage: string;
  previousMessages: ChatMessage[];
  actions: unknown[];
  calcResults: Record<string, unknown>[];
  assistantResponse: string;
}): Record<string, unknown> {
  const flags: Record<string, unknown> = {};

  // 1. Calc errors — any action returned an error
  const calcErrors = params.calcResults.filter((r) => "error" in r);
  if (calcErrors.length > 0) {
    flags.calc_errors = calcErrors.length;
  }

  // 2. Empty classification — AI didn't know what calc to run
  if (Array.isArray(params.actions) && params.actions.length === 0 && params.userMessage.length > 20) {
    flags.no_actions_classified = true;
  }

  // 3. Retry pattern — user is rephrasing a previous question (similar words)
  const prevUserMsgs = params.previousMessages
    .filter((m) => m.role === "user")
    .map((m) => m.text.toLowerCase());
  const currentLower = params.userMessage.toLowerCase();
  const currentWords = new Set(currentLower.split(/\s+/).filter((w) => w.length > 3));
  for (const prev of prevUserMsgs.slice(-3)) {
    const prevWords = new Set(prev.split(/\s+/).filter((w: string) => w.length > 3));
    const overlap = Array.from(currentWords).filter((w) => prevWords.has(w)).length;
    const similarity = currentWords.size > 0 ? overlap / currentWords.size : 0;
    if (similarity > 0.6 && currentLower !== prev) {
      flags.possible_retry = true;
      break;
    }
  }

  // 4. Very short response — might indicate the AI didn't have enough context
  if (params.assistantResponse.length < 50) {
    flags.short_response = true;
  }

  // 5. Slow response
  // (latency is tracked separately, but flag extreme cases here)

  return flags;
}

function logConversationTurn(params: {
  installerId?: string;
  sessionId: string;
  turnIndex: number;
  userMessage: string;
  assistantResponse: string;
  actions: unknown[];
  calcResults: Record<string, unknown>[];
  previousMessages: ChatMessage[];
  latencyMs: number;
}) {
  const qualityFlags = detectQualityFlags({
    userMessage: params.userMessage,
    previousMessages: params.previousMessages,
    actions: params.actions,
    calcResults: params.calcResults,
    assistantResponse: params.assistantResponse,
  });

  // Non-blocking — don't await, don't let failures affect the response
  try {
    const supabase = getServiceClient();
    void supabase
      .from("build_assistant_logs")
      .insert({
        installer_id: params.installerId || null,
        session_id: params.sessionId,
        turn_index: params.turnIndex,
        user_message: params.userMessage.slice(0, 2000),
        assistant_response: params.assistantResponse.slice(0, 5000),
        actions_json: params.actions,
        calc_results_json: params.calcResults,
        quality_flags: qualityFlags,
        latency_ms: params.latencyMs,
      })
      .then(() => {});
  } catch {
    // Swallow — logging must never affect the response
  }
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const body = await request.json();
    const { messages, buildContext, sessionId } = body as {
      messages: ChatMessage[];
      buildContext: Record<string, unknown>;
      sessionId?: string;
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

    // Fetch learned corrections in parallel with prompt build
    const [learnedCorrections] = await Promise.all([fetchLearnedCorrections()]);

    const systemPrompt = buildSystemPrompt(buildContext ?? {}) + learnedCorrections;
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
- "custom_item": For custom products like planter boxes, cleanouts, workbenches, etc. Set customDescription and customPrice. Use this when the user asks about non-standard products.
- "overhead": Calculate overhead ceiling storage. Provide overheadGridPresetId (2x2, 2x3, 3x2, 3x3, 3x4, 4x4). Keywords: "overhead", "ceiling", "ceiling storage", "ceiling totes". Returns price, materials list, dimensions.

IMPORTANT routing rules:
- When user gives wall dimensions (e.g. "149 x 89"), use wallWidth/wallHeight — do NOT guess cols/rows
- When user asks about 2x4s, boards, screws, lumber → use "manifest" (NOT "build")
- When user asks about material costs/pricing → use "materials"
- When user asks what fits a wall AND about materials → use BOTH "build" (for dimensions) AND "manifest" (for material counts) with the same wallWidth/wallHeight
- When user asks about overhead/ceiling storage → use "overhead" with the grid size (overheadGridPresetId). Default to "3x3" if no size specified.
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

    // ── Step 4: Silent logging (fire-and-forget) ─────────────────────
    const latencyMs = Date.now() - startTime;
    const turnIndex = Math.floor(recentMessages.filter((m) => m.role === "user").length - 1);

    logConversationTurn({
      installerId: ctx.installerId,
      sessionId: sessionId || `anon-${Date.now()}`,
      turnIndex: Math.max(0, turnIndex),
      userMessage: latestQuestion,
      assistantResponse: answer.text,
      actions: plan.object.actions,
      calcResults,
      previousMessages: recentMessages.slice(0, -1),
      latencyMs,
    });

    return NextResponse.json({
      text: answer.text,
      // Return a log reference so the client can submit feedback later
      logRef: sessionId ? `${sessionId}:${turnIndex}` : undefined,
    });
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
