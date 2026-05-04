import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateCompoundBuild, type CompoundBuildResult } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { VisualizerSubUnit } from "@/components/visualizer/RackVisualizer";

interface UsePresetsParams {
  pricing: DesignPageViewModel["pricing"] | undefined;
  globalTotesDisabled: boolean;
}

export function usePresets({ pricing, globalTotesDisabled }: UsePresetsParams) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [compoundBuild, setCompoundBuild] = useState<CompoundBuildResult | null>(null);
  const [presetTotes, setPresetTotes] = useState(true);
  const [presetLoading, setPresetLoading] = useState(false);
  const presetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePresetObj = useMemo(
    () => activePreset ? BESTSELLER_PRESETS.find((p) => p.id === activePreset) ?? null : null,
    [activePreset],
  );

  const presetVisUnits: VisualizerSubUnit[] | undefined = useMemo(() => {
    if (!compoundBuild || !activePresetObj) return undefined;
    return compoundBuild.subUnits.map((su, i) => ({
      cols: su.cols,
      rows: su.rows,
      totalW: su.totalW,
      totalH: su.totalH,
      hasTop: activePresetObj.units[i].hasTop,
      hasWheels: activePresetObj.units[i].hasWheels,
    }));
  }, [compoundBuild, activePresetObj]);

  const fetchPresetBuild = useCallback(
    (presetId: string, totes: boolean) => {
      if (presetDebounceRef.current) clearTimeout(presetDebounceRef.current);
      presetDebounceRef.current = setTimeout(async () => {
        setPresetLoading(true);
        try {
          const res = await calculateCompoundBuild({
            presetId,
            hasTotes: totes,
            installerPricing: pricing,
          });
          if (res.success) {
            setCompoundBuild(res);
          }
        } catch {
          // keep previous build on error
        } finally {
          setPresetLoading(false);
        }
      }, 300);
    },
    [pricing],
  );

  // Force totes off when installer has totes globally disabled or preset has totesDisabled
  useEffect(() => {
    if ((globalTotesDisabled || activePresetObj?.totesDisabled) && presetTotes) {
      setPresetTotes(false);
    }
  }, [activePresetObj, presetTotes, globalTotesDisabled]);

  // Re-fetch preset build when totes toggle changes
  useEffect(() => {
    if (activePreset) {
      fetchPresetBuild(activePreset, activePresetObj?.totesDisabled ? false : presetTotes);
    }
  }, [activePreset, presetTotes, fetchPresetBuild, activePresetObj]);

  return {
    activePreset, setActivePreset,
    compoundBuild, setCompoundBuild,
    presetTotes, setPresetTotes,
    presetLoading,
    activePresetObj,
    presetVisUnits,
    fetchPresetBuild,
  };
}
