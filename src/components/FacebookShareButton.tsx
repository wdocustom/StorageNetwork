"use client";

import { useState, useCallback, useRef } from "react";
import { Facebook, CheckCircle2, Loader2, Copy, Check } from "lucide-react";
import { siteConfig } from "@/config/site";
import { applyFbShareDiscount } from "@/app/actions/fb-share";

const MIN_SHARE_DURATION_MS = 8_000;

interface FacebookShareButtonProps {
  leadId: string;
  onDiscountApplied?: (amount: number) => void;
  disabled?: boolean;
}

function getShareText() {
  return "I just designed custom garage storage with Storage Network — check it out and get yours! 🏠🔧";
}

export default function FacebookShareButton({ leadId, onDiscountApplied, disabled }: FacebookShareButtonProps) {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tooFast, setTooFast] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const openedAtRef = useRef<number>(0);

  const shareUrl = `${siteConfig.baseUrl}/design?source=fb_referral&ref_lead=${leadId}`;
  const shareText = getShareText();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareText, shareUrl]);

  const handleShare = useCallback(() => {
    if (shared || loading) return;

    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    const popup = window.open(fbShareUrl, "fb_share", "width=600,height=400");

    openedAtRef.current = Date.now();
    setLoading(true);
    setTooFast(false);
    setShowCopy(true);

    const timer = setInterval(async () => {
      try {
        if (popup && popup.closed) {
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
      } catch {
        // Cross-origin access to popup.closed can throw — treat as still open
      }
    }, 500);
  }, [leadId, shared, loading, onDiscountApplied, shareUrl]);

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
      {showCopy && !shared && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Paste this into your Facebook post:
          </p>
          <p className="mb-2 text-xs text-stone-300 leading-relaxed">
            {shareText}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-stone-300 transition-colors hover:bg-slate-600"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy Text"}
          </button>
        </div>
      )}
      {tooFast && (
        <p className="mt-2 text-center text-xs text-amber-400">
          Please complete your Facebook post to receive the discount. Try again when ready.
        </p>
      )}
    </div>
  );
}
