"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  Facebook,
  Instagram,
  MapPin,
  ChevronDown,
  ExternalLink,
  List,
  Users,
  Hash,
  Video,
  MessageCircle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// AI Group Finder — Gemini-powered local group suggestions
// ═══════════════════════════════════════════════════════════════════════════

interface FacebookGroup {
  name: string;
  type: string;
  search_terms?: string;
  why: string;
  tip: string;
}

interface CraigslistSection {
  name: string;
  type: string;
  subdomain?: string;
  section_code?: string;
  why: string;
  tip: string;
}

interface OtherPlatform {
  platform: string;
  name: string;
  type: string;
  why: string;
  tip: string;
}

interface Suggestions {
  facebook: FacebookGroup[];
  craigslist: CraigslistSection[];
  other: OtherPlatform[];
}

interface GroupFinderProps {
  city: string | null;
  state: string | null;
  zip: string | null;
  businessName: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  "buy-sell-trade": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "mom-group": "bg-pink-500/15 text-pink-400 border-pink-500/20",
  "neighborhood": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "home-improvement": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "community": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "odd-jobs": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "marketplace": "bg-teal-500/15 text-teal-400 border-teal-500/20",
  "services": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "for-sale": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "gigs": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "hashtag": "bg-pink-500/15 text-pink-400 border-pink-500/20",
  "page": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "subreddit": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "strategy": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
};

const PLATFORM_ICONS: Record<string, typeof Facebook> = {
  Instagram: Instagram,
  Nextdoor: MapPin,
  TikTok: Video,
  Reddit: MessageCircle,
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || "bg-slate-700/30 text-stone-400 border-slate-600/30";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${color}`}>
      {type.replace(/-/g, " ")}
    </span>
  );
}

export default function GroupFinder({
  city,
  state,
  zip,
  businessName,
}: GroupFinderProps) {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>("facebook");

  async function findGroups() {
    setLoading(true);
    setError("");
    setSuggestions(null);
    try {
      const res = await fetch("/api/marketing/suggest-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, state, zip, businessName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to find groups");
      setSuggestions(data.suggestions);
      setExpandedSection("facebook");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  const locationLabel =
    city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";

  return (
    <div className="space-y-4">
      {/* Location context */}
      <div className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
        <MapPin className="h-3.5 w-3.5 text-yellow-400" />
        <p className="text-xs text-stone-400">
          Finding groups near{" "}
          <span className="font-bold text-white">{locationLabel}</span>
        </p>
      </div>

      {/* Generate button */}
      <button
        onClick={findGroups}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3.5 text-sm font-black uppercase tracking-wider text-white transition-all hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : suggestions ? (
          <>
            <Search className="h-4 w-4" />
            Search Again
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Find Groups &amp; Pages
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {suggestions && (
        <div className="space-y-2">
          {/* ── Facebook Groups ────────────────────────────────── */}
          {suggestions.facebook?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-blue-500/20 bg-slate-900">
              <button
                onClick={() => toggleSection("facebook")}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                  <Facebook className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-400">Facebook Groups</p>
                  <p className="text-[10px] text-stone-500">
                    {suggestions.facebook.length} groups found
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform ${
                    expandedSection === "facebook" ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expandedSection === "facebook" && (
                <div className="border-t border-slate-800 p-3 space-y-2">
                  {suggestions.facebook.map((g, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-slate-800/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">
                              {g.name}
                            </p>
                            <TypeBadge type={g.type} />
                          </div>
                          <p className="mt-1 text-xs text-stone-400">
                            {g.why}
                          </p>
                          <p className="mt-1.5 text-[11px] text-yellow-400/80">
                            <span className="font-bold">Tip:</span> {g.tip}
                          </p>
                        </div>
                        <a
                          href={`https://www.facebook.com/search/groups/?q=${encodeURIComponent(g.search_terms || g.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-stone-500 transition-colors hover:border-blue-400 hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Craigslist Sections ───────────────────────────── */}
          {suggestions.craigslist?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-purple-500/20 bg-slate-900">
              <button
                onClick={() => toggleSection("craigslist")}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
                  <List className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-purple-400">Craigslist</p>
                  <p className="text-[10px] text-stone-500">
                    {suggestions.craigslist.length} sections
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform ${
                    expandedSection === "craigslist" ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expandedSection === "craigslist" && (
                <div className="border-t border-slate-800 p-3 space-y-2">
                  {suggestions.craigslist.map((s, i) => {
                    const clUrl = s.subdomain && s.section_code
                      ? `https://${s.subdomain}.craigslist.org/search/${s.section_code}`
                      : null;
                    return (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-800/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white">{s.name}</p>
                              <TypeBadge type={s.type} />
                            </div>
                            <p className="mt-1 text-xs text-stone-400">{s.why}</p>
                            <p className="mt-1.5 text-[11px] text-yellow-400/80">
                              <span className="font-bold">Tip:</span> {s.tip}
                            </p>
                          </div>
                          {clUrl && (
                            <a
                              href={clUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-stone-500 transition-colors hover:border-purple-400 hover:text-purple-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Other Platforms ────────────────────────────────── */}
          {suggestions.other?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-900">
              <button
                onClick={() => toggleSection("other")}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-cyan-400">
                    Other Platforms
                  </p>
                  <p className="text-[10px] text-stone-500">
                    {suggestions.other.length} suggestions
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-stone-500 transition-transform ${
                    expandedSection === "other" ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expandedSection === "other" && (
                <div className="border-t border-slate-800 p-3 space-y-2">
                  {suggestions.other.map((o, i) => {
                    const Icon = PLATFORM_ICONS[o.platform] || Hash;
                    return (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-800/50 p-3"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon className="h-3.5 w-3.5 text-stone-500" />
                          <p className="text-sm font-bold text-white">
                            {o.name}
                          </p>
                          <span className="text-[10px] font-semibold text-stone-500">
                            {o.platform}
                          </span>
                          <TypeBadge type={o.type} />
                        </div>
                        <p className="mt-1 text-xs text-stone-400">{o.why}</p>
                        <p className="mt-1.5 text-[11px] text-yellow-400/80">
                          <span className="font-bold">Tip:</span> {o.tip}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
