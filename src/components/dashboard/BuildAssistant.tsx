"use client";

// ═══════════════════════════════════════════════════════════════════════════
// BUILD ASSISTANT — AI Chat Panel for the Build Configurator
// Floating FAB that expands to a streaming chat with tool-calling support.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "ai/react";
import { MessageCircle, X, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { BuildManifest } from "@/lib/buildEngine.types";
import type { MaterialBreakdown, MaterialPrices } from "@/utils/calculateMaterials";
import type { BuildFeeBreakdown } from "@/app/actions/fee-engine";
import type { InstallerPricing } from "@/types/viewModels";

// ── Props ────────────────────────────────────────────────────────────────

interface BuildAssistantProps {
  buildResult?: {
    cols: number;
    rows: number;
    price: number;
    totalW: number;
    totalH: number;
    depth: number;
    slots: number;
    unitType: string;
    orientation: string;
  } | null;
  units: Array<{
    cols: number;
    rows: number;
    toteType: string;
    unitType: string;
    hasTotes: boolean;
    hasWheels: boolean;
    hasTop: boolean;
    price: number;
    desc?: string;
  }>;
  materialBreakdown: MaterialBreakdown | null;
  feeBreakdown: BuildFeeBreakdown | null;
  manifest: BuildManifest | null;
  installerPricing?: InstallerPricing;
  materialPrices?: MaterialPrices;
  userId?: string | null;
}

// ── Quick-Ask Chips ──────────────────────────────────────────────────────

function useQuickChips(
  hasBuild: boolean,
  hasUnits: boolean,
): string[] {
  return useMemo(() => {
    const chips: string[] = [];

    if (hasBuild) {
      chips.push("How many screws and what sizes?");
      chips.push("Material cost breakdown");
      chips.push("Profit on this build?");
    }

    if (hasUnits) {
      chips.push("Total materials for all units");
      chips.push("Shopping list");
    }

    // Always available
    chips.push("Screws in a 4x4 unit?");
    chips.push("Indiana Joe profit?");
    chips.push("Compare all presets");

    return chips.slice(0, 6); // Max 6 chips
  }, [hasBuild, hasUnits]);
}

// ── Component ────────────────────────────────────────────────────────────

export default function BuildAssistant({
  buildResult,
  units,
  materialBreakdown,
  feeBreakdown,
  manifest,
  installerPricing,
  materialPrices,
  userId,
}: BuildAssistantProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build context sent with every message
  const buildContext = useMemo(
    () => ({
      buildResult,
      units,
      materialBreakdown: materialBreakdown
        ? {
            totalCost: materialBreakdown.totalCost,
            items: materialBreakdown.items,
            rawCounts: materialBreakdown.rawCounts,
          }
        : null,
      feeBreakdown,
      manifest: manifest
        ? { totals: manifest.totals, shopping_list: manifest.shopping_list }
        : null,
      installerPricing,
      materialPrices,
      installerId: userId,
    }),
    [buildResult, units, materialBreakdown, feeBreakdown, manifest, installerPricing, materialPrices, userId],
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    setMessages,
  } = useChat({
    api: "/api/build-assistant",
    body: { buildContext },
  });

  const chips = useQuickChips(!!buildResult, units.length > 0);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function handleChipClick(text: string) {
    setInput(text);
    // Submit via form event
    const form = document.getElementById("build-assistant-form") as HTMLFormElement;
    if (form) {
      // Set input then submit on next tick
      setTimeout(() => form.requestSubmit(), 0);
    }
  }

  function handleReset() {
    setMessages([]);
  }

  // ── FAB (collapsed) ────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-400/25 transition-all hover:scale-105 hover:bg-yellow-300 hover:shadow-yellow-400/40 active:scale-95"
        aria-label="Open Build Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  // ── Chat Panel (expanded) ──────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[min(550px,80vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/15">
            <Sparkles className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Build Assistant</h3>
            <p className="text-[10px] text-slate-500">Materials, pricing & profit</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10">
              <MessageCircle className="h-6 w-6 text-yellow-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Ask me anything about your builds
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Screws, materials, pricing, profit — I calculate it all
            </p>
            {/* Quick chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-yellow-400/40 hover:bg-yellow-400/10 hover:text-yellow-300"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-yellow-400/15 text-yellow-100"
                      : "bg-slate-800/80 text-slate-300"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-yellow-400 prose-headings:text-sm prose-strong:text-white prose-code:text-yellow-300 prose-code:bg-slate-700/50 prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{typeof msg.content === "string" ? msg.content : ""}</ReactMarkdown>
                    </div>
                  ) : (
                    <span>{typeof msg.content === "string" ? msg.content : ""}</span>
                  )}
                </div>
              </div>
            ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-3.5 py-2.5 text-[13px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
              <span>Calculating...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick chips (when conversation started) */}
      {messages.length > 0 && !isLoading && (
        <div className="shrink-0 border-t border-slate-800/50 px-3 py-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {chips.slice(0, 4).map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="shrink-0 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-1 text-[10px] font-medium text-slate-500 transition-all hover:border-yellow-400/30 hover:text-yellow-400"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        id="build-assistant-form"
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-800 bg-slate-900/95 px-3 py-3 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 focus-within:border-yellow-400/50 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about materials, pricing, profit..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-slate-900 transition-all hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-yellow-400"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
