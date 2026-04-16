"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useSpeechRecognition — Browser speech-to-text hook
//
// Wraps the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
// Single-utterance mode: auto-stops after user pauses speaking (~1.5s).
//
// iOS Safari fix: calls getUserMedia({ audio: true }) before starting
// SpeechRecognition to establish mic permission. Without this, iOS
// SpeechRecognition starts but silently receives no audio.
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

// Detect iOS (Safari or Chrome-on-iOS both use WebKit)
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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

function getErrorMessage(error: SpeechError): string | null {
  switch (error) {
    case "unsupported": return "Voice input is not available in this browser.";
    case "denied": return "Microphone access was denied. Check your browser settings.";
    case "no-speech": return "No speech detected. Try speaking louder or closer to the mic.";
    case "network": return "Speech recognition network error. Check your connection.";
    case "aborted": return null;
    case null: return null;
  }
}

// Track if we've already done the getUserMedia pre-flight for mic permission
let micPermissionGranted = false;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<SpeechError>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Start recognition (after mic permission is established)
  const startRecognition = useCallback(() => {
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;   // single utterance — auto-stops on pause
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
      // "aborted" fires when we call stop() ourselves — not a real error
      if (event.error === "aborted") return;
      setError(classifySpeechError(event));
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("[STT] Recognition ended");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onspeechstart = () => {
      console.log("[STT] Speech detected");
    };

    recognition.onspeechend = () => {
      console.log("[STT] Speech ended");
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

  const start = useCallback(async () => {
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

    // iOS Safari fix: SpeechRecognition needs getUserMedia to be called first
    // to establish mic permission. Without this, recognition starts but
    // silently receives no audio data (onresult never fires).
    if (!micPermissionGranted && (isIOS() || !micPermissionGranted)) {
      try {
        console.log("[STT] Requesting mic permission via getUserMedia...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        micPermissionGranted = true;
        console.log("[STT] Mic permission granted");
        // Keep the stream alive briefly — iOS needs the permission context active
        // when SpeechRecognition starts. Release after a short delay.
        setTimeout(() => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }, 500);
      } catch (err) {
        console.error("[STT] Mic permission denied:", err);
        setError("denied");
        return;
      }
    }

    // Small delay to let the permission context establish on iOS
    if (isIOS()) {
      setTimeout(() => startRecognition(), 200);
    } else {
      startRecognition();
    }
  }, [Ctor, startRecognition]);

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
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
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
    start,
    stop,
    clear,
  };
}
