"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CollapsibleSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  /** Whether to start expanded (default: false — starts collapsed) */
  defaultOpen?: boolean;
  /** Optional border color class override */
  borderClass?: string;
  /** Optional icon color class override */
  iconColor?: string;
  /** Optional badge text shown in the header */
  badge?: string;
  /** Badge color class */
  badgeColor?: string;
}

export default function CollapsibleSection({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = false,
  borderClass = "border-slate-800",
  iconColor = "text-yellow-400",
  badge,
  badgeColor = "bg-yellow-400/10 text-yellow-400",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`rounded-2xl border ${borderClass} bg-slate-900 overflow-hidden`}>
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-slate-800/30"
      >
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              {title}
            </h2>
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {!open && (
            <p className="mt-0.5 truncate text-[11px] text-stone-600">
              {description}
            </p>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-600" />
        </motion.div>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/50 px-5 pb-5 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
