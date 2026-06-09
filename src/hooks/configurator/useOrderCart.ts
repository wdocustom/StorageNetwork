import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateBuild, type UnitType, type Orientation } from "@/app/actions/calculator";
import { SHELVING_CONFIGS } from "@/lib/shelving";
import { OVERHEAD_GRID_PRESETS } from "@/lib/overhead-storage";
import { RAISED_BED_SIZES } from "@/lib/raised-beds";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { UnitConfig, ToteType, ToteColor } from "./types";

function buildMultiUnitItem(
  item: UnitConfig,
  expandedIdx: number,
  unitVisibility: Record<number, boolean>,
) {
  const shelvingConfig3D = item.shelvingConfigId
    ? (() => {
        const cfg = SHELVING_CONFIGS.find((c) => c.id === item.shelvingConfigId);
        return cfg ? { widthIn: cfg.widthIn, frameH: cfg.frameH, depth: cfg.depth, shelves: cfg.shelves } : undefined;
      })()
    : undefined;
  return {
    cols: item.cols,
    rows: item.rows,
    toteType: item.toteType,
    toteColor: item.toteColor,
    unitType: item.unitType,
    orientation: item.orientation,
    hasTotes: item.hasTotes,
    hasWheels: item.hasWheels,
    hasTop: item.hasTop,
    totalW: item.totalW,
    totalH: item.totalH,
    depth: item.depth,
    addons: item.addons,
    paintFrameColor: item.paintFrameColor,
    paintDoorColor: item.paintDoorColor,
    paintSidePanelColor: item.paintSidePanelColor,
    shelvingConfigId: item.shelvingConfigId,
    shelvingConfig: shelvingConfig3D,
    overheadStorageConfig: item.overheadStorageConfig
      ? (() => {
          const cfg = item.overheadStorageConfig;
          const preset = OVERHEAD_GRID_PRESETS.find((p) => p.id === cfg.gridPresetId);
          return preset ? { slotsWide: preset.slotsWide, slotsDeep: preset.slotsDeep, toteType: cfg.toteType } : undefined;
        })()
      : undefined,
    raisedBedConfig: item.raisedBedConfig
      ? (() => {
          const bed = RAISED_BED_SIZES.find((s) => s.id === item.raisedBedConfig!.sizeId);
          return bed ? {
            widthIn: bed.widthIn,
            lengthIn: bed.lengthIn,
            heightIn: bed.heightIn,
            hasLegs: bed.style === "with_legs",
            groundClearance: bed.groundClearance,
            pestCover: item.raisedBedConfig!.pestCover,
            finish: item.raisedBedConfig!.finish,
            hasStringLightPost: bed.hasStringLightPost,
            postHeightIn: bed.postHeightIn,
          } : undefined;
        })()
      : undefined,
    chairConfig: item.chairConfig
      ? { finish: item.chairConfig.finish }
      : undefined,
    presetUnits: item.presetUnits,
    drawerSlideRows: item.drawerSlideRows,
    drawerSlideColumns: item.drawerSlideColumns,
    visible: unitVisibility[expandedIdx] !== false,
    desc: item.desc,
  };
}

interface UseOrderCartParams {
  initialConfig: Record<string, unknown> | null | undefined;
  pricing: DesignPageViewModel["pricing"] | undefined;
}

