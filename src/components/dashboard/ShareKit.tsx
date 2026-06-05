"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Share2,
  Facebook,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// ShareKit — Zero-friction social sharing for installers
//
// Pre-written, ready-to-paste posts with the installer's link embedded.
// No generation, no waiting — tap "Copy Post" and paste into FB.
// ═══════════════════════════════════════════════════════════════════════════

interface ShareKitProps {
  bookingLink: string;
  businessName: string | null;
  city: string | null;
  state: string | null;
}

interface PostTemplate {
  id: string;
  label: string;
  hook: string; // Short description of the angle
  getText: (link: string, name: string, location: string) => string;
}

function buildTemplates(): PostTemplate[] {
  return [
    {
      id: "direct",
      label: "Direct Offer",
      hook: "Straight to the point — here's what I do",
      getText: (link, name, location) =>
        `I build custom tote storage systems for garages${location ? ` in ${location}` : ""}. Design yours in 30 seconds with the free 3D tool — see how many totes your wall can hold and get a real price.\n\n${link}`,
    },
    {
      id: "question",
      label: "Question Hook",
      hook: "Calls out the pain point everyone has",
      getText: (link, name, location) =>
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
    {
      id: "overhead",
      label: "Overhead Storage",
      hook: "Capitalize on dead ceiling space",
      getText: (link, _name, location) =>
        `Ever look up in your garage and think "that's a lot of wasted space"? I build overhead ceiling storage systems${location ? ` right here in ${location}` : ""} — totes mount directly to the joists, completely out of the way. Design yours in 30 seconds:\n\n${link}`,
    },
    {
      id: "shelving",
      label: "Open Shelving",
      hook: "Custom shelves for stuff that doesn't fit in totes",
      getText: (link, _name, location) =>
        `Not everything fits in a tote. I build custom heavy-duty open shelving${location ? ` in ${location}` : ""} for toolboxes, paint cans, coolers, sports gear — all the odd-shaped stuff. Wall-mounted or freestanding, built to last:\n\n${link}`,
    },
  ];
}

export default function ShareKit({
  bookingLink,
  businessName,
  city,
  state,
}: ShareKitProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const name = businessName || "my business";
  const location = [city, state].filter(Boolean).join(", ");
  const templates = buildTemplates();

  function copyPost(template: PostTemplate) {
    const text = template.getText(bookingLink, name, location);
    navigator.clipboard.writeText(text);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function sharePost(template: PostTemplate) {
    const text = template.getText(bookingLink, name, location);

    // Mobile: use native share sheet (lets them pick FB, IG, iMessage, etc.)
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
      return;
    }

    // Desktop: copy to clipboard + open Facebook share dialog with the link
    navigator.clipboard.writeText(text);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2500);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingLink)}`,
      "_blank",
      "width=600,height=400"
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-zinc-900 to-zinc-900">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Quick Share
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Ready to Post
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Pre-written posts with your link — copy &amp; paste into FB groups
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-stone-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-500" />
        )}
      </button>

      {/* Posts — collapsible */}
      {expanded && (
        <div className="space-y-3 border-t border-zinc-800/60 px-5 pb-5 pt-4">
          {/* Instruction callout */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2.5">
            <Facebook className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
            <p className="text-[11px] leading-relaxed text-blue-300">
              Tap <span className="font-bold text-blue-200">Copy Post</span> below, then paste it straight into a Facebook group.
              Your link is already included — FB will show a preview card automatically.
            </p>
          </div>

          {templates.map((tmpl) => {
            const isCopied = copiedId === tmpl.id;
            const postText = tmpl.getText(bookingLink, name, location);

            return (
              <div
                key={tmpl.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden"
              >
                {/* Post label */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <div>
                    <p className="text-xs font-bold text-white">{tmpl.label}</p>
                    <p className="text-[10px] text-stone-500">{tmpl.hook}</p>
                  </div>
                </div>

                {/* Post preview */}
                <div className="px-4 py-2">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-stone-300">
                    {postText}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-zinc-800/60 px-4 py-3 bg-zinc-900/50">
                  {/* Mobile: Share (native sheet) */}
                  <button
                    onClick={() => sharePost(tmpl)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:hidden"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>

                  {/* Desktop: Copy Post */}
                  <button
                    onClick={() => copyPost(tmpl)}
                    className="hidden flex-1 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300 sm:flex"
                  >
                    {isCopied ? (
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

                  {/* Mobile: Copy fallback */}
                  <button
                    onClick={() => copyPost(tmpl)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 sm:hidden"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {/* Desktop: Share to FB */}
                  <button
                    onClick={() => sharePost(tmpl)}
                    className="hidden items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20 sm:flex"
                  >
                    <Facebook className="h-3.5 w-3.5" />
                    Share to FB
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
