"use client";

import { MessageSquare, Clock, Tag, ImageIcon } from "lucide-react";
import VoteButton from "./VoteButton";
import type { Post } from "@/app/actions/community";

interface PostCardProps {
  post: Post;
  userId: string;
}

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

export default function PostCard({ post, userId }: PostCardProps) {
  const authorName =
    post.author?.business_name || post.author?.first_name || "Anonymous";
  const avatarUrl = post.author?.avatar_url;

  return (
    <a
      href={`/community/post/${post.id}`}
      className="group flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/70"
    >
      {/* Vote column */}
      <div onClick={(e) => e.preventDefault()}>
        <VoteButton
          userId={userId}
          postId={post.id}
          upvotes={post.upvotes}
          downvotes={post.downvotes}
          userVote={post.user_vote}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Community badge + pinned */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            {post.community?.name}
          </span>
          {post.is_pinned && (
            <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-400">
              Pinned
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors line-clamp-2">
          {post.title}
        </h3>

        {/* Preview text */}
        <p className="mt-1 text-xs text-stone-500 line-clamp-2">
          {post.content.replace(/[#*_~`]/g, "").slice(0, 200)}
        </p>

        {/* Image thumbnails */}
        {Array.isArray(post.images) && post.images.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {post.images.slice(0, 3).map((img) => (
              <div
                key={img.id}
                className="h-14 w-14 overflow-hidden rounded border border-slate-700"
              >
                <img
                  src={img.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            {post.images.length > 3 && (
              <div className="flex h-14 w-14 items-center justify-center rounded border border-slate-700 bg-slate-800">
                <span className="text-[10px] font-medium text-stone-400">
                  +{post.images.length - 3}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.tags.slice(0, 4).map((tag) => (
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

        {/* AI Summary */}
        {post.ai_summary && (
          <div className="mt-2 rounded border border-purple-500/20 bg-purple-500/5 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-0.5">
              AI Summary
            </p>
            <p className="text-[11px] text-purple-300/80 line-clamp-2">
              {post.ai_summary}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-600">
          <div className="flex items-center gap-1.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={authorName}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[8px] font-bold text-stone-400">
                {authorName[0]?.toUpperCase()}
              </div>
            )}
            <span className="font-medium text-stone-400">{authorName}</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(post.created_at)}
          </div>

          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}
          </div>

          {Array.isArray(post.images) && post.images.length > 0 && (
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {post.images.length} {post.images.length === 1 ? "photo" : "photos"}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
