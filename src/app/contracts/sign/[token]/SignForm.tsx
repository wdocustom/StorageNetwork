"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, PenLine } from "lucide-react";
import { acceptContractorAgreement } from "@/app/actions/contractor-agreements";

// ═══════════════════════════════════════════════════════════════════════════
// SignForm — typed-name signature input
//
// The signer must type their full legal name exactly as it appears on the
// agreement (case + whitespace tolerant). On accept the page re-fetches via
// router.refresh() so the page transitions to the already-signed view.
// ═══════════════════════════════════════════════════════════════════════════

export function SignForm({
  token,
  expectedName,
}: {
  token: string;
  expectedName: string;
}) {
  const [typed, setTyped] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const normalize = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, " ");
  const nameMatches = normalize(typed) === normalize(expectedName);
  const canSign = nameMatches && agreed && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nameMatches) {
      setError("Type your full legal name exactly as it appears in the signature block.");
      return;
    }
    if (!agreed) {
      setError("Confirm you've read the agreement before signing.");
      return;
    }

    startTransition(async () => {
      const result = await acceptContractorAgreement({
        token,
        typedSignature: typed,
      });
      if (!result.success) {
        setError(result.error ?? "Could not record signature. Try again.");
        return;
      }
      // Server refresh swaps the unsigned form for the success state.
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6"
    >
      <div className="mb-4 flex items-start gap-2">
        <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
        <p className="text-sm leading-relaxed text-stone-200">
          Type your full legal name below to sign. Your typed signature,
          along with the timestamp and IP, is recorded as legal acceptance
          of every clause above.
        </p>
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-300">
        Full legal name
      </label>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={expectedName}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-serif text-lg italic text-white placeholder:text-stone-600 focus:border-yellow-400/50 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
      />
      <p className="mt-1.5 text-[11px] text-stone-500">
        Expected: {expectedName}
      </p>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-stone-300">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-yellow-400"
        />
        <span>
          I&rsquo;ve read this agreement in full and accept all of its terms
          on behalf of myself and any business entity named above.
        </span>
      </label>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSign}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-base font-bold text-slate-950 transition-all hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Recording signature&hellip;
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Sign agreement
          </>
        )}
      </button>
    </form>
  );
}
