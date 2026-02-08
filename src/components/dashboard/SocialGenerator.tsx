"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Social Post Generator — Professional templates for installer promotion
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATES = {
  standard: {
    label: "Standard",
    text: (link: string) =>
      `Tired of clutter taking over your space? 🗂️ I install custom tote storage systems that transform any room — garages, basements, sheds, you name it. Design yours in 30 seconds with my free 3D tool:\n\n${link}`,
  },
  urgent: {
    label: "Urgent",
    text: (link: string) =>
      `🚨 I have 3 install spots open this week! These heavy-duty tote organizers are flying off the shelves. Design your custom setup and lock in your spot before they're gone:\n\n${link}`,
  },
  casual: {
    label: "Casual",
    text: (link: string) =>
      `Finally found a storage solution that actually works 💪 Custom-built tote systems for any space. Check out my 3D design tool — takes 30 seconds to see what fits your wall:\n\n${link}`,
  },
  valuedriven: {
    label: "Value-Driven",
    text: (link: string) =>
      `Stop buying cheap shelving that falls apart. My heavy-duty tote storage systems are built to last and hold 1000+ lbs per unit. See what fits your space:\n\n${link}`,
  },
} as const;

type Tone = keyof typeof TEMPLATES;

interface SocialGeneratorProps {
  bookingLink: string;
  compact?: boolean;
}

export default function SocialGenerator({
  bookingLink,
  compact = false,
}: SocialGeneratorProps) {
  const [tone, setTone] = useState<Tone>("standard");
  const [copied, setCopied] = useState(false);

  const postText = TEMPLATES[tone].text(bookingLink);

  function handleCopy() {
    navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ text: postText }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  return (
    <div className={compact ? "" : "space-y-3"}>
      {/* Tone Selector */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Tone
        </label>
        <select
          value={tone}
          onChange={(e) => {
            setTone(e.target.value as Tone);
            setCopied(false);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white outline-none focus:border-yellow-400"
        >
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <option key={key} value={key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-300">
          {postText}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:hidden"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share Post
        </button>
        <button
          onClick={handleCopy}
          className="hidden items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:flex"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy Text
            </>
          )}
        </button>
        {/* Mobile copy fallback */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 sm:hidden"
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
      </div>
    </div>
  );
}
