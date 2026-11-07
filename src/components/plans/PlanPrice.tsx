import { TOTE_PLAN_SALE_ON, TOTE_PLAN_SALE_TAG, formatPlanPrice, type TotePlanTierInfo } from "@/lib/tote-plans";

// Tote-plan price with the running sale shown as a cross-out:
//   ~~$19~~ $14  [$5 OFF]
// Renders just the price when no sale is on. Server- and client-safe.

const SIZES = {
  sm: { now: "text-lg", was: "text-xs", tag: "text-[9px] px-1.5" },
  md: { now: "text-xl", was: "text-sm", tag: "text-[10px] px-2" },
} as const;

export default function PlanPrice({
  tier,
  size = "md",
  nowClassName = "text-white",
  showTag = true,
  className = "",
}: {
  tier: Pick<TotePlanTierInfo, "price" | "listPrice">;
  size?: keyof typeof SIZES;
  nowClassName?: string;
  showTag?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const onSale = TOTE_PLAN_SALE_ON && tier.listPrice > tier.price;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
      {onSale && (
        <s className={`${s.was} font-bold text-stone-500 decoration-red-500/70 decoration-2`}>
          <span className="sr-only">Regular price </span>
          {formatPlanPrice(tier.listPrice)}
        </s>
      )}
      <span className={`${s.now} font-black ${nowClassName}`}>
        {onSale && <span className="sr-only">Sale price </span>}
        {formatPlanPrice(tier.price)}
      </span>
      {onSale && showTag && (
        <span className={`${s.tag} self-center rounded-full bg-red-500/15 py-0.5 font-black uppercase tracking-wider text-red-400`}>
          {TOTE_PLAN_SALE_TAG}
        </span>
      )}
    </span>
  );
}
