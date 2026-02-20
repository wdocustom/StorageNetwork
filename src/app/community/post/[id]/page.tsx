"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Clock,
  Tag,
  MessageSquare,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getPostById,
  getComments,
  type Post,
  type Comment,
} from "@/app/actions/community";
import VoteButton from "@/components/community/VoteButton";
import CommentThread from "@/components/community/CommentThread";
import ThreadSummarizer from "@/components/community/ThreadSummarizer";
import PostImageGallery from "@/components/community/PostImageGallery";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function PostDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = getSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
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

    const [postData, commentsData] = await Promise.all([
      getPostById(params.id, user.id),
      getComments(params.id, user.id),
    ]);

    setPost(postData);
    setComments(commentsData);
    setLoading(false);
  }, [supabase, params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-stone-500">Post not found.</p>
        <a
          href="/community"
          className="mt-4 inline-block text-xs text-yellow-400 hover:underline"
        >
          Back to Community
        </a>
      </div>
    );
  }

  const authorName =
    post.author?.business_name || post.author?.first_name || "Anonymous";
  const avatarUrl = post.author?.avatar_url;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back link */}
      <a
        href="/community"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-yellow-400 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Community
      </a>

      {/* Post */}
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        {/* Community badge */}
        <div className="mb-2 flex items-center gap-2">
          <a
            href="/community"
            className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 hover:underline"
          >
            {post.community?.name}
          </a>
          {post.is_pinned && (
            <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-400">
              Pinned
            </span>
          )}
        </div>

        <div className="flex gap-4">
          {/* Vote column */}
          <div className="flex-shrink-0">
            <VoteButton
              userId={userId!}
              postId={post.id}
              upvotes={post.upvotes}
              downvotes={post.downvotes}
              userVote={post.user_vote}
            />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white leading-tight">
              {post.title}
            </h1>

            {/* Author + time */}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={authorName}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-stone-400">
                    {authorName[0]?.toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-stone-300">{authorName}</span>
              </div>

              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(post.created_at)}
              </span>

              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}
              </span>
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-stone-400"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Post body */}
            <div className="mt-4 text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </div>

            {/* Post images */}
            {post.images && post.images.length > 0 && (
              <PostImageGallery images={post.images} />
            )}
          </div>
        </div>
      </article>

      {/* AI Thread Summary */}
      <div className="mt-4">
        <ThreadSummarizer
          postId={post.id}
          postTitle={post.title}
          postContent={post.content}
          comments={comments}
          existingSummary={post.ai_summary}
        />
      </div>

      {/* Comments Section */}
      <div className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquare className="h-4 w-4 text-stone-500" />
          {post.comment_count} {post.comment_count === 1 ? "Comment" : "Comments"}
        </h2>

        <CommentThread
          comments={comments}
          postId={post.id}
          userId={userId!}
        />
      </div>
    </div>
  );
}
