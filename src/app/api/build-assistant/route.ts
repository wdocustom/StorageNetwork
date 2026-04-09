// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT API — Streaming AI endpoint with tool-calling
// Uses Gemini 2.0 Flash for fast, capable responses with real calculations.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type CoreMessage } from "ai";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";

export const maxDuration = 30; // Vercel serverless timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, buildContext } = body as {
      messages: CoreMessage[];
      buildContext: Record<string, unknown>;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    // Build tool context from the request
    const toolContext = {
      installerPricing: (buildContext?.installerPricing as Record<string, unknown>) ?? undefined,
      materialPrices: (buildContext?.materialPrices as Record<string, number>) ?? undefined,
      installerId: (buildContext?.installerId as string) ?? undefined,
    };

    const systemPrompt = buildSystemPrompt(buildContext ?? {});
    const tools = buildTools(toolContext);

    // Limit conversation history to last 20 messages to control token usage
    const recentMessages = messages.slice(-20);

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      messages: recentMessages,
      tools,
      maxSteps: 5, // Allow up to 5 tool calls per response (for multi-part questions)
    });

    return result.toDataStreamResponse();
  } catch (error: unknown) {
    console.error("Build assistant error:", error);

    let message: string;
    if (error instanceof Error) {
      message = error.message;
      if ((error as Record<string, unknown>).cause instanceof Error) {
        message = ((error as Record<string, unknown>).cause as Error).message;
      }
    } else {
      message = String(error);
    }

    if (message.includes("quota") || message.includes("rate") || message.includes("429")) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Wait a moment and try again." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Assistant error: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
