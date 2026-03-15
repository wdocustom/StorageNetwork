"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  Flame,
  Crown,
  Medal,
  ChevronUp,
  Loader2,
  Gift,
  Zap,
  TrendingUp,
} from "lucide-react";
import { getLeaderboard, type LeaderboardData, type LeaderboardEntry } from "@/app/actions/leaderboard";

// ═══════════════════════════════════════════════════════════════════════════
// Live Leaderboard — Monthly installer competition
//
// Shows top 10 installers ranked by completed jobs this month.
// Current user is always visible (highlighted). Updates on mount +
// auto-refreshes every 60s. Animated rank badges, streak flames,
// and a prize callout drive competitive engagement.
// ═══════════════════════════════════════════════════════════════════════════

interface LiveLeaderboardProps {
  userId: string;
}

export default function LiveLeaderboard({ userId }: LiveLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const result = await getLeaderboard(userId);
      if (mounted) {
        setData(result);
        setLoading(false);
        // Trigger pulse animation on fresh data
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    }

    load();

    // Auto-refresh every 60 seconds
    const interval = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
          <span className="text-xs font-semibold text-stone-500">Loading leaderboard...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { entries, currentUserRank, monthLabel, daysLeft } = data;
  const top3 = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);
  const leader = entries[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Top accent glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2">
        <div className="h-48 w-96 rounded-full bg-yellow-400/8 blur-3xl" />
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="relative border-b border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/10">
              <Trophy className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Live Leaderboard
              </h2>
              <p className="text-[10px] font-semibold text-stone-500">{monthLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full bg-emerald-400 ${pulse ? "animate-ping" : "animate-pulse"}`}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* ── Podium — Top 3 ────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <div className="border-b border-slate-800 px-5 py-5">
          <div className="flex items-end justify-center gap-3">
            {/* 2nd place (left) */}
            {top3.length >= 2 && (
              <PodiumSlot entry={top3[1]} position={2} isCurrentUser={top3[1].isCurrentUser} />
            )}
            {/* 1st place (center, tallest) */}
            <PodiumSlot entry={top3[0]} position={1} isCurrentUser={top3[0].isCurrentUser} />
            {/* 3rd place (right) */}
            {top3.length >= 3 && (
              <PodiumSlot entry={top3[2]} position={3} isCurrentUser={top3[2].isCurrentUser} />
            )}
          </div>
        </div>
      )}

      {/* ── Rankings Table (4th+) ─────────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="px-4 py-3">
          <div className="space-y-1">
            {rest.map((entry, i) => {
              // Show separator before current user if they're not adjacent
              const showSep =
                entry.isCurrentUser &&
                entry.rank > 11 &&
                i > 0 &&
                rest[i - 1].rank < entry.rank - 1;

              return (
                <div key={entry.id}>
                  {showSep && (
                    <div className="flex items-center gap-2 py-1.5">
                      <div className="h-px flex-1 bg-slate-800" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-stone-600">
                        Your Position
                      </span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>
                  )}
                  <RankRow entry={entry} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Your Rank Summary (if not in top 10) ──────────────────────── */}
      {currentUserRank && currentUserRank > 10 && (
        <div className="border-t border-slate-800 bg-yellow-400/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <ChevronUp className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">
              You&apos;re #{currentUserRank}
            </span>
            <span className="text-[10px] text-stone-500">
              — {leader ? `${leader.jobsThisMonth - (entries.find((e) => e.isCurrentUser)?.jobsThisMonth || 0)} jobs behind #1` : "Complete a job to get on the board!"}
            </span>
          </div>
        </div>
      )}

      {/* ── Countdown Bar ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 bg-slate-950/50 px-5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-bold text-stone-400">
              {daysLeft === 0
                ? "Last day!"
                : daysLeft === 1
                  ? "1 day left"
                  : `${daysLeft} days left`}
            </span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all"
              style={{
                width: `${Math.max(5, ((new Date().getDate()) / (new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Prize Callout ─────────────────────────────────────────────── */}
      <div className="border-t border-yellow-400/10 bg-gradient-to-r from-yellow-400/5 via-amber-400/5 to-yellow-400/5 px-5 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10">
            <Gift className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-yellow-300">
              Monthly Champion Prize
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">
              The installer who dominates the leaderboard this month gets a{" "}
              <span className="font-bold text-yellow-400">free Pro subscription</span>{" "}
              for next month. Every job counts — keep climbing!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Podium Slot (Top 3) ──────────────────────────────────────────────────

