import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateBuild, type UnitType, type Orientation } from "@/app/actions/calculator";
import type { SectionAddon, PaintColorId } from "@/types/viewModels";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { ServerBuild, ToteType, ToteColor } from "./types";

interface UseUnitBuilderParams {
  pricing: DesignPageViewModel["pricing"] | undefined;
  globalTotesDisabled: boolean;
}

export function useUnitBuilder({ pricing, globalTotesDisabled }: UseUnitBuilderParams) {
  const [wallWidth, setWallWidth] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [wallFitMsg, setWallFitMsg] = useState("");

  const [unitType, setUnitType] = useState<UnitType>("standard");
  const [orientation, setOrientation] = useState<Orientation>("standard");
  const [cols, setCols] = useState<number | string>(4);
  const [rows, setRows] = useState<number | string>(4);
  const [toteType, setToteType] = useState<ToteType>("HDX");
  const [toteColor, setToteColor] = useState<ToteColor>("black");
  const [hasTotes, setHasTotes] = useState(true);
  const [hasWheels, setHasWheels] = useState(true);
  const [hasTop, setHasTop] = useState(true);
  const [addons, setAddons] = useState<SectionAddon[]>([]);
  const [indoorDelivery, setIndoorDelivery] = useState(false);

  const [paintFrameColor, setPaintFrameColor] = useState<PaintColorId | null>(null);
  const [paintDoorColor, setPaintDoorColor] = useState<PaintColorId | null>(null);
  const [paintSidePanelColor, setPaintSidePanelColor] = useState<PaintColorId | null>(null);

  const [build, setBuild] = useState<ServerBuild>({
    cols: 4, rows: 4, price: 0, totalW: 0, totalH: 0, depth: 30, slots: 0, unitType: "standard", orientation: "standard",
  });
  const [buildLoading, setBuildLoading] = useState(false);

  const numCols = useMemo(() => typeof cols === "number" ? cols : parseInt(cols as string) || 0, [cols]);
  const numRows = useMemo(() => typeof rows === "number" ? rows : parseInt(rows as string) || 0, [rows]);
  const effectiveHasTop = useMemo(() => unitType === "mini" ? true : hasTop, [unitType, hasTop]);
  const effectiveOrientation: Orientation = useMemo(() => unitType === "standard" ? orientation : "standard", [unitType, orientation]);
  const effectiveToteColor: ToteColor = useMemo(
    () => (toteType === "HDX" && unitType === "standard" && hasTotes) ? toteColor : "black",
    [toteType, unitType, hasTotes, toteColor],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBuild = useCallback(
    (
      c: number,
      r: number,
      model: ToteType,
      color: ToteColor,
      unit: UnitType,
      orient: Orientation,
      totes: boolean,
      wheels: boolean,
      top: boolean,
      sectionAddons?: SectionAddon[],
    ) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setBuildLoading(true);
        try {
          const res = await calculateBuild({
            cols: c,
            rows: r,
            toteModel: model,
            toteColor: color,
            unitType: unit,
            orientation: orient,
            addOns: { totes, wheels, top },
            mode: "manual",
            installerPricing: pricing,
            sectionAddons,
          });
          if (res.success) {
            setBuild({
              cols: res.cols,
              rows: res.rows,
              price: res.price,
              totalW: res.dimensions.totalW,
              totalH: res.dimensions.totalH,
              depth: res.dimensions.depth,
              slots: res.config.slots,
              unitType: res.config.unitType,
              orientation: res.config.orientation,
            });
          }
        } catch {
          // keep previous build on error
        } finally {
          setBuildLoading(false);
        }
      }, 500);
    },
    [pricing],
  );

  // Fire on every config change
  useEffect(() => {
    if (numCols >= 1 && numRows >= 1) {
      fetchBuild(numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, addons);
    }
  }, [numCols, numRows, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, addons, fetchBuild]);

  // Re-trigger auto-fit when unitType changes
  const prevUnitTypeRef = useRef(unitType);
  useEffect(() => {
    if (prevUnitTypeRef.current !== unitType) {
      prevUnitTypeRef.current = unitType;
      const wW = parseFloat(wallWidth);
      const wH = parseFloat(wallHeight);
      if (wW > 0 && wH > 0) {
        handleWallFit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitType]);

  // Re-trigger auto-fit when orientation changes
  const prevOrientationRef = useRef(effectiveOrientation);
  useEffect(() => {
    if (prevOrientationRef.current !== effectiveOrientation) {
      prevOrientationRef.current = effectiveOrientation;
      const wW = parseFloat(wallWidth);
      const wH = parseFloat(wallHeight);
      if (wW > 0 && wH > 0) {
        handleWallFit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrientation]);

  // Force hasTotes off when installer has totes globally disabled
  useEffect(() => {
    if (globalTotesDisabled && hasTotes) {
      setHasTotes(false);
    }
  }, [globalTotesDisabled, hasTotes]);

  const handleWallFit = useCallback(async () => {
    const wW = parseFloat(wallWidth);
    const wH = parseFloat(wallHeight);
    if (!wW || !wH) return;

    setBuildLoading(true);
    try {
      const res = await calculateBuild({
        wallWidth: wW,
        wallHeight: wH,
        toteModel: toteType,
        toteColor: effectiveToteColor,
        unitType,
        orientation: effectiveOrientation,
        addOns: { totes: hasTotes, wheels: hasWheels, top: effectiveHasTop },
        mode: "wallFit",
        installerPricing: pricing,
      });
      if (res.success) {
        setCols(res.cols);
        setRows(res.rows);
        setBuild({
          cols: res.cols,
          rows: res.rows,
          price: res.price,
          totalW: res.dimensions.totalW,
          totalH: res.dimensions.totalH,
          depth: res.dimensions.depth,
          slots: res.config.slots,
          unitType: res.config.unitType,
          orientation: res.config.orientation,
        });
        setWallFitMsg(
          `Max fit: ${res.cols} Wide × ${res.rows} High for that wall.`,
        );
      }
    } catch {
      // keep previous state on error
    } finally {
      setBuildLoading(false);
    }
  }, [wallWidth, wallHeight, toteType, effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, pricing]);

  const handleScanWizardComplete = useCallback(async (width: number, height: number | undefined, toteConfigKey: "HDX" | "GM") => {
    const effectiveHeight = height ?? 96;
    setWallWidth(width.toFixed(1));
    setWallHeight(effectiveHeight.toFixed(1));
    setToteType(toteConfigKey);
    setWallFitMsg(`AI measured: ${width.toFixed(1)}" wide × ${effectiveHeight.toFixed(1)}" tall${!height ? " (default height)" : ""}`);
    setBuildLoading(true);
    try {
      const res = await calculateBuild({
        wallWidth: width,
        wallHeight: effectiveHeight,
        toteModel: toteConfigKey,
        toteColor: effectiveToteColor,
        unitType,
        orientation: effectiveOrientation,
        addOns: { totes: hasTotes, wheels: hasWheels, top: effectiveHasTop },
        mode: "wallFit",
        installerPricing: pricing,
      });
      if (res.success) {
        setCols(res.cols);
        setRows(res.rows);
        setBuild({
          cols: res.cols,
          rows: res.rows,
          price: res.price,
          totalW: res.dimensions.totalW,
          totalH: res.dimensions.totalH,
          depth: res.dimensions.depth,
          slots: res.config.slots,
          unitType: res.config.unitType,
          orientation: res.config.orientation,
        });
        setWallFitMsg(
          `AI measured: ${width.toFixed(1)}" × ${effectiveHeight.toFixed(1)}"${!height ? " (default height)" : ""} — Max fit: ${res.cols} Wide × ${res.rows} High`,
        );
      }
    } catch {
      // keep previous state on error
    } finally {
      setBuildLoading(false);
    }
  }, [effectiveToteColor, unitType, effectiveOrientation, hasTotes, hasWheels, effectiveHasTop, pricing]);

  const resetForNewUnit = useCallback(() => {
    setAddons([]);
    setPaintFrameColor(null);
    setPaintDoorColor(null);
    setPaintSidePanelColor(null);
    setHasWheels(true);
    setHasTop(true);
    setHasTotes(true);
    setIndoorDelivery(false);
  }, []);

  return {
    wallWidth, setWallWidth,
    wallHeight, setWallHeight,
    wallFitMsg, setWallFitMsg,
    unitType, setUnitType,
    orientation, setOrientation,
    cols, setCols,
    rows, setRows,
    toteType, setToteType,
    toteColor, setToteColor,
    hasTotes, setHasTotes,
    hasWheels, setHasWheels,
    hasTop, setHasTop,
    addons, setAddons,
    indoorDelivery, setIndoorDelivery,
    paintFrameColor, setPaintFrameColor,
    paintDoorColor, setPaintDoorColor,
    paintSidePanelColor, setPaintSidePanelColor,
    build, setBuild,
    buildLoading,
    numCols, numRows,
    effectiveHasTop,
    effectiveOrientation,
    effectiveToteColor,
    fetchBuild,
    handleWallFit,
    handleScanWizardComplete,
    resetForNewUnit,
  };
}
