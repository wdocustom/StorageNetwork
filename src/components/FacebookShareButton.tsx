"use client";

import { useState, useCallback, useRef } from "react";
import { Facebook, CheckCircle2, Loader2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { applyFbShareDiscount } from "@/app/actions/fb-share";

const MIN_SHARE_DURATION_MS = 15_000;

interface FacebookShareButtonProps {
  leadId: string;
  onDiscountApplied?: (amount: number) => void;
  disabled?: boolean;
}

export default function FacebookShareButton({ leadId, onDiscountApplied, disabled }: FacebookShareButtonProps) {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tooFast, setTooFast] = useState(false);
  const openedAtRef = useRef<number>(0);

  const handleShare = useCallback(() => {
    if (shared || loading) return;

    const shareUrl = `${siteConfig.baseUrl}/design?source=fb_referral&ref_lead=${leadId}`;
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    const popup = window.open(fbShareUrl, "fb_share", "width=600,height=400,noopener");

    openedAtRef.current = Date.now();
    setLoading(true);
    setTooFast(false);

    const timer = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(timer);

        const elapsed = Date.now() - openedAtRef.current;
        if (elapsed < MIN_SHARE_DURATION_MS) {
          setLoading(false);
          setTooFast(true);
          return;
        }

        const result = await applyFbShareDiscount(leadId);
        setLoading(false);
        if (result.success) {
          setShared(true);
          onDiscountApplied?.(result.discountAmount);
        }
      }
    }, 500);
  }, [leadId, shared, loading, onDiscountApplied]);

  if (shared) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 px-4 py-3 text-sm font-semibold text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        10% Discount Applied
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleShare}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-600/20 hover:text-blue-300 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Facebook className="h-4 w-4" />
        )}
        Share to Facebook for 10% Off
      </button>
      {tooFast && (
        <p className="mt-2 text-center text-xs text-amber-400">
          Please complete your Facebook post to receive the discount. Try again when ready.
        </p>
      )}
    </div>
  );
}
