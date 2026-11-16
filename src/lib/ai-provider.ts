// ═══════════════════════════════════════════════════════════════════════════
// AI Provider — Dual-provider: Google Gemini primary, Groq fallback
//
// Uses Gemini for best output quality. When rate-limited (429/quota),
// automatically falls back to Groq so the app never goes down.
// Vision and TTS routes still use their own providers directly.
// ═══════════════════════════════════════════════════════════════════════════

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, generateText } from "ai";
import type { LanguageModel } from "ai";

// gemini-2.5-flash is past Google's announced retirement window (earliest
// shutdown Oct 16, 2026). 3.8 Flash is the current GA Flash model.
export const GEMINI_MODEL = "gemini-3.8-flash";
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
 * Human-readable description of an AI provider failure. On Cloudflare
 * Workers, `console.error(err)` only records the stack — the HTTP status
 * and Google's error body were being dropped, so a Gemini 400 showed up
 * in the logs as an anonymous stack trace. Use this when logging.
 */
export function describeAIError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    let detail = err.message;
    try {
      const body = JSON.parse(err.responseBody ?? "");
      if (body?.error?.message) detail = `${body.error.status ?? ""} ${body.error.message}`.trim();
    } catch {
      if (err.responseBody) detail = err.responseBody.slice(0, 500);
    }
    return `${err.statusCode ?? "?"} from ${err.url.replace(/\?.*$/, "")}: ${detail}`;
  }
  if (err instanceof Error) {
    return err.cause instanceof Error ? `${err.message} (cause: ${err.cause.message})` : err.message;
  }
  return String(err);
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
    console.error("[AI] generateText failed:", describeAIError(err));
    const fallback = getFallbackModel();
    if (isRateLimitError(err) && fallback) {
      console.warn("[AI] Primary rate-limited, falling back to Groq");
      return await generateText({ ...opts, model: fallback });
    }
    throw err;
  }
}
