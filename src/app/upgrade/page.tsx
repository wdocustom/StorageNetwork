"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Star } from "lucide-react";
import { createProCheckoutSession } from "@/app/actions/pro-subscription";

// ═══════════════════════════════════════════════════════════════════════════
// Upgrade Page — /upgrade
//
// Seamless redirect to Pro checkout:
// - Logged in → Create Stripe checkout session → Redirect
// - Not logged in → Redirect to login → Return here → Checkout
// ═══════════════════════════════════════════════════════════════════════════

export default function UpgradePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initiateUpgrade() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in — redirect to login with return URL
        router.push("/login?redirect=/upgrade");
        return;
      }

      // User is logged in — create checkout session
      setStatus("redirecting");

      const result = await createProCheckoutSession(user.id);

      if (!result.success || !result.url) {
        setStatus("error");
        setError(result.error || "Failed to create checkout session. Please try again.");
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = result.url;
    }

    initiateUpgrade();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        {status === "error" ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <Star className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">Unable to Upgrade</h1>
            <p className="mb-6 text-sm text-stone-400">{error}</p>
            <a
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-300"
            >
              Go to Dashboard
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/10">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-white">
              {status === "redirecting" ? "Preparing Checkout..." : "Loading..."}
            </h1>
            <p className="text-sm text-stone-400">
              {status === "redirecting"
                ? "Redirecting you to secure checkout..."
                : "Checking your account..."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
