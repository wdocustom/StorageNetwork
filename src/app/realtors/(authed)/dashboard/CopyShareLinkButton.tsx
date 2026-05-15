"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts; fall back to a tiny
      // hidden-input + execCommand path before giving up entirely.
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* swallow — UI shows no confirmation, link is still visible */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors " +
        (copied
          ? "bg-emerald-400/15 text-emerald-300"
          : "bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/25")
      }
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}
