"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { STEPS } from "./configurator-types";

export default function ConfiguratorStepper({
  activeStep,
  setActiveStep,
  hasQuoteItems,
}: {
  activeStep: number;
  setActiveStep: (step: number) => void;
  hasQuoteItems: boolean;
}) {
  return (
    <div className="shrink-0 border-b border-zinc-800/80 px-4 py-4">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = activeStep === step.id;
          const isComplete = activeStep > step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <button
                onClick={() => setActiveStep(step.id)}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <motion.div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-yellow-400 text-zinc-900"
                      : isComplete
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-400"
                  }`}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isComplete ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </motion.div>
                <div className="flex flex-col items-center">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    isActive ? "text-yellow-400" : isComplete ? "text-yellow-400/60" : "text-zinc-600"
                  }`}>
                    {String(step.id).padStart(2, "0")}
                  </span>
                  <span className={`text-[9px] font-semibold ${
                    isActive ? "text-zinc-200" : "text-zinc-500"
                  }`}>
                    {step.label}
                  </span>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${isComplete ? "bg-yellow-400/30" : "bg-zinc-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar — endowed progress effect (starts at 12.5%, never empty) */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300"
          initial={{ width: "12.5%" }}
          animate={{ width: `${Math.max(12.5, (activeStep / 4) * 100)}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
}
