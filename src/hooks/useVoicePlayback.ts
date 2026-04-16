"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useVoicePlayback — TTS audio playback with sentence-level queuing
//
// Sends text to /api/tts, receives audio, plays back sentence-by-sentence.
// Uses Web Audio API (AudioContext) for low-latency, gapless playback.
// Falls back to browser speechSynthesis if TTS API is unavailable.
//
// Flow:
//   speak(text) → split into sentences → fetch /api/tts per sentence
//   → decode audio → queue → play back-to-back → onFinished callback
// ═══════════════════════════════════════════════════════════════════════════

export interface UseVoicePlaybackReturn {
  /** Currently playing audio */
  isSpeaking: boolean;
  /** Send full text to TTS — auto-splits into sentences and plays */
  speak: (text: string) => void;
  /** Stop all playback and clear queue */
  stop: () => void;
}

/** Split text into sentences for sentence-level TTS streaming */
function splitSentences(text: string): string[] {
  // Split on sentence boundaries but keep the punctuation
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!raw) return text.trim() ? [text.trim()] : [];
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
}

interface PlaybackOptions {
  /** Called when all queued audio finishes playing */
  onFinished?: () => void;
  /** Voice name to pass to TTS API */
  voice?: string;
}

export function useVoicePlayback(options: PlaybackOptions = {}): UseVoicePlaybackReturn {
  const { onFinished, voice } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const playingRef = useRef(false);
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
    // Resume if suspended (browsers suspend until user gesture)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Play next buffer from queue
  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || queueRef.current.length === 0) {
      playingRef.current = false;
      setIsSpeaking(false);
      onFinishedRef.current?.();
      return;
    }

    playingRef.current = true;
    setIsSpeaking(true);

    const buffer = queueRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    sourceRef.current = source;

    source.onended = () => {
      sourceRef.current = null;
      playNext();
    };

    source.start(0);
  }, []);

  // Fetch TTS audio for a single sentence
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
          // API returned an error JSON instead of audio
          const err = await res.json();
          console.error("[VoicePlayback] TTS API error:", err);
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength < 100) {
          console.error("[VoicePlayback] TTS response too small:", arrayBuffer.byteLength, "bytes");
          return null;
        }
        const ctx = getAudioCtx();
        return await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        console.error("[VoicePlayback] TTS error:", err);
        return null;
      }
    },
    [getAudioCtx, voice]
  );

  // Browser speechSynthesis fallback — used when cloud TTS is unavailable
  const speakWithBrowserTTS = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      // No TTS available at all — just finish
      setIsSpeaking(false);
      onFinishedRef.current?.();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a female English voice
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
      // Abort any in-flight requests
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
      queueRef.current = [];
      playingRef.current = false;

      // Initialize AudioContext during user gesture callstack (required for iOS)
      try { getAudioCtx(); } catch {}

      const sentences = splitSentences(text);
      if (sentences.length === 0) {
        onFinishedRef.current?.();
        return;
      }

      setIsSpeaking(true);

      // Track which sentences have been fetched (to distinguish "not fetched" from "fetch failed")
      const fetchedSet = new Set<number>();
      const buffers: (AudioBuffer | null)[] = new Array(sentences.length).fill(null);
      let nextToPlay = 0;
      let allTTSFailed = true;

      const tryPlay = () => {
        if (playingRef.current) return; // already playing, onended will call tryPlay via playNext
        if (controller.signal.aborted) return;

        // Advance past all fetched sentences (queue successful ones, skip failed ones)
        while (nextToPlay < sentences.length && fetchedSet.has(nextToPlay)) {
          if (buffers[nextToPlay]) {
            queueRef.current.push(buffers[nextToPlay]!);
          }
          // If buffer is null but it was fetched, skip it (TTS failed for this sentence)
          nextToPlay++;
        }

        if (queueRef.current.length > 0 && !playingRef.current) {
          playNext();
          return; // playNext will call tryPlay again when done
        }

        // All sentences fetched and processed?
        if (fetchedSet.size === sentences.length && nextToPlay >= sentences.length && queueRef.current.length === 0 && !playingRef.current) {
          if (allTTSFailed) {
            // Cloud TTS completely unavailable — fall back to browser speechSynthesis
            console.warn("[VoicePlayback] All cloud TTS failed, falling back to browser speechSynthesis");
            speakWithBrowserTTS(text);
          } else {
            setIsSpeaking(false);
            onFinishedRef.current?.();
          }
        }
      };

      sentences.forEach((sentence, i) => {
        fetchTTS(sentence, controller.signal).then((buf) => {
          if (controller.signal.aborted) return;
          fetchedSet.add(i);
          if (buf) {
            buffers[i] = buf;
            allTTSFailed = false;
          }
          tryPlay();
        });
      });
    },
    [fetchTTS, playNext, getAudioCtx, speakWithBrowserTTS]
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
    queueRef.current = [];
    playingRef.current = false;
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
