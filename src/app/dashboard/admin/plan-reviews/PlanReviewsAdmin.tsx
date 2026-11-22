"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, MessageSquareReply } from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import { PLAN_REVIEW_TAGS, REVIEW_LIMITS } from "@/lib/reviews";
import { PLAN_REVIEW_PRODUCT_LABEL } from "@/lib/plan-reviews";
import {
  listPlanReviewsAdmin,
  replyToPlanReview,
  setPlanReviewStatus,
  type AdminPlanReview,
} from "@/app/actions/plan-reviews";

type Filter = "held" | "published" | "hidden";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "held", label: "Waiting" },
  { id: "published", label: "Live" },
  { id: "hidden", label: "Hidden" },
];

function AdminRow({ review, onChange }: { review: AdminPlanReview; onChange: (r: AdminPlanReview) => void }) {
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.reply ?? "");
  const [error, setError] = useState<string | null>(null);

  const setStatus = async (status: "published" | "hidden") => {
    setBusy(true);
    setError(null);
    const r = await setPlanReviewStatus(review.id, status);
    setBusy(false);
    if (r.ok) onChange({ ...review, status });
    else setError(r.error ?? "Couldn't update.");
  };
  const saveReply = async () => {
    setBusy(true);
    setError(null);
    const r = await replyToPlanReview(review.id, reply);
    setBusy(false);
    if (r.ok) {
      onChange({ ...review, reply: reply.trim() || null });
      setReplying(false);
    } else setError(r.error ?? "Couldn't save the reply.");
  };

  return (
    <div className="space-y-2">
      <ReviewCard
        tags={PLAN_REVIEW_TAGS}
        review={{
          id: review.id,
          name: review.fullName,
          rating: review.rating,
          headline: review.headline,
          comment: review.comment,
          tags: review.tags,
          photos: review.photos,
          verified: true,
          when: review.when,
          meta: [PLAN_REVIEW_PRODUCT_LABEL[review.product], review.meta].filter(Boolean).join(" · "),
          reply: review.reply ? { by: "Storage Network", text: review.reply } : null,
        }}
      />
      <div className="flex flex-wrap items-center gap-2 px-1">
        <a href={`mailto:${review.email}`} className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-yellow-300">
          <Mail className="h-3.5 w-3.5" />
          {review.email}
        </a>
        <span className="flex-1" />
        {review.status !== "published" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("published")}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <Eye className="h-3.5 w-3.5" /> Publish
          </button>
        )}
        {review.status !== "hidden" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("hidden")}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <EyeOff className="h-3.5 w-3.5" /> Hide
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setReplying((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-slate-700 disabled:opacity-50"
        >
          <MessageSquareReply className="h-3.5 w-3.5" /> {review.reply ? "Edit reply" : "Reply"}
        </button>
      </div>
      {replying && (
        <div className="space-y-2 px-1">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={REVIEW_LIMITS.reply}
            placeholder="Public reply from Storage Network (leave empty to remove)"
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={saveReply}
            className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-slate-900 hover:bg-yellow-300 disabled:opacity-50"
          >
            Save reply
          </button>
        </div>
      )}
      {error && <p className="px-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function PlanReviewsAdmin() {
  const [reviews, setReviews] = useState<AdminPlanReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("held");

  useEffect(() => {
    listPlanReviewsAdmin().then((r) => {
      if (r.ok) {
        setReviews(r.reviews);
        if (!r.reviews.some((x) => x.status === "held")) setFilter("published");
      } else setError(r.error);
    });
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!reviews) return <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />;

  const count = (f: Filter) => reviews.filter((r) => r.status === f).length;
  const shown = reviews.filter((r) => r.status === filter);
  return (
    <div>
      <div className="mb-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === f.id ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-stone-300 hover:bg-slate-700"
            }`}
          >
            {f.label} ({count(f.id)})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-stone-500">Nothing here.</p>
      ) : (
        <div className="space-y-6">
          {shown.map((r) => (
            <AdminRow key={r.id} review={r} onChange={(next) => setReviews((all) => all!.map((x) => (x.id === next.id ? next : x)))} />
          ))}
        </div>
      )}
    </div>
  );
}
