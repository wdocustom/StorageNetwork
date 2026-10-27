"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Studio booking sheet — the configurator's own "Book Install" step (order
// review, discount, cleanout, contact + address, service-area waitlist,
// schedule, trial-cap waitlist) and its footer CTA, unchanged, in a sheet
// over the designer. "Back" / "Add another unit" return to the design.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ConfiguratorSidebarProps } from "@/components/design/configurator-types";
import StepSummary from "@/components/design/steps/StepSummary";
import ConfiguratorFooter from "@/components/design/ConfiguratorFooter";

const BOOK_STEP = 4;

export default function StudioBookingSheet({
  open,
  props,
  onClose,
}: {
  open: boolean;
  props: ConfiguratorSidebarProps;
  onClose: () => void;
}) {
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const detailsFilled = !!(
    props.firstName.trim() &&
    props.lastName.trim() &&
    props.email.trim() &&
    props.phone.trim() &&
    props.streetAddress.trim() &&
    props.city.trim() &&
    props.addrState.trim() &&
    props.addrZip.trim()
  );
  // The step's "Edit" / "Add another unit" / "Back" all mean: back to the design
  const toStep = (step: number) => {
    if (step < BOOK_STEP) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book your install"
      className="fixed inset-y-0 left-0 z-40 flex w-full flex-col bg-zinc-950 lg:w-[40%] lg:border-r lg:border-zinc-800 xl:w-[38%]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to design
        </button>
        <h2 className="ml-auto pr-2 text-sm font-bold text-white">Book your install</h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <StepSummary
          props={props}
          hasQuoteItems={props.orderItems.length > 0}
          detailsCollapsed={detailsCollapsed}
          setDetailsCollapsed={setDetailsCollapsed}
          detailsFilled={detailsFilled}
          setActiveStep={toStep}
          goPrev={onClose}
        />
        {/* Total, trust row and DIY alternative close out the form instead of
            pinning a third of a phone screen; the form has its own CTA. */}
        <ConfiguratorFooter props={props} activeStep={BOOK_STEP} detailsFilled={detailsFilled} setActiveStep={toStep} docked={false} />
      </div>
    </div>
  );
}
