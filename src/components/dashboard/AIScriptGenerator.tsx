"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
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
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Script Generator — Gemini-powered social media marketing copy
// ═══════════════════════════════════════════════════════════════════════════

type Platform =
  | "facebook-group"
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

interface AIScriptGeneratorProps {
  bookingLink: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  businessName: string | null;
}

export default function AIScriptGenerator({
  bookingLink,
  city,
  state,
  zip,
  businessName,
}: AIScriptGeneratorProps) {
  const [platform, setPlatform] = useState<Platform>("facebook-group");
  const [tone, setTone] = useState<Tone>("casual");
  const [customTopic, setCustomTopic] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
    } catch (err: any) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Strip markdown syntax so the copied text pastes cleanly on FB/social media
  function stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, "")        // ## headers → plain text
      .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold** → bold text only
      .replace(/\*([^*]+)\*/g, "$1")       // *italic* → italic text only
      .replace(/^---+\s*$/gm, "")          // horizontal rules
      .replace(/^\*\s+/gm, "• ")           // * bullets → • bullets
      .replace(/^-\s+/gm, "• ")            // - bullets → • bullets
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")  // [text](url) → text: url
      .replace(/\n{3,}/g, "\n\n")          // collapse excess blank lines
      .trim();
  }

  // Strip Pro-Tips section from copy text (everything after the --- separator
  // that precedes "Pro-Tips"). Hashtags and Search Keywords live BEFORE the
  // separator so they are always preserved. Then strip markdown for clean paste.
  function getPostText(): string {
    // Split on the horizontal rule that precedes Pro-Tips
    const parts = script.split(/\n---\s*\n/);
    let cleaned: string;
    if (parts.length <= 1) {
      cleaned = script;
    } else {
      // Keep everything before the ---, plus any sections after that are NOT Pro-Tips
      const postParts = [parts[0]];
      for (let i = 1; i < parts.length; i++) {
        if (/^#{1,3}\s*Pro[- ]?Tips/im.test(parts[i])) continue;
        postParts.push(parts[i]);
      }
      cleaned = postParts.join("\n\n").trim();
    }
    return stripMarkdown(cleaned);
  }

  function handleCopy() {
    navigator.clipboard.writeText(getPostText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    const text = getPostText();
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Platform
        </label>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
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

      {/* Tone selector */}
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

      {/* Custom topic (optional) */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Custom Angle <span className="font-normal text-stone-600">(optional)</span>
        </label>
        <input
          type="text"
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          placeholder="e.g. Spring cleaning season, recent install I did, holiday prep..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 outline-none focus:border-yellow-400"
        />
      </div>

      {/* Generate button */}
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

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      {/* Output — rendered as markdown */}
      {script && (
        <div className="space-y-3">
          <div className="prose prose-invert prose-sm prose-yellow max-w-none rounded-xl border border-slate-700 bg-slate-800 p-4 prose-headings:text-yellow-400 prose-headings:font-black prose-h2:text-base prose-h3:text-sm prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
            <ReactMarkdown>{script}</ReactMarkdown>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:hidden"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              onClick={handleCopy}
              className="hidden items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:flex"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Script
                </>
              )}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 sm:hidden"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              New
            </button>
          </div>

          {/* Booking link reminder */}
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <p className="text-[11px] text-emerald-400">
              Your booking link is embedded in the script
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
