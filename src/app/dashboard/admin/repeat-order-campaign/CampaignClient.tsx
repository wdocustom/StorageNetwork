"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  runRepeatOrderCampaignAdmin,
} from "@/app/actions/admin-repeat-order-campaign";
import type { CampaignRunResult } from "@/lib/server/repeat-order-campaign";

export default function CampaignClient() {
  const [testTo, setTestTo] = useState("");
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignRunResult | null>(null);
  const [error, setError] = useState("");

  async function run(mode: "dry-run" | "test" | "send") {
    setError("");
    setResult(null);
    if (mode === "send" && !window.confirm(`Send the email to up to ${limit} REAL customers now?`)) return;
    setBusy(mode);
    try {
      const res = await runRepeatOrderCampaignAdmin({ mode, testTo, limit });
      if (res.success) setResult(res.result);
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50";

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-xl border border-stone-800 bg-gray-900 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">1 · Dry run</h2>
        <p className="mb-3 mt-1 text-xs text-stone-400">
          Counts who would get the email and shows a few (masked). Sends nothing.
        </p>
        <button onClick={() => run("dry-run")} disabled={!!busy} className={`${btn} bg-slate-700 text-white`}>
          {busy === "dry-run" && <Loader2 className="h-4 w-4 animate-spin" />} Run dry run
        </button>
      </section>

      <section className="rounded-xl border border-stone-800 bg-gray-900 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-yellow-400">2 · Test email to yourself</h2>
        <p className="mb-3 mt-1 text-xs text-stone-400">
          Sends one &ldquo;[TEST]&rdquo; email to the address below only, built from the first eligible
          customer&rsquo;s installer and order. Its links work for real — the order page will show that
          customer&rsquo;s details and previous order. Nobody else is emailed.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-yellow-400 focus:outline-none"
          />
          <button onClick={() => run("test")} disabled={!!busy} className={`${btn} bg-yellow-400 text-gray-950`}>
            {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />} Send test
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-red-500/30 bg-gray-900 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">3 · Send to real customers</h2>
        <p className="mb-3 mt-1 text-xs text-stone-400">
          Emails real customers, once each. Start with a small batch; run it again until eligible reaches 0.
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400">Batch size</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
            className="w-24 rounded-lg border border-stone-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
          />
          <button onClick={() => run("send")} disabled={!!busy} className={`${btn} bg-red-500 text-white`}>
            {busy === "send" && <Loader2 className="h-4 w-4 animate-spin" />} Send batch
          </button>
        </div>
      </section>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}

      {result && (
        <section className="rounded-xl border border-stone-800 bg-gray-900 p-5 text-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Result · {result.mode}</h2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Eligible", result.eligible],
              ["Attempted", result.attempted],
              ["Sent", result.sent],
              ["Skipped", result.skipped],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-slate-800 p-3 text-center">
                <dd className="text-2xl font-black text-white">{v}</dd>
                <dt className="text-[10px] uppercase tracking-wider text-stone-500">{k}</dt>
              </div>
            ))}
          </dl>
          {result.sample && result.sample.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">Sample recipients</p>
              <ul className="space-y-1 text-stone-300">
                {result.sample.map((s, i) => (
                  <li key={i}>{s.email} → {s.installer}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-400">Errors</p>
              <ul className="space-y-1 text-red-300">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
