"use client";

import { useState } from "react";
import { CheckCircle2, Link2, Copy, Check, X } from "lucide-react";
import type { ReferralStatus } from "@/app/actions/createQuote";
import { logActivityClient } from "@/lib/activity-client";

interface QuoteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLeadId: string | null;
  quoteLeadId: string | null;
  quoteReferralStatus: ReferralStatus;
  quoteCoveringName: string;
  customerEmail: string;
}

export default function QuoteSuccessModal({
  isOpen,
  onClose,
  editingLeadId,
  quoteLeadId,
  quoteReferralStatus,
  quoteCoveringName,
  customerEmail,
}: QuoteSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const title = editingLeadId
    ? "Quote Updated!"
    : quoteReferralStatus === "waitlisted"
      ? "Customer Waitlisted"
      : quoteReferralStatus === "handed_off"
        ? "Quote Sent & Referred"
        : "Quote Created!";

  const message = editingLeadId
    ? "The quote has been updated. Your customer's pay link will show the new items and total."
    : quoteReferralStatus === "waitlisted"
      ? "No installer covers this area yet. The customer has been added to the waitlist and will be notified when one is available. You'll earn the referral bounty when they book."
      : quoteReferralStatus === "handed_off"
        ? `The quote was handed off to ${quoteCoveringName}. The customer will receive the email from them. You'll earn a referral bounty (30% of deposit, min $15) when they book.`
        : customerEmail?.trim()
          ? "Your customer will receive an email with their quote and a link to confirm."
          : "Copy the link below to send it to your customer via text, message, or any channel.";

  async function handleCopy() {
    if (!quoteLeadId) return;
    const url = `${window.location.origin}/pay/${quoteLeadId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    logActivityClient({
      action: "quote_link_copied",
      pagePath: "/build",
      detail: { lead_id: quoteLeadId },
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="scrollbar-dark relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-gray-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-stone-500 transition-colors hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="py-2 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
          <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
          <p className="mb-5 text-sm text-stone-400">{message}</p>

          {quoteReferralStatus === "handed_off" && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
              <p className="text-[11px] font-semibold text-amber-300">
                Referral Bounty Pending
              </p>
              <p className="mt-1 text-[10px] text-stone-400">
                Track your referrals and bounty earnings in your{" "}
                <strong className="text-white">Referrals</strong> dashboard.
              </p>
            </div>
          )}

          {quoteLeadId && (
            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left">
              <div className="mb-2 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Quote Link
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
                  <p className="truncate text-xs text-stone-300">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/pay/${quoteLeadId}`
                      : `/pay/${quoteLeadId}`}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    copied
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-yellow-400 text-gray-950 hover:bg-yellow-300"
                  }`}
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
              </div>
            </div>
          )}

          {editingLeadId ? (
            <div className="flex justify-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
              >
                Keep Editing
              </button>
              <a
                href={`/dashboard/leads/${editingLeadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
              >
                View Job Ticket
              </a>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
