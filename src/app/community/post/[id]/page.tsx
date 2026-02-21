"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Clock,
  Tag,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getPostById,
  getComments,
  editPost,
  deletePost,
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

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const isAuthor = userId && post && userId === post.author_id;

  async function handleSaveEdit() {
    if (!post || !userId) return;
    const trimmedTitle = editTitle.trim();
    const trimmedContent = editContent.trim();
    if (!trimmedTitle || !trimmedContent) return;

    setEditSaving(true);
    const result = await editPost({
      postId: post.id,
      authorId: userId,
      title: trimmedTitle,
      content: trimmedContent,
    });

    if (result.success) {
      setPost({ ...post, title: trimmedTitle, content: trimmedContent });
      setIsEditing(false);
    }
    setEditSaving(false);
  }

  async function handleDelete() {
    if (!post || !userId) return;
    setDeleting(true);
    const result = await deletePost({ postId: post.id, authorId: userId });
    if (result.success) {
      window.location.href = "/community";
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function startEditing() {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setIsEditing(true);
  }

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
        {/* Community badge + author actions */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
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

          {/* Edit / Delete buttons — author only */}
          {isAuthor && !isEditing && (
            <div className="flex items-center gap-1">
              <button
                onClick={startEditing}
                className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-stone-300"
                title="Edit post"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Delete post"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm font-medium text-red-400">
              Delete this post?
            </p>
            <p className="mt-1 text-xs text-stone-500">
              This will permanently remove the post, all comments, and images. This cannot be undone.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
            {isEditing ? (
              /* ── Edit Mode ────────────────────────────────────── */
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-white placeholder-stone-500 focus:border-yellow-400/50 focus:outline-none"
                  placeholder="Post title..."
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-stone-300 placeholder-stone-500 focus:border-yellow-400/50 focus:outline-none resize-y"
                  placeholder="Post content..."
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving || !editTitle.trim() || !editContent.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
                  >
                    {editSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {editSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={editSaving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View Mode ────────────────────────────────────── */
              <>
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
              </>
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
