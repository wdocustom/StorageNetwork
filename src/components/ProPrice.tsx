import { PRO_FREE_PROMO, PRO_MONTHLY_PRICE, PRO_PROMO_TAG } from "@/config/pro-pricing";

/**
 * The Pro price, everywhere it's shown. While PRO_FREE_PROMO is on:
 * ~~$49/mo~~ FREE · LIMITED TIME. Otherwise $49/mo.
 */
export default function ProPrice({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const big = { sm: "text-xl", md: "text-3xl", lg: "text-4xl" }[size];
  const old = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];

  if (!PRO_FREE_PROMO) {
    return (
      <span className={`inline-flex items-baseline gap-1 ${className}`}>
        <span className={`${big} font-black text-white`}>${PRO_MONTHLY_PRICE}</span>
        <span className="text-sm text-stone-400">/mo</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className={`${old} font-bold text-stone-500 line-through decoration-red-500/70 decoration-2`}>
        ${PRO_MONTHLY_PRICE}/mo
      </span>
      <span className={`${big} font-black text-yellow-400`}>FREE</span>
      <span className="self-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
        {PRO_PROMO_TAG}
      </span>
    </span>
  );
}
