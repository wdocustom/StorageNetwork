"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, PhoneOff, MessageSquare, Package } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";
import type { RackConfig } from "@/lib/ai/customer-chat-prompt";

// ═══════════════════════════════════════════════════════════════════════════
// VoiceConversation — Full voice-to-voice AI sales conversation
//
// Renders inside the chat widget when voice mode is active.
// Manages the listen → send → receive → speak → listen loop.
//
// Flow:
//   1. User taps "Start Voice Chat" (user gesture — required for AudioContext)
//   2. AI greeting plays via TTS
//   3. After greeting → mic auto-activates
//   4. User speaks → transcript auto-sends → AI responds → TTS plays
//   5. Loop continues until user ends call
// ═══════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  config?: RackConfig;
}

interface VoiceConversationProps {
  messages: ChatMessage[];
  isLoading: boolean;
  /** Must return the AI response text (stripped of config blocks) */
  onSendMessage: (text: string) => Promise<string>;
  onClose: () => void;
  onSwitchToText: () => void;
  onAddUnits?: (configs: RackConfig[]) => void | Promise<void>;
}

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const CONFIG_REGEX = /```config\n([\s\S]*?)\n```/;
const CUSTOMER_INFO_REGEX = /```customerInfo\n([\s\S]*?)\n```/;

function stripBlocks(text: string): string {
  return text.replace(CONFIG_REGEX, "").replace(CUSTOMER_INFO_REGEX, "").trim();
}

function getAllUnits(config: RackConfig): RackConfig[] {
  const all = (config as RackConfig & { _allUnits?: RackConfig[] })._allUnits;
  return all || [config];
}

