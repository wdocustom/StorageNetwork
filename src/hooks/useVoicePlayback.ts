"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useVoicePlayback — TTS audio playback with sentence streaming
//
// Sends text to /api/tts sentence-by-sentence for low latency.
// First sentence starts playing while remaining sentences are fetched.
// Uses Web Audio API (AudioContext) for gapless playback.
// Falls back to browser speechSynthesis if cloud TTS is unavailable.
// ═══════════════════════════════════════════════════════════════════════════

export interface UseVoicePlaybackReturn {
  /** Currently playing audio */
  isSpeaking: boolean;
  /** Elapsed playback time in seconds (updates ~60fps while speaking) */
  playbackTime: number;
  /** Total estimated duration of all audio in seconds */
  totalDuration: number;
  /** Send text to TTS and play the audio response */
  speak: (text: string) => void;
  /** Stop all playback */
  stop: () => void;
}

/** Split text into sentences, then merge short ones to reduce TTS API calls.
 *  Aim for chunks of ~80-200 chars each. */
function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!raw) return text.trim() ? [text.trim()] : [];
  const sentences = raw.map((s) => s.trim()).filter((s) => s.length > 0);

  // Merge short sentences to reduce API calls
  const merged: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && (current.length + s.length) > 200) {
      merged.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) merged.push(current);
  return merged;
}

interface PlaybackOptions {
  /** Called when all audio finishes playing */
  onFinished?: () => void;
  /** Voice name to pass to TTS API */
  voice?: string;
}

export function useVoicePlayback(options: PlaybackOptions = {}): UseVoicePlaybackReturn {
  const { onFinished, voice } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef(0);
  const elapsedBeforeRef = useRef(0);

  // Update playback timer via requestAnimationFrame
  const startTimer = useCallback(() => {
    playStartRef.current = performance.now();
    const tick = () => {
      const elapsed = elapsedBeforeRef.current + (performance.now() - playStartRef.current) / 1000;
      setPlaybackTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Lazy-init AudioContext
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Fetch TTS audio for a chunk of text
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
          console.error("[VoicePlayback] TTS fetch failed:", res.status);
          return null;
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength < 100) return null;
        const ctx = getAudioCtx();
        return await ctx.decodeAudioData(arrayBuffer.slice(0));
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
      stopTimer();
      setPlaybackTime(0);
      setTotalDuration(0);
      elapsedBeforeRef.current = 0;

      if (!text.trim()) {
        onFinishedRef.current?.();
        return;
      }

      // Init AudioContext during user gesture callstack
      try { getAudioCtx(); } catch {}

      const sentences = splitSentences(text);
      if (sentences.length === 0) {
        onFinishedRef.current?.();
        return;
      }

      setIsSpeaking(true);

      // Sentence-level streaming: fetch all in parallel, play in order
      const buffers: (AudioBuffer | null)[] = new Array(sentences.length).fill(null);
      const fetched = new Set<number>();
      let nextToPlay = 0;
      let isPlaying = false;
      let allTTSFailed = true;
      let accDuration = 0;

      const playNext = () => {
        if (controller.signal.aborted) return;

        // Skip any failed sentences, queue next successful one
        while (nextToPlay < sentences.length && fetched.has(nextToPlay)) {
          if (buffers[nextToPlay]) {
            // Play this buffer
            const buf = buffers[nextToPlay]!;
            nextToPlay++;
            isPlaying = true;

            const ctx = getAudioCtx();
            const source = ctx.createBufferSource();
            source.buffer = buf;
            source.connect(ctx.destination);
            sourceRef.current = source;

            playStartRef.current = performance.now();
            startTimer();

            source.onended = () => {
              sourceRef.current = null;
              stopTimer();
              elapsedBeforeRef.current += buf.duration;
              isPlaying = false;
              playNext();
            };

            source.start(0);
            return;
          }
          nextToPlay++;
        }

        // If all sentences fetched and processed
        if (fetched.size === sentences.length && nextToPlay >= sentences.length) {
          stopTimer();
          setIsSpeaking(false);
          if (allTTSFailed) {
            speakWithBrowserTTS(text);
          } else {
            // Suspend AudioContext to release audio session for mic on Android
            if (audioCtxRef.current) {
              audioCtxRef.current.suspend();
            }
            onFinishedRef.current?.();
          }
          return;
        }

        // Still waiting for more sentences to be fetched
      };

      sentences.forEach((sentence, i) => {
        fetchTTS(sentence, controller.signal).then((buf) => {
          if (controller.signal.aborted) return;
          fetched.add(i);
          if (buf) {
            buffers[i] = buf;
            allTTSFailed = false;
            accDuration += buf.duration;
            setTotalDuration(accDuration);
          }
          if (!isPlaying) playNext();
        });
      });
    },
    [fetchTTS, getAudioCtx, speakWithBrowserTTS, startTimer, stopTimer]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (synthUtteranceRef.current) {
      window.speechSynthesis?.cancel();
      synthUtteranceRef.current = null;
    }
    setIsSpeaking(false);
    setPlaybackTime(0);
    setTotalDuration(0);
    elapsedBeforeRef.current = 0;
  }, [stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopTimer();
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }
      window.speechSynthesis?.cancel();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopTimer]);

  return { isSpeaking, playbackTime, totalDuration, speak, stop };
}
