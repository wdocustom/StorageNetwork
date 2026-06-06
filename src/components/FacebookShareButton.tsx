"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Facebook, CheckCircle2, Loader2, Copy, Check } from "lucide-react";
import { siteConfig } from "@/config/site";
import { applyFbShareDiscount } from "@/app/actions/fb-share";

const CONFIRM_DELAY_MS = 6_000;

interface FacebookShareButtonProps {
  leadId: string;
  onDiscountApplied?: (amount: number) => void;
  disabled?: boolean;
}

function getShareText() {
  return "I just designed custom garage storage with Storage Network — check it out and get yours! 🏠🔧";
}

export default function FacebookShareButton({ leadId, onDiscountApplied, disabled }: FacebookShareButtonProps) {
  const [phase, setPhase] = useState<"idle" | "pending" | "confirming" | "done">("idle");
  const [copied, setCopied] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const openedAtRef = useRef<number>(0);

  const shareUrl = `${siteConfig.baseUrl}/design?source=fb_referral&ref_lead=${leadId}`;
  const shareText = getShareText();

  useEffect(() => {
    if (phase !== "pending") return;
    const target = openedAtRef.current + CONFIRM_DELAY_MS;
    const tick = setInterval(() => {
      const remaining = Math.max(0, target - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setConfirmReady(true);
        clearInterval(tick);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [phase]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareText, shareUrl]);

  const handleShare = useCallback(() => {
    if (phase !== "idle") return;
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fbShareUrl, "_blank");
    openedAtRef.current = Date.now();
    setPhase("pending");
    setConfirmReady(false);
    setCountdown(Math.ceil(CONFIRM_DELAY_MS / 1000));
  }, [phase, shareUrl]);

  const handleConfirm = useCallback(async () => {
    if (!confirmReady) return;
    setPhase("confirming");
    const result = await applyFbShareDiscount(leadId);
    if (result.success) {
      setPhase("done");
      onDiscountApplied?.(result.discountAmount);
    } else {
      setPhase("pending");
    }
  }, [confirmReady, leadId, onDiscountApplied]);

  if (phase === "done") {
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
        disabled={disabled || phase !== "idle"}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-600/20 hover:text-blue-300 disabled:opacity-50"
      >
        <Facebook className="h-4 w-4" />
        Share to Facebook for 10% Off
      </button>

      {phase !== "idle" && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Paste this into your Facebook post:
          </p>
          <p className="text-xs text-stone-300 leading-relaxed">
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

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!confirmReady || phase === "confirming"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {phase === "confirming" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : !confirmReady ? (
              <>Wait {countdown}s...</>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                I Shared It — Apply My 10% Off
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
