"use client";

import { useState } from "react";
import {
  Loader2,
  Sparkles,
  ChevronDown,
  Facebook,
  Instagram,
  MapPin,
  ExternalLink,
  Globe,
  Search,
  AlertCircle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Group Finder — Gemini-powered local group/page suggestions
// ═══════════════════════════════════════════════════════════════════════════

interface GroupSuggestion {
  name: string;
  category: string;
  reason: string;
}

interface PlatformResult {
  platform: string;
  icon: string;
  groups: GroupSuggestion[];
}

interface AIGroupFinderProps {
  city: string | null;
  state: string | null;
  zip: string | null;
}

function getPlatformIcon(icon: string) {
  switch (icon) {
    case "facebook": return Facebook;
    case "instagram": return Instagram;
    case "craigslist": return ExternalLink;
    default: return Globe;
  }
}

function getPlatformColor(icon: string): string {
  switch (icon) {
    case "facebook": return "text-blue-400";
    case "instagram": return "text-pink-400";
    case "craigslist": return "text-purple-400";
    default: return "text-emerald-400";
  }
}

function getPlatformBg(icon: string): string {
  switch (icon) {
    case "facebook": return "bg-blue-500/10";
    case "instagram": return "bg-pink-500/10";
    case "craigslist": return "bg-purple-500/10";
    default: return "bg-emerald-500/10";
  }
}

export default function AIGroupFinder({ city, state, zip }: AIGroupFinderProps) {
  const [results, setResults] = useState<PlatformResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  const hasLocation = city || state || zip;

  async function findGroups() {
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/marketing/group-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, state, zip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to find groups");
      setResults(data.platforms || []);
      // Auto-expand the first platform
      if (data.platforms?.length > 0) {
        setExpandedPlatform(data.platforms[0].platform);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!hasLocation && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300">
            <span className="font-bold">Location required.</span> Update your{" "}
            <a href="/dashboard/profile" className="font-bold underline hover:text-amber-200">
              profile
            </a>{" "}
            with your city &amp; state so we can find local groups near you.
          </p>
        </div>
      )}

      <button
        onClick={findGroups}
        disabled={loading || !hasLocation}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black uppercase tracking-wider text-white transition-all hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding Groups...
          </>
        ) : results ? (
          <>
            <Search className="h-4 w-4" />
            Search Again
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Find Groups Near Me
          </>
        )}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((platform) => {
            const isExpanded = expandedPlatform === platform.platform;
            const Icon = getPlatformIcon(platform.icon);
            const colorClass = getPlatformColor(platform.icon);
            const bgClass = getPlatformBg(platform.icon);

            return (
              <div key={platform.platform} className="rounded-xl border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpandedPlatform(isExpanded ? null : platform.platform)}
                  className="flex w-full items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{platform.platform}</p>
                    <p className="text-[10px] text-stone-500">
                      {platform.groups.length} {platform.groups.length === 1 ? "suggestion" : "suggestions"}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700 bg-slate-900/50 p-3 space-y-2">
                    {platform.groups.map((group, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${colorClass}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">{group.name}</p>
                            <span className="mt-1 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-400">
                              {group.category}
                            </span>
                            <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                              {group.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
