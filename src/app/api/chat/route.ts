// ═══════════════════════════════════════════════════════════════════════════
// Chat API — Streaming AI Assistant
//
// Supports two modes:
//   "installer" — sales chatbot for /join, /partner/join, /invite
//   "customer"  — conversational configurator for /design pages
//     Accepts installerContext to tailor responses to the specific
//     installer's pricing, services, and product toggles.
//
// Uses Gemini 2.0 Flash (switchable via AI_CHAT_MODEL env).
// Public endpoint — no auth required.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { buildInstallerChatPrompt } from "@/lib/ai/installer-chat-prompt";
import { buildCustomerChatPrompt, type InstallerChatContext } from "@/lib/ai/customer-chat-prompt";

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

  // Customer mode gets more history (config builds over many exchanges)
  const maxMessages = mode === "customer" ? 20 : 10;
  const truncated = messages.slice(-maxMessages).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const google = createGoogleGenerativeAI({ apiKey });
  const model = process.env.AI_CHAT_MODEL || "gemini-2.0-flash";

  const systemPrompt = mode === "customer"
    ? buildCustomerChatPrompt(body.installerContext)
    : buildInstallerChatPrompt();

  const result = streamText({
    model: google(model),
    system: systemPrompt,
    messages: truncated,
  });

  return result.toTextStreamResponse();
}
