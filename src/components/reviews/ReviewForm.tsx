"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Shield, Star, X } from "lucide-react";
import { RATING_LABELS, REVIEW_LIMITS, SKILL_LEVELS, type ReviewTag, type SkillLevel } from "@/lib/reviews";
import { compressReviewPhoto } from "@/lib/review-photo-compress";

// ═══════════════════════════════════════════════════════════════════════════
// The review form, shared by installer reviews and DIY plan reviews:
// stars → what stood out → photos → headline + review (+ build details for
// plans). Sends one FormData: rating, headline, comment, tags (JSON), photos
// (resized JPEGs), and for plans skill_level + build_hours.
// ═══════════════════════════════════════════════════════════════════════════

export type ReviewSubmitResult = { ok: true } | { ok: false; error: string };

interface Photo {
  blob: Blob;
  preview: string;
}

export default function ReviewForm({
  question,
  tags,
  commentPlaceholder,
  photoPrompt,
  buildDetails = false,
  publicNote,
  onSubmit,
  compact = false,
  initialRating = 0,
}: {
  /** "How was your experience?" */
  question: string;
  tags: readonly ReviewTag[];
  commentPlaceholder: string;
  /** "Add photos of your finished rack" */
  photoPrompt: string;
  /** DIY plans: skill level + hours to build */
  buildDetails?: boolean;
  /** Under the submit button, e.g. "Verified purchase · Your first name and last initial are shown" */
  publicNote: string;
  onSubmit: (form: FormData) => Promise<ReviewSubmitResult>;
  /** Tighter spacing for use inside a card */
  compact?: boolean;
  /** A star already tapped (e.g. in the review email) */
  initialRating?: number;
}) {
  const [rating, setRating] = useState(() => (Number.isInteger(initialRating) && initialRating >= 1 && initialRating <= 5 ? initialRating : 0));
  const [hover, setHover] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [headline, setHeadline] = useState("");
  const [comment, setComment] = useState("");
  const [skill, setSkill] = useState<SkillLevel | "">("");
  const [hours, setHours] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Free the previews when the form goes away
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const shown = hover || rating;
  const field =
    "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none sm:text-sm";
  const label = "text-xs font-bold uppercase tracking-wider text-slate-400";
  const optional = <span className="font-normal normal-case text-slate-600">(optional)</span>;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    const room = REVIEW_LIMITS.photos - photos.length;
    const added: Photo[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const blob = await compressReviewPhoto(file);
        added.push({ blob, preview: URL.createObjectURL(blob) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "We couldn't add that photo.");
      }
    }
    setPhotos((p) => [...p, ...added]);
    setPhotoBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (i: number) =>
    setPhotos((p) => {
      URL.revokeObjectURL(p[i].preview);
      return p.filter((_, j) => j !== i);
    });

  const submit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("rating", String(rating));
    form.set("headline", headline);
    form.set("comment", comment);
    form.set("tags", JSON.stringify(picked));
    if (buildDetails) {
      if (skill) form.set("skill_level", skill);
      if (hours) form.set("build_hours", hours);
    }
    photos.forEach((p, i) => form.append("photos", p.blob, `photo-${i + 1}.jpg`));
    const res = await onSubmit(form).catch(() => ({ ok: false as const, error: "Something went wrong. Check your connection and try again." }));
    setSubmitting(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className={compact ? "space-y-5" : "space-y-6"}>
      {/* Stars */}
      <div className="text-center">
        <p className="mb-3 text-sm font-semibold text-slate-300">{question}</p>
        <div className="mb-2 flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
              aria-pressed={rating === s}
              onMouseEnter={() => setHover(s)}
              onClick={() => setRating(s)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star className={`h-10 w-10 transition-colors ${s <= shown ? "fill-yellow-400 text-yellow-400" : "text-slate-700"}`} />
            </button>
          ))}
        </div>
        <p
          className={`h-5 text-sm font-bold ${shown >= 4 ? "text-yellow-400" : shown === 3 ? "text-slate-300" : "text-orange-400"}`}
          aria-live="polite"
        >
          {shown ? RATING_LABELS[shown] : ""}
        </p>
      </div>

      {rating > 0 && (
        <>
          {/* What stood out */}
          <div>
            <p className={`${label} mb-2`}>What stood out? {optional}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const on = picked.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      on
                        ? "border-yellow-400/50 bg-yellow-400/20 text-yellow-300"
                        : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <span aria-hidden>{t.emoji}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photos */}
          <div>
            <p className={`${label} mb-2`}>
              {photoPrompt} {optional}
            </p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.preview} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < REVIEW_LIMITS.photos && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 text-[11px] font-semibold text-slate-400 transition hover:border-yellow-400/60 hover:text-yellow-300 disabled:opacity-50"
                >
                  {photoBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {photos.length ? "Add more" : "Add photos"}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />
          </div>

          {/* Build details (plans) */}
          {buildDetails && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <p className={`${label} mb-2`}>Your experience {optional}</p>
                <div className="flex flex-wrap gap-2">
                  {SKILL_LEVELS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={skill === s.id}
                      onClick={() => setSkill(skill === s.id ? "" : s.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        skill === s.id
                          ? "border-yellow-400/50 bg-yellow-400/20 text-yellow-300"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className={`${label} mb-2 block`}>Hours to build {optional}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={200}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 4"
                  className={`${field} sm:w-32`}
                />
              </label>
            </div>
          )}

          {/* Words */}
          <div className="space-y-3">
            <label className="block">
              <span className={label}>Headline {optional}</span>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Sum it up in a few words"
                maxLength={REVIEW_LIMITS.headline}
                className={`${field} mt-1`}
              />
            </label>
            <label className="block">
              <span className={label}>Your review {optional}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={commentPlaceholder}
                rows={4}
                maxLength={REVIEW_LIMITS.comment}
                className={`${field} mt-1 resize-none`}
              />
              <span className="mt-1 block text-right text-[10px] text-slate-600">
                {comment.length}/{REVIEW_LIMITS.comment}
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || photoBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5" />}
              {submitting ? "Sending…" : "Submit review"}
            </button>
            {error && (
              <p className="text-center text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
            <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-500">
              <Shield className="h-3 w-3 shrink-0" />
              {publicNote}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
