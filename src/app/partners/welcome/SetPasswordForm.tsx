"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { setPartnerPassword } from "@/app/actions/partner-portal";

const INPUT = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400";

export default function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    const res = await setPartnerPassword(token, password);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    const { error: signInErr } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: res.email, password });
    router.replace(signInErr ? "/partners/login" : "/partners");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={`${INPUT} opacity-60`} value={email} readOnly aria-label="Email" />
      <input className={INPUT} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      <input className={INPUT} type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      {error && <p className="text-xs font-medium text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-yellow-300 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Set password &amp; open dashboard
      </button>
    </form>
  );
}
