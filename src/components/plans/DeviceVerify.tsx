"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { confirmPlanDeviceCode, requestPlanDeviceCode } from "@/app/actions/plan-device";
import { CONTACT_EMAIL } from "@/lib/plan-library";

/**
 * "Confirm it's you" — shown instead of a plan when its link is opened on a
 * device the buyer hasn't used before. Emails the buyer a 6-digit code;
 * `onVerified` re-opens the plan once this device is remembered.
 */
export default function DeviceVerify({
  token,
  emailHint,
  onVerified,
}: {
  token: string;
  emailHint: string;
  onVerified: () => void;
}) {
  const [stage, setStage] = useState<"ask" | "code">("ask");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError("");
    const res = await requestPlanDeviceCode(token).catch(() => null);
    setBusy(false);
    if (!res) return setError("Couldn't reach the server. Try again.");
    if (!res.ok) {
      setError(res.error);
      // A code from a moment ago is still good — let them enter it.
      if (/just sent/.test(res.error)) setStage("code");
      return;
    }
    setStage("code");
    setCooldown(60);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError("");
    const res = await confirmPlanDeviceCode(token, value).catch(() => null);
    if (res?.ok) {
      onVerified();
      return;
    }
    setBusy(false);
    setError(res?.error ?? "Couldn't reach the server. Try again.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src="/landing_page_logo.png" alt="Storage Network" width={36} height={36} className="rounded" />
          <span className="text-sm font-black tracking-wide text-white">STORAGE NETWORK</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10">
            {stage === "ask" ? <ShieldCheck className="h-6 w-6 text-yellow-400" /> : <Mail className="h-6 w-6 text-yellow-400" />}
          </div>

          {stage === "ask" ? (
            <>
              <h1 className="mb-1.5 text-lg font-black text-white">Confirm it&apos;s you</h1>
              <p className="mb-5 text-sm leading-relaxed text-stone-400">
                This is a new device for these plans. We&apos;ll email a 6-digit code to{" "}
                <span className="font-semibold text-white">{emailHint}</span>, the address they were bought with.
              </p>
              <button
                onClick={send}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email me a code
              </button>
            </>
          ) : (
            <>
              <h1 className="mb-1.5 text-lg font-black text-white">Check your email</h1>
              <p className="mb-5 text-sm leading-relaxed text-stone-400">
                Enter the code we sent to <span className="font-semibold text-white">{emailHint}</span>.
              </p>
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verify(v);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                aria-label="6-digit code"
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 text-center font-mono text-2xl font-black tracking-[0.5em] text-yellow-400 placeholder:text-slate-700 focus:border-yellow-400 focus:outline-none"
              />
              <button
                onClick={() => verify()}
                disabled={busy || code.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black uppercase tracking-wider text-gray-950 transition hover:bg-yellow-300 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Open my plans
              </button>
              <button
                onClick={send}
                disabled={busy || cooldown > 0}
                className="mt-3 w-full text-center text-xs font-semibold text-stone-400 transition hover:text-yellow-400 disabled:text-stone-600"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </>
          )}

          {error && <p className="mt-3 text-center text-xs font-medium text-amber-400">{error}</p>}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-stone-600">
          Plans open on up to 3 of your devices. Not your plans? Questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-stone-400 hover:text-yellow-400">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
