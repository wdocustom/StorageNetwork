// ═══════════════════════════════════════════════════════════════════════════
// AI Provider — Dual-provider: Google Gemini primary, Groq fallback
//
// Uses Gemini for best output quality. When rate-limited (429/quota),
// automatically falls back to Groq so the app never goes down.
// Vision and TTS routes still use their own providers directly.
// ═══════════════════════════════════════════════════════════════════════════

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import type { LanguageModel } from "ai";

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";

function getGeminiModel(): LanguageModel | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google(GEMINI_MODEL);
}

function getGroqModel(): LanguageModel | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const groq = createGroq({ apiKey });
  return groq(GROQ_FALLBACK_MODEL);
}

export function getChatModel(): LanguageModel {
  const gemini = getGeminiModel();
  if (gemini) return gemini;
  const groq = getGroqModel();
  if (groq) return groq;
  throw new Error("No AI provider configured — set GOOGLE_GENERATIVE_AI_API_KEY or GROQ_API_KEY");
}

export function getFallbackModel(): LanguageModel | null {
  if (getGeminiModel()) return getGroqModel();
  return null;
}

export function hasChatProvider(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GROQ_API_KEY;
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate");
}

/**
 * generateText with automatic fallback — tries primary (Gemini), retries
 * on Groq if rate-limited. Accepts the same options as generateText.
 */
export async function generateTextWithFallback(
  opts: Parameters<typeof generateText>[0],
): Promise<Awaited<ReturnType<typeof generateText>>> {
  try {
    return await generateText(opts);
  } catch (err) {
    const fallback = getFallbackModel();
    if (isRateLimitError(err) && fallback) {
      console.warn("[AI] Primary rate-limited, falling back to Groq");
      return await generateText({ ...opts, model: fallback });
    }
    throw err;
  }
}
