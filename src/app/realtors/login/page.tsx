"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, ArrowLeft, KeyRound, ShieldOff } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { stampLastLogin, checkSuspensionStatus } from "@/app/actions/profile";

// ═══════════════════════════════════════════════════════════════════════════
// Realtor Login — dedicated entry point for the closing-gift toolkit.
//
// Mirrors the brand language of /realtors/join (slate/yellow, "closing-gift
// toolkit") and reuses the same auth helpers as /login (suspension check,
// last-login stamping, forgot-password flow). Added on top: a realtor
// guard that refuses to sign a non-realtor user into the portal so they
// don't end up half-redirected.
// ═══════════════════════════════════════════════════════════════════════════

export default function RealtorLoginPage() {
  return (
    <Suspense>
      <RealtorLoginInner />
    </Suspense>
  );
}

function RealtorLoginInner() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/realtors/dashboard";

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState<null | { reason: "manual" | "payment" | null }>(null);

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) {
          setError(resetError.message);
        } else {
          setMessage("Check your email for a password reset link.");
        }
        setLoading(false);
        return;
      }

      if (!password) {
        setError("Enter your password.");
        setLoading(false);
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!signInData.user) {
        setError("Sign-in failed unexpectedly.");
        setLoading(false);
        return;
      }

      // Suspension gate first — applies to all account types.
      const status = await checkSuspensionStatus(signInData.user.id);
      if (status.suspended) {
        await supabase.auth.signOut();
        setBlocked({ reason: status.reason });
        setLoading(false);
        return;
      }

      // Realtor-specific guard: this page is the realtor login. If the
      // account isn't flagged is_realtor, send them to the installer
      // login instead of dumping them at /realtors/dashboard (where the
      // (authed) layout would immediately bounce them anyway).
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_realtor")
        .eq("id", signInData.user.id)
        .single();

      if (!profile?.is_realtor) {
        await supabase.auth.signOut();
        setError(
          "This account isn't a realtor account. If you're an installer, sign in at /login. If you'd like to join as a realtor, hit \"Get started\" below."
        );
        setLoading(false);
        return;
      }

      await stampLastLogin(signInData.user.id);
      window.location.href = redirectTo;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  // ── Suspended-account screen ─────────────────────────────────────────────
  if (blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-400/40">
            <ShieldOff className="h-7 w-7 text-red-300" />
          </div>
          <h1 className="mb-3 text-2xl font-black text-white">Account paused</h1>
          <p className="mb-6 text-sm leading-relaxed text-stone-300">
            {blocked.reason === "manual"
              ? "This account has been paused by support. Reply to your most recent email from us, or reach out and we'll sort it out."
              : "We couldn't process a recent payment on this account. Please update your billing details to restore access."}
          </p>
          <button
            onClick={() => {
              setBlocked(null);
              setEmail("");
              setPassword("");
            }}
            className="text-sm font-semibold text-yellow-400 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ── Main card ────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-3 text-stone-300 hover:text-white"
        >
          <Image
            src="/landing_page_logo.png"
            alt="Storage Network"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-sm font-bold tracking-tight">Storage Network</span>
        </Link>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
          {mode === "login" ? (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                Realtors
              </p>
              <h1 className="mb-2 text-3xl font-black text-white">Sign in</h1>
              <p className="mb-8 text-sm text-stone-400">
                Pick up your closing-gift toolkit where you left off.
              </p>

              <div className="space-y-4">
                <Field
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="Work email"
                  value={email}
                  onChange={setEmail}
                  onKeyDown={handleKeyDown}
                />
                <Field
                  icon={Lock}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  onKeyDown={handleKeyDown}
                />
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in&hellip;
                  </>
                ) : (
                  <>Sign in</>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setMessage("");
                }}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-yellow-400"
              >
                <KeyRound className="h-3 w-3" />
                Forgot password?
              </button>

              <div className="mt-8 border-t border-slate-800 pt-6 text-center">
                <p className="text-xs text-stone-500">
                  Don&apos;t have an account?{" "}
                  <Link href="/realtors/join" className="font-semibold text-yellow-400 hover:underline">
                    Get started
                  </Link>
                </p>
                <p className="mt-3 text-[11px] text-stone-600">
                  Are you an installer?{" "}
                  <Link href="/login" className="text-stone-400 underline hover:text-yellow-400">
                    Sign in here
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
                className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-400 hover:text-yellow-400"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </button>

              <h1 className="mb-2 text-3xl font-black text-white">Reset password</h1>
              <p className="mb-8 text-sm text-stone-400">
                Enter the email you signed up with and we&apos;ll send a reset link.
              </p>

              <Field
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="Work email"
                value={email}
                onChange={setEmail}
                onKeyDown={handleKeyDown}
              />

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              {message && (
                <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">
                  {message}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending&hellip;
                  </>
                ) : (
                  <>Send reset link</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  autoComplete?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function Field({ icon: Icon, type, autoComplete, placeholder, value, onChange, onKeyDown }: FieldProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-sm text-white placeholder:text-stone-500 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
    </div>
  );
}
