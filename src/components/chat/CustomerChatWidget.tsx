"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, ExternalLink, Mail, Sparkles } from "lucide-react";
import type { RackConfig } from "@/lib/ai/customer-chat-prompt";

// ═══════════════════════════════════════════════════════════════════════════
// Customer Chat Widget — Conversational Configurator
//
// AI-guided tote rack builder. Walks customers through questions,
// collects config params, and outputs action buttons when ready.
// Lives on landing page and /design page.
// ═══════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  config?: RackConfig;
}

interface CustomerChatWidgetProps {
  /** Installer ID if already routed (from ZIP check) */
  installerId?: string;
  /** Installer slug for URL generation */
  installerSlug?: string;
}

const GREETING = "Hey! Want help picking the right storage setup? I can walk you through it — just a few quick questions and I'll have a design ready for you.";
const SESSION_KEY = "sn_customer_chat";
const CONFIG_REGEX = /```config\n([\s\S]*?)\n```/;

function parseConfig(text: string): RackConfig | null {
  const match = text.match(CONFIG_REGEX);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as RackConfig;
  } catch {
    return null;
  }
}

function stripConfigBlock(text: string): string {
  return text.replace(CONFIG_REGEX, "").trim();
}

function buildDesignUrl(config: RackConfig, installerId?: string, installerSlug?: string): string {
  const params = new URLSearchParams();
  params.set("config", btoa(JSON.stringify(config)));
  if (installerId) params.set("installer_id", installerId);
  if (installerSlug) params.set("installer", installerSlug);
  params.set("from", "chat");
  return `/design?${params.toString()}`;
}

export default function CustomerChatWidget({ installerId, installerSlug }: CustomerChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore from sessionStorage
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

  // Save to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  // Greeting on first open
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
          mode: "customer",
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong. Try again!" }]);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const assistantId = `a-${Date.now()}`;
      let fullContent = "";

      if (reader) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });

          const displayContent = stripConfigBlock(fullContent);
          const config = parseConfig(fullContent);

          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: displayContent, config: config || undefined } : m)
          );
        }
      }
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Something went wrong. Give it another shot!" }]);
    }

    setIsLoading(false);
  }, [messages, isLoading]);

  const handleSendEmail = async (config: RackConfig) => {
    if (!emailInput.trim()) return;
    setEmailSending(true);
    try {
      await fetch("/api/email/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          config,
          designUrl: buildDesignUrl(config, installerId, installerSlug),
        }),
      });
      setEmailSent(true);
    } catch {}
    setEmailSending(false);
  };

  // Find the latest config from messages (last assistant message with a config)
  const latestConfig = [...messages].reverse().find((m) => m.config)?.config;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 hover:scale-105 active:scale-95"
          aria-label="Design with AI"
        >
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">Build My Storage</span>
          {!hasGreeted && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-300 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col sm:bottom-5 sm:right-5 sm:rounded-2xl w-full sm:w-[400px] h-[85vh] sm:h-[540px] bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-bold text-white">Design Assistant</span>
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
              <div key={m.id}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

                {/* Config CTA Buttons — shown below the message that contains a config */}
                {m.config && (
                  <div className="mt-3 space-y-2 pl-2">
                    <a
                      href={buildDesignUrl(m.config, installerId, installerSlug)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black uppercase tracking-wider text-slate-900 shadow-lg shadow-yellow-500/20 transition-all hover:bg-yellow-400"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View My Design in 3D
                    </a>

                    {!emailSent ? (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="your@email.com"
                          className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
                          onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(m.config!); }}
                        />
                        <button
                          onClick={() => handleSendEmail(m.config!)}
                          disabled={!emailInput.trim() || emailSending}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
                        >
                          {emailSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          Email Quote
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-center text-xs font-semibold text-emerald-400">
                        Quote sent to {emailInput}!
                      </div>
                    )}
                  </div>
                )}
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
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Tell me about your space..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
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
