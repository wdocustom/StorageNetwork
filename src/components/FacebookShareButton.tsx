"use client";

import { Facebook } from "lucide-react";
import { siteConfig } from "@/config/site";

interface FacebookShareButtonProps {
  leadId: string;
  className?: string;
}

export default function FacebookShareButton({ leadId, className }: FacebookShareButtonProps) {
  const shareUrl = `${siteConfig.baseUrl}/design?source=fb_referral&ref_lead=${leadId}`;

  function handleShare() {
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fbShareUrl, "_blank", "noopener,noreferrer,width=600,height=400");
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={className ?? "flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-400 transition-all hover:bg-blue-600/20 hover:text-blue-300"}
    >
      <Facebook className="h-4 w-4" />
      Share with a Neighbor
    </button>
  );
}
