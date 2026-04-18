"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { Loader2, Sparkles, Plus, Check, MessageCircle, Send, X, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";

export type AiResultUnit = {
  cols: number;
  rows: number;
  toteColor: string;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  presetId?: string;
  overheadGridPresetId?: string;
  raisedBedConfig?: {
    sizeId: string;
    finish: string;
    hasLiner: boolean;
    depthIncrease: boolean;
    bottomShelf: boolean;
    pestCover: string;
    postHeight: number | null;
    hasHook: boolean;
    highWindWeighted?: boolean;
    quantity: number;
  } | null;
  customPrice?: number | null;
  description: string;
  indoorDelivery?: boolean;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  parsedUnits?: AiResultUnit[];
  unitsAdded?: boolean;
}

interface AICommandBarProps {
  aiInput: string;
  onAiInputChange: (val: string) => void;
  onBuild: () => void;
  aiLoading: boolean;
  aiError: string;
  aiResult: AiResultUnit[] | null;
  aiNotes: string;
  aiAdded: boolean;
  onAddAiUnits: () => void;
  onClearResult: () => void;
  buildContext?: Record<string, unknown>;
  onAssistantAddUnits?: (units: AiResultUnit[]) => void;
}

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export default function AICommandBar({
  aiInput,
  onAiInputChange,
  onBuild,
  aiLoading,
  aiError,
  aiResult,
  aiNotes,
  aiAdded,
  onAddAiUnits,
  onClearResult,
  buildContext,
  onAssistantAddUnits,
}: AICommandBarProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef(`ba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 150);
    }
  }, [chatOpen]);

  const sendChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatLoading) return;

      const userMsg: ChatMessage = { id: nextId(), role: "user", text: trimmed };
      const updated = [...chatMessages, userMsg];
      setChatMessages(updated);
      setChatInput("");
      setChatLoading(true);

      try {
        const [assistantRes, buildAiRes] = await Promise.allSettled([
          fetch("/api/build-assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: updated.map((m) => ({ role: m.role, text: m.text })),
              buildContext: buildContext ?? {},
              sessionId: sessionIdRef.current,
            }),
          }).then((r) => r.json()),
          fetch("/api/build-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: trimmed }),
          }).then((r) => (r.ok ? r.json() : null)),
        ]);

        const assistantText =
          assistantRes.status === "fulfilled" && assistantRes.value?.text
            ? assistantRes.value.text
            : "Something went wrong. Try again.";

        const parsedUnits: AiResultUnit[] | undefined =
          buildAiRes.status === "fulfilled" &&
          buildAiRes.value?.units?.length > 0
            ? buildAiRes.value.units
            : undefined;

        setChatMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: assistantText,
            parsedUnits,
          },
        ]);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", text: "Network error. Please try again." },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatMessages, buildContext, chatLoading],
  );

  function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    sendChatMessage(chatInput);
  }

  function handleAddFromChat(msgId: string, units: AiResultUnit[]) {
    if (!onAssistantAddUnits) return;
    onAssistantAddUnits(units);
    setChatMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, unitsAdded: true } : m)),
    );
  }

  function handleResetChat() {
    setChatMessages([]);
    sessionIdRef.current = `ba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return (
    <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
        <Sparkles className="h-4 w-4 text-yellow-400" />
        AI Command Center
      </h2>

      {/* ── Build input ──────────────────────────────────────────── */}
      <textarea
        value={aiInput}
        onChange={(e) => onAiInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onBuild();
          }
        }}
        placeholder='Describe what to build — e.g. "Indiana Joe with clear totes", "4x4 on wheels with a top", "36x24 planter box $350", "garage cleanout $349", "120x96 wall fit"'
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
        disabled={aiLoading}
      />

      {aiError && <p className="mt-1 text-xs font-medium text-red-400">{aiError}</p>}

      {/* ── Action buttons — Build + Assistant ──────────────────── */}
      {!aiResult && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onBuild}
            disabled={!aiInput.trim() || aiLoading}
            className={`flex flex-[2] items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
              aiInput.trim() && !aiLoading
                ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                : "cursor-not-allowed bg-slate-700 text-stone-500"
            }`}
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Build
              </>
            )}
          </button>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-all ${
              chatOpen
                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                : "border-slate-700 text-stone-400 hover:border-stone-500 hover:text-stone-300"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Assistant
          </button>
        </div>
      )}

      {/* ── Build result preview ─────────────────────────────────── */}
      {aiResult && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Preview — confirm before adding
          </p>
          {aiResult.map((unit, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{unit.description}</p>
                <div className="flex items-center gap-2">
                  {unit.customPrice && (
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      ${unit.customPrice}
                    </span>
                  )}
                  {unit.presetId && (
                    <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                      Preset
                    </span>
                  )}
                  {unit.overheadGridPresetId && (
                    <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                      Ceiling
                    </span>
                  )}
                  {unit.raisedBedConfig && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Raised Bed
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-stone-400">
                {unit.raisedBedConfig ? (
                  <span>
                    {(() => {
                      const bed = RAISED_BED_SIZES.find(
                        (s) => s.id === unit.raisedBedConfig!.sizeId
                      );
                      return bed
                        ? `${bed.widthIn}"×${bed.lengthIn}"×${bed.heightIn}" ${
                            bed.style === "with_legs" ? "(with legs)" : "(ground)"
                          }`
                        : unit.raisedBedConfig!.sizeId;
                    })()}
                    {unit.raisedBedConfig.finish !== "natural" &&
                      ` • ${
                        unit.raisedBedConfig.finish === "stain"
                          ? "Stain"
                          : "Painted White"
                      }`}
                    {unit.raisedBedConfig.hasLiner && " • Liner"}
                    {unit.raisedBedConfig.depthIncrease && ' • 12" Depth'}
                    {unit.raisedBedConfig.postHeight &&
                      ` • ${
                        unit.raisedBedConfig.postHeight === 72
                          ? "6'"
                          : unit.raisedBedConfig.postHeight === 84
                            ? "7'"
                            : "8'"
                      } Post`}
                    {unit.raisedBedConfig.hasHook && " • Hook"}
                    {unit.raisedBedConfig.highWindWeighted && " • High-Wind Weighted"}
                    {unit.raisedBedConfig.quantity > 1 &&
                      ` • Qty: ${unit.raisedBedConfig.quantity}`}
                  </span>
                ) : unit.overheadGridPresetId ? (
                  <span>
                    Overhead {unit.overheadGridPresetId} grid
                    {unit.hasTotes ? ` • Totes (${unit.toteColor})` : ""}
                  </span>
                ) : unit.cols === 0 && unit.rows === 0 && unit.customPrice ? (
                  <span>Custom item</span>
                ) : (
                  <>
                    {!unit.presetId && (
                      <span>
                        {unit.cols}��{unit.rows}
                      </span>
                    )}
                    {unit.hasTotes && <span>Totes ({unit.toteColor})</span>}
                    {!unit.hasTotes && <span>No totes</span>}
                    {unit.hasWheels && <span>Wheels</span>}
                    {unit.hasTop && <span>Top</span>}
                  </>
                )}
              </div>
            </div>
          ))}
          {aiNotes && <p className="text-xs italic text-stone-500">{aiNotes}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClearResult}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-stone-400 transition-colors hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={onAddAiUnits}
              className={`flex flex-[2] items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                aiAdded
                  ? "bg-emerald-500 text-white"
                  : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
              }`}
            >
              {aiAdded ? (
                <>
                  <Check className="h-4 w-4" /> Added to Quote
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add to Quote
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Assistant Chat Panel ─────────────────────────────────── */}
      {chatOpen && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/40">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-slate-700/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              {chatMessages.length > 0 && (
                <button
                  onClick={handleResetChat}
                  className="rounded p-1 text-stone-600 transition-colors hover:text-stone-300"
                  title="Clear chat"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setChatOpen(false)}
                className="rounded p-1 text-stone-600 transition-colors hover:text-stone-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="scrollbar-dark max-h-[40vh] space-y-2 overflow-y-auto px-3 py-3"
          >
            {chatMessages.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-xs text-stone-500">
                  Ask about materials, pricing, screws, profit — or tell me to add items to your quote.
                </p>
              </div>
            )}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[90%] space-y-2">
                  <div
                    className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-yellow-400/15 text-yellow-100"
                        : "bg-slate-700/50 text-stone-300"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-yellow-400 prose-headings:text-sm prose-strong:text-white prose-code:text-yellow-300 prose-code:bg-slate-700/50 prose-code:px-1 prose-code:rounded">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>
                  {/* Inline add-to-quote for parsed units */}
                  {msg.parsedUnits && msg.parsedUnits.length > 0 && onAssistantAddUnits && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
                      <p className="mb-1.5 text-[10px] font-bold uppercase text-emerald-400">
                        {msg.parsedUnits.length} item{msg.parsedUnits.length > 1 ? "s" : ""} detected
                      </p>
                      {msg.parsedUnits.map((u, i) => (
                        <p key={i} className="text-[11px] text-stone-400">
                          • {u.description}
                        </p>
                      ))}
                      <button
                        onClick={() => handleAddFromChat(msg.id, msg.parsedUnits!)}
                        disabled={msg.unitsAdded}
                        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          msg.unitsAdded
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                        }`}
                      >
                        {msg.unitsAdded ? (
                          <>
                            <Check className="h-3 w-3" /> Added to Quote
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" /> Add to Quote
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 text-[13px] text-stone-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <form
            onSubmit={handleChatSubmit}
            className="border-t border-slate-700/50 px-3 py-2"
          >
            <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 transition-colors focus-within:border-yellow-400/50">
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask anything or say 'add a 4x4 with totes'..."
                className="flex-1 bg-transparent text-sm text-white placeholder-stone-600 outline-none"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-yellow-400 text-slate-900 transition-all hover:bg-yellow-300 disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
