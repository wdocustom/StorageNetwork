"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useSpeechRecognition — Browser speech-to-text hook
//
// Wraps the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
// Single-utterance mode: auto-stops after user pauses speaking (~1.5s).
//
// IMPORTANT: Call requestMicPermission() during a user gesture (button click)
// BEFORE calling start(). Chrome won't show the mic permission prompt
// unless it's triggered from a user gesture context. Once granted, all
// subsequent start() calls work even outside gestures.
//
// Browser support:
//   Chrome/Edge — full
//   Safari 14.1+ — works with getUserMedia pre-flight
//   Firefox — not supported (isSupported = false)
// ═══════════════════════════════════════════════════════════════════════════

export type SpeechError =
  | "unsupported"   // Browser doesn't have SpeechRecognition
  | "denied"        // User blocked microphone permission
  | "no-speech"     // No speech detected before timeout
  | "network"       // Network error (speech API needs connectivity)
  | "aborted"       // Recognition was aborted
  | null;

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: SpeechError;
  errorMessage: string | null;
  isSupported: boolean;
  /** Call during a user gesture to request mic permission upfront */
  requestMicPermission: () => Promise<boolean>;
  start: () => void;
  stop: () => void;
  clear: () => void;
}

// Web Speech API types (not in all TS lib sets)
type SpeechRecognitionType = any;

// Feature detection
function getSpeechRecognitionCtor(): (new () => SpeechRecognitionType) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

function classifySpeechError(event: any): SpeechError {
  const err = event?.error || event;
  switch (err) {
    case "not-allowed":
      return "denied";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "network";
  }
}

function getErrorMessage(error: SpeechError): string | null {
  switch (error) {
    case "unsupported": return "Voice input is not available in this browser.";
    case "denied": return "Microphone blocked. Tap the lock icon next to the URL and allow microphone access, then try again.";
    case "no-speech": return "No speech detected. Try speaking louder or closer to the mic.";
    case "network": return "Speech recognition network error. Check your connection.";
    case "aborted": return null;
    case null: return null;
  }
}

// Module-level flag — once mic permission is granted, don't re-request
let micPermissionGranted = false;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<SpeechError>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Request mic permission — MUST be called from a user gesture (button click).
  // This triggers the browser's "Allow microphone?" prompt. Once granted,
  // all subsequent SpeechRecognition.start() calls work automatically.
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (micPermissionGranted) return true;

    try {
      console.log("[STT] Requesting mic permission via getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — release the stream immediately
      stream.getTracks().forEach((t) => t.stop());
      micPermissionGranted = true;
      console.log("[STT] Mic permission granted");
      return true;
    } catch (err) {
      console.error("[STT] Mic permission denied:", err);
      setError("denied");
      return false;
    }
  }, []);

  // Start recognition (assumes mic permission already granted)
  const startRecognition = useCallback(() => {
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[STT] Recognition started");
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) console.log("[STT] Interim:", interim);
      setInterimTranscript(interim);
      if (final) {
        console.log("[STT] Final:", final);
        setFinalTranscript(final);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("[STT] Error:", event.error, event.message);
      if (event.error === "aborted") return;
      setError(classifySpeechError(event));
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("[STT] Recognition ended");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[STT] Start error:", err);
      setError("unsupported");
      setIsListening(false);
    }
  }, [Ctor]);

  const start = useCallback(() => {
    if (!Ctor) {
      setError("unsupported");
      return;
    }

    // Tear down any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    setError(null);
    setInterimTranscript("");
    setFinalTranscript("");
    startRecognition();
  }, [Ctor, startRecognition]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  const clear = useCallback(() => {
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    errorMessage: getErrorMessage(error),
    isSupported,
    requestMicPermission,
    start,
    stop,
    clear,
  };
}
