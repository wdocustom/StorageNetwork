"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, MessageSquareHeart } from "lucide-react";
import ReviewForm from "@/components/reviews/ReviewForm";
import Stars from "@/components/reviews/Stars";
import { PLAN_REVIEW_TAGS } from "@/lib/reviews";
import { getMyPlanReview, submitPlanReview, type MyPlanReview } from "@/app/actions/plan-reviews";
import { trackPlanActivity } from "@/lib/plan-activity";

// ═══════════════════════════════════════════════════════════════════════════
// "How did your build go?" on the buyer's plan page. Opens itself (and
// scrolls into view) from the review email (?review=1, ?stars=N) or right
// after the buyer finishes the 3D guide (`nudge`). Hidden for anyone who
// isn't the verified buyer of a 27-gal or Mini plan.
// ═══════════════════════════════════════════════════════════════════════════

export default function PlanReviewCard({
  token,
  autoOpen = false,
  initialRating = 0,
  nudge = 0,
}: {
  token: string;
  /** From the review email link */
  autoOpen?: boolean;
  /** Star tapped in the email */
  initialRating?: number;
  /** Bumped when the buyer finishes the guide */
  nudge?: number;
}) {
  const [state, setState] = useState<MyPlanReview | null>(null);
  const [open, setOpen] = useState(autoOpen);
  const [done, setDone] = useState<{ held: boolean; rating: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    getMyPlanReview(token)
      .then((s) => live && setState(s))
      .catch(() => live && setState({ canReview: false }));
    return () => {
      live = false;
    };
  }, [token]);

  const reviewable = state?.canReview && !state.review;
  // Email link or finished guide: open and bring it into view.
  useEffect(() => {
    if (!reviewable || (!autoOpen && !nudge)) return;
    setOpen(true);
    trackPlanActivity(token, "review_prompt", { detail: nudge ? "guide_done" : "email" });
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(t);
  }, [reviewable, autoOpen, nudge, token]);

  if (!state?.canReview) return null;

  const existing = done ?? (state.review ? { held: state.review.status !== "published", rating: state.review.rating } : null);
  if (existing) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Thanks for your review!</p>
            <Stars rating={existing.rating} className="mt-1" />
            <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
              {existing.held ? (
                <>
                  <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                  We read every review before it goes up. If something about your build didn&apos;t go right, we&apos;ll reach out to help.
                </>
              ) : (
                "It's live on the plans page, helping the next builder decide."
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} id="review" className="scroll-mt-4 rounded-2xl border border-yellow-400/30 bg-slate-900 p-5">
      <div className="flex items-start gap-3">
        <MessageSquareHeart className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">How did your build go?</p>
          <p className="mt-0.5 text-xs text-stone-400">
            {state.buildSummary ? `Your ${state.buildSummary}: ` : ""}a quick review and a photo help the next builder most.
          </p>
        </div>
      </div>
      {open ? (
        <div className="mt-5">
          <ReviewForm
            compact
            initialRating={initialRating}
            question="Rate the plans and 3D guide"
            tags={PLAN_REVIEW_TAGS}
            commentPlaceholder="How was the build? What helped, and what would you tell someone about to start?"
            photoPrompt="Photos of your rack"
            buildDetails
            publicNote="Verified buyer · Shown with your first name and last initial"
            onSubmit={async (form) => {
              form.set("token", token);
              const res = await submitPlanReview(form);
              if (!res.ok) return res;
              setDone({ held: res.held, rating: Number(form.get("rating")) });
              return { ok: true };
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-xl border border-yellow-400/40 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/10"
        >
          Leave a review
        </button>
      )}
    </div>
  );
}
