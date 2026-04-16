// ═══════════════════════════════════════════════════════════════════════════
// TTS API — Text-to-Speech proxy
//
// Gemini TTS (primary) → OpenAI TTS (fallback)
//
// Keeps API keys server-side. Returns audio stream.
// Used by the voice Design Assistant for AI spoken responses.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

// Gemini TTS voices — female voices for the Design Assistant
const GEMINI_VOICE = "Kore"; // Clear, warm female voice
const OPENAI_VOICE = "nova"; // Fallback: pleasant female voice

export async function POST(req: NextRequest) {
  let body: { text?: string; voice?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length === 0) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: "Text too long (max 4096 chars)" }, { status: 400 });
  }

  // ── Try Gemini TTS first ──────────────────────────────────────────────
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleKey) {
    try {
      console.log("[TTS] Trying Gemini TTS...");
      const audio = await geminiTTS(text, body.voice || GEMINI_VOICE, googleKey);
      if (audio) {
        console.log("[TTS] Gemini TTS success:", audio.byteLength, "bytes");
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      }
      console.warn("[TTS] Gemini TTS returned null");
    } catch (err) {
      console.error("[TTS] Gemini TTS failed, trying fallback:", err);
    }
  } else {
    console.warn("[TTS] No GOOGLE_GENERATIVE_AI_API_KEY set");
  }

  // ── Fallback to OpenAI TTS ────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      console.log("[TTS] Trying OpenAI TTS fallback...");
      const audio = await openaiTTS(text, body.voice || OPENAI_VOICE, openaiKey);
      if (audio) {
        console.log("[TTS] OpenAI TTS success:", audio.byteLength, "bytes");
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      }
      console.warn("[TTS] OpenAI TTS returned null");
    } catch (err) {
      console.error("[TTS] OpenAI TTS failed:", err);
    }
  } else {
    console.log("[TTS] No OPENAI_API_KEY set, skipping OpenAI fallback");
  }

  console.error("[TTS] All providers failed — returning 503");
  return NextResponse.json(
    { error: "TTS unavailable — no provider configured or all providers failed" },
    { status: 503 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Gemini TTS — tries multiple model versions for compatibility
// ═══════════════════════════════════════════════════════════════════════════

// Models to try in order — the TTS preview model first, then multimodal fallback
const GEMINI_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.0-flash",
];

async function geminiTTS(
  text: string,
  voice: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  for (const model of GEMINI_TTS_MODELS) {
    try {
      console.log(`[TTS] Trying Gemini model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Read this aloud naturally: ${text}` }],
            },
          ],
          generationConfig: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[TTS] Gemini ${model} error:`, res.status, errText.slice(0, 200));
        continue; // Try next model
      }

      const data = await res.json();

      // Extract audio from Gemini response
      const parts = data?.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        console.warn(`[TTS] Gemini ${model}: no parts in response`);
        continue;
      }

      const audioPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("audio/"));
      if (!audioPart?.inlineData?.data) {
        console.warn(`[TTS] Gemini ${model}: no audio part found. Parts:`, parts.map((p: any) => Object.keys(p)));
        continue;
      }

      // Gemini returns base64-encoded audio
      const binaryStr = atob(audioPart.inlineData.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      console.log(`[TTS] Gemini ${model} success: ${bytes.length} bytes, mime: ${audioPart.inlineData.mimeType}`);
      return bytes.buffer;
    } catch (err) {
      console.error(`[TTS] Gemini ${model} exception:`, err);
      continue;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// OpenAI TTS — fallback provider
// ═══════════════════════════════════════════════════════════════════════════

async function openaiTTS(
  text: string,
  voice: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voice,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[TTS] OpenAI error:", res.status, errText);
    return null;
  }

  return res.arrayBuffer();
}
