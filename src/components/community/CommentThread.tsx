"use client";

import { useRef, useState, useTransition } from "react";
import { MessageSquare, Clock, ImagePlus, X, Loader2 } from "lucide-react";
import VoteButton from "./VoteButton";
import PostImageGallery from "./PostImageGallery";
import {
  createComment,
  uploadCommentImage,
  type Comment,
  type CommentImage,
} from "@/app/actions/community";

interface CommentThreadProps {
  comments: Comment[];
  postId: string;
  userId: string;
  maxDepth?: number;
}

interface StagedFile {
  file: File;
  preview: string;
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

// ═══════════════════════════════════════════════════════════════════════════
// Inline Image Picker — compact version for comment forms
// ═══════════════════════════════════════════════════════════════════════════

function CommentImagePicker({
  staged,
  onStaged,
  inputId,
}: {
  staged: StagedFile[];
  onStaged: (files: StagedFile[]) => void;
  inputId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const maxImages = 4;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxImages - staged.length;
    if (remaining <= 0) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
    const maxSize = 10 * 1024 * 1024;
    const added: StagedFile[] = [];

    for (const file of Array.from(files).slice(0, remaining)) {
      if (file.type && !allowed.includes(file.type)) continue;
      if (file.size > maxSize) continue;
      added.push({ file, preview: URL.createObjectURL(file) });
    }

    if (added.length > 0) onStaged([...staged, ...added]);
  }

  function remove(i: number) {
    const updated = [...staged];
    URL.revokeObjectURL(updated[i].preview);
    updated.splice(i, 1);
    onStaged(updated);
  }

  return (
    <>
      {staged.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {staged.map((img, i) => (
            <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-700">
              <img src={img.preview} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {staged.length < maxImages && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-1 flex items-center gap-1 text-[11px] text-stone-500 hover:text-yellow-400 transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Photo
        </button>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Single Comment Node
// ═══════════════════════════════════════════════════════════════════════════

function CommentNode({
  comment,
  postId,
  userId,
  maxDepth,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  userId: string;
  maxDepth: number;
  depth?: number;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyImages, setReplyImages] = useState<StagedFile[]>([]);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [localChildren, setLocalChildren] = useState(comment.children || []);

  const authorName =
    comment.author?.business_name || comment.author?.first_name || "Anonymous";
  const avatarUrl = comment.author?.avatar_url;

  function handleSubmitReply() {
    if (!replyText.trim() && replyImages.length === 0) return;

    startTransition(async () => {
      const result = await createComment({
        postId,
        authorId: userId,
        content: replyText.trim(),
        parentId: comment.id,
      });

      if (result.success && result.commentId) {
        // Upload images if any
        const uploadedImages: CommentImage[] = [];
        if (replyImages.length > 0) {
          setUploading(true);
          for (const staged of replyImages) {
            const fd = new FormData();
            fd.append("image", staged.file);
            const imgResult = await uploadCommentImage(result.commentId, userId, fd);
            if (imgResult.success && imgResult.image) {
              uploadedImages.push(imgResult.image);
            }
            URL.revokeObjectURL(staged.preview);
          }
          setUploading(false);
        }

        const newComment: Comment = {
          id: result.commentId,
          post_id: postId,
          author_id: userId,
          parent_id: comment.id,
          content: replyText.trim(),
          upvotes: 0,
          downvotes: 0,
          depth: depth + 1,
          created_at: new Date().toISOString(),
          author: { id: userId, first_name: "You", business_name: null, avatar_url: null },
          images: uploadedImages,
          children: [],
        };
        setLocalChildren((prev) => [...prev, newComment]);
        setReplyText("");
        setReplyImages([]);
        setReplyOpen(false);
      }
    });
  }

  const canNest = depth < maxDepth;
  const commentImages = comment.images || [];

  return (
    <div className={`${depth > 0 ? "ml-4 border-l border-slate-800 pl-4" : ""}`}>
      <div className="py-2">
        {/* Comment header */}
        <div className="flex items-center gap-2 mb-1">
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
          <span className="text-xs font-medium text-stone-300">
            {authorName}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-stone-600">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(comment.created_at)}
          </span>
        </div>

        {/* Comment body */}
        <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </p>

        {/* Comment images */}
        {commentImages.length > 0 && (
          <PostImageGallery
            images={commentImages.map((ci) => ({
              id: ci.id,
              post_id: ci.comment_id,
              image_url: ci.image_url,
              storage_path: ci.storage_path,
              sort_order: ci.sort_order,
              caption: null,
              created_at: ci.created_at,
            }))}
          />
        )}

        {/* Comment actions */}
        <div className="mt-1.5 flex items-center gap-3">
          <VoteButton
            userId={userId}
            commentId={comment.id}
            upvotes={comment.upvotes}
            downvotes={comment.downvotes}
            userVote={comment.user_vote}
            compact
          />

          {canNest && (
            <button
              onClick={() => setReplyOpen(!replyOpen)}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-yellow-400 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {replyOpen && (
          <div className="mt-2 ml-7">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
            />
            <CommentImagePicker
              staged={replyImages}
              onStaged={setReplyImages}
              inputId={`reply-img-${comment.id}`}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={handleSubmitReply}
                disabled={(!replyText.trim() && replyImages.length === 0) || isPending || uploading}
                className="rounded bg-yellow-400 px-3 py-1 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading...
                  </span>
                ) : isPending ? "Posting..." : "Reply"}
              </button>
              <button
                onClick={() => {
                  setReplyOpen(false);
                  setReplyText("");
                  replyImages.forEach((img) => URL.revokeObjectURL(img.preview));
                  setReplyImages([]);
                }}
                className="text-xs text-stone-500 hover:text-stone-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested children */}
      {localChildren.length > 0 && (
        <div>
          {localChildren.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              postId={postId}
              userId={userId}
              maxDepth={maxDepth}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Comment Thread Container
// ═══════════════════════════════════════════════════════════════════════════

export default function CommentThread({
  comments,
  postId,
  userId,
  maxDepth = 6,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState("");
  const [rootImages, setRootImages] = useState<StagedFile[]>([]);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [localComments, setLocalComments] = useState(comments);

  function handleSubmitRoot() {
    if (!newComment.trim() && rootImages.length === 0) return;

    startTransition(async () => {
      const result = await createComment({
        postId,
        authorId: userId,
        content: newComment.trim(),
      });

      if (result.success && result.commentId) {
        // Upload images if any
        const uploadedImages: CommentImage[] = [];
        if (rootImages.length > 0) {
          setUploading(true);
          for (const staged of rootImages) {
            const fd = new FormData();
            fd.append("image", staged.file);
            const imgResult = await uploadCommentImage(result.commentId, userId, fd);
            if (imgResult.success && imgResult.image) {
              uploadedImages.push(imgResult.image);
            }
            URL.revokeObjectURL(staged.preview);
          }
          setUploading(false);
        }

        const optimistic: Comment = {
          id: result.commentId,
          post_id: postId,
          author_id: userId,
          parent_id: null,
          content: newComment.trim(),
          upvotes: 0,
          downvotes: 0,
          depth: 0,
          created_at: new Date().toISOString(),
          author: { id: userId, first_name: "You", business_name: null, avatar_url: null },
          images: uploadedImages,
          children: [],
        };
        setLocalComments((prev) => [...prev, optimistic]);
        setNewComment("");
        setRootImages([]);
      }
    });
  }

  return (
    <div>
      {/* Comment tree */}
      {localComments.length === 0 ? (
        <div className="py-8 text-center text-sm text-stone-600">
          No comments yet. Be the first to share your thoughts.
        </div>
      ) : (
        <div className="space-y-1">
          {localComments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              postId={postId}
              userId={userId}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}

      {/* Root comment form — below comments */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
        />
        <CommentImagePicker
          staged={rootImages}
          onStaged={setRootImages}
          inputId="root-comment-img"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSubmitRoot}
            disabled={(!newComment.trim() && rootImages.length === 0) || isPending || uploading}
            className="rounded-lg bg-yellow-400 px-4 py-1.5 text-xs font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading...
              </span>
            ) : isPending ? "Posting..." : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
