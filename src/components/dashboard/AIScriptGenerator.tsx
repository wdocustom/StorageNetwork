"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { logActivityClient } from "@/lib/activity-client";
import {
  Copy,
  Check,
  Share2,
  Sparkles,
  Loader2,
  RefreshCw,
  Facebook,
  Instagram,
  MapPin,
  Globe,
  Video,
  List,
  Link2,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  ArrowRight,
  Zap,
  Tag,
  X,
} from "lucide-react";
import DiscountCodesCard from "@/components/dashboard/DiscountCodesCard";

// ═══════════════════════════════════════════════════════════════════════════
// AI Script Generator — Platform-specific marketing copy + follow-up scripts.
// ═══════════════════════════════════════════════════════════════════════════

type Mode = "post" | "followup";

type Platform =
  | "facebook-group"
  | "facebook-marketplace"
  | "facebook-page"
  | "instagram"
  | "nextdoor"
  | "craigslist"
  | "tiktok-reels"
  | "general";

type Tone =
  | "professional"
  | "casual"
  | "urgent"
  | "storytelling"
  | "humorous"
  | "direct"
  | "reverse-psychology";

type FollowUpHook =
  | "just-sold"
  | "last-spots"
  | "price-change"
  | "season"
  | "circle-back";

type FollowUpOffer = "10-off" | "20-off" | "priority" | "none";

const PLATFORMS: { value: Platform; label: string; icon: typeof Facebook; desc: string }[] = [
  { value: "facebook-group", label: "FB Group", icon: Facebook, desc: "Local community groups" },
  { value: "facebook-marketplace", label: "FB Market", icon: ShoppingBag, desc: "Marketplace listings" },
  { value: "facebook-page", label: "FB Page", icon: Facebook, desc: "Your business page" },
  { value: "instagram", label: "Instagram", icon: Instagram, desc: "Reels & feed posts" },
  { value: "nextdoor", label: "Nextdoor", icon: MapPin, desc: "Neighborhood app" },
  { value: "craigslist", label: "Craigslist", icon: List, desc: "Keyword-rich listing" },
  { value: "tiktok-reels", label: "TikTok", icon: Video, desc: "A/V script format" },
  { value: "general", label: "General", icon: Globe, desc: "Any platform" },
];

const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Confident craftsperson" },
  { value: "casual", label: "Casual", desc: "Friendly neighbor vibe" },
  { value: "urgent", label: "Urgent", desc: "Real scarcity, real timing" },
  { value: "storytelling", label: "Story", desc: "A job I just wrapped up" },
  { value: "humorous", label: "Funny", desc: "Dry wit, tote avalanche" },
  { value: "direct", label: "Hard Sell", desc: "Zero fluff, all facts" },
  { value: "reverse-psychology", label: "Reverse Psych", desc: "\"Don't buy this...\"" },
];

const TOPIC_PRESETS = [
  { label: "Tote Racks", value: "Focus on the wall-mounted sliding tote rack system — the core product." },
  { label: "Overhead Storage", value: "Focus on overhead ceiling storage. Hook: Is there usable space above your head in the garage? Most people never look up — let's capitalize on that dead space. Totes mounted to the ceiling joists, out of the way but easy to grab." },
  { label: "Open Shelving", value: "Focus on custom open shelving as a bonus add-on. Great for items that don't fit in totes — toolboxes, paint cans, coolers, sports equipment. Wall-mounted or freestanding." },
  { label: "Full Garage System", value: "Pitch the complete garage organization system — wall racks + overhead ceiling storage + open shelving. Top to bottom, wall to wall. One installer, one visit, total transformation." },
  { label: "Raised Beds", value: "Focus on handmade cedar raised bed planters. Two styles: elevated on legs for comfortable gardening without bending, and ground-level for traditional garden beds. Natural cedar, cedar stain, or painted white finishes. Pest protection covers available. Mention the string light planter post for patios." },
  { label: "String Light Post", value: "Focus on the 24x24 planter base with a 7-foot center post for hanging outdoor string lights. Perfect for patios, entertaining areas, outdoor dining. Handmade cedar, available in natural, stained, or painted white." },
  { label: "Adirondack Chair", value: "Focus on the handmade Low Boy Adirondack Chair. Built from solid lumber with a classic low-slung profile — great for patios, backyards, garages, or workshops. Natural upsell for storage customers: they're fixing up the garage anyway, why not add a piece they'll actually sit in? Handmade, not a box store chair." },
  { label: "Spring Cleaning", value: "Seasonal spring cleaning angle — time to get organized before summer." },
  { label: "Holiday Prep", value: "Holiday season angle — get decorations organized and accessible with overhead ceiling storage." },
];

