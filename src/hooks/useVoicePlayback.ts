"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useVoicePlayback — TTS audio playback via Web Audio API
//
// Sends full text to /api/tts, receives audio, plays via AudioContext.
// Falls back to browser speechSynthesis if cloud TTS is unavailable.
//
// Flow:
//   speak(text) → fetch /api/tts → decode audio → play → onFinished
// ═══════════════════════════════════════════════════════════════════════════

export interface UseVoicePlaybackReturn {
  /** Currently playing audio */
  isSpeaking: boolean;
  /** Send text to TTS and play the audio response */
  speak: (text: string) => void;
  /** Stop all playback */
  stop: () => void;
}

interface PlaybackOptions {
  /** Called when audio finishes playing */
  onFinished?: () => void;
  /** Voice name to pass to TTS API */
  voice?: string;
}

export function useVoicePlayback(options: PlaybackOptions = {}): UseVoicePlaybackReturn {
  const { onFinished, voice } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Lazy-init AudioContext (must be created after user gesture)
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Fetch TTS audio
  const fetchTTS = useCallback(
    async (text: string, signal: AbortSignal): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
          signal,
        });
        if (!res.ok) {
          console.error("[VoicePlayback] TTS fetch failed:", res.status, await res.text().catch(() => ""));
          return null;
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const err = await res.json();
          console.error("[VoicePlayback] TTS API error:", err);
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength < 100) {
          console.error("[VoicePlayback] TTS response too small:", arrayBuffer.byteLength, "bytes");
          return null;
        }
        console.log("[VoicePlayback] Decoding audio:", arrayBuffer.byteLength, "bytes, type:", contentType);
        const ctx = getAudioCtx();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          console.log("[VoicePlayback] Decoded OK:", audioBuffer.duration.toFixed(2) + "s", audioBuffer.sampleRate + "Hz");
          return audioBuffer;
        } catch (decodeErr) {
          console.error("[VoicePlayback] decodeAudioData FAILED:", decodeErr);
          return null;
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        console.error("[VoicePlayback] TTS error:", err);
        return null;
      }
    },
    [getAudioCtx, voice]
  );

  // Browser speechSynthesis fallback
  const speakWithBrowserTTS = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      onFinishedRef.current?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) => v.lang.startsWith("en") && /female|samantha|karen|victoria|zira|hazel/i.test(v.name)
    ) || voices.find((v) => v.lang.startsWith("en"));
    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.onend = () => {
      synthUtteranceRef.current = null;
      setIsSpeaking(false);
      onFinishedRef.current?.();
    };
    utterance.onerror = () => {
      synthUtteranceRef.current = null;
      setIsSpeaking(false);
      onFinishedRef.current?.();
    };

    synthUtteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Stop current playback
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
        sourceRef.current = null;
      }
      if (synthUtteranceRef.current) {
        window.speechSynthesis?.cancel();
        synthUtteranceRef.current = null;
      }

      if (!text.trim()) {
        onFinishedRef.current?.();
        return;
      }

      // Initialize AudioContext during user gesture callstack (required for iOS)
      try { getAudioCtx(); } catch {}

      setIsSpeaking(true);

      // Send full text as a single TTS request — ensures consistent voice
      fetchTTS(text, controller.signal).then((audioBuffer) => {
        if (controller.signal.aborted) return;

        if (audioBuffer) {
          // Play the decoded audio
          const ctx = getAudioCtx();
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          sourceRef.current = source;

          source.onended = () => {
            sourceRef.current = null;
            setIsSpeaking(false);
            // Suspend AudioContext to release the audio session — on Android,
            // an active AudioContext can prevent SpeechRecognition from
            // accessing the microphone (OS audio session conflict).
            if (audioCtxRef.current) {
              audioCtxRef.current.suspend();
            }
            onFinishedRef.current?.();
          };

          source.start(0);
        } else {
          // Cloud TTS failed — fall back to browser speechSynthesis
          console.warn("[VoicePlayback] Cloud TTS failed, falling back to browser speechSynthesis");
          speakWithBrowserTTS(text);
        }
      });
    },
    [fetchTTS, getAudioCtx, speakWithBrowserTTS]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (synthUtteranceRef.current) {
      window.speechSynthesis?.cancel();
      synthUtteranceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }
      window.speechSynthesis?.cancel();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { isSpeaking, speak, stop };
}
