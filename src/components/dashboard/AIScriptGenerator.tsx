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
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Script Generator — Gemini-powered, platform-specific marketing copy.
//
// Desktop sharing: direct clipboard + "open Facebook" flow instead of a
// broken Web Share API / sharer.php combo.
// ═══════════════════════════════════════════════════════════════════════════

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
  { value: "professional", label: "Professional", desc: "Authoritative & skilled" },
  { value: "casual", label: "Casual", desc: "Friendly neighbor vibe" },
  { value: "urgent", label: "Urgent", desc: "Limited spots / seasonal" },
  { value: "storytelling", label: "Story", desc: "Before/after narrative" },
  { value: "humorous", label: "Funny", desc: "Witty & memorable" },
  { value: "direct", label: "Hard Sell", desc: "Straight to the point" },
  { value: "reverse-psychology", label: "Reverse Psych", desc: "\"Don't buy this...\"" },
];

// Topic presets — chip shortcuts for the custom angle field.
const TOPIC_PRESETS = [
  { label: "Tote Racks", value: "Focus on the wall-mounted sliding tote rack system — the core product." },
  { label: "Overhead Storage", value: "Focus on overhead ceiling storage. Hook: Is there usable space above your head in the garage? Most people never look up — let's capitalize on that dead space to organize your home. Totes mounted to the ceiling joists, out of the way but easy to grab." },
  { label: "Open Shelving", value: "Focus on custom open shelving as a bonus add-on. Great for items that don't fit in totes — toolboxes, paint cans, coolers, sports equipment. Wall-mounted or freestanding." },
  { label: "Full Garage System", value: "Pitch the complete garage organization system — wall racks + overhead ceiling storage + open shelving. Top to bottom, wall to wall. One installer, one visit, total transformation." },
  { label: "Raised Beds", value: "Focus on handmade cedar raised bed planters. Two styles: elevated on legs for comfortable gardening without bending, and ground-level for traditional garden beds. Natural cedar, cedar stain, or painted white finishes. Pest protection covers available. Mention the string light planter post for patios." },
  { label: "String Light Post", value: "Focus on the 24x24 planter base with a 7-foot center post for hanging outdoor string lights. Perfect for patios, entertaining areas, outdoor dining. Handmade cedar, available in natural, stained, or painted white." },
  { label: "Spring Cleaning", value: "Seasonal spring cleaning angle — time to get organized before summer." },
  { label: "Holiday Prep", value: "Holiday season angle — get decorations organized and accessible with overhead ceiling storage." },
];

// ── Component ───────────────────────────────────────────────────────────

interface AIScriptGeneratorProps {
  bookingLink: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  businessName: string | null;
  /** Called whenever the active post text changes (for parent components to react) */
  onActiveTextChange?: (text: string | null) => void;
}

export default function AIScriptGenerator({
  bookingLink,
  city,
  state,
  zip,
  businessName,
  onActiveTextChange,
}: AIScriptGeneratorProps) {
  const [platform, setPlatform] = useState<Platform>("facebook-group");
  const [tone, setTone] = useState<Tone>("casual");
  const [customTopic, setCustomTopic] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── AI generation ──────────────────────────────────────────────────

  async function generate() {
    setLoading(true);
    setError("");
    setScript("");
    try {
      const payload = {
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

  function handleCopyLink() {
    navigator.clipboard.writeText(bookingLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    logActivityClient({ action: "copy_link", pagePath: "/dashboard/marketing" });
  }

  /**
   * Share flow that works on BOTH desktop and mobile:
   *  - Copies post text to clipboard
   *  - Opens Facebook sharer dialog with the booking link so FB renders
   *    the OG card (image + title + description) automatically
   *  - The `quote` param pre-fills the post text above the card
   */
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
  const isFacebook = platform.startsWith("facebook-");

  useEffect(() => {
    onActiveTextChange?.(activeText);
  }, [activeText, onActiveTextChange]);

  return (
    <div className="space-y-4">
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

      {/* ── Generate button ──────────────────────────────────── */}
      <button
        onClick={generate}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:from-yellow-300 hover:to-amber-400 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : script ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Regenerate Script
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Script
          </>
        )}
      </button>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      {/* ── AI output (markdown) ─────────────────────────────── */}
      {script && (
        <div className="prose prose-invert prose-sm prose-yellow max-w-none rounded-xl border border-slate-700 bg-slate-800 p-4 prose-headings:text-yellow-400 prose-headings:font-black prose-h2:text-base prose-h3:text-sm prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
          <ReactMarkdown>{script}</ReactMarkdown>
        </div>
      )}

      {/* ── Shared Action Bar (shows when there's output) ────── */}
      {hasOutput && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Post
                </>
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
              Click &quot;Post to Facebook&quot; — a share dialog opens with your link card. Your post text is also copied to clipboard if you want to paste it.
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
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {isFacebook
                    ? "Copy Link for DM Replies"
                    : "Copy Link for First Comment"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
