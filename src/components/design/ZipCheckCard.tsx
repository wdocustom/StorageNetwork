"use client";

// "Find My Local Pro" — ZIP check for visitors not on an installer's own
// link (hidden when the installer is locked). Shared by the step-by-step
// configurator and the design studio.

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import type { ConfiguratorSidebarProps } from "./configurator-types";

export default function ZipCheckCard({ props }: { props: ConfiguratorSidebarProps }) {
  return (
    <>
      {/* ZIP Check (hidden when installer locked) */}
      {!props.installerLocked && (
        <section className="rounded-xl border border-dashed border-yellow-400/40 bg-yellow-400/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-yellow-400/80">
            <MapPin className="h-3.5 w-3.5" />
            Find My Local Pro
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={props.zip}
              onChange={(e) => {
                props.onZipChange(e.target.value.replace(/\D/g, "").slice(0, 5));
                props.onZipResultClear();
              }}
              placeholder="ZIP Code"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
            />
            <button
              onClick={props.onZipCheck}
              disabled={props.zip.length < 5 || props.zipChecking}
              className="shrink-0 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
            >
              {props.zipChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
            </button>
          </div>
          {props.zipResult?.available && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 space-y-1.5"
            >
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {props.zipResult.message}
              </div>
              <p className="text-xs text-zinc-400">
                Your free 3D design is ready — let&apos;s build it!
              </p>
            </motion.div>
          )}
          {props.zipResult && !props.zipResult.available && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-xs font-semibold text-amber-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {props.zipResult.message}
            </motion.div>
          )}
        </section>
      )}
    </>
  );
}
