import { Star } from "lucide-react";

const SIZES = { xs: "h-3 w-3", sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" } as const;

/** Read-only star row. Half stars round to the nearest whole star. */
export default function Stars({
  rating,
  size = "sm",
  className = "",
}: {
  rating: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          aria-hidden
          className={`${SIZES[size]} ${s <= filled ? "fill-yellow-400 text-yellow-400" : "text-slate-700"}`}
        />
      ))}
    </span>
  );
}
