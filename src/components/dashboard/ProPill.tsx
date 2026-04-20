"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInstallerLink } from "@/lib/utils";

export default function ProPill({ link }: { link?: string }) {
  const [copied, setCopied] = useState(false);
  const [resolvedLink, setResolvedLink] = useState(link ?? "");

  useEffect(() => {
    if (link) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("id, slug, is_pro")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setResolvedLink(getInstallerLink(data));
        });
    });
  }, [link]);

  const handleClick = useCallback(() => {
    if (!resolvedLink) return;
    navigator.clipboard.writeText(resolvedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [resolvedLink]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full bg-yellow-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-400 transition-all hover:bg-yellow-400/30 active:scale-95"
      title="Copy your portfolio link"
    >
      {copied ? "COPIED!" : "PRO"}
    </button>
  );
}
