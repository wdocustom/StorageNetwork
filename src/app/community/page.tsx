"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  Clock,
  HelpCircle,
  Hash,
  Loader2,
  Users,
  MessageSquare,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getCommunities, getPosts, type Community, type Post } from "@/app/actions/community";
import PostCard from "@/components/community/PostCard";

type Feed = "latest" | "trending" | "unanswered";

export default function CommunityPage() {
  const supabase = getSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeFeed, setActiveFeed] = useState<Feed>("latest");
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);

    const [communitiesData, postsData] = await Promise.all([
      getCommunities(),
      getPosts({
        communitySlug: activeCommunity || undefined,
        feed: activeFeed,
        userId: user.id,
      }),
    ]);

    setCommunities(communitiesData);
    setPosts(postsData);
    setLoading(false);
  }, [supabase, activeFeed, activeCommunity]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const feeds: { key: Feed; label: string; icon: typeof Clock }[] = [
    { key: "latest", label: "Latest", icon: Clock },
    { key: "trending", label: "Trending", icon: TrendingUp },
    { key: "unanswered", label: "Unanswered", icon: HelpCircle },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── Main Feed ──────────────────────────────────────── */}
        <div>
          {/* Feed Tabs */}
          <div className="mb-4 flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
            {feeds.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFeed(f.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  activeFeed === f.key
                    ? "bg-yellow-400/10 text-yellow-400"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>

          {/* Active community filter */}
          {activeCommunity && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-stone-500">Filtering:</span>
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                {communities.find((c) => c.slug === activeCommunity)?.name}
              </span>
              <button
                onClick={() => setActiveCommunity(null)}
                className="text-[10px] text-stone-600 hover:text-stone-300"
              >
                Clear
              </button>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-stone-700" />
                <p className="text-sm text-stone-500">
                  {activeFeed === "unanswered"
                    ? "All posts have been answered. Great community!"
                    : "No posts yet. Be the first to start a conversation."}
                </p>
                <a
                  href="/community/new"
                  className="mt-3 inline-block rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-yellow-300"
                >
                  Create Post
                </a>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} userId={userId!} />
              ))
            )}
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="space-y-4">
          {/* Communities Panel */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Hash className="h-3.5 w-3.5" />
              Spaces
            </h2>
            <div className="space-y-1">
              <button
                onClick={() => setActiveCommunity(null)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  !activeCommunity
                    ? "bg-yellow-400/10 font-semibold text-yellow-400"
                    : "text-stone-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>All Spaces</span>
              </button>
              {communities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCommunity(c.slug)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                    activeCommunity === c.slug
                      ? "bg-yellow-400/10 font-semibold text-yellow-400"
                      : "text-stone-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="ml-2 text-[10px] text-stone-600">
                    {c.post_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Community Stats */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Users className="h-3.5 w-3.5" />
              Community
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-lg font-black text-white">
                  {communities.reduce((sum, c) => sum + c.post_count, 0)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-stone-600">
                  Posts
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-white">
                  {communities.length}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-stone-600">
                  Spaces
                </p>
              </div>
            </div>
          </div>

          {/* Pro Badge */}
          <div className="rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-slate-900 p-4 text-center">
            <p className="text-xs font-bold text-yellow-400">
              Pro Community Member
            </p>
            <p className="mt-1 text-[10px] text-stone-500">
              Exclusive access to builder discussions, AI summaries, and expert advice.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
