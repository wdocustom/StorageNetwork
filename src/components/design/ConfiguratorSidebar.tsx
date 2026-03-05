"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import {
  Ruler,
  Settings2,
  Palette,
  ShoppingCart,
  CheckCircle2,
  Plus,
  X,
  Maximize2,
  Star,
  Truck,
  CreditCard,
  Send,
  Loader2,
  MapPin,
  AlertTriangle,
  Clock,
  User,
  Mail,
  ChevronRight,
  Calendar,
  Tag,
} from "lucide-react";
import NativeScheduler from "@/components/booking/NativeScheduler";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type ToteType = "HDX" | "GM";
type ToteColor = "black" | "clear";
type UnitType = "standard" | "mini";
type Orientation = "standard" | "sideways";

interface UnitConfig {
  cols: number;
  rows: number;
  toteType: ToteType;
  toteColor: ToteColor;
  unitType: UnitType;
  orientation: Orientation;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  desc: string;
}

interface ServerBuild {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
  slots: number;
  unitType: UnitType;
  orientation: Orientation;
}

// ═══════════════════════════════════════════════════════════════════════════
// Props — Everything the parent DesignConfigurator passes in
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfiguratorSidebarProps {
  // Step 1: Dimensions
  wallWidth: string;
  wallHeight: string;
  onWallWidthChange: (v: string) => void;
  onWallHeightChange: (v: string) => void;
  onWallFit: () => void;
  wallFitMsg: string;
  buildLoading: boolean;
  cols: number | string;
  rows: number | string;
  onColsChange: (v: number | string) => void;
  onRowsChange: (v: number | string) => void;

  // Step 2: Configuration
  unitType: UnitType;
  orientation: Orientation;
  onUnitTypeChange: (v: UnitType) => void;
  onOrientationChange: (v: Orientation) => void;
  toteType: ToteType;
  toteColor: ToteColor;
  onToteTypeChange: (v: ToteType) => void;
  onToteColorChange: (v: ToteColor) => void;
  hasTotes: boolean;
  hasWheels: boolean;
  hasTop: boolean;
  onHasTotesChange: (v: boolean) => void;
  onHasWheelsChange: (v: boolean) => void;
  onHasTopChange: (v: boolean) => void;
  effectiveHasTop: boolean;
  miniDisabled?: boolean;

  // Pricing info for toggle labels
  pricing?: {
    standard_tote?: number;
    standard_tote_clear?: number;
    standard_wheels?: number;
    mini_tote?: number;
    mini_wheels?: number;
    plywood_top?: number;
    mini_disabled?: boolean;
  };
  platformDefaults: {
    standard_tote: number;
    standard_tote_clear: number;
    standard_wheels: number;
    mini_tote: number;
    mini_wheels: number;
    plywood_top: number;
  };

  // Build result
  build: ServerBuild;
  onAddUnit: () => void;

  // Preset
  activePreset: string | null;
  onPresetChange: (v: string | null) => void;
  presetOptions: Array<{
    id: string;
    name: string;
    units: Array<{ cols: number; rows: number; hasTop: boolean; hasWheels: boolean }>;
    toteColor?: string;
    toteModel?: string;
  }>;
  compoundBuild: {
    totalPrice: number;
    presetName: string;
    subUnits: Array<{ cols: number; rows: number; slots: number; totalW: number; totalH: number }>;
  } | null;
  presetLoading: boolean;
  presetTotes: boolean;
  onPresetTotesChange: (v: boolean) => void;
  onAddPresetUnit: () => void;
  activePresetObj: {
    name: string;
    toteColor: string;
    units: Array<{ hasTop: boolean; hasWheels: boolean }>;
  } | null;

  // Step 4: Summary / Quote
  orderItems: UnitConfig[];
  onRemoveUnit: (index: number) => void;
  grandTotal: number;
  deliveryFeeAmount: number;
  deliveryFeeResult: { applicable: boolean; fee: number; distance?: number } | null;
  depositAmount: number;
  depositLabelText: string;
  stripeAccountId: string | null;

  // Booking form
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;

  // Address
  streetAddress: string;
  city: string;
  addrState: string;
  addrZip: string;
  onStreetAddressChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onAddrStateChange: (v: string) => void;
  onAddrZipChange: (v: string) => void;

  // Delivery address
  hasDifferentDelivery: boolean;
  onHasDifferentDeliveryChange: (v: boolean) => void;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  onDeliveryStreetChange: (v: string) => void;
  onDeliveryCityChange: (v: string) => void;
  onDeliveryStateChange: (v: string) => void;
  onDeliveryZipChange: (v: string) => void;

  // Submit / Booking
  submitting: boolean;
  submitted: boolean;
  submitError: string;
  onBookDeposit: () => void;
  isDemo: boolean;
  onDemoToast: () => void;

  // ZIP check (for local pro)
  zip: string;
  onZipChange: (v: string) => void;
  onZipCheck: () => void;
  zipChecking: boolean;
  zipResult: { available: boolean; message?: string } | null;
  onZipResultClear: () => void;
  installerLocked: boolean;

  // Out of area / waitlist
  zipOutOfArea: boolean;
  zipCheckMsg: string;
  handedOff: boolean;
  handoffInstallerName: string;
  waitlistSending: boolean;
  waitlistSent: boolean;
  waitlistError: string;
  onWaitlist: () => void;

  // Contact installer
  installerId: string;
  brandingTitle: string;
  showContactForm: boolean;
  onShowContactFormChange: (v: boolean) => void;
  contactMessage: string;
  onContactMessageChange: (v: string) => void;
  contactSending: boolean;
  contactSent: boolean;
  contactError: string;
  onContactInstaller: () => void;

  // Scheduler (inline in sidebar)
  scheduledDate: string | null;
  onScheduledDateChange: (date: string) => void;
  installerLeadTime: number;
  installerWorkingDays: string[];
  blackoutDates: { start_date: string; end_date: string }[];

  // Discount code (inline in sidebar)
  discountInput: string;
  onDiscountInputChange: (v: string) => void;
  discountApplied: { code: string; amount: number } | null;
  discountLoading: boolean;
  discountError: string;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;

  // Pulse trigger — called after "Find Max" updates inputs
  // UI_TRIGGER: When this fires, the 3D model should animate/highlight
  // to draw attention to the updated configuration.
  onPulseVisualizerTrigger?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Steps Definition
// ═══════════════════════════════════════════════════════════════════════════

const STEPS = [
  { id: 1, label: "Dimensions", icon: Ruler },
  { id: 2, label: "Configuration", icon: Settings2 },
  { id: 3, label: "Style", icon: Palette },
  { id: 4, label: "Summary", icon: ShoppingCart },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

/** Rolling number counter that "ticks" up/down smoothly */
function RollingPrice({ value }: { value: number }) {
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
function FocusFrame({
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
function SelectionCard({
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
function StudioToggle({
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

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function ConfiguratorSidebar(props: ConfiguratorSidebarProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [dimensionPulsing, setDimensionPulsing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // After "Find Max" is clicked and succeeds, pulse the dimension inputs
  const prevWallFitMsg = useRef(props.wallFitMsg);
  useEffect(() => {
    if (props.wallFitMsg && props.wallFitMsg !== prevWallFitMsg.current) {
      setDimensionPulsing(true);
      // UI_TRIGGER: Signal the 3D model to animate when Find Max updates values
      props.onPulseVisualizerTrigger?.();
      const t = setTimeout(() => setDimensionPulsing(false), 3600);
      prevWallFitMsg.current = props.wallFitMsg;
      return () => clearTimeout(t);
    }
    prevWallFitMsg.current = props.wallFitMsg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.wallFitMsg]);

  // Scroll to top when step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  const numCols = typeof props.cols === "number" ? props.cols : parseInt(props.cols as string) || 0;
  const numRows = typeof props.rows === "number" ? props.rows : parseInt(props.rows as string) || 0;

  // Navigate to next step
  const goNext = () => setActiveStep((s) => Math.min(4, s + 1));
  const goPrev = () => setActiveStep((s) => Math.max(1, s - 1));

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-zinc-950 lg:w-[38%] xl:w-[35%]">
      {/* ── Vertical Stepper (top) ─────────────────────────────────── */}
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

      {/* ── Scrollable Content Area ────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-dark">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-4 p-4"
          >
            {/* ════════════════════════════════════════════════════════════
                STEP 1: DIMENSIONS
            ════════════════════════════════════════════════════════════ */}
            {activeStep === 1 && (
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
                        className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs font-semibold text-emerald-400"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {props.zipResult.message}
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

                {/* Auto-Fit Wall Calculator */}
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
                  <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    <Maximize2 className="h-3.5 w-3.5 text-yellow-400" />
                    Auto-Fit Wall Calculator
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FocusFrame label="Wall Width (in)" pulsing={dimensionPulsing}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={props.wallWidth}
                        onChange={(e) => props.onWallWidthChange(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </FocusFrame>
                    <FocusFrame label="Wall Height (in)" pulsing={dimensionPulsing}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={props.wallHeight}
                        onChange={(e) => props.onWallHeightChange(e.target.value)}
                        placeholder="e.g. 96"
                        className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </FocusFrame>
                  </div>
                  <motion.button
                    onClick={() => {
                      props.onWallFit();
                    }}
                    disabled={!props.wallWidth || !props.wallHeight || props.buildLoading}
                    className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {props.buildLoading ? "Calculating..." : "Find Max Size"}
                  </motion.button>
                  {props.wallFitMsg && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 text-center text-xs font-semibold text-emerald-400"
                    >
                      {props.wallFitMsg}
                    </motion.p>
                  )}
                </section>

                {/* Manual Columns / Rows */}
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Grid Size
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FocusFrame label="Columns" pulsing={dimensionPulsing}>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={props.cols}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          props.onColsChange(v === "" ? "" : parseInt(v) || "");
                        }}
                        onBlur={() => {
                          const n = typeof props.cols === "number" ? props.cols : parseInt(props.cols as string);
                          props.onColsChange(Math.min(12, Math.max(1, n || 1)));
                        }}
                        className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </FocusFrame>
                    <FocusFrame label="Tiers High" pulsing={dimensionPulsing}>
                      <input
                        type="number"
                        min={1}
                        max={props.unitType === "mini" ? 4 : 10}
                        value={props.rows}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          props.onRowsChange(v === "" ? "" : parseInt(v) || "");
                        }}
                        onBlur={() => {
                          const n = typeof props.rows === "number" ? props.rows : parseInt(props.rows as string);
                          const maxT = props.unitType === "mini" ? 4 : 10;
                          props.onRowsChange(Math.min(maxT, Math.max(1, n || 1)));
                        }}
                        className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-600 focus:outline-none"
                      />
                    </FocusFrame>
                  </div>
                </section>

                {/* Continue Button */}
                <motion.button
                  onClick={goNext}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue to Configuration
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 2: CONFIGURATION
            ════════════════════════════════════════════════════════════ */}
            {activeStep === 2 && (
              <>
                {/* Unit Size Cards */}
                {!props.miniDisabled && (
                  <div>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Unit Size
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectionCard
                        selected={props.unitType === "standard"}
                        onSelect={() => {
                          props.onUnitTypeChange("standard");
                        }}
                      >
                        <div className="text-xs font-bold text-zinc-300">Standard</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">27 Gallon Totes</div>
                      </SelectionCard>
                      <SelectionCard
                        selected={props.unitType === "mini"}
                        onSelect={() => {
                          props.onUnitTypeChange("mini");
                          props.onOrientationChange("standard");
                        }}
                      >
                        <div className="text-xs font-bold text-zinc-300">Mini</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">6.5 Quart Totes</div>
                      </SelectionCard>
                    </div>
                  </div>
                )}

                {/* Orientation Cards (standard only) */}
                {props.unitType === "standard" && (
                  <div>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Tote Orientation
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectionCard
                        selected={props.orientation === "standard"}
                        onSelect={() => props.onOrientationChange("standard")}
                      >
                        <div className="text-xs font-bold text-zinc-300">Standard</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">30&quot; Deep</div>
                      </SelectionCard>
                      <SelectionCard
                        selected={props.orientation === "sideways"}
                        onSelect={() => props.onOrientationChange("sideways")}
                      >
                        <div className="text-xs font-bold text-zinc-300">Sideways</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">20&quot; Deep</div>
                      </SelectionCard>
                    </div>
                  </div>
                )}

                {/* Bestseller Presets */}
                {props.presetOptions.length > 0 && (
                  <section className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-yellow-400/80">
                      <Star className="h-3.5 w-3.5" />
                      Bestsellers
                    </h3>
                    <select
                      value={props.activePreset || ""}
                      onChange={(e) => props.onPresetChange(e.target.value || null)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                    >
                      <option value="">Custom Build</option>
                      {props.presetOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.units.map((u) => `${u.cols}x${u.rows}`).join(" + ")}
                        </option>
                      ))}
                    </select>
                    {props.activePreset && props.compoundBuild && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 space-y-3"
                      >
                        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/60 p-3">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                            Preset Includes
                          </div>
                          <ul className="space-y-1">
                            {props.compoundBuild.subUnits.map((su, i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-zinc-400">
                                <span className="font-medium text-zinc-300">
                                  {su.cols}W &times; {su.rows}H ({su.slots} slots)
                                </span>
                                <span>{su.totalW.toFixed(1)}&quot; &times; {su.totalH.toFixed(1)}&quot;</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <StudioToggle
                          checked={props.presetTotes}
                          onChange={props.onPresetTotesChange}
                          label={`Include Totes`}
                        />
                        <div className="flex items-center gap-3 border-t border-zinc-800 pt-3">
                          <div className="flex-1 text-center">
                            <div className="text-2xl font-black text-white">
                              {props.presetLoading ? "..." : <RollingPrice value={props.compoundBuild.totalPrice} />}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                              {props.compoundBuild.presetName}
                            </div>
                          </div>
                          <motion.button
                            onClick={props.onAddPresetUnit}
                            disabled={props.presetLoading}
                            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Plus className="h-4 w-4" />
                            Add to Quote
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                    {props.activePreset && !props.compoundBuild && props.presetLoading && (
                      <div className="mt-3 flex items-center justify-center gap-2 py-4 text-xs font-semibold text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculating preset...
                      </div>
                    )}
                  </section>
                )}

                {/* Continue Button */}
                <div className="flex gap-2">
                  <button
                    onClick={goPrev}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    Back
                  </button>
                  <motion.button
                    onClick={goNext}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Continue to Style
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 3: STYLE (Tote Selection + Add-ons)
            ════════════════════════════════════════════════════════════ */}
            {activeStep === 3 && (
              <>
                {/* Tote Style Cards — only for standard units */}
                {props.unitType === "standard" ? (
                  <div>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Tote Size
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectionCard
                        selected={props.toteType === "HDX"}
                        onSelect={() => props.onToteTypeChange("HDX")}
                      >
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                          19-3/4&quot; Opening
                        </div>
                        <div className="text-sm font-bold text-zinc-200">Standard</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                            HDX
                          </span>
                          <span className="inline-block rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                            Performax
                          </span>
                        </div>
                        <div className="mt-1.5 text-[9px] text-zinc-600">
                          Home Depot &middot; Menards
                        </div>
                      </SelectionCard>

                      <SelectionCard
                        selected={props.toteType === "GM"}
                        onSelect={() => {
                          props.onToteTypeChange("GM");
                          props.onToteColorChange("black");
                        }}
                      >
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                          20-3/4&quot; Opening
                        </div>
                        <div className="text-sm font-bold text-zinc-200">Wide</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="inline-block rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                            GreenMade
                          </span>
                          <span className="inline-block rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">
                            Project Source
                          </span>
                        </div>
                        <div className="mt-1.5 text-[9px] text-zinc-600">
                          Costco &middot; Lowe&apos;s &middot; Walmart
                        </div>
                      </SelectionCard>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tote Type</div>
                    <div className="mt-1 text-sm font-medium text-zinc-300">
                      6.5 Quart Clear Totes (Yellow Lids)
                    </div>
                  </div>
                )}

                {/* HDX Color Cards */}
                {props.toteType === "HDX" && props.hasTotes && props.unitType === "standard" && (
                  <div>
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      HDX Tote Style
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectionCard
                        selected={props.toteColor === "black"}
                        onSelect={() => props.onToteColorChange("black")}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-zinc-900">
                            <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-200">Black / Yellow</div>
                            <div className="text-[10px] text-zinc-500">
                              ${props.pricing?.standard_tote ?? props.platformDefaults.standard_tote}/tote
                            </div>
                          </div>
                        </div>
                      </SelectionCard>
                      <SelectionCard
                        selected={props.toteColor === "clear"}
                        onSelect={() => props.onToteColorChange("clear")}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-zinc-600 bg-gradient-to-b from-zinc-700 to-zinc-800">
                            <div className="h-2 w-4 rounded-sm bg-yellow-400" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-200">Clear / Yellow</div>
                            <div className="text-[10px] text-amber-400">
                              ${props.pricing?.standard_tote_clear ?? props.platformDefaults.standard_tote_clear}/tote
                            </div>
                          </div>
                        </div>
                      </SelectionCard>
                    </div>
                  </div>
                )}

                {/* Add-on Toggles */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Add-ons
                  </h3>
                  <StudioToggle
                    checked={props.hasTotes}
                    onChange={props.onHasTotesChange}
                    label={
                      props.unitType === "mini"
                        ? `Include Clear Totes (+$${props.pricing?.mini_tote ?? props.platformDefaults.mini_tote}/ea)`
                        : `Totes (+$${
                            props.toteType === "HDX" && props.toteColor === "clear"
                              ? (props.pricing?.standard_tote_clear ?? props.platformDefaults.standard_tote_clear)
                              : (props.pricing?.standard_tote ?? props.platformDefaults.standard_tote)
                          }/ea)`
                    }
                  />
                  <StudioToggle
                    checked={props.hasWheels}
                    onChange={props.onHasWheelsChange}
                    label={
                      props.unitType === "mini"
                        ? `Wheels (+$${props.pricing?.mini_wheels ?? props.platformDefaults.mini_wheels})`
                        : `Wheels (+$${props.pricing?.standard_wheels ?? props.platformDefaults.standard_wheels})`
                    }
                  />
                  {props.unitType === "standard" ? (
                    <StudioToggle
                      checked={props.hasTop}
                      onChange={props.onHasTopChange}
                      label={`Plywood Top (+$${props.pricing?.plywood_top ?? props.platformDefaults.plywood_top})`}
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-300">
                        Plywood Top (Included)
                      </span>
                    </div>
                  )}
                </div>

                {/* Current Unit Price + Add */}
                {!props.activePreset && (
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex-1 text-center">
                      <div className="text-2xl font-black text-white">
                        {props.buildLoading ? "..." : <RollingPrice value={props.build.price} />}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Current Unit
                      </div>
                    </div>
                    <motion.button
                      onClick={props.onAddUnit}
                      disabled={props.buildLoading || props.build.price === 0}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="h-4 w-4" />
                      Add to Quote
                    </motion.button>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex gap-2">
                  <button
                    onClick={goPrev}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    Back
                  </button>
                  <motion.button
                    onClick={goNext}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Review Summary
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 4: SUMMARY
            ════════════════════════════════════════════════════════════ */}
            {activeStep === 4 && (
              <>
                {/* Order Items */}
                {props.orderItems.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Your Quote
                    </h3>
                    <AnimatePresence>
                      {props.orderItems.map((item, index) => {
                        const extras: string[] = [];
                        if (item.hasTotes) {
                          if (item.toteType === "HDX" && item.unitType === "standard" && item.toteColor === "clear") {
                            extras.push("Clear Totes");
                          } else {
                            extras.push("Totes");
                          }
                        }
                        if (item.hasWheels) extras.push("Wheels");
                        if (item.hasTop) extras.push("Top");

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20, height: 0 }}
                            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-zinc-200">
                                Unit #{index + 1}: {item.desc}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {extras.length > 0 ? extras.join(", ") : "Frame Only"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-white">
                                ${item.price.toLocaleString()}
                              </span>
                              <button
                                onClick={() => props.onRemoveUnit(index)}
                                className="text-zinc-600 transition-colors hover:text-red-400"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </section>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center">
                    <ShoppingCart className="mx-auto h-8 w-8 text-zinc-700" />
                    <p className="mt-2 text-sm font-medium text-zinc-500">No units added yet</p>
                    <button
                      onClick={() => setActiveStep(3)}
                      className="mt-3 text-xs font-bold uppercase tracking-wider text-yellow-400 hover:text-yellow-300"
                    >
                      Go configure a unit
                    </button>
                  </div>
                )}

                {/* Contact Installer */}
                {props.installerId && !props.submitted && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    {!props.showContactForm && !props.contactSent ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-yellow-400/80">
                            Custom layouts, unique dimensions, special materials?
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            We build more than what&apos;s on screen.
                          </p>
                        </div>
                        <button
                          onClick={() => props.onShowContactFormChange(true)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </button>
                      </div>
                    ) : props.contactSent ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center"
                      >
                        <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
                        <p className="text-xs font-semibold text-zinc-200">Message Sent!</p>
                        <p className="text-[11px] text-zinc-500">
                          {props.brandingTitle || "The installer"} will get back to you shortly.
                        </p>
                      </motion.div>
                    ) : (
                      <div>
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                            <Mail className="h-3.5 w-3.5 text-yellow-400" />
                            Email {props.brandingTitle || "Installer"}
                          </span>
                          <button
                            onClick={() => props.onShowContactFormChange(false)}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="First Name"
                              value={props.firstName}
                              onChange={(e) => props.onFirstNameChange(e.target.value)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Last Name"
                              value={props.lastName}
                              onChange={(e) => props.onLastNameChange(e.target.value)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="email"
                              placeholder="Your Email"
                              value={props.email}
                              onChange={(e) => props.onEmailChange(e.target.value)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                            <input
                              type="tel"
                              placeholder="Phone (optional)"
                              value={props.phone}
                              onChange={(e) => props.onPhoneChange(e.target.value)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                          </div>
                          <textarea
                            value={props.contactMessage}
                            onChange={(e) => props.onContactMessageChange(e.target.value)}
                            placeholder="Describe your custom project..."
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                          />
                        </div>
                        {props.contactError && (
                          <p className="mt-1 text-xs font-medium text-red-400">{props.contactError}</p>
                        )}
                        <button
                          onClick={props.onContactInstaller}
                          disabled={props.contactSending || !props.contactMessage.trim()}
                          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {props.contactSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {props.contactSending ? "Sending..." : "Send Message"}
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Booking Form */}
                {props.orderItems.length > 0 && !props.submitted && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Your Details
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={props.firstName}
                          onChange={(e) => props.onFirstNameChange(e.target.value)}
                          placeholder="First Name *"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={props.lastName}
                          onChange={(e) => props.onLastNameChange(e.target.value)}
                          placeholder="Last Name *"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="email"
                          value={props.email}
                          onChange={(e) => props.onEmailChange(e.target.value)}
                          placeholder="Email *"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="tel"
                          value={props.phone}
                          onChange={(e) => props.onPhoneChange(e.target.value)}
                          placeholder="Phone *"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>

                      {/* Billing Address */}
                      <div className="pt-1">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Billing Address
                        </label>
                        <input
                          type="text"
                          value={props.streetAddress}
                          onChange={(e) => props.onStreetAddressChange(e.target.value)}
                          placeholder="Street Address"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={props.city}
                          onChange={(e) => props.onCityChange(e.target.value)}
                          placeholder="City"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={props.addrState}
                          onChange={(e) => props.onAddrStateChange(e.target.value)}
                          placeholder="State"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={props.addrZip}
                          onChange={(e) => props.onAddrZipChange(e.target.value)}
                          placeholder="Zip"
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                        />
                      </div>

                      {/* Hand-off banner */}
                      {props.handedOff && !props.zipOutOfArea && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"
                        >
                          <div className="mb-1 flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                            <p className="text-xs font-medium text-blue-300">
                              Routed to a local partner installer.
                            </p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            <strong className="text-zinc-400">{props.handoffInstallerName}</strong> will handle your build.
                          </p>
                        </motion.div>
                      )}

                      {/* Out of area waitlist */}
                      {props.zipOutOfArea && !props.waitlistSent && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                        >
                          <div className="mb-2 flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                            <p className="text-xs font-medium text-amber-300">{props.zipCheckMsg}</p>
                          </div>
                          <button
                            onClick={props.onWaitlist}
                            disabled={props.waitlistSending}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {props.waitlistSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                            {props.waitlistSending ? "Sending..." : "Notify Me When Available"}
                          </button>
                          {props.waitlistError && (
                            <p className="mt-2 text-xs font-medium text-red-400">{props.waitlistError}</p>
                          )}
                        </motion.div>
                      )}
                      {props.waitlistSent && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center"
                        >
                          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                          <p className="text-sm font-semibold text-zinc-200">You&apos;re on the List</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            We&apos;ll email you as soon as an installer is available.
                          </p>
                        </motion.div>
                      )}

                      {/* Installation address toggle */}
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 transition-colors hover:bg-zinc-800/50">
                        <input
                          type="checkbox"
                          checked={props.hasDifferentDelivery}
                          onChange={(e) => props.onHasDifferentDeliveryChange(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-600 accent-yellow-400"
                        />
                        <span className="text-xs font-medium text-zinc-400">
                          Installation address is different from billing
                        </span>
                      </label>

                      {/* Installation address fields */}
                      {props.hasDifferentDelivery && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-2 rounded-lg border border-yellow-400/10 bg-yellow-400/5 p-3"
                        >
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-yellow-400/60">
                            Installation Address
                          </label>
                          <input
                            type="text"
                            value={props.deliveryStreet}
                            onChange={(e) => props.onDeliveryStreetChange(e.target.value)}
                            placeholder="Street Address"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={props.deliveryCity}
                              onChange={(e) => props.onDeliveryCityChange(e.target.value)}
                              placeholder="City"
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={props.deliveryState}
                              onChange={(e) => props.onDeliveryStateChange(e.target.value)}
                              placeholder="State"
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={props.deliveryZip}
                              onChange={(e) => props.onDeliveryZipChange(e.target.value)}
                              placeholder="Zip"
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            />
                          </div>
                        </motion.div>
                      )}

                      {props.submitError && (
                        <p className="text-xs font-medium text-red-400">{props.submitError}</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Scheduler — pick a date inline */}
                {props.orderItems.length > 0 && !props.submitted && props.installerId && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-yellow-400" />
                      Pick a Date
                    </h3>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <NativeScheduler
                        leadTimeDays={props.installerLeadTime}
                        workingDays={props.installerWorkingDays}
                        blackoutDates={props.blackoutDates}
                        selectedDate={props.scheduledDate}
                        onSelectDate={props.onScheduledDateChange}
                      />
                    </div>
                    {props.scheduledDate && (
                      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 px-3 py-2 text-center text-xs font-semibold text-yellow-400">
                        Scheduled:{" "}
                        {new Date(props.scheduledDate + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* Discount Code — inline */}
                {props.orderItems.length > 0 && !props.submitted && props.installerId && (
                  <section>
                    {!props.discountApplied ? (
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          Discount Code
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={props.discountInput}
                            onChange={(e) => props.onDiscountInputChange(e.target.value.toUpperCase())}
                            placeholder="Enter code"
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                            onKeyDown={(e) => { if (e.key === "Enter") props.onApplyDiscount(); }}
                          />
                          <button
                            onClick={props.onApplyDiscount}
                            disabled={!props.discountInput.trim() || props.discountLoading}
                            className="rounded-lg bg-zinc-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-600 disabled:opacity-40"
                          >
                            {props.discountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                          </button>
                        </div>
                        {props.discountError && (
                          <p className="mt-1 text-xs text-red-400">{props.discountError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                        <Tag className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="flex-1 text-xs font-semibold text-emerald-400">
                          {props.discountApplied.code} — ${props.discountApplied.amount} off
                        </span>
                        <button onClick={props.onRemoveDiscount} className="text-zinc-500 hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Submitted confirmation */}
                {props.submitted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-8 text-center"
                  >
                    <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                    <p className="text-lg font-bold text-white">Booking Received!</p>
                    <p className="mt-1 text-sm text-zinc-500">We&apos;ll reach out within 24 hours.</p>
                  </motion.div>
                )}

                {/* Back button */}
                <button
                  onClick={goPrev}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                >
                  Back
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sticky Frosted-Glass Footer — Pricing + CTA ──────────── */}
      <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/80 px-4 py-4 backdrop-blur-xl"
        style={{
          background: "linear-gradient(to top, rgba(9,9,11,0.95), rgba(9,9,11,0.85))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Grand Total */}
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {props.orderItems.length > 0 ? "Grand Total" : "Current Unit"}
            </div>
            <div className="text-3xl font-black text-white">
              <RollingPrice value={props.orderItems.length > 0 ? props.grandTotal : props.build.price} />
            </div>
          </div>
          <div className="text-right">
            {props.deliveryFeeAmount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Truck className="h-3 w-3 text-amber-400" />
                +${props.deliveryFeeAmount} delivery
              </div>
            )}
            {props.stripeAccountId && props.orderItems.length > 0 && (
              <div className="text-[10px] text-zinc-500">
                Deposit ({props.depositLabelText}):{" "}
                <span className="font-bold text-yellow-400">${props.depositAmount.toLocaleString()}</span>
              </div>
            )}
            {props.orderItems.length > 0 && (
              <div className="text-[10px] text-zinc-600">
                {props.orderItems.length} unit{props.orderItems.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && (
          <motion.button
            onClick={props.isDemo ? props.onDemoToast : props.onBookDeposit}
            disabled={props.submitting}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider shadow-lg transition-all disabled:opacity-50 ${
              props.isDemo
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-yellow-400 text-zinc-900 shadow-yellow-400/20 hover:bg-yellow-300"
            }`}
            whileHover={props.isDemo ? {} : { scale: 1.01, y: -1 }}
            whileTap={props.isDemo ? {} : { scale: 0.99 }}
          >
            {props.submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : props.stripeAccountId ? (
              <CreditCard className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {props.isDemo
              ? "Demo Mode"
              : props.submitting
              ? "Submitting..."
              : props.stripeAccountId
              ? `Pay $${props.depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} & Book`
              : "Submit Quote Request"}
          </motion.button>
        )}

        {props.orderItems.length === 0 && activeStep !== 4 && (
          <motion.button
            onClick={props.onAddUnit}
            disabled={props.buildLoading || props.build.price === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Add to Quote
          </motion.button>
        )}

        {props.orderItems.length > 0 && !props.submitted && !props.zipOutOfArea && (
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            By placing this order, you agree to our{" "}
            <a href="/terms" className="underline hover:text-yellow-400">Terms of Service</a>.
          </p>
        )}
      </div>
    </aside>
  );
}
