"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareReply } from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import { REVIEW_TAGS } from "@/config/review-tags";
import { REVIEW_LIMITS, timeAgo } from "@/lib/reviews";
import { getMyLeadReview, replyToReview, type MyLeadReview } from "@/app/actions/reviews";

// The customer's review on a job ticket, with the installer's public reply
// (shown under the review on their portfolio page).

export default function InstallerReviewReply({ leadId, businessName = "you" }: { leadId: string; businessName?: string }) {
  const [review, setReview] = useState<MyLeadReview | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyLeadReview(leadId)
      .then((r) => {
        setReview(r);
        setText(r?.reply ?? "");
      })
      .catch(() => setReview(null));
  }, [leadId]);

  if (review === undefined) return <Loader2 className="h-5 w-5 animate-spin text-stone-500" />;
  if (!review) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-xs font-bold text-emerald-400">Review received</p>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await replyToReview(leadId, text);
    setBusy(false);
    if (r.success) {
      setReview({ ...review, reply: text.trim() || null });
      setEditing(false);
    } else setError(r.error ?? "Couldn't save your reply");
  };

  return (
    <div className="space-y-2">
      <ReviewCard
        tags={REVIEW_TAGS}
        review={{
          id: review.id,
          name: "Your customer",
          rating: review.rating,
          headline: review.headline,
          comment: review.comment,
          tags: review.tags,
          photos: review.photos,
          verified: true,
          when: timeAgo(review.createdAt),
          reply: review.reply && !editing ? { by: businessName, text: review.reply } : null,
        }}
      />
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={REVIEW_LIMITS.reply}
            placeholder="Thank them, or answer a concern. Shown publicly under their review."
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-base text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none sm:text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-lg bg-yellow-400 py-2.5 text-xs font-bold text-slate-900 hover:bg-yellow-300 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Post reply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setText(review.reply ?? "");
              }}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-bold text-stone-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2.5 text-xs font-bold text-stone-300 hover:border-yellow-400/40 hover:text-yellow-300"
        >
          <MessageSquareReply className="h-3.5 w-3.5" />
          {review.reply ? "Edit your reply" : "Reply publicly"}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
