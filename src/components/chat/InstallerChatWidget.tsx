"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, Sparkles } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Installer Chat Widget — Sales Conversion Chatbot
//
// Floating chat button + expandable panel for /join and /partner/join pages.
// Uses simple fetch-based streaming — no external chat SDK needed.
// ═══════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING = "Hey! Thinking about joining the network? I can answer any questions about the platform, pricing, or what it's like to be an installer. Fire away!";
const SESSION_KEY = "sn_installer_chat";

const TEASERS = [
  "How much can I actually make?",
  "What does the free trial include?",
  "Is my area available?",
  "How do the pre-sold jobs work?",
  "What's the catch?",
];

export default function InstallerChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [teaserIndex, setTeaserIndex] = useState(0);
  const [teaserDismissed, setTeaserDismissed] = useState(false);

  // Rotate teaser messages
  useEffect(() => {
    if (isOpen || teaserDismissed) return;
    const interval = setInterval(() => {
      setTeaserIndex((prev) => (prev + 1) % TEASERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, teaserDismissed]);

  // Show teaser bubble after 3 seconds
  const [showTeaser, setShowTeaser] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowTeaser(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setHasGreeted(true);
        }
      }
    } catch {}
  }, []);

  // Save to sessionStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  // Inject greeting on first open
  useEffect(() => {
    if (isOpen && !hasGreeted && messages.length === 0) {
      setMessages([{ id: "greeting", role: "assistant", content: GREETING }]);
      setHasGreeted(true);
    }
  }, [isOpen, hasGreeted, messages.length]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Sorry, I hit a snag. Try again in a moment!" }]);
        setIsLoading(false);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const assistantId = `a-${Date.now()}`;
      let assistantContent = "";

      if (reader) {
        // Add empty assistant message that we'll build up
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m)
          );
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Something went wrong. Give it another shot!" }]);
    }

    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [messages, isLoading]);

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Chat Button + Teaser */}
      {!isOpen && (
        <div className="fixed bottom-5 left-5 z-50 flex items-end gap-3">
          {/* Teaser bubble */}
          {showTeaser && !teaserDismissed && (
            <div className="animate-fadeInUp mb-1 max-w-[220px]">
              <button
                onClick={() => setIsOpen(true)}
                className="relative rounded-2xl rounded-bl-md bg-slate-800 border border-slate-700 px-4 py-3 text-left shadow-xl shadow-black/30 transition-all hover:border-yellow-400/50 group"
              >
                <p className="text-[11px] font-bold text-yellow-400 mb-0.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Ask me anything
                </p>
                <p className="text-xs text-stone-300 leading-relaxed transition-all">
                  &ldquo;{TEASERS[teaserIndex]}&rdquo;
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setTeaserDismissed(true); }}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-stone-500 text-[10px] hover:bg-slate-600 hover:text-white transition-colors"
                >
                  &times;
                </button>
              </button>
            </div>
          )}

          {/* Chat button */}
          <button
            onClick={() => setIsOpen(true)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:scale-105 active:scale-95"
            aria-label="Chat with us"
          >
            <MessageSquare className="h-6 w-6" />
            {!hasGreeted && (
              <span className="absolute inset-0 rounded-full animate-ping bg-yellow-400 opacity-30" />
            )}
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 z-50 flex flex-col sm:bottom-5 sm:left-5 sm:rounded-2xl w-full sm:w-[380px] h-[85vh] sm:h-[480px] bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-white">Storage Network</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-yellow-400 text-slate-900 rounded-br-md"
                      : "bg-slate-800 text-slate-200 rounded-bl-md"
                  }`}
                >
                  {m.content.split("\n").map((line, i) => (
                    <span key={i}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
                        ) : (
                          <span key={j}>{part}</span>
                        )
                      )}
                      {i < m.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800/50 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask anything about joining..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-slate-900 transition-colors hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
