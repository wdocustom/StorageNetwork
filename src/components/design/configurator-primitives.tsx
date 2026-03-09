"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/** Rolling number counter that "ticks" up/down smoothly */
export function RollingPrice({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (v) => `$${Math.round(v).toLocaleString()}`);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span className="tabular-nums">
      {display}
    </motion.span>
  );
}

/** Focus Frame wrapper for inputs — glowing border + label lift on focus */
export function FocusFrame({
  label,
  children,
  pulsing = false,
}: {
  label: string;
  children: React.ReactNode;
  pulsing?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className={`relative rounded-xl border-2 p-3 transition-colors ${
        focused
          ? "border-yellow-400 bg-zinc-900/80 shadow-[0_0_16px_rgba(250,204,21,0.15)]"
          : "border-zinc-700/60 bg-zinc-900/50"
      }`}
      animate={pulsing ? {
        borderColor: ["rgba(113,113,122,0.6)", "rgba(250,204,21,0.8)", "rgba(113,113,122,0.6)"],
        boxShadow: [
          "0 0 0px rgba(250,204,21,0)",
          "0 0 20px rgba(250,204,21,0.3)",
          "0 0 0px rgba(250,204,21,0)",
        ],
      } : {}}
      transition={pulsing ? { duration: 1.2, repeat: 2, ease: "easeInOut" } : {}}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <motion.label
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest"
        animate={{
          color: focused ? "#facc15" : "#a1a1aa",
          y: focused ? -2 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {label}
      </motion.label>
      {children}
    </motion.div>
  );
}

/** Interactive Selection Card with scale-up hover, border change, and checkmark pop */
export function SelectionCard({
  selected,
  onSelect,
  children,
  className = "",
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-colors ${
        selected
          ? "border-yellow-400 bg-yellow-400/5 shadow-[0_0_12px_rgba(250,204,21,0.1)]"
          : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
      } ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {children}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-bl-lg rounded-tr-xl bg-yellow-400"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Toggle switch with smooth animation */
export function StudioToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50"
    >
      <motion.div
        className={`relative h-5 w-9 shrink-0 rounded-full ${checked ? "bg-yellow-400" : "bg-zinc-700"}`}
        animate={{ backgroundColor: checked ? "#facc15" : "#3f3f46" }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.div>
      <span className="flex-1 text-left text-sm font-medium text-zinc-300 group-hover:text-zinc-100">
        {label}
      </span>
    </button>
  );
}

/** Small toggle button for individual addon items */
export function AddonToggleBtn({
  icon,
  label,
  price,
  active,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  price?: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-all ${
        active
          ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-300"
          : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {price !== undefined && price > 0 && (
        <span className="text-[10px] text-zinc-500">+${price}</span>
      )}
    </button>
  );
}
