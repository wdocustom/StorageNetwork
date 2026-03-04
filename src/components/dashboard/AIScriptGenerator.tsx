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
  Link2,
  ShoppingBag,
  Zap,
  ExternalLink,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Script Generator — Unified marketing copy hub
//
// Two modes:
//   1. Quick Post  — Pre-written templates (instant, no waiting)
//   2. AI Generate — Gemini-powered, platform-specific scripts
//
// Desktop sharing: direct clipboard + "open Facebook" flow instead of
// broken Web Share API / sharer.php combo.
// ═══════════════════════════════════════════════════════════════════════════

type Mode = "quick" | "ai";

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

// ── Quick Post Templates ────────────────────────────────────────────────

interface PostTemplate {
  id: string;
  label: string;
  hook: string;
  getText: (link: string, name: string, location: string) => string;
}

function buildTemplates(): PostTemplate[] {
  return [
    {
      id: "direct",
      label: "Direct Offer",
      hook: "Straight to the point — here's what I do",
      getText: (link, _name, location) =>
        `I build custom tote storage systems for garages${location ? ` in ${location}` : ""}. Design yours in 30 seconds with the free 3D tool — see how many totes your wall can hold and get a real price.\n\n${link}`,
    },
    {
      id: "question",
      label: "Question Hook",
      hook: "Calls out the pain point everyone has",
      getText: (link, _name, location) =>
        `Who else has bins and totes stacked all over their garage floor? I install custom tote rack systems${location ? ` in ${location}` : ""} that get everything off the ground and organized. You can design yours in 30 seconds with this free tool:\n\n${link}`,
    },
    {
      id: "transformation",
      label: "Before / After",
      hook: "Transformation story — great with photos",
      getText: (link, _name, location) =>
        `Transformed another garage this week. If your garage is a mess, I can build you a custom tote rack system${location ? ` — serving ${location}` : ""}. Design yours free in 30 seconds and see the price instantly:\n\n${link}`,
    },
    {
      id: "seasonal",
      label: "Spring Cleaning",
      hook: "Seasonal urgency — post during cleanup season",
      getText: (link, _name, location) =>
        `Spring cleaning time! If you need your garage organized, I build custom tote storage racks${location ? ` in ${location}` : ""}. Use my free 3D designer to see what fits your wall — takes 30 seconds:\n\n${link}`,
    },
  ];
}

