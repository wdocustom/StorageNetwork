// ═══════════════════════════════════════════════════════════════════════════
// Chat API — Streaming AI Assistant with Tool Calling
//
// Supports two modes:
//   "installer" — sales chatbot for /join, /partner/join, /invite, /features
//   "customer"  — design assistant for /design pages
//     Uses tool calling to get REAL pricing from calculateBuild()
//     instead of lookup tables. Pricing is always 100% accurate.
//
// Uses Gemini 2.0 Flash (switchable via AI_CHAT_MODEL env).
// Public endpoint — no auth required.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import { z } from "zod";
import { buildInstallerChatPrompt } from "@/lib/ai/installer-chat-prompt";
import { buildCustomerChatPrompt, type InstallerChatContext } from "@/lib/ai/customer-chat-prompt";
import { calculateBuild, calculateShelvingUnit, calculateOverheadStorageUnit } from "@/app/actions/calculator";
import { calculateRaisedBedPriceServer } from "@/app/actions/platform-defaults";
import { lookupPlatformInfo } from "@/lib/ai/platform-registry";
import type { InstallerPricing } from "@/types/viewModels";

export const maxDuration = 30;

type ChatMode = "installer" | "customer";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return new Response("AI not configured", { status: 500 });
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    mode?: string;
    installerContext?: InstallerChatContext;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages required", { status: 400 });
  }

  const mode: ChatMode = body.mode === "customer" ? "customer" : "installer";

  const maxMessages = mode === "customer" ? 20 : 10;
  const truncated = messages.slice(-maxMessages).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const google = createGoogleGenerativeAI({ apiKey });
  const model = process.env.AI_CHAT_MODEL || "gemini-2.0-flash";
  console.log(`[Chat] Using model: ${model} | Mode: ${mode}`);

  const systemPrompt = mode === "customer"
    ? buildCustomerChatPrompt(body.installerContext)
    : buildInstallerChatPrompt();

  // Build installer pricing object for the calculator from the context
  const installerPricing: InstallerPricing | undefined = body.installerContext ? {
    standard_slot: body.installerContext.standardSlot,
    mini_slot: body.installerContext.miniSlot,
    standard_tote: body.installerContext.standardTote,
    standard_tote_clear: body.installerContext.standardToteClear,
    mini_tote: body.installerContext.miniTote,
    standard_wheels: body.installerContext.standardWheels,
    mini_wheels: body.installerContext.miniWheels,
    plywood_top: body.installerContext.plywoodTop,
  } : undefined;

  // Customer mode gets tool calling for accurate pricing
  const calcSchema = z.object({
    cols: z.number().int().min(1).max(12).describe("Number of columns wide"),
    rows: z.number().int().min(1).max(6).describe("Number of tiers/rows tall"),
    toteColor: z.enum(["black", "clear"]).default("black").describe("HDX tote color"),
    hasTotes: z.boolean().describe("Whether totes are included in the price"),
    hasWheels: z.boolean().describe("Whether industrial casters are included"),
    hasTop: z.boolean().describe("Whether a plywood countertop is included"),
  });

  const customerTools = mode === "customer" ? {
    calculate_price: {
      description: "Calculate the exact price for a tote storage rack configuration. ALWAYS use this tool before quoting any price to the customer. Never estimate or calculate prices yourself.",
      inputSchema: calcSchema,
      execute: async (input: z.infer<typeof calcSchema>) => {
        try {
          const result = await calculateBuild({
            cols: input.cols,
            rows: input.rows,
            toteModel: "HDX",
            toteColor: input.toteColor,
            unitType: "standard",
            orientation: "standard",
            addOns: { totes: input.hasTotes, wheels: input.hasWheels, top: input.hasTop },
            mode: "manual",
            installerPricing,
          });
          if ("price" in result) {
            return {
              price: result.price,
              cols: result.cols,
              rows: result.rows,
              slots: result.config.slots,
              topSheets: result.config.topSheets,
              dimensions: result.dimensions,
              hasTotes: result.config.hasTotes,
              hasWheels: result.config.hasWheels,
              hasTop: result.config.hasTop,
            };
          }
          return { error: result.error };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Calculation failed" };
        }
      },
    },
    calculate_overhead: {
      description: "Calculate exact price for overhead ceiling storage. Call before quoting price.",
      inputSchema: z.object({
        gridId: z.string().describe("Grid size ID: 2x2, 2x3, 3x2, 3x3, 3x4, or 4x4"),
        hasTotes: z.boolean().describe("Whether to include totes"),
      }),
      execute: async (input: z.infer<z.ZodObject<{ gridId: z.ZodString; hasTotes: z.ZodBoolean }>>) => {
        try {
          const result = await calculateOverheadStorageUnit({
            config: { gridPresetId: input.gridId, toteType: "HDX", hasTotes: input.hasTotes },
            installerPricing,
          });
          if (result.success) return { price: result.result.price + result.result.totePrice, gridId: input.gridId, toteCount: result.result.toteCount };
          return { error: result.error };
        } catch (err) { return { error: err instanceof Error ? err.message : "Failed" }; }
      },
    },
    calculate_shelving: {
      description: "Calculate exact price for open shelving unit. Call before quoting price.",
      inputSchema: z.object({
        configId: z.string().describe("Config ID: shelf-4ft-short, shelf-5ft-short, shelf-6ft-short, shelf-4ft-tall, shelf-5ft-tall, or shelf-6ft-tall"),
      }),
      execute: async (input: z.infer<z.ZodObject<{ configId: z.ZodString }>>) => {
        try {
          const result = await calculateShelvingUnit({ configId: input.configId, installerPricing });
          if (result.success) return { price: result.price, configId: input.configId, label: result.label };
          return { error: result.error };
        } catch (err) { return { error: err instanceof Error ? err.message : "Failed" }; }
      },
    },
    calculate_raised_bed: {
      description: "Calculate exact price for a raised bed planter. Call before quoting price.",
      inputSchema: z.object({
        sizeId: z.string().describe("Size ID: legs_12x48x16, legs_24x48x16, legs_24x48x30, legs_24x72x16, legs_24x24x16_post, ground_24x72x11, ground_24x72x22, ground_36x72x22, ground_48x48x22"),
        finish: z.string().describe("Wood finish: natural, stain, or painted_white"),
        hasLiner: z.boolean().describe("Waterproof liner"),
        pestCover: z.string().describe("Pest protection: none, hoop, rigid_cage, cabinet_24, or cabinet_48"),
      }),
      execute: async (input: { sizeId: string; finish: string; hasLiner: boolean; pestCover: string }) => {
        try {
          const result = await calculateRaisedBedPriceServer({
            sizeId: input.sizeId, finish: input.finish, hasLiner: input.hasLiner,
            depthIncrease: false, bottomShelf: false, pestCover: input.pestCover,
          });
          return { price: result.total, breakdown: result.breakdown };
        } catch (err) { return { error: err instanceof Error ? err.message : "Failed" }; }
      },
    },
  } : undefined;

  // Platform lookup tool — available to BOTH installer and customer chatbots
  const lookupSchema = z.object({
    query: z.string().describe("What the user is asking about — e.g. 'demo', 'pricing', 'reviews', 'how do payments work', 'territory', 'what products can I build'"),
  });
  const lookupTool = {
    lookup_platform: {
      description: "Look up information about the Storage Network platform — pages, features, pricing, trial details, and FAQ. Use this when the user asks about anything you're not 100% certain about. Better to look it up than guess wrong.",
      inputSchema: lookupSchema,
      execute: async (input: z.infer<typeof lookupSchema>) => {
        const audience = mode === "customer" ? "customer" : "installer";
        return lookupPlatformInfo(input.query, audience);
      },
    },
  };

  // Merge tools based on mode
  const tools = {
    ...lookupTool,
    ...(customerTools || {}),
  };

  const result = streamText({
    model: google(model),
    system: systemPrompt,
    messages: truncated,
    tools,
    stopWhen: stepCountIs(4),
  });

  return result.toTextStreamResponse();
}
