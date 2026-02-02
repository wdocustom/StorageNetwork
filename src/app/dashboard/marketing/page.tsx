"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  Copy,
  Check,
  Link2,
  ExternalLink,
  Megaphone,
  Lock,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import SocialGenerator from "@/components/dashboard/SocialGenerator";

// ═══════════════════════════════════════════════════════════════════════════
// Marketing & Promotion — Installer sales toolkit
// ═══════════════════════════════════════════════════════════════════════════

export default function MarketingPage() {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setUserId(data.user.id);
      setLoading(false);
    });
  }, [supabase]);

  if (loading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookingLink = `${baseUrl}/design?installer_id=${userId}`;

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">
              Marketing & Promotion
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 pt-6">
        {/* ── Section 1: Booking Link ──────────────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Your Booking Link
            </h2>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            This is your unique booking link. Send this to clients to let them
            design and book their own jobs.
          </p>

          {/* Link display */}
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-3">
            <p className="select-all break-all text-sm font-medium text-blue-400">
              {bookingLink}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-yellow-300"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </button>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Launch Configurator
            </a>
          </div>

          {/* Pro feature teaser */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-4 py-3">
            <Lock className="h-3.5 w-3.5 text-stone-600" />
            <p className="text-xs text-stone-600">
              Custom Domain & White Labeling{" "}
              <span className="font-semibold text-stone-500">
                (Pro Plan Coming Soon)
              </span>
            </p>
          </div>
        </section>

        {/* ── Section 2: Social Post Generator ─────────────────────── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Social Media Post Generator
            </h2>
          </div>
          <p className="mb-4 text-sm text-stone-500">
            Generate a professional post to share on Instagram, Facebook, or
            SMS.
          </p>

          <SocialGenerator bookingLink={bookingLink} />
        </section>
      </main>
    </div>
  );
}
