"use client";

import { useState } from "react";
import { contactInstaller } from "@/app/actions/contact-installer";

// ═══════════════════════════════════════════════════════════════════════════
// PortfolioContact — Inline email form on the installer portfolio page
//
// Sits alongside the Phone / Instagram / Facebook buttons. Lets a potential
// customer send a message to the installer without exposing the installer's
// email (same black-box contactInstaller action used on /design and /pay).
// ═══════════════════════════════════════════════════════════════════════════

interface PortfolioContactProps {
  installerId: string;
  businessName: string;
}

export default function PortfolioContact({ installerId, businessName }: PortfolioContactProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Name, email, and message are required.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const result = await contactInstaller({
        installerId,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim() || undefined,
        message: message.trim(),
      });
      if (!result.success) {
        setError(result.error || "Failed to send. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Collapsed state — just the button
  if (!open && !sent) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:border-yellow-400/40 hover:bg-slate-800"
      >
        <svg className="h-3.5 w-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email
      </button>
    );
  }

  // Sent state
  if (sent) {
    return (
      <div className="mt-4 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
        <svg className="mx-auto mb-1.5 h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-bold text-white">Message Sent!</p>
        <p className="text-xs text-stone-400">{businessName} will get back to you shortly.</p>
      </div>
    );
  }

  // Open form state
  return (
    <div className="mt-4 w-full rounded-xl border border-slate-700 bg-[#0d1220] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
          <svg className="h-3.5 w-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email {businessName}
        </span>
        <button
          onClick={() => { setOpen(false); setError(""); }}
          className="text-stone-500 transition-colors hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
          />
          <input
            type="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
          />
        </div>
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
        />
        <textarea
          placeholder="Tell us about your project or ask a question..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
        />
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-400">{error}</p>
      )}

      <button
        onClick={handleSend}
        disabled={sending || !message.trim() || !name.trim() || !email.trim()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-sm font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
      >
        {sending ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
        {sending ? "Sending..." : "Send Message"}
      </button>

      <p className="mt-2 text-center text-[10px] text-stone-500">
        Your info will be shared so they can reply directly.
      </p>
    </div>
  );
}