const FOLLOW_UP_HOOKS: { value: FollowUpHook; label: string; desc: string; detail: string }[] = [
  {
    value: "just-sold",
    label: "Just Sold One",
    desc: "Heading to store — limited offer",
    detail: "Reach out to people who showed interest. Tell them you just sold one and you're heading to pick up materials — offer to grab theirs too at a discount.",
  },
  {
    value: "last-spots",
    label: "Last Spots",
    desc: "Running out of openings",
    detail: "You're booked up or taking a break soon. Give warm leads a heads-up before your schedule fills completely.",
  },
  {
    value: "price-change",
    label: "Price Lock",
    desc: "Rates going up soon",
    detail: "Lumber costs went up. You're adjusting pricing soon. Anyone who deposits before [date] locks in current rates.",
  },
  {
    value: "season",
    label: "Seasonal",
    desc: "Spring, fall, holiday timing",
    detail: "Connect your service to whatever season is here — spring garage cleanup, holiday storage, winter prep.",
  },
  {
    value: "circle-back",
    label: "Circle Back",
    desc: "Low-pressure warm check-in",
    detail: "No specific event — just reconnecting with someone you talked to a while back who never committed.",
  },
];

const FOLLOW_UP_OFFERS: { value: FollowUpOffer; label: string; desc: string }[] = [
  { value: "10-off", label: "10% Off", desc: "If they deposit today/this week" },
  { value: "20-off", label: "15–20% Off", desc: "One-time deal, this batch only" },
  { value: "priority", label: "Priority Queue", desc: "Jump to front of schedule" },
  { value: "none", label: "No Offer", desc: "Urgency alone — no discount" },
];

