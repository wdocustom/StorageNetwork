"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useVoicePlayback — TTS audio playback with sentence-level queuing
//
// Sends text to /api/tts, receives audio, plays back sentence-by-sentence.
// Uses Web Audio API (AudioContext) for low-latency, gapless playback.
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
          console.error("TTS fetch failed:", res.status);
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        const ctx = getAudioCtx();
        return await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        console.error("TTS error:", err);
        return null;
      }
    },
    [getAudioCtx, voice]
  );

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
      queueRef.current = [];
      playingRef.current = false;

      const sentences = splitSentences(text);
      if (sentences.length === 0) {
        onFinishedRef.current?.();
        return;
      }

      setIsSpeaking(true);

      // Fetch all sentences in parallel, but play in order
      const buffers: (AudioBuffer | null)[] = new Array(sentences.length).fill(null);
      let nextToPlay = 0;
      let fetchedCount = 0;

      const tryPlay = () => {
        if (playingRef.current) return; // already playing, onended will call tryPlay via playNext
        if (controller.signal.aborted) return;

        // Queue up all consecutive ready buffers
        while (nextToPlay < buffers.length && buffers[nextToPlay] !== null) {
          queueRef.current.push(buffers[nextToPlay]!);
          nextToPlay++;
        }

        if (queueRef.current.length > 0 && !playingRef.current) {
          playNext();
        }

        // If all fetched and all played
        if (fetchedCount === sentences.length && nextToPlay >= sentences.length && queueRef.current.length === 0 && !playingRef.current) {
          setIsSpeaking(false);
          onFinishedRef.current?.();
        }
      };

      sentences.forEach((sentence, i) => {
        fetchTTS(sentence, controller.signal).then((buf) => {
          if (controller.signal.aborted) return;
          fetchedCount++;
          if (buf) {
            buffers[i] = buf;
          }
          tryPlay();
        });
      });
    },
    [fetchTTS, playNext]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
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
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { isSpeaking, speak, stop };
}
