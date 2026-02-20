"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  getCommunities,
  createPost,
  uploadPostImage,
  type Community,
} from "@/app/actions/community";
import PostImageUpload, {
  type StagedImage,
} from "@/components/community/PostImageUpload";

export default function NewPostPage() {
  const supabase = getSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [communityId, setCommunityId] = useState("");
  const [communitySlug, setCommunitySlug] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<{
    tags: string[];
    belongsInCommunity: boolean;
    suggestedCommunity: string | null;
    reason: string | null;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const [isSubmitting, startTransition] = useTransition();

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      const communitiesData = await getCommunities();
      setCommunities(communitiesData);

      // Default to first community
      if (communitiesData.length > 0) {
        setCommunityId(communitiesData[0].id);
        setCommunitySlug(communitiesData[0].slug);
      }
    } catch (err) {
      console.error("Failed to load page data:", err);
      setError("Failed to load data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCommunityChange(id: string) {
    setCommunityId(id);
    const c = communities.find((c) => c.id === id);
    if (c) setCommunitySlug(c.slug);
    // Reset AI suggestion when community changes
    setAiSuggestion(null);
  }

  async function handleAutoTag() {
    if (!title.trim() || !content.trim()) return;

    setAiLoading(true);
    setAiSuggestion(null);

    try {
      const res = await fetch("/api/community/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          communitySlug,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Auto-tagging failed");
      }

      const data = await res.json();
      setAiSuggestion(data);
      setTags(data.tags || []);
    } catch (err) {
      console.error("Auto-tag error:", err);
    } finally {
      setAiLoading(false);
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleSubmit() {
    if (!title.trim() || !content.trim() || !communityId || !userId) return;
    setError("");

    startTransition(async () => {
      // 1. Create the post
      const result = await createPost({
        communityId,
        authorId: userId,
        title: title.trim(),
        content: content.trim(),
        tags,
      });

      if (!result.success || !result.postId) {
        setError(result.error || "Failed to create post.");
        return;
      }

      // 2. Upload staged images (if any)
      if (stagedImages.length > 0) {
        for (const staged of stagedImages) {
          const formData = new FormData();
          formData.set("image", staged.file);
          await uploadPostImage(result.postId, userId, formData);
        }
      }

      // 3. Redirect to the new post
      window.location.href = `/community/post/${result.postId}`;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <a
          href="/community"
          className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </a>
        <h1 className="text-lg font-bold text-white">Create New Post</h1>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Community Picker */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Space
          </label>
          <select
            value={communityId}
            onChange={(e) => handleCommunityChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-yellow-400/50 focus:outline-none"
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={200}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
          />
        </div>

        {/* Content */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your experience, ask a question, or start a discussion..."
            rows={8}
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-stone-600">
            Supports plain text. Keep it clear and constructive.
          </p>
        </div>

        {/* Photo Upload */}
        <PostImageUpload
          stagedImages={stagedImages}
          onStagedImagesChange={setStagedImages}
        />

        {/* AI Auto-Tag */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                AI Auto-Tag
              </span>
            </div>
            <button
              onClick={handleAutoTag}
              disabled={aiLoading || !title.trim() || !content.trim()}
              className="flex items-center gap-1 rounded bg-purple-500/20 px-2.5 py-1 text-[10px] font-medium text-purple-300 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze & Tag"
              )}
            </button>
          </div>

          <p className="text-[11px] text-purple-400/60 mb-3">
            Our AI will automatically suggest tags and verify your post belongs
            in the selected space.
          </p>

          {/* AI Community Mismatch Warning */}
          {aiSuggestion && !aiSuggestion.belongsInCommunity && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-medium text-amber-400">
                  This post might fit better in a different space
                </p>
                {aiSuggestion.reason && (
                  <p className="mt-0.5 text-[11px] text-amber-300/70">
                    {aiSuggestion.reason}
                  </p>
                )}
                {aiSuggestion.suggestedCommunity && (
                  <button
                    onClick={() => {
                      const suggested = communities.find(
                        (c) => c.slug === aiSuggestion.suggestedCommunity
                      );
                      if (suggested) {
                        handleCommunityChange(suggested.id);
                      }
                    }}
                    className="mt-1.5 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30"
                  >
                    Move to{" "}
                    {communities.find(
                      (c) => c.slug === aiSuggestion.suggestedCommunity
                    )?.name || aiSuggestion.suggestedCommunity}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-stone-300"
                >
                  <Tag className="h-3 w-3 text-purple-400" />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 text-stone-600 hover:text-red-400"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <a
              href="/community"
              className="text-xs text-stone-500 hover:text-stone-300"
            >
              Cancel
            </a>
            <button
              onClick={handleSubmit}
              disabled={
                isSubmitting || !title.trim() || !content.trim() || !communityId || !userId
              }
              className="flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {stagedImages.length > 0 ? "Uploading..." : "Posting..."}
                </>
              ) : (
                "Publish Post"
              )}
            </button>
          </div>
          {!isSubmitting && (!title.trim() || !content.trim() || !communityId || !userId) && (
            <p className="text-right text-[11px] text-stone-500">
              {!userId
                ? "Please sign in to post."
                : !communityId
                  ? "No spaces available. Please try again later."
                  : !title.trim()
                    ? "A title is required."
                    : "Content is required."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