export default function VoiceConversation({
  messages,
  isLoading,
  onSendMessage,
  onClose,
  onSwitchToText,
  onAddUnits,
}: VoiceConversationProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [lastAIText, setLastAIText] = useState("");
  const [muted, setMuted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const isProcessingRef = useRef(false);

  const speech = useSpeechRecognition();
  const voicePlayback = useVoicePlayback({
    onFinished: () => {
      // After AI finishes speaking, auto-activate mic (unless muted)
      if (!mutedRef.current) {
        setVoiceState("listening");
        setTimeout(() => speech.start(), 300);
      } else {
        setVoiceState("idle");
      }
    },
  });

  // ── Start conversation (called from button click = user gesture) ──────
  // IMPORTANT: This runs in the button click handler, which is a user gesture.
  // We MUST request mic permission here — Chrome won't show the permission
  // prompt if it's triggered later (e.g. after TTS finishes playing).
  const startConversation = useCallback(async () => {
    // Request mic permission upfront during this user gesture
    const micAllowed = await speech.requestMicPermission();
    if (!micAllowed) {
      // Mic denied — gracefully fall back to text chat
      onSwitchToText();
      return;
    }

    setHasStarted(true);

    // Find the last assistant message to speak as greeting
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      const text = stripBlocks(lastAssistant.content);
      setLastAIText(text);
      setVoiceState("speaking");
      voicePlayback.speak(text);
    } else {
      // No greeting yet — go straight to listening
      setVoiceState("listening");
      speech.start();
    }
  }, [messages, voicePlayback, speech, onSwitchToText]);

  // ── Handle final transcript → send to AI → speak response ─────────────
  useEffect(() => {
    if (!speech.finalTranscript || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const text = speech.finalTranscript;
    setCurrentTranscript(text);
    speech.clear();
    setVoiceState("thinking");

    // sendMessage returns the full AI response text
    onSendMessage(text).then((responseText) => {
      isProcessingRef.current = false;
      if (responseText) {
        setLastAIText(responseText);
        setVoiceState("speaking");
        voicePlayback.speak(responseText);
      } else {
        // AI returned empty — go back to listening
        if (!mutedRef.current) {
          setVoiceState("listening");
          setTimeout(() => speech.start(), 300);
        } else {
          setVoiceState("idle");
        }
      }
    }).catch(() => {
      isProcessingRef.current = false;
      if (!mutedRef.current) {
        setVoiceState("listening");
        setTimeout(() => speech.start(), 300);
      } else {
        setVoiceState("idle");
      }
    });
  }, [speech.finalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show interim transcript while listening ───────────────────────────
  useEffect(() => {
    if (speech.interimTranscript) {
      setCurrentTranscript(speech.interimTranscript);
    }
  }, [speech.interimTranscript]);

  // ── Sync voice state with speech recognition ─────────────────────────
  useEffect(() => {
    if (speech.isListening && voiceState !== "listening") {
      setVoiceState("listening");
    }
  }, [speech.isListening, voiceState]);

  // ── Mute toggle ──────────────────────────────────────────────────────
  const handleMuteToggle = () => {
    if (muted) {
      setMuted(false);
      if (voiceState === "idle" && !voicePlayback.isSpeaking) {
        setVoiceState("listening");
        speech.start();
      }
    } else {
      setMuted(true);
      speech.stop();
      if (voiceState === "listening") {
        setVoiceState("idle");
      }
    }
  };

  const handleEndCall = () => {
    speech.stop();
    voicePlayback.stop();
    onClose();
  };

  // Find latest config in messages
  const latestConfig = [...messages].reverse().find((m) => m.config)?.config;

  return (
    <div className="flex flex-col h-full">
      {/* Voice Indicator Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Start button (shown before conversation begins) */}
        {!hasStarted && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400/10 ring-2 ring-yellow-400/30">
              <Mic className="h-10 w-10 text-yellow-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Talk to Your Design Assistant</h3>
              <p className="mt-1 text-sm text-slate-400">
                Have a conversation about your storage needs
              </p>
            </div>
            <button
              onClick={startConversation}
              className="rounded-full bg-yellow-400 px-8 py-3 text-sm font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:scale-105 active:scale-95"
            >
              Start Voice Chat
            </button>
            <button
              onClick={onSwitchToText}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Prefer to type? Switch to text chat
            </button>
          </div>
        )}

        {/* Active conversation states */}
        {hasStarted && (
          <>
            {/* Voice visualizer */}
            <div className="mb-6">
              {voiceState === "speaking" && <SpeakingIndicator />}
              {voiceState === "listening" && <ListeningIndicator />}
              {voiceState === "thinking" && <ThinkingIndicator />}
              {voiceState === "idle" && <IdleIndicator />}
            </div>

            {/* State label */}
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              {voiceState === "speaking"
                ? "Speaking..."
                : voiceState === "listening"
                ? "Listening..."
                : voiceState === "thinking"
                ? "Thinking..."
                : "Paused"}
            </p>

            {/* Live transcript */}
            <div className="w-full max-h-40 overflow-y-auto rounded-xl bg-slate-800/50 px-4 py-3">
              {voiceState === "listening" && currentTranscript && (
                <p className="text-sm text-yellow-300 italic">{currentTranscript}</p>
              )}
              {voiceState === "listening" && !currentTranscript && !speech.error && (
                <p className="text-sm text-slate-500 italic">Say something...</p>
              )}
              {speech.error && speech.errorMessage && (
                <p className="text-sm text-red-400">{speech.errorMessage}</p>
              )}
              {voiceState === "speaking" && lastAIText && (
                <p className="text-sm text-slate-200">{lastAIText}</p>
              )}
              {voiceState === "thinking" && (
                <p className="text-sm text-slate-500 italic">Processing your request...</p>
              )}
              {voiceState === "idle" && lastAIText && (
                <p className="text-sm text-slate-400">{lastAIText}</p>
              )}
            </div>

            {/* Config CTA — "Add Unit to My Build" */}
            {latestConfig && onAddUnits && (
              <div className="mt-4 w-full">
                <button
                  onClick={async () => {
                    voicePlayback.stop();
                    speech.stop();
                    await onAddUnits(getAllUnits(latestConfig));
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400"
                >
                  <Package className="h-4 w-4" />
                  Add {getAllUnits(latestConfig).length > 1
                    ? `${getAllUnits(latestConfig).length} Units`
                    : "Unit"} to My Build
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      {hasStarted && (
        <div className="border-t border-slate-700 bg-slate-800/50 px-4 py-4">
          <div className="flex items-center justify-center gap-4">
            {/* Mute */}
            <button
              onClick={handleMuteToggle}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                muted
                  ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-all hover:bg-red-400 active:scale-95"
              title="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </button>

            {/* Switch to text */}
            <button
              onClick={() => {
                speech.stop();
                voicePlayback.stop();
                onSwitchToText();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-slate-300 transition-all hover:bg-slate-600"
              title="Switch to text chat"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Visual Indicators
// ═══════════════════════════════════════════════════════════════════════════

function SpeakingIndicator() {
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-400/30">
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-blue-400"
            style={{
              animation: `voiceBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
              height: "8px",
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes voiceBar {
          0% { height: 8px; }
          100% { height: 28px; }
        }
      `}</style>
    </div>
  );
}

function ListeningIndicator() {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-green-400/10 animate-ping" style={{ animationDuration: "2s" }} />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-400/10 ring-2 ring-green-400/40">
        <Mic className="h-8 w-8 text-green-400" />
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-yellow-400/10 ring-2 ring-yellow-400/30">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function IdleIndicator() {
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700/50 ring-2 ring-slate-600/50">
      <MicOff className="h-8 w-8 text-slate-500" />
    </div>
  );
}