export function useOrderCart({ initialConfig, pricing }: UseOrderCartParams) {
  const [orderItems, setOrderItems] = useState<UnitConfig[]>([]);
  const [unitVisibility, setUnitVisibility] = useState<Record<number, boolean>>({});
  const [showMultiUnit3D, setShowMultiUnit3D] = useState(false);

  const initialStep = initialConfig ? (Array.isArray(initialConfig.units) ? 4 : typeof initialConfig.cols === "number" ? 3 : 1) : 1;
  const [sidebarStep, setSidebarStep] = useState(initialStep);

  // Step ↔ multiUnit3D sync
  useEffect(() => {
    if (sidebarStep === 4 && orderItems.length > 0) {
      setShowMultiUnit3D(true);
    } else if (sidebarStep <= 3) {
      setShowMultiUnit3D(false);
    }
  }, [sidebarStep, orderItems.length]);

  // Apply initial config from URL param (multi-unit)
  const configApplied = useRef(false);
  useEffect(() => {
    if (!initialConfig || configApplied.current) return;
    configApplied.current = true;

    if (Array.isArray(initialConfig.units)) {
      const cfgUnits = initialConfig.units as Array<Record<string, unknown>>;
      (async () => {
        for (const u of cfgUnits) {
          const result = await calculateBuild({
            cols: (u.cols as number) || 4,
            rows: (u.rows as number) || 4,
            toteModel: (u.toteType as "HDX" | "GM") || "HDX",
            toteColor: (u.toteColor as "black" | "clear") || "black",
            unitType: (u.unitType as "standard" | "mini") || "standard",
            orientation: (u.orientation as "standard" | "sideways") || "standard",
            addOns: { totes: u.hasTotes !== false, wheels: !!u.hasWheels, top: !!u.hasTop },
            mode: "manual",
            installerPricing: pricing,
          });
          if ("price" in result) {
            const colorLabel = u.hasTotes !== false && u.toteColor === "clear" ? " (Clear Totes)" : "";
            setOrderItems((prev) => [...prev, {
              cols: result.cols, rows: result.rows,
              toteType: (u.toteType as ToteType) || "HDX",
              toteColor: (u.toteColor as ToteColor) || "black",
              unitType: (u.unitType as UnitType) || "standard",
              orientation: (u.orientation as Orientation) || "standard",
              hasTotes: u.hasTotes !== false, hasWheels: !!u.hasWheels, hasTop: !!u.hasTop,
              price: result.price,
              totalW: result.dimensions.totalW, totalH: result.dimensions.totalH, depth: result.dimensions.depth,
              desc: `Standard: ${result.cols}W × ${result.rows}H${colorLabel}`,
              addons: [],
            }]);
          }
        }
      })();
    }
    // Single unit and preset configs are handled by the orchestrator setting state on useUnitBuilder/usePresets
  }, [initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // multiUnitItems is the SHAPE of the cart for consumers that need cart
  // data (the 2D blueprint fallback in particular). It is intentionally NOT
  // gated on showMultiUnit3D: when the user steps back from 4 to 3 to edit a
  // previously-configured unit, the cart contents must remain available so
  // the 2D path can keep rendering the configured rack instead of falling
  // back to stale builder state (which is what caused the 6-high → 5-high
  // reversion bug). The step-gated showMultiUnit3D flag still controls
  // whether the 3D scene swaps to the multi-unit composition.
  const multiUnitItems = useMemo(() => {
    if (orderItems.length === 0) return undefined;
    const items: Array<ReturnType<typeof buildMultiUnitItem>> = [];
    let expandedIdx = 0;
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) {
        items.push(buildMultiUnitItem(item, expandedIdx, unitVisibility));
        expandedIdx++;
      }
    }
    return items;
  }, [orderItems, unitVisibility]);

  const expandedMultiUnitDescs = useMemo(() => {
    const descs: Array<{ desc: string }> = [];
    for (const item of orderItems) {
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) {
        descs.push({ desc: qty > 1 ? `${item.desc} (#${q + 1})` : item.desc });
      }
    }
    return descs;
  }, [orderItems]);

  const anyHasWheels = useMemo(() => orderItems.some((it) => it.hasWheels), [orderItems]);
  const maxCols = useMemo(() => orderItems.reduce((max, it) => Math.max(max, it.cols), 0), [orderItems]);

  const handleRemoveUnit = useCallback((index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleQuantityChange = useCallback((index: number, quantity: number) => {
    setOrderItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item)),
    );
  }, []);

  const handleToggleAllUnits = useCallback((visible: boolean, items: UnitConfig[]) => {
    const newVis: Record<number, boolean> = {};
    let idx = 0;
    items.forEach((item) => {
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) { newVis[idx++] = visible; }
    });
    setUnitVisibility(newVis);
  }, []);

  const handleUnitVisibilityChange = useCallback((index: number, visible: boolean) => {
    setUnitVisibility((prev) => ({ ...prev, [index]: visible }));
  }, []);

  return {
    orderItems, setOrderItems,
    unitVisibility,
    showMultiUnit3D, setShowMultiUnit3D,
    sidebarStep, setSidebarStep,
    initialStep,
    multiUnitItems,
    expandedMultiUnitDescs,
    anyHasWheels,
    maxCols,
    handleRemoveUnit,
    handleQuantityChange,
    handleToggleAllUnits,
    handleUnitVisibilityChange,
  };
}
