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
                onClick={() => {
                  if (hasQuoteItems && activeStep === 4 && step.id !== 1 && step.id !== 4) return;
                  setActiveStep(step.id);
                }}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <motion.div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    hasQuoteItems && activeStep === 4 && step.id !== 1 && step.id !== 4
                      ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                      : isActive
                      ? "bg-yellow-400 text-zinc-900"
                      : isComplete
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-400"
                  }`}
                  animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
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
    </div>
  );
}
