import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateShelvingUnit } from "@/app/actions/calculator";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { RAISED_BED_SIZES, type RaisedBedConfig } from "@/lib/raised-beds";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";
import type { ShelvingConfig3D } from "@/components/visualizer/RackVisualizer";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { UnitConfig, ToteType, ToteColor } from "./types";

interface UseProductAddonsParams {
  pricing: DesignPageViewModel["pricing"] | undefined;
  servicesConfig: DesignPageViewModel["servicesConfig"] | undefined;
  setOrderItems: React.Dispatch<React.SetStateAction<UnitConfig[]>>;
}

export function useProductAddons({ pricing, servicesConfig, setOrderItems }: UseProductAddonsParams) {
  const [shelvingConfigId, setShelvingConfigId] = useState<string | null>(null);
  const [shelvingPrice, setShelvingPrice] = useState<number | null>(null);
  const [shelvingLoading, setShelvingLoading] = useState(false);

  const [raisedBedPreview, setRaisedBedPreview] = useState<{
    widthIn: number; lengthIn: number; heightIn: number; hasLegs: boolean;
    groundClearance: number; pestCover: string; finish: string;
    hasStringLightPost?: boolean; postHeightIn?: number;
  } | null>(null);
  const [raisedBedPreviewPrice, setRaisedBedPreviewPrice] = useState<number | null>(null);

  const [overheadPreview, setOverheadPreview] = useState<{
    slotsWide: number; slotsDeep: number; toteType: "HDX" | "GM"; hasTotes: boolean;
  } | null>(null);

  const [selectedCleanout, setSelectedCleanout] = useState<string | null>(null);

  // Calculate shelving price when selection changes
  useEffect(() => {
    if (!shelvingConfigId) { setShelvingPrice(null); return; }
    setShelvingLoading(true);
    calculateShelvingUnit({ configId: shelvingConfigId, installerPricing: pricing })
      .then((res) => { if (res.success) setShelvingPrice(res.price); })
      .finally(() => setShelvingLoading(false));
  }, [shelvingConfigId, pricing]);

  const activeShelvingConfig: ShelvingConfig3D | undefined = useMemo(() => {
    if (!shelvingConfigId) return undefined;
    const cfg = SHELVING_CONFIGS.find((c) => c.id === shelvingConfigId);
    if (!cfg) return undefined;
    return { widthIn: cfg.widthIn, frameH: cfg.frameH, depth: cfg.depth, shelves: cfg.shelves };
  }, [shelvingConfigId]);

  const cleanoutPrice = useMemo(() => {
    if (!selectedCleanout || !servicesConfig) return 0;
    const svc = servicesConfig.find((s) => s.id === selectedCleanout);
    return svc?.price ?? 0;
  }, [selectedCleanout, servicesConfig]);

  const handleAddShelvingUnit = useCallback(() => {
    if (!shelvingConfigId || shelvingPrice == null) return;
    const cfg = SHELVING_CONFIGS.find((c) => c.id === shelvingConfigId);
    if (!cfg) return;
    const heightLabel = cfg.height === "tall" ? "Tall" : "Short";
    setOrderItems((prev) => [
      ...prev,
      {
        cols: 0,
        rows: 0,
        toteType: "HDX" as ToteType,
        toteColor: "black" as ToteColor,
        unitType: "standard",
        orientation: "standard",
        hasTotes: false,
        hasWheels: false,
        hasTop: true,
        price: shelvingPrice,
        totalW: cfg.widthIn,
        totalH: cfg.frameH,
        depth: cfg.depth,
        desc: `Open Shelving: ${cfg.widthFt}' × ${heightLabel} (${cfg.shelves} ${cfg.shelves === 1 ? "shelf" : "shelves"})`,
        addons: [],
        shelvingConfigId: cfg.id,
      },
    ]);
    setShelvingConfigId(null);
    setShelvingPrice(null);
  }, [shelvingConfigId, shelvingPrice, setOrderItems]);

  const handleAddRaisedBed = useCallback((
    config: RaisedBedConfig,
    price: number,
    desc: string,
  ) => {
    const bed = RAISED_BED_SIZES.find((s) => s.id === config.sizeId);
    setOrderItems((prev) => [
      ...prev,
      {
        cols: 0,
        rows: 0,
        toteType: "HDX" as ToteType,
        toteColor: "black" as ToteColor,
        unitType: "standard",
        orientation: "standard",
        hasTotes: false,
        hasWheels: false,
        hasTop: false,
        price,
        totalW: bed?.lengthIn || 48,
        totalH: bed?.heightIn || 16.5,
        depth: bed?.widthIn || 24,
        desc,
        addons: [],
        raisedBedConfig: config,
      } as UnitConfig,
    ]);
  }, [setOrderItems]);

  const handleAddOverheadUnit = useCallback((
    result: import("@/lib/overhead-storage").OverheadStorageResult,
    config: import("@/lib/overhead-storage").OverheadStorageConfig,
  ) => {
    const desc = `Ceiling Tote Rail: ${result.slotsWide}×${result.slotsDeep} (${result.toteCount} totes, ${result.toteType})`;
    setOrderItems((prev) => [
      ...prev,
      {
        cols: 0,
        rows: 0,
        toteType: result.toteType as ToteType,
        toteColor: "black" as ToteColor,
        unitType: "standard",
        orientation: "standard",
        hasTotes: config.hasTotes,
        hasWheels: false,
        hasTop: false,
        price: result.price,
        totalW: result.systemWidthIn,
        totalH: 10,
        depth: result.systemDepthIn,
        desc,
        addons: [],
        overheadStorageConfig: config,
      } as UnitConfig,
    ]);
  }, [setOrderItems]);

  return {
    shelvingConfigId, setShelvingConfigId,
    shelvingPrice,
    shelvingLoading,
    activeShelvingConfig,
    raisedBedPreview, setRaisedBedPreview,
    raisedBedPreviewPrice, setRaisedBedPreviewPrice,
    overheadPreview, setOverheadPreview,
    selectedCleanout, setSelectedCleanout,
    cleanoutPrice,
    handleAddShelvingUnit,
    handleAddRaisedBed,
    handleAddOverheadUnit,
  };
}
