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
      const audio = await geminiTTS(text, body.voice || GEMINI_VOICE, googleKey);
      if (audio) {
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/wav",
            "Cache-Control": "no-store",
          },
        });
      }
    } catch (err) {
      console.error("[TTS] Gemini TTS failed, trying fallback:", err);
    }
  }

  // ── Fallback to OpenAI TTS ────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const audio = await openaiTTS(text, body.voice || OPENAI_VOICE, openaiKey);
      if (audio) {
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      }
    } catch (err) {
      console.error("[TTS] OpenAI TTS failed:", err);
    }
  }

  return NextResponse.json(
    { error: "TTS unavailable — no provider configured or all providers failed" },
    { status: 503 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Gemini TTS — uses the generative language API with audio output
// ═══════════════════════════════════════════════════════════════════════════

async function geminiTTS(
  text: string,
  voice: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text }],
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
    console.error("[TTS] Gemini error:", res.status, errText);
    return null;
  }

  const data = await res.json();

  // Extract audio from Gemini response
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return null;

  const audioPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("audio/"));
  if (!audioPart?.inlineData?.data) return null;

  // Gemini returns base64-encoded audio
  const binaryStr = atob(audioPart.inlineData.data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
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
