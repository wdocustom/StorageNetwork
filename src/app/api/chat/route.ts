// ═══════════════════════════════════════════════════════════════════════════
// Installer Chat API — Streaming AI Sales Assistant
//
// Conversion-focused chatbot for installer signup pages (/join, /partner/join).
// Uses Gemini 2.0 Flash for streaming responses via Vercel AI SDK.
// Public endpoint — rate limited by IP.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { buildInstallerChatPrompt } from "@/lib/ai/installer-chat-prompt";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return new Response("AI not configured", { status: 500 });
  }

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const messages = body.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages required", { status: 400 });
  }

  // Truncate to last 10 messages to control token costs
  const truncated = messages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const google = createGoogleGenerativeAI({ apiKey });
  const model = process.env.AI_CHAT_MODEL || "gemini-2.0-flash";

  const result = streamText({
    model: google(model),
    system: buildInstallerChatPrompt(),
    messages: truncated,
  });

  return result.toTextStreamResponse();
}
