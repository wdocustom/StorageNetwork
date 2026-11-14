"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A PURCHASED CUSTOM PLAN — /plans/builder/plan
//
//   ?session_id=…   first visit from Stripe (payment verified server-side)
//   ?token=…        the permanent link from the purchase email
//
// Shows the same plan screen a builder sees for their own design: parts,
// cut list, shopping list, 3D guide and PDF. Opened on a device the buyer
// hasn't used, it asks for the code emailed to them first.
// ═══════════════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { openPurchasedPlan, type PurchasedPlanResult } from "@/app/actions/builder";
import { VerifyDialog } from "@/components/builder/BuilderDialogs";
import BuilderPlan from "@/components/builder/BuilderPlan";
import { MARKET_HREF, purchasedPlanHref } from "@/lib/builder/store";

const Loading = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
    <div className="text-center">
      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-yellow-400" />
      <p className="text-sm text-stone-500">Loading your build plan…</p>
    </div>
  </div>
);

function PurchasedPlanInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<PurchasedPlanResult | null>(null);
  const started = useRef(false);

  const open = useCallback(
    (input: { sessionId: string } | { token: string }) => {
      setResult(null);
      openPurchasedPlan(input)
        .catch((): PurchasedPlanResult => ({ ok: false, error: "We couldn't reach the server. Please try again." }))
        .then((res) => {
          setResult(res);
          // Swap the one-time session for the permanent link
          const token = res.ok ? res.token : res.verify?.token;
          if (token && "sessionId" in input) router.replace(purchasedPlanHref(token));
        });
    },
    [router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = searchParams.get("token");
    const sessionId = searchParams.get("session_id");
    if (token) open({ token });
    else if (sessionId) open({ sessionId });
    else router.replace(MARKET_HREF);
  }, [open, router, searchParams]);

  if (!result) return <Loading />;

  if (!result.ok && result.verify) {
    const { token, emailHint } = result.verify;
    return (
      <div className="min-h-[100dvh] bg-slate-950">
        <VerifyDialog token={token} emailHint={emailHint} onVerified={() => open({ token })} onClose={() => router.push(MARKET_HREF)} />
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <h1 className="mb-2 text-base font-bold text-white">We couldn&apos;t open this plan</h1>
          <p className="mb-5 text-sm text-stone-500">{result.error}</p>
          <Link href={MARKET_HREF} className="block rounded-xl bg-yellow-400 py-3 text-sm font-bold text-gray-950 transition hover:bg-yellow-300">
            Back to the marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BuilderPlan
      scene={result.scene}
      plan={result.plan}
      subtitle="Build plan · yours for good"
      licensedTo={result.license}
      banner={result.emailSentTo ? `Check your email: we sent your permanent link to ${result.emailSentTo}. Bookmark this page to come back any time.` : undefined}
    />
  );
}

export default function PurchasedPlanPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PurchasedPlanInner />
    </Suspense>
  );
}
