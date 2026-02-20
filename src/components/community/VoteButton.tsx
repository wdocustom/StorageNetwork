"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { vote } from "@/app/actions/community";

interface VoteButtonProps {
  userId: string;
  postId?: string;
  commentId?: string;
  upvotes: number;
  downvotes: number;
  userVote?: number | null;
  compact?: boolean;
}

export default function VoteButton({
  userId,
  postId,
  commentId,
  upvotes,
  downvotes,
  userVote,
  compact = false,
}: VoteButtonProps) {
  const [currentVote, setCurrentVote] = useState(userVote || null);
  const [currentUp, setCurrentUp] = useState(upvotes);
  const [currentDown, setCurrentDown] = useState(downvotes);
  const [isPending, startTransition] = useTransition();

  const score = currentUp - currentDown;

  function handleVote(value: 1 | -1) {
    // Optimistic update
    if (currentVote === value) {
      // Toggle off
      if (value === 1) setCurrentUp((v) => v - 1);
      else setCurrentDown((v) => v - 1);
      setCurrentVote(null);
    } else if (currentVote) {
      // Switch direction
      if (value === 1) {
        setCurrentUp((v) => v + 1);
        setCurrentDown((v) => Math.max(0, v - 1));
      } else {
        setCurrentDown((v) => v + 1);
        setCurrentUp((v) => Math.max(0, v - 1));
      }
      setCurrentVote(value);
    } else {
      // New vote
      if (value === 1) setCurrentUp((v) => v + 1);
      else setCurrentDown((v) => v + 1);
      setCurrentVote(value);
    }

    startTransition(async () => {
      await vote({ userId, postId, commentId, value });
    });
  }

  const size = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={`flex items-center ${compact ? "gap-1" : "flex-col gap-0.5"}`}>
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`rounded p-0.5 transition-colors ${
          currentVote === 1
            ? "text-yellow-400 bg-yellow-400/10"
            : "text-stone-600 hover:text-yellow-400 hover:bg-slate-800"
        }`}
        title="Upvote"
      >
        <ChevronUp className={size} />
      </button>

      <span
        className={`text-center font-bold ${compact ? "text-xs min-w-[20px]" : "text-sm min-w-[24px]"} ${
          score > 0
            ? "text-yellow-400"
            : score < 0
              ? "text-red-400"
              : "text-stone-500"
        }`}
      >
        {score}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`rounded p-0.5 transition-colors ${
          currentVote === -1
            ? "text-red-400 bg-red-400/10"
            : "text-stone-600 hover:text-red-400 hover:bg-slate-800"
        }`}
        title="Downvote"
      >
        <ChevronDown className={size} />
      </button>
    </div>
  );
}
