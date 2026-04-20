"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { saveAiSummary, type Comment } from "@/app/actions/community";

interface ThreadSummarizerProps {
  postId: string;
  postTitle: string;
  postContent: string;
  comments: Comment[];
  existingSummary?: string | null;
}

function flattenComments(comments: Comment[]): Array<{ author: string; content: string; depth: number }> {
  const result: Array<{ author: string; content: string; depth: number }> = [];
  function walk(list: Comment[]) {
    for (const c of list) {
      result.push({
        author: c.author?.business_name || c.author?.first_name || "Anonymous",
        content: c.content,
        depth: c.depth,
      });
      if (c.children) walk(c.children);
    }
  }
  walk(comments);
  return result;
}

export default function ThreadSummarizer({
  postId,
  postTitle,
  postContent,
  comments,
  existingSummary,
}: ThreadSummarizerProps) {
  const [summary, setSummary] = useState(existingSummary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const flatComments = flattenComments(comments);
  const canSummarize = flatComments.length >= 5;

  async function handleSummarize() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/community/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTitle,
          postContent,
          comments: flatComments,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      const data = await res.json();
      setSummary(data.summary);

      // Save to database
      await saveAiSummary(postId, data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!canSummarize && !summary) return null;

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
            AI Thread Summary
          </h3>
          <span className="rounded bg-yellow-400/15 px-1 py-0.5 text-[8px] font-black uppercase tracking-widest text-yellow-400">
            PRO
          </span>
        </div>

        {canSummarize && (
          <button
            onClick={handleSummarize}
            disabled={loading}
            className="flex items-center gap-1 rounded bg-purple-500/20 px-2 py-1 text-[10px] font-medium text-purple-300 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Summarizing...
              </>
            ) : summary ? (
              "Regenerate"
            ) : (
              "Generate TL;DR"
            )}
          </button>
        )}
      </div>

      {summary ? (
        <p className="text-sm text-purple-200/80 leading-relaxed">{summary}</p>
      ) : (
        <p className="text-xs text-purple-400/50">
          {canSummarize
            ? "Click to generate an AI summary of this thread."
            : "Summary available when thread has 5+ comments."}
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
