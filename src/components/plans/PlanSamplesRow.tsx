"use client";

// Both plan samples side by side — the 3D guide and the PDF — opening the
// same lightbox the designer uses. A server page can't hold the lightbox
// state, so it renders this.

import { useState } from "react";
import { Box, FileText } from "lucide-react";

import { PlanSampleLightbox, PlanSampleThumb } from "@/components/plans/PlanSample";
import type { TotePlanTier } from "@/lib/tote-plans";

export default function PlanSamplesRow() {
  const [open, setOpen] = useState<TotePlanTier | null>(null);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-300">
            <Box className="h-3.5 w-3.5 text-yellow-400" aria-hidden /> Interactive 3D guide
          </p>
          <PlanSampleThumb tier="interactive" onOpen={() => setOpen("interactive")} />
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-300">
            <FileText className="h-3.5 w-3.5 text-yellow-400" aria-hidden /> Printable PDF
          </p>
          <PlanSampleThumb tier="pdf" onOpen={() => setOpen("pdf")} />
        </div>
      </div>
      {open && <PlanSampleLightbox tier={open} onClose={() => setOpen(null)} />}
    </>
  );
}
