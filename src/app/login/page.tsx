"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, ArrowLeft, KeyRound } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Login Page — Supabase Email/Password Auth with Forgot Password
// ═══════════════════════════════════════════════════════════════════════════

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleEmailAuth() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        // Send password reset email
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          {
            redirectTo: `${window.location.origin}/reset-password`,
          }
        );

        if (resetError) {
          setError(resetError.message);
        } else {
          setMessage(
            "Check your email for a password reset link."
          );
        }
      } else if (mode === "signup") {
        // Sign up with email + password
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage(
            "Check your email for a confirmation link, then come back and sign in."
          );
        }
      } else {
        // Sign in with email + password
        if (!password) {
          setError("Enter your password.");
          setLoading(false);
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          window.location.href = redirectTo;
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleEmailAuth();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/logo-storage-network.png"
            alt="Storage Network"
            className="mx-auto mb-4 h-32 w-auto object-contain"
          />
          <h1 className="text-lg font-bold uppercase tracking-wider text-white">
            Partner Network
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {mode === "login"
              ? "Sign in to your installer dashboard"
              : mode === "signup"
              ? "Create your installer account"
              : "Reset your password"}
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-3">
            {/* Email */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Email
              </label>
              <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-800 focus-within:border-yellow-400">
                <div className="flex items-center pl-3 text-stone-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-stone-600 outline-none"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password - hidden in forgot mode */}
            {mode !== "forgot" && (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white placeholder-stone-600 outline-none focus:border-yellow-400"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
          )}
          {message && (
            <p className="mt-3 text-xs font-medium text-emerald-400">
              {message}
            </p>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign In"
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Send Reset Link
              </>
            )}
          </button>

          {/* Toggle mode */}
          <div className="mt-4 space-y-2 text-center">
            {mode === "login" && (
              <>
                <p className="text-xs text-stone-500">
                  <button
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setMessage("");
                    }}
                    className="font-semibold text-stone-400 hover:text-yellow-400"
                  >
                    Forgot Password?
                  </button>
                </p>
                <p className="text-xs text-stone-500">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setMessage("");
                    }}
                    className="font-semibold text-yellow-400 hover:text-yellow-300"
                  >
                    Sign Up
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-xs text-stone-500">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                  className="font-semibold text-yellow-400 hover:text-yellow-300"
                >
                  Sign In
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <p className="text-xs text-stone-500">
                Remember your password?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                  className="font-semibold text-yellow-400 hover:text-yellow-300"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
