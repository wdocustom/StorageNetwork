// ═══════════════════════════════════════════════════════════════════════════
// AI Provider — Centralized chat model for all text-generation routes
//
// Uses Groq (fast, generous free tier) for text generation.
// Vision and TTS routes still use their own providers.
// ═══════════════════════════════════════════════════════════════════════════

import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

const DEFAULT_CHAT_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";

/**
 * Returns the configured chat model for generateText / streamText / generateObject.
 * Throws if GROQ_API_KEY is not set — callers should check `hasChatProvider()` first
 * or catch the error to return a 500 with a clear message.
 */
export function getChatModel(overrideModel?: string): LanguageModel {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("AI chat provider not configured — GROQ_API_KEY missing");
  }
  const groq = createGroq({ apiKey });
  const envModel = process.env.AI_CHAT_MODEL;
  // Ignore stale Google model names left in env vars
  const isGroqModel = envModel && !envModel.startsWith("gemini");
  return groq(overrideModel || (isGroqModel ? envModel : DEFAULT_CHAT_MODEL));
}

export function hasChatProvider(): boolean {
  return !!process.env.GROQ_API_KEY;
}