// ── Component ───────────────────────────────────────────────────────────

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
  // Mode toggle
  const [mode, setMode] = useState<Mode>("quick");

  // Quick Post state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // AI state
  const [platform, setPlatform] = useState<Platform>("facebook-group");
  const [tone, setTone] = useState<Tone>("casual");
  const [customTopic, setCustomTopic] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shared state
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const name = businessName || "my business";
  const location = [city, state].filter(Boolean).join(", ");
  const templates = buildTemplates();

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
    } catch (err: any) {
      setError(err.message || "Something went wrong. Try again.");
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

  function getAIPostText(): string {
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

  /** Get the active post text (quick template or AI-generated) */
  function getActiveText(): string | null {
    if (mode === "quick" && selectedTemplate) {
      const tmpl = templates.find((t) => t.id === selectedTemplate);
      return tmpl ? tmpl.getText(bookingLink, name, location) : null;
    }
    if (mode === "ai" && script) {
      return getAIPostText();
    }
    return null;
  }

  // ── Sharing helpers ────────────────────────────────────────────────

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleCopy() {
    const text = getActiveText();
    if (text) copyText(text);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(bookingLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  /**
   * Share flow that works on BOTH desktop and mobile:
   *  - Mobile: native share sheet (if available)
   *  - Desktop: copy text to clipboard + open Facebook compose in new tab
   */
  function handleShareFacebook() {
    const text = getActiveText();
    if (!text) return;

    // Always copy text first so it's ready to paste
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Open Facebook — desktop users paste into the compose box
    window.open("https://www.facebook.com/", "_blank");
  }

  function handleShareNative() {
    const text = getActiveText();
    if (!text) return;

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      // Fallback: just copy
      copyText(text);
    }
  }

  // ── Determine if we have output to show ────────────────────────────
  const activeText = getActiveText();
  const hasOutput = !!activeText;

  // For the link hint, use the selected platform (AI mode) or default to facebook-group (quick mode)
  const activePlatform = mode === "ai" ? platform : "facebook-group";
  const isFacebook = activePlatform.startsWith("facebook-");

  return (
    <div className="space-y-4">
      {/* ── Mode Toggle ──────────────────────────────────────────── */}
      <div className="flex rounded-xl border border-slate-700 bg-slate-800/50 p-1">
        <button
          onClick={() => setMode("quick")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            mode === "quick"
              ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
              : "text-stone-500 hover:text-stone-300"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Quick Post
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            mode === "ai"
              ? "bg-yellow-400/15 text-yellow-400 shadow-sm"
              : "text-stone-500 hover:text-stone-300"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Generate
        </button>
      </div>

      {/* ── Quick Post Mode ──────────────────────────────────────── */}
      {mode === "quick" && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Pre-written posts with your link baked in. Tap one, then copy &amp; paste into any group or feed.
          </p>

          {templates.map((tmpl) => {
            const isSelected = selectedTemplate === tmpl.id;
            const postText = tmpl.getText(bookingLink, name, location);

            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(isSelected ? null : tmpl.id)}
                className={`w-full rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                    : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                }`}
              >
                {/* Label */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <div>
                    <p className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-white"}`}>
                      {tmpl.label}
                    </p>
                    <p className="text-[10px] text-stone-500">{tmpl.hook}</p>
                  </div>
                  {isSelected && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      Selected
                    </span>
                  )}
                </div>

                {/* Post preview */}
                <div className="px-4 py-2">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-stone-300">
                    {postText}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── AI Generate Mode ─────────────────────────────────────── */}
      {mode === "ai" && (
        <div className="space-y-4">
          {/* Platform selector */}
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

          {/* Custom topic */}
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

          {/* AI output — rendered as markdown */}
          {script && (
            <div className="prose prose-invert prose-sm prose-yellow max-w-none rounded-xl border border-slate-700 bg-slate-800 p-4 prose-headings:text-yellow-400 prose-headings:font-black prose-h2:text-base prose-h3:text-sm prose-strong:text-white prose-li:text-stone-300 prose-p:text-stone-300 prose-p:leading-relaxed">
              <ReactMarkdown>{script}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* ── Shared Action Bar (shows when there's output) ─────────── */}
      {hasOutput && (
        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          {/* Primary actions */}
          <div className="flex flex-wrap gap-2">
            {/* Copy Post — works everywhere (desktop + mobile) */}
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

            {/* Share to Facebook — copies text + opens FB (desktop & mobile) */}
            <button
              onClick={handleShareFacebook}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              <Facebook className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Post to Facebook</span>
              <span className="sm:hidden">Facebook</span>
            </button>

            {/* Native Share — mobile only (shows the OS share sheet) */}
            <button
              onClick={handleShareNative}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 sm:hidden"
            >
              <Share2 className="h-3.5 w-3.5" />
              More
            </button>

            {/* Regenerate — AI mode only */}
            {mode === "ai" && (
              <button
                onClick={generate}
                disabled={loading}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50 sm:flex"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                New
              </button>
            )}
          </div>

          {/* Desktop sharing instruction */}
          <div className="hidden items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2.5 sm:flex">
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
            <p className="text-[11px] leading-relaxed text-stone-500">
              <span className="font-bold text-stone-400">Desktop tip:</span>{" "}
              Click &quot;Post to Facebook&quot; — your post text is auto-copied. Just paste (Ctrl+V / Cmd+V) into the Facebook compose box.
            </p>
          </div>

          {/* Copy link helper — context-aware for Facebook vs other platforms */}
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
