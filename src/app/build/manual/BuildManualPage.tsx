"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import BuildManual from "@/components/BuildManual";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function BuildManualPage() {
  const searchParams = useSearchParams();

  const config = useMemo(() => {
    const cols = clamp(Number(searchParams.get("cols")) || 3, 1, 10);
    const rows = clamp(Number(searchParams.get("rows")) || 3, 1, 8);
    const toteParam = searchParams.get("tote");
    const toteType = toteParam === "GM" ? "GM" as const : "HDX" as const;
    const hasWheels = searchParams.get("wheels") === "1";
    const hasTop = searchParams.get("top") === "1";
    const jobId = searchParams.get("job") ?? undefined;

    return { cols, rows, toteType, hasWheels, hasTop, jobId };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-950">
      <BuildManual
        cols={config.cols}
        rows={config.rows}
        toteType={config.toteType}
        hasWheels={config.hasWheels}
        hasTop={config.hasTop}
        jobId={config.jobId}
      />
    </div>
  );
}
