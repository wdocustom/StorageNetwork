"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { stampLastLogin } from "@/app/actions/profile";
import { Loader2, KeyRound, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Reset Password Page — Handles password reset from email link
// ═══════════════════════════════════════════════════════════════════════════

export default function ResetPasswordPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  // ── Recovery session setup ───────────────────────────────────────────────
  // Three valid arrival paths:
  //
  //   1. PKCE / OTP via /auth/callback (current): the callback has
  //      already exchanged the link for a session and written it to
  //      HttpOnly cookies. The browser client picks that up via
  //      getSession() and we're done — no URL hash, no manual setSession.
  //
  //   2. Legacy Supabase email template that drops the user directly on
  //      /reset-password#access_token=…&refresh_token=…&type=recovery.
  //      We parse the hash, sign out any pre-existing local session,
  //      then install the recovery session via setSession.
  //
  //   3. Supabase fires a PASSWORD_RECOVERY auth event when it detects
  //      a recovery code in the URL. We listen for that too as a final
  //      safety net (browsers sometimes strip the hash before our effect
  //      runs).
  //
  // Defense: parse the recovery tokens from the URL hash ourselves, sign
  // out any pre-existing local session before doing anything else, then
  // install the recovery session via setSession so the rest of the page
  // is guaranteed to be acting on the correct account.
  useEffect(() => {
    let cancelled = false;

    async function processRecovery() {
      // ── Path 1: session already in cookies (PKCE via /auth/callback) ──
      const { data: existing } = await supabase.auth.getSession();
      if (existing?.session) {
        if (cancelled) return;
        setHasValidSession(true);
        setCheckingSession(false);
        return;
      }

      // ── Path 2: legacy hash-fragment recovery tokens ──────────────────
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const tokenType = params.get("type");

      if (tokenType !== "recovery" || !accessToken || !refreshToken) {
        setError("Invalid or expired reset link. Please request a new one.");
        setCheckingSession(false);
        return;
      }

      // scope:"local" wipes the session from THIS device only — we don't
      // want to invalidate the prior user's sessions elsewhere; they might
      // be a different person entirely.
      await supabase.auth.signOut({ scope: "local" });

      const { error: setErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setErr) {
        setError(setErr.message || "Couldn't validate reset link. Please request a new one.");
        setCheckingSession(false);
        return;
      }

      // Strip the tokens from the URL so they don't leak into history,
      // referrers, or screen captures.
      window.history.replaceState(null, "", window.location.pathname);

      if (cancelled) return;
      setHasValidSession(true);
      setCheckingSession(false);
    }

    // ── Path 3: Supabase-fired PASSWORD_RECOVERY event ───────────────────
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    });

    processRecovery();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleResetPassword() {
    // Validate passwords
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        // Stamp login — user is authenticated via recovery link
        const { data: { user } } = await supabase.auth.getUser();
        let destination = "/dashboard";
        if (user) {
          stampLastLogin(user.id);
          // Send realtors to their own portal so they don't land in the
          // installer dashboard, which would just bounce them back out via
          // the realtor (authed) route-group guard.
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_realtor")
            .eq("id", user.id)
            .single();
          if (profile?.is_realtor) destination = "/realtors/dashboard";
        }
        setTimeout(() => {
          router.push(destination);
        }, 2000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleResetPassword();
  }

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-400" />
          <p className="mt-4 text-sm text-stone-400">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Password Updated!</h1>
          <p className="mt-2 text-sm text-stone-400">
            Your password has been reset successfully. Redirecting to dashboard...
          </p>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-yellow-400" />
        </div>
      </div>
    );
  }

  // Invalid/expired link state
  if (!hasValidSession && error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Link Expired</h1>
          <p className="mt-2 text-sm text-stone-400">
            {error}
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Image
            src="/landing_page_logo.png"
            alt="Storage Network"
            width={128}
            height={128}
            className="mx-auto mb-4 h-32 w-auto object-contain"
          />
          <h1 className="text-lg font-bold uppercase tracking-wider text-white">
            Reset Password
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Enter your new password below
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-3">
            {/* New Password */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Min 6 characters"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
          )}

          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Set New Password
              </>
            )}
          </button>
        </div>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
