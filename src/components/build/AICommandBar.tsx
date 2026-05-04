"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Sparkles, Plus, Check, Send, RotateCcw } from "lucide-react";
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
  buildContext?: Record<string, unknown>;
  onAddUnits: (units: AiResultUnit[]) => Promise<void>;
  disabled?: boolean;
}

let msgCounter = 0;
function nextId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

function UnitPreviewCard({ unit }: { unit: AiResultUnit }) {
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-white">{unit.description}</p>
        <div className="flex shrink-0 items-center gap-1">
          {unit.customPrice != null && unit.customPrice > 0 && (
            <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              ${unit.customPrice}
            </span>
          )}
          {unit.presetId && (
            <span className="rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
              Preset
            </span>
          )}
          {unit.overheadGridPresetId && (
            <span className="rounded-full bg-blue-400/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
              Ceiling
            </span>
          )}
          {unit.raisedBedConfig && (
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              Raised Bed
            </span>
          )}
        </div>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] text-stone-500">
        {unit.raisedBedConfig ? (
          <span>
            {(() => {
              const bed = RAISED_BED_SIZES.find((s) => s.id === unit.raisedBedConfig!.sizeId);
              return bed
                ? `${bed.widthIn}"×${bed.lengthIn}"×${bed.heightIn}" ${bed.style === "with_legs" ? "(legs)" : "(ground)"}`
                : unit.raisedBedConfig!.sizeId;
            })()}
            {unit.raisedBedConfig.finish !== "natural" &&
              ` • ${unit.raisedBedConfig.finish === "stain" ? "Stain" : "Painted White"}`}
            {unit.raisedBedConfig.hasLiner && " • Liner"}
            {unit.raisedBedConfig.depthIncrease && ' • 12" Depth'}
            {unit.raisedBedConfig.postHeight &&
              ` • ${unit.raisedBedConfig.postHeight === 72 ? "6'" : unit.raisedBedConfig.postHeight === 84 ? "7'" : "8'"} Post`}
            {unit.raisedBedConfig.hasHook && " • Hook"}
            {unit.raisedBedConfig.quantity > 1 && ` • Qty: ${unit.raisedBedConfig.quantity}`}
          </span>
        ) : unit.overheadGridPresetId ? (
          <span>
            {unit.overheadGridPresetId} grid{unit.hasTotes ? ` • Totes (${unit.toteColor})` : ""}
          </span>
        ) : unit.cols === 0 && unit.rows === 0 && unit.customPrice ? (
          <span>Custom item</span>
        ) : (
          <>
            {!unit.presetId && (
              <span>
                {unit.cols}×{unit.rows}
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
  );
}

export default function AICommandBar({
  buildContext,
  onAddUnits,
  disabled,
}: AICommandBarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef(`ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = { id: nextId(), role: "user", text: trimmed };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");
      setLoading(true);

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

        // Prefer build-ai structured units; fall back to build-assistant's
        const buildAiUnits: AiResultUnit[] | undefined =
          buildAiRes.status === "fulfilled" &&
          buildAiRes.value?.units?.length > 0
            ? buildAiRes.value.units
            : undefined;

        const assistantUnits: AiResultUnit[] | undefined =
          assistantRes.status === "fulfilled" &&
          assistantRes.value?.parsedUnits?.length > 0
            ? assistantRes.value.parsedUnits
            : undefined;

        const parsedUnits = buildAiUnits || assistantUnits;

        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", text: assistantText, parsedUnits },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", text: "Network error. Please try again." },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    },
    [messages, buildContext, loading],
  );

  async function handleAddFromMessage(msgId: string, units: AiResultUnit[]) {
    setAddingId(msgId);
    try {
      await onAddUnits(units);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, unitsAdded: true } : m)),
      );
    } finally {
      setAddingId(null);
    }
  }

  function handleReset() {
    setMessages([]);
    sessionIdRef.current = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return (
    <section className="rounded-xl border border-yellow-400/20 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          AI Command Center
        </h2>
        {messages.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-stone-600 transition-colors hover:text-stone-300"
            title="Clear conversation"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder='Build, ask, or add — e.g. "Indiana Joe no totes", "how many screws for a 4x4?", "add a 3x3 overhead"'
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400 focus:outline-none"
          disabled={loading || disabled}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading || disabled}
          className={`flex w-12 shrink-0 items-center justify-center rounded-lg transition-all ${
            input.trim() && !loading
              ? "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
              : "bg-slate-700 text-stone-500"
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* ── Conversation ───────────────────────────────────────────── */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="scrollbar-dark mt-3 max-h-[50vh] space-y-3 overflow-y-auto"
        >
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Parsed units — show first when available */}
                  {msg.parsedUnits && msg.parsedUnits.length > 0 && (
                    <div className="rounded-xl border border-yellow-400/20 bg-slate-800/50 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {msg.parsedUnits.length} item{msg.parsedUnits.length > 1 ? "s" : ""} parsed
                      </p>
                      <div className="space-y-1.5">
                        {msg.parsedUnits.map((u, i) => (
                          <UnitPreviewCard key={i} unit={u} />
                        ))}
                      </div>
                      <button
                        onClick={() => handleAddFromMessage(msg.id, msg.parsedUnits!)}
                        disabled={msg.unitsAdded || addingId === msg.id}
                        className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
                          msg.unitsAdded
                            ? "bg-emerald-500/20 text-emerald-400"
                            : addingId === msg.id
                              ? "bg-slate-700 text-stone-400"
                              : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                        }`}
                      >
                        {msg.unitsAdded ? (
                          <>
                            <Check className="h-4 w-4" /> Added to Quote
                          </>
                        ) : addingId === msg.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> Add to Quote
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Conversational response */}
                  <div className="max-w-[95%] rounded-lg bg-slate-800/50 px-3 py-2 text-[13px] leading-relaxed text-stone-300">
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-yellow-400 prose-headings:text-sm prose-strong:text-white prose-code:text-yellow-300 prose-code:bg-slate-700/50 prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2.5 text-sm text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
              Thinking...
            </div>
          )}
        </div>
      )}
    </section>
  );
}
