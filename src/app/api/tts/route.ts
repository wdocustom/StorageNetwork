// ═══════════════════════════════════════════════════════════════════════════
// TTS API — Text-to-Speech proxy
//
// Gemini TTS (primary) → OpenAI TTS (fallback)
//
// Keeps API keys server-side. Returns audio stream.
// Used by the voice Design Assistant for AI spoken responses.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const maxDuration = 15;

// Gemini TTS voices — female voices for the Design Assistant
const GEMINI_VOICE = "Kore"; // Clear, warm female voice
const OPENAI_VOICE = "nova"; // Fallback: pleasant female voice

export async function POST(req: NextRequest) {
  // SECURITY (H-1): TTS is a paid upstream API. Reject anon callers before
  // touching either provider key so a bot cannot drain the TTS budget.
  const authedUser = await getAuthenticatedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

// Models to try in order — newest TTS-specific models first
const GEMINI_TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
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
            responseModalities: ["AUDIO"],
            speechConfig: {
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
        console.error(`[TTS] Gemini ${model} error: HTTP ${res.status} — ${errText.slice(0, 500)}`);
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
      const pcmBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pcmBytes[i] = binaryStr.charCodeAt(i);
      }

      const mime: string = audioPart.inlineData.mimeType || "";
      console.log(`[TTS] Gemini ${model} success: ${pcmBytes.length} bytes, mime: ${mime}`);

      // Check if data already has WAV headers (starts with "RIFF")
      const hasWavHeader =
        pcmBytes.length > 44 &&
        pcmBytes[0] === 0x52 && // R
        pcmBytes[1] === 0x49 && // I
        pcmBytes[2] === 0x46 && // F
        pcmBytes[3] === 0x46;   // F

      if (hasWavHeader) {
        console.log(`[TTS] Audio already has WAV headers`);
        return pcmBytes.buffer;
      }

      // Raw PCM from Gemini — wrap in WAV headers so browsers can decode it.
      // Gemini TTS returns Linear16 PCM. Parse sample rate from mimeType if
      // present (e.g. "audio/L16;rate=24000"), otherwise default to 24000 Hz.
      let sampleRate = 24000;
      const rateMatch = mime.match(/rate=(\d+)/);
      if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);
      console.log(`[TTS] Wrapping raw PCM in WAV headers (rate=${sampleRate})`);

      const wavBytes = wrapPCMInWav(pcmBytes, sampleRate, 1, 16);
      return wavBytes.buffer as ArrayBuffer;
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

// ═══════════════════════════════════════════════════════════════════════════
// WAV header wrapper — turns raw Linear16 PCM into a valid WAV file
// ═══════════════════════════════════════════════════════════════════════════

function wrapPCMInWav(
  pcm: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Uint8Array {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true); // file size minus RIFF header
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);          // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true);           // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Copy PCM data after the 44-byte header
  const wav = new Uint8Array(buffer);
  wav.set(pcm, headerSize);

  return wav;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
