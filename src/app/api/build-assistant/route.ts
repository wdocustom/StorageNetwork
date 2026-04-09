// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT API — AI endpoint with tool-calling
// Uses generateText (proven pattern) + Gemini 2.0 Flash for real calculations.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";

export const maxDuration = 30; // Vercel serverless timeout

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
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 },
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

    // Format conversation history as a prompt string (proven pattern)
    const recentMessages = messages.slice(-20);
    const conversationPrompt = recentMessages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n");

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      prompt: conversationPrompt,
      tools,
      stopWhen: stepCountIs(5),
    });

    return NextResponse.json({ text: result.text });
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
      return NextResponse.json(
        { error: "Rate limit reached. Wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: `Assistant error: ${message}` },
      { status: 500 },
    );
  }
}
