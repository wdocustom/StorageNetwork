"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestPartnerPasswordLink } from "@/app/actions/partner-portal";
import PartnerShell from "../PartnerShell";

const INPUT = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (err) {
      setError("That email and password don't match.");
      setBusy(false);
      return;
    }
    router.replace("/partners");
  }

  async function forgot() {
    if (!email.trim()) return setError("Enter your email first.");
    setError(null);
    const res = await requestPartnerPasswordLink(email);
    setInfo(
      res.ok
        ? "If that email has partner access, we just sent a link to set a new password. If you also run an installer account, reset it from the main login page instead."
        : res.error,
    );
  }

  return (
    <PartnerShell title="Log in" subtitle="Track your referrals and payouts.">
      <form onSubmit={signIn} className="space-y-3">
        <input className={INPUT} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={INPUT} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-xs font-medium text-red-400">{error}</p>}
        {info && <p className="text-xs text-stone-400">{info}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
        </button>
        <button type="button" onClick={forgot} className="w-full text-center text-xs font-semibold text-stone-500 hover:text-white">
          Forgot your password?
        </button>
      </form>
    </PartnerShell>
  );
}