// ── Parse follow-up output into named sections for individual copy ───────
function parseFollowUpSections(text: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  // Strip any leading bold markers the AI might wrap around headings (e.g. **## Version A**)
  const normalized = text.replace(/^\*\*(##\s)/gm, "$1").replace(/\*\*$/gm, "");
  const parts = normalized.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const title = part.slice(0, newlineIdx).trim().replace(/\*\*/g, "");
    const content = part.slice(newlineIdx).trim();
    if (title && content) sections.push({ title, content });
  }
  return sections;
}

// ── Component ───────────────────────────────────────────────────────────

interface AIScriptGeneratorProps {
  bookingLink: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  businessName: string | null;
  userId: string;
  onActiveTextChange?: (text: string | null) => void;
}

export default function AIScriptGenerator({
  bookingLink,
  city,
  state,
  zip,
  businessName,
  userId,
  onActiveTextChange,
}: AIScriptGeneratorProps) {
  const [mode, setMode] = useState<Mode>("post");

  // Post generator state
  const [platform, setPlatform] = useState<Platform>("facebook-group");
  const [tone, setTone] = useState<Tone>("casual");
  const [customTopic, setCustomTopic] = useState("");

  // Follow-up state
  const [followUpHook, setFollowUpHook] = useState<FollowUpHook>("just-sold");
  const [followUpOffer, setFollowUpOffer] = useState<FollowUpOffer>("10-off");
  const [followUpPlatform, setFollowUpPlatform] = useState<Platform>("facebook-group");

  // Shared state
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sectionCopied, setSectionCopied] = useState<string | null>(null);
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);

  // Reset output when switching modes
  function switchMode(next: Mode) {
    setMode(next);
    setScript("");
    setError("");
  }

  // ── AI generation ──────────────────────────────────────────────────

  async function generate() {
    setLoading(true);
    setError("");
    setScript("");
    try {
      const payload =
        mode === "followup"
          ? {
              mode: "followup",
              platform: followUpPlatform,
              followUpHook,
              followUpOffer,
              city,
              state,
              zip,
              bookingLink,
              businessName,
            }
          : {
              mode: "post",
              platform,
              tone,
              city,
              state,
              zip,
              bookingLink,
              businessName,
              customTopic: customTopic.trim() || undefined,
            };

      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setScript(data.script);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Text processing ────────────────────────────────────────────────

  function stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^---+\s*$/gm, "")
      .replace(/^\*\s+/gm, "• ")
      .replace(/^-\s+/gm, "• ")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1\n$2")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getActiveText(): string | null {
    if (!script) return null;
    if (mode === "followup") return stripMarkdown(script);
    const parts = script.split(/\n---\s*\n/);
    let cleaned: string;
    if (parts.length <= 1) {
      cleaned = script;
    } else {
      const postParts = [parts[0]];
      for (let i = 1; i < parts.length; i++) {
        if (/^#{1,3}\s*Pro[- ]?Tips/im.test(parts[i])) continue;
        postParts.push(parts[i]);
      }
      cleaned = postParts.join("\n\n").trim();
    }
    return stripMarkdown(cleaned);
  }

  // ── Sharing helpers ────────────────────────────────────────────────

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleCopy() {
    const text = getActiveText();
    if (text) {
      copyText(text);
      logActivityClient({ action: "social_generate", pagePath: "/dashboard/marketing" });
    }
  }

  function handleCopySection(title: string, content: string) {
    navigator.clipboard.writeText(stripMarkdown(`## ${title}\n\n${content}`));
    setSectionCopied(title);
    setTimeout(() => setSectionCopied(null), 2500);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(bookingLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    logActivityClient({ action: "copy_link", pagePath: "/dashboard/marketing" });
  }

  function handleShareFacebook() {
    const text = getActiveText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    logActivityClient({ action: "social_share", detail: { platform: "facebook" } });
    const sharerUrl =
      `https://www.facebook.com/sharer/sharer.php` +
      `?u=${encodeURIComponent(bookingLink)}` +
      `&quote=${encodeURIComponent(text)}`;
    window.open(sharerUrl, "_blank", "width=600,height=500");
  }

  function handleShareNative() {
    const text = getActiveText();
    if (!text) return;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      copyText(text);
    }
  }

  const activeText = getActiveText();
  const hasOutput = !!activeText;
  const isFacebook = (mode === "post" ? platform : followUpPlatform).startsWith("facebook-");
  const followUpSections = mode === "followup" && script ? parseFollowUpSections(script) : [];

  useEffect(() => {
    onActiveTextChange?.(activeText);
  }, [activeText, onActiveTextChange]);

  return (
    <div className="space-y-4">
      {/* ── Mode tab switcher ────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
        <button
          onClick={() => switchMode("post")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            mode === "post"
              ? "bg-yellow-400 text-gray-950"
              : "text-stone-400 hover:text-stone-300"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Post Generator
        </button>
        <button
          onClick={() => switchMode("followup")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            mode === "followup"
              ? "bg-yellow-400 text-gray-950"
              : "text-stone-400 hover:text-stone-300"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Follow-Up Scripts
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          POST GENERATOR MODE
      ══════════════════════════════════════════════════════════════ */}
      {mode === "post" && (
        <>
          {/* ── Platform selector ────────────────────────────────── */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Platform
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const active = platform === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-slate-700 bg-slate-800/50 text-stone-400 hover:border-slate-600 hover:text-stone-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-bold leading-tight">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tone selector ────────────────────────────────────── */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Tone
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {TONES.map((t) => {
                const active = tone === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`rounded-lg border px-3 py-2 text-center transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-slate-700 bg-slate-800/50 text-stone-400 hover:border-slate-600 hover:text-stone-300"
                    }`}
                  >
                    <span className="text-xs font-bold">{t.label}</span>
                    <p className="mt-0.5 text-[9px] text-stone-600">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Custom topic ─────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Custom Angle <span className="font-normal text-stone-600">(optional)</span>
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TOPIC_PRESETS.map((preset) => {
                const active = customTopic === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setCustomTopic(active ? "" : preset.value)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-slate-700 bg-slate-800/50 text-stone-400 hover:border-slate-600 hover:text-stone-300"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Spring cleaning season, recent install I did, overhead ceiling storage..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 outline-none focus:border-yellow-400"
            />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FOLLOW-UP MODE
      ══════════════════════════════════════════════════════════════ */}
      {mode === "followup" && (
        <>
          {/* ── Context callout ──────────────────────────────────── */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              <span className="font-bold text-amber-300">Pro technique:</span> When you sell a unit, reach out to 10–20 people who showed interest but never committed. Tell them you just sold one and you&apos;re heading to the store — offer to bring materials for theirs too at a discount. These scripts use that same psychology.
            </p>
          </div>

          {/* ── Hook selector ────────────────────────────────────── */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Your Hook — What&apos;s Happening Right Now
            </label>
            <div className="space-y-1.5">
              {FOLLOW_UP_HOOKS.map((h) => {
                const active = followUpHook === h.value;
                return (
                  <button
                    key={h.value}
                    onClick={() => setFollowUpHook(h.value)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${active ? "text-yellow-400" : "text-stone-600"}`} />
                      <div>
                        <span className={`text-xs font-bold ${active ? "text-yellow-400" : "text-stone-300"}`}>
                          {h.label}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${active ? "text-yellow-400/70" : "text-stone-600"}`}>
                          {h.detail}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Offer selector ───────────────────────────────────── */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              The Offer
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {FOLLOW_UP_OFFERS.map((o) => {
                const active = followUpOffer === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setFollowUpOffer(o.value)}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-slate-700 bg-slate-800/50 text-stone-400 hover:border-slate-600 hover:text-stone-300"
                    }`}
                  >
                    <span className="text-xs font-bold">{o.label}</span>
                    <p className="mt-0.5 text-[9px] text-stone-600">{o.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Discount reminder ───────────────────────────────── */}
          {(followUpOffer === "10-off" || followUpOffer === "20-off") && (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
              <Tag className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-yellow-300">Discount code required before you offer this</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-yellow-400/70">
                  When a customer asks for the code you mentioned in your script, you need one ready. Make sure it&apos;s created and active before you start sending.
                </p>
                <button
                  onClick={() => setShowDiscountPanel(true)}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-yellow-400/15 px-3 py-1.5 text-[11px] font-bold text-yellow-300 transition-colors hover:bg-yellow-400/25"
                >
                  <Tag className="h-3 w-3" />
                  Check Discount Codes
                </button>
              </div>
            </div>
          )}

          {/* ── Platform (follow-up) ─────────────────────────────── */}
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Sending Via
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                const active = followUpPlatform === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => setFollowUpPlatform(p.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all ${
                      active
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-slate-700 bg-slate-800/50 text-stone-400 hover:border-slate-600 hover:text-stone-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-bold leading-tight">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Generate button (shared) ─────────────────────────────── */}
      <button
        onClick={generate}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === "followup" ? "Generating Scripts..." : "Generating..."}
          </>
        ) : script ? (
          <>
            <RefreshCw className="h-4 w-4" />
            {mode === "followup" ? "Regenerate Scripts" : "Regenerate Script"}
          </>
        ) : (
          <>
            {mode === "followup" ? <MessageCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {mode === "followup" ? "Generate Follow-Up Scripts" : "Generate Script"}
          </>
        )}
      </button>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      {/* ── OUTPUT: Follow-up mode — sectioned with individual copy ─ */}
      {mode === "followup" && script && (
        <div className="space-y-3">
          {followUpSections.length > 0 ? (
            followUpSections.map((section) => {
              const isSendingTips = /sending tip/i.test(section.title);
              return (
                <div
                  key={section.title}
                  className={`rounded-xl border ${
                    isSendingTips
                      ? "border-slate-700/50 bg-slate-900/50"
                      : "border-slate-700 bg-slate-800"
                  } overflow-hidden`}
                >
                  <div className={`flex items-center justify-between px-4 py-2.5 ${
                    isSendingTips ? "border-b border-slate-700/50" : "border-b border-slate-700"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isSendingTips ? "text-stone-500" : "text-yellow-400"
                    }`}>
                      {section.title}
                    </span>
                    {!isSendingTips && (
                      <button
                        onClick={() => handleCopySection(section.title, section.content)}
                        className="flex items-center gap-1.5 rounded-md bg-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-300 transition-colors hover:bg-slate-600"
                      >
                        {sectionCopied === section.title ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="prose prose-invert prose-sm prose-yellow max-w-none p-4 prose-headings:text-yellow-400 prose-headings:font-bold prose-h2:text-sm prose-h3:text-xs prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })
          ) : (
            // Fallback if parsing fails
            <div className="prose prose-invert prose-sm prose-yellow max-w-none rounded-xl border border-slate-700 bg-slate-800 p-4 prose-headings:text-yellow-400 prose-headings:font-black prose-h2:text-base prose-h3:text-sm prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
              <ReactMarkdown>{script}</ReactMarkdown>
            </div>
          )}

          {/* Regenerate bar */}
          <div className="flex justify-end">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>

          {/* Send the link as follow-up */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2.5">
            <div className="mb-2 flex items-start gap-2">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
              <p className="text-[11px] leading-relaxed text-purple-300">
                Once they reply, send your configurator link so they can design their rack and see pricing. Keep it in Messenger — it&apos;s fully clickable there.
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-300 transition-colors hover:bg-purple-500/30"
            >
              {linkCopied ? (
                <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">Link Copied!</span></>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copy Configurator Link</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── OUTPUT: Post generator mode ──────────────────────────── */}
      {mode === "post" && script && (
        <>
          <div className="prose prose-invert prose-sm prose-yellow max-w-none rounded-xl border border-slate-700 bg-slate-800 p-4 prose-headings:text-yellow-400 prose-headings:font-black prose-h2:text-base prose-h3:text-sm prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
            <ReactMarkdown>{script}</ReactMarkdown>
          </div>

          {/* ── Shared Action Bar ─────────────────────────────────── */}
          {hasOutput && (
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5" /> Copied!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy Post</>
                  )}
                </button>

                <button
                  onClick={handleShareFacebook}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20"
                >
                  <Facebook className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Post to Facebook</span>
                  <span className="sm:hidden">Facebook</span>
                </button>

                <button
                  onClick={handleShareNative}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 sm:hidden"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  More
                </button>

                <button
                  onClick={generate}
                  disabled={loading}
                  className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50 sm:flex"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  New
                </button>
              </div>

              <div className="hidden items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2.5 sm:flex">
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
                <p className="text-[11px] leading-relaxed text-stone-500">
                  <span className="font-bold text-stone-400">Desktop tip:</span>{" "}
                  Click &quot;Post to Facebook&quot; — a share dialog opens with your link card. Your post text is also copied to clipboard.
                </p>
              </div>

              <div className={`rounded-lg border px-3 py-2.5 ${
                isFacebook
                  ? "border-purple-500/20 bg-purple-500/5"
                  : "border-blue-500/20 bg-blue-500/5"
              }`}>
                <div className="mb-2 flex items-start gap-2">
                  <Link2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    isFacebook ? "text-purple-400" : "text-blue-400"
                  }`} />
                  {isFacebook ? (
                    <p className="text-[11px] leading-relaxed text-purple-300">
                      When someone <span className="font-bold text-purple-200">DMs you or comments</span>, paste your configurator link in the reply — links are fully clickable inside Messenger.
                    </p>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-blue-300">
                      After posting, paste your link as the <span className="font-bold text-blue-200">first comment</span> — it&apos;s the only place links are clickable on most platforms.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    isFacebook
                      ? "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                      : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                  }`}
                >
                  {linkCopied ? (
                    <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">Link Copied!</span></>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" />{isFacebook ? "Copy Link for DM Replies" : "Copy Link for First Comment"}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* ── Discount Codes Modal ─────────────────────────────── */}
      {showDiscountPanel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDiscountPanel(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-bold text-white">Discount Codes</span>
              </div>
              <button
                onClick={() => setShowDiscountPanel(false)}
                className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <DiscountCodesCard userId={userId} embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