function PodiumSlot({
  entry,
  position,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  isCurrentUser: boolean;
}) {
  const heights = { 1: "h-28", 2: "h-20", 3: "h-16" };
  const avatarSizes = { 1: "h-14 w-14", 2: "h-11 w-11", 3: "h-11 w-11" };
  const badgeColors = {
    1: "from-yellow-400 to-amber-500 text-gray-950 shadow-yellow-400/30",
    2: "from-stone-300 to-stone-400 text-gray-950 shadow-stone-300/20",
    3: "from-amber-600 to-amber-700 text-amber-100 shadow-amber-600/20",
  };
  const ringColors = {
    1: "ring-yellow-400",
    2: "ring-stone-400",
    3: "ring-amber-600",
  };

  const initials = entry.businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`flex flex-col items-center ${position === 1 ? "order-2 -mt-2" : position === 2 ? "order-1" : "order-3"}`}>
      {/* Crown for #1 */}
      {position === 1 && (
        <Crown className="mb-1 h-5 w-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
      )}

      {/* Avatar */}
      <div className="relative">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt={entry.businessName}
            className={`${avatarSizes[position]} rounded-full object-cover ring-2 ${ringColors[position]} ${isCurrentUser ? "ring-4" : ""}`}
          />
        ) : (
          <div
            className={`${avatarSizes[position]} flex items-center justify-center rounded-full bg-slate-800 ring-2 ${ringColors[position]} ${isCurrentUser ? "ring-4" : ""}`}
          >
            <span className={`font-black text-stone-400 ${position === 1 ? "text-base" : "text-xs"}`}>
              {initials}
            </span>
          </div>
        )}

        {/* Rank badge */}
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b shadow-lg ${badgeColors[position]}`}
        >
          <span className="text-[9px] font-black">{position}</span>
        </div>

        {/* Streak flame */}
        {entry.streak >= 2 && (
          <div className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full bg-orange-500/20 px-1 py-0.5">
            <Flame className="h-2.5 w-2.5 text-orange-400" />
            <span className="text-[8px] font-black text-orange-400">{entry.streak}</span>
          </div>
        )}
      </div>

      {/* Name */}
      <p
        className={`mt-2.5 max-w-[90px] truncate text-center text-[10px] font-bold leading-tight ${
          isCurrentUser ? "text-yellow-400" : "text-white"
        }`}
        title={entry.businessName}
      >
        {isCurrentUser ? "You" : entry.businessName}
      </p>

      {/* Location */}
      {entry.state && (
        <p className="text-[8px] font-semibold text-stone-600">
          {entry.city ? `${entry.city}, ` : ""}{entry.state}
        </p>
      )}

      {/* Podium bar */}
      <div className={`mt-2 w-20 ${heights[position]} rounded-t-lg ${
        position === 1
          ? "bg-gradient-to-t from-yellow-400/20 to-yellow-400/5 border border-b-0 border-yellow-400/20"
          : position === 2
            ? "bg-gradient-to-t from-stone-400/10 to-stone-400/5 border border-b-0 border-stone-400/15"
            : "bg-gradient-to-t from-amber-600/10 to-amber-600/5 border border-b-0 border-amber-600/15"
      }`}>
        <div className="flex flex-col items-center justify-center h-full">
          <span className={`text-lg font-black ${
            position === 1 ? "text-yellow-400" : position === 2 ? "text-stone-400" : "text-amber-500"
          }`}>
            {entry.jobsThisMonth}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-stone-600">
            jobs
          </span>
          <span className="text-[9px] font-bold text-stone-500 mt-0.5">
            ${entry.revenueThisMonth.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Rank Row (4th place and below) ───────────────────────────────────────

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const initials = entry.businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        entry.isCurrentUser
          ? "bg-yellow-400/10 border border-yellow-400/20"
          : "hover:bg-slate-800/50"
      }`}
    >
      {/* Rank */}
      <span
        className={`w-6 text-center text-xs font-black ${
          entry.isCurrentUser ? "text-yellow-400" : "text-stone-600"
        }`}
      >
        {entry.rank}
      </span>

      {/* Avatar */}
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.avatarUrl}
          alt={entry.businessName}
          className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-700"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 ring-1 ring-slate-700">
          <span className="text-[10px] font-bold text-stone-500">{initials}</span>
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs font-bold ${
            entry.isCurrentUser ? "text-yellow-400" : "text-white"
          }`}
        >
          {entry.isCurrentUser ? `${entry.businessName} (You)` : entry.businessName}
        </p>
        <div className="flex items-center gap-2">
          {entry.state && (
            <span className="text-[9px] text-stone-600">
              {entry.city ? `${entry.city}, ` : ""}{entry.state}
            </span>
          )}
          {entry.streak >= 2 && (
            <span className="flex items-center gap-0.5 text-[9px] text-orange-400">
              <Flame className="h-2.5 w-2.5" />
              {entry.streak}mo streak
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Medal className="h-3 w-3 text-yellow-400" />
          <span className="text-sm font-black text-white">{entry.jobsThisMonth}</span>
        </div>
        <p className="text-[9px] font-semibold text-stone-600">
          ${entry.revenueThisMonth.toLocaleString()}
        </p>
      </div>

      {/* Trend indicator for current user */}
      {entry.isCurrentUser && entry.jobsThisMonth > 0 && (
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      )}
    </div>
  );
}
