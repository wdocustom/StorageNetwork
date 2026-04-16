"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useSpeechRecognition — Browser speech-to-text hook
//
// Wraps the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
// Single-utterance mode: auto-stops after user pauses speaking (~1.5s).
// Mirrors error handling pattern from useCameraStream.ts.
//
// Browser support:
//   Chrome/Edge — full
//   Safari 14.1+ — partial (webkit prefix)
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
  isSupported: boolean;
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
      return "network"; // catch-all for unknown errors
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<SpeechError>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

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

    const recognition = new Ctor();
    recognition.continuous = false;   // single utterance — auto-stops on pause
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
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
      setInterimTranscript(interim);
      if (final) setFinalTranscript(final);
    };

    recognition.onerror = (event: any) => {
      // "aborted" fires when we call stop() ourselves — not a real error
      if (event.error === "aborted") return;
      setError(classifySpeechError(event));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      setError("unsupported");
      setIsListening(false);
    }
  }, [Ctor]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop(); // fires onend → sets isListening=false
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
    isSupported,
    start,
    stop,
    clear,
  };
}
