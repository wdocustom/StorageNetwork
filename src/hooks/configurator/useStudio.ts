import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS, type BestsellerPreset } from "@/lib/presets";
import {
  DEFAULT_TOTE_UNIT,
  normalizeToteUnit,
  presetOfItem,
  presetOrderItem,
  presetTotesChoice,
  pruneAddons,
  studioItemKind,
  studioPaintCost,
  toteOptionsOf,
  toteUnitDesc,
  toteUnitSignature,
  type StudioPaintPrices,
  type StudioRules,
  type ToteUnitOptions,
} from "@/lib/studio";
import type { PaintColorId, SectionAddon } from "@/types/viewModels";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { UnitConfig } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// useStudio — the single-page designer's state on top of the order cart.
//
// The cart IS the design: the selected item is edited in place and every tote
// unit / bestseller is re-priced with the installer's own rates as soon as its
// options change. `repricing` stays true until every line's price matches its
// options, and booking waits for it, so a stale price is never submitted.
// ═══════════════════════════════════════════════════════════════════════════

type Pricing = DesignPageViewModel["pricing"] | undefined;

interface PricedTote {
  cols: number;
  rows: number;
  price: number;
  totalW: number;
  totalH: number;
  depth: number;
}

interface UseStudioParams {
  orderItems: UnitConfig[];
  setOrderItems: React.Dispatch<React.SetStateAction<UnitConfig[]>>;
  pricing: Pricing;
  rules: StudioRules;
  paintPrices: StudioPaintPrices;
  initialConfig: Record<string, unknown> | null | undefined;
}

/** Per-unit extras edited in the studio (organizers, paint, indoor delivery). */
export interface StudioUnitExtras {
  addons?: SectionAddon[];
  paintFrameColor?: PaintColorId | null;
  paintDoorColor?: PaintColorId | null;
  paintSidePanelColor?: PaintColorId | null;
}

const REPRICE_DELAY_MS = 200;

function presetKey(item: UnitConfig, preset: BestsellerPreset): string {
  return JSON.stringify([preset.id, item.hasTotes]);
}

export function useStudio({ orderItems, setOrderItems, pricing, rules, paintPrices, initialConfig }: UseStudioParams) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);

  // Prices are cached per (options, installer rates); new rates start over.
  const pricingKey = useMemo(() => JSON.stringify(pricing ?? null), [pricing]);
  const pricingKeyRef = useRef(pricingKey);
  pricingKeyRef.current = pricingKey;
  const toteCache = useRef(new Map<string, PricedTote>());
  const presetCache = useRef(new Map<string, UnitConfig>());
  const inflight = useRef(new Set<string>());
  const [cacheVersion, setCacheVersion] = useState(0);
  useEffect(() => {
    toteCache.current.clear();
    presetCache.current.clear();
    inflight.current.clear();
    setCacheVersion((v) => v + 1);
  }, [pricingKey]);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const paintKey = `${paintPrices.frame}|${paintPrices.doorsPanels}`;

  // ── Write cached prices into the cart; fetch what's missing ────────────
  const missing = useMemo(() => {
    void cacheVersion;
    const totes: UnitConfig[] = [];
    const presets: { item: UnitConfig; preset: BestsellerPreset }[] = [];
    for (const item of orderItems) {
      const kind = studioItemKind(item);
      if (kind === "tote" && !toteCache.current.has(toteUnitSignature(item))) totes.push(item);
      if (kind === "bestseller") {
        const preset = presetOfItem(item);
        if (preset && !presetCache.current.has(presetKey(item, preset))) presets.push({ item, preset });
      }
    }
    return { totes, presets };
  }, [orderItems, cacheVersion]);

  const repricing = missing.totes.length > 0 || missing.presets.length > 0;

  useEffect(() => {
    // Apply what's cached (also after a fetch lands)
    setOrderItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const kind = studioItemKind(item);
        if (kind === "tote") {
          const hit = toteCache.current.get(toteUnitSignature(item));
          if (!hit) return item;
          // Line price = engine price + this unit's paint
          const price = hit.price + studioPaintCost(item, paintPrices);
          if (
            item.price === price && item.cols === hit.cols && item.rows === hit.rows &&
            item.totalW === hit.totalW && item.totalH === hit.totalH && item.depth === hit.depth
          ) return item;
          changed = true;
          const o = { ...toteOptionsOf(item), cols: hit.cols, rows: hit.rows };
          return { ...item, ...hit, price, desc: toteUnitDesc(o) };
        }
        if (kind === "bestseller") {
          const preset = presetOfItem(item);
          const hit = preset && presetCache.current.get(presetKey(item, preset));
          if (!hit || (item.price === hit.price && item.totalW === hit.totalW && item.desc === hit.desc)) return item;
          changed = true;
          // Keep the customer's quantity / indoor delivery on the line
          return { ...item, ...hit, quantity: item.quantity, indoorDelivery: item.indoorDelivery, indoorDeliveryFee: item.indoorDeliveryFee };
        }
        return item;
      });
      return changed ? next : prev;
    });
    // paintKey stands in for paintPrices (a new object every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheVersion, orderItems, setOrderItems, paintKey]);

  useEffect(() => {
    if (missing.totes.length === 0 && missing.presets.length === 0) return;
    const t = setTimeout(() => {
      for (const item of missing.totes) {
        const sig = toteUnitSignature(item);
        if (inflight.current.has(sig)) continue;
        inflight.current.add(sig);
        const key = pricingKey;
        const o = toteOptionsOf(item);
        calculateBuild({
          cols: o.cols,
          rows: o.rows,
          toteModel: o.toteType,
          toteColor: o.toteColor,
          unitType: o.unitType,
          orientation: o.orientation,
          addOns: { totes: o.hasTotes, wheels: o.hasWheels, top: o.hasTop },
          mode: "manual",
          installerPricing: pricing,
          sectionAddons: item.addons?.length ? item.addons : undefined,
        })
          .then((res) => {
            if (key !== pricingKeyRef.current || !res.success) return;
            const priced: PricedTote = {
              cols: res.cols,
              rows: res.rows,
              price: res.price,
              totalW: res.dimensions.totalW,
              totalH: res.dimensions.totalH,
              depth: res.dimensions.depth,
            };
            toteCache.current.set(sig, priced);
            // The engine may settle on a different size; cache that line too
            toteCache.current.set(toteUnitSignature({ ...item, cols: res.cols, rows: res.rows }), priced);
            setCacheVersion((v) => v + 1);
          })
          .catch(() => {})
          .finally(() => inflight.current.delete(sig));
      }
      for (const { item, preset } of missing.presets) {
        const k = presetKey(item, preset);
        if (inflight.current.has(k)) continue;
        inflight.current.add(k);
        const key = pricingKey;
        calculateCompoundBuild({ presetId: preset.id, hasTotes: item.hasTotes, installerPricing: pricing })
          .then((res) => {
            if (key !== pricingKeyRef.current || !res.success) return;
            presetCache.current.set(k, presetOrderItem(preset, res, item.hasTotes));
            setCacheVersion((v) => v + 1);
          })
          .catch(() => {})
          .finally(() => inflight.current.delete(k));
      }
    }, REPRICE_DELAY_MS);
    return () => clearTimeout(t);
  }, [missing, pricing, pricingKey]);

  // ── Selection follows the cart ─────────────────────────────────────────
  const prevLength = useRef(orderItems.length);
  useEffect(() => {
    if (orderItems.length > prevLength.current) setActiveIndex(orderItems.length - 1);
    else if (activeIndex > orderItems.length - 1) setActiveIndex(Math.max(0, orderItems.length - 1));
    prevLength.current = orderItems.length;
  }, [orderItems.length, activeIndex]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const toteLine = useCallback((options: ToteUnitOptions): UnitConfig => {
    const o = normalizeToteUnit(options, rulesRef.current);
    return { ...o, price: 0, totalW: 0, totalH: 0, depth: 0, desc: toteUnitDesc(o), addons: [] };
  }, []);

  /** Change the selected tote unit's options; its price follows. */
  const updateTote = useCallback(
    (index: number, patch: Partial<ToteUnitOptions>) => {
      setOrderItems((prev) =>
        prev.map((item, i) => {
          if (i !== index || studioItemKind(item) !== "tote") return item;
          const o = normalizeToteUnit({ ...toteOptionsOf(item), ...patch }, rulesRef.current);
          return { ...item, ...o, addons: pruneAddons(item.addons, o.cols, o.rows), desc: toteUnitDesc(o) };
        }),
      );
    },
    [setOrderItems],
  );

  /** Organizers / paint on a tote unit — organizers re-price, paint adds to the line. */
  const updateExtras = useCallback(
    (index: number, extras: StudioUnitExtras) => {
      setOrderItems((prev) =>
        prev.map((item, i) => {
          if (i !== index || studioItemKind(item) !== "tote") return item;
          const next = { ...item, ...extras };
          return { ...next, addons: pruneAddons(next.addons, next.cols, next.rows) };
        }),
      );
    },
    [setOrderItems],
  );

  /** Built and delivered inside the home — a per-unit fee, as at Add to quote. */
  const setIndoorDelivery = useCallback(
    (index: number, on: boolean, fee: number) => {
      setOrderItems((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          if (on) return { ...item, indoorDelivery: true, indoorDeliveryFee: fee };
          const { indoorDelivery: _d, indoorDeliveryFee: _f, ...rest } = item;
          return rest;
        }),
      );
    },
    [setOrderItems],
  );

  /** A new tote unit like the last one on the map (or the default). */
  const addToteUnit = useCallback(() => {
    setOrderItems((prev) => {
      const last = [...prev].reverse().find((it) => studioItemKind(it) === "tote");
      return [...prev, toteLine(last ? toteOptionsOf(last) : DEFAULT_TOTE_UNIT)];
    });
  }, [setOrderItems, toteLine]);

  const addBestseller = useCallback(
    async (presetId: string, totes?: boolean): Promise<boolean> => {
      const preset = BESTSELLER_PRESETS.find((p) => p.id === presetId);
      if (!preset) return false;
      const choice = presetTotesChoice(preset, rulesRef.current.totesDisabled);
      const hasTotes = choice === "always" ? true : choice === "never" ? false : totes ?? true;
      setAddingPreset(presetId);
      try {
        const res = await calculateCompoundBuild({ presetId, hasTotes, installerPricing: pricing });
        if (!res.success) return false;
        const line = presetOrderItem(preset, res, hasTotes);
        presetCache.current.set(presetKey(line, preset), line);
        setOrderItems((prev) => [...prev, line]);
        return true;
      } catch {
        return false;
      } finally {
        setAddingPreset(null);
      }
    },
    [pricing, setOrderItems],
  );

  const setBestsellerTotes = useCallback(
    (index: number, hasTotes: boolean) => {
      setOrderItems((prev) => prev.map((item, i) => (i === index ? { ...item, hasTotes } : item)));
    },
    [setOrderItems],
  );

  const removeItem = useCallback(
    (index: number) => {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
      setActiveIndex((a) => (a >= index ? Math.max(0, a - 1) : a));
    },
    [setOrderItems],
  );

  const setQuantity = useCallback(
    (index: number, quantity: number) => {
      setOrderItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, Math.round(quantity) || 1) } : item)));
    },
    [setOrderItems],
  );

  /** Biggest unit with the selected unit's options that fits the wall. */
  const fitToWall = useCallback(
    async (index: number, widthIn: number, heightIn: number): Promise<{ cols: number; rows: number } | null> => {
      const item = orderItems[index];
      if (!item || studioItemKind(item) !== "tote" || !(widthIn > 0) || !(heightIn > 0)) return null;
      const o = toteOptionsOf(item);
      try {
        const res = await calculateBuild({
          wallWidth: widthIn,
          wallHeight: heightIn,
          toteModel: o.toteType,
          toteColor: o.toteColor,
          unitType: o.unitType,
          orientation: o.orientation,
          addOns: { totes: o.hasTotes, wheels: o.hasWheels, top: o.hasTop },
          mode: "wallFit",
          installerPricing: pricing,
        });
        if (!res.success) return null;
        updateTote(index, { cols: res.cols, rows: res.rows });
        return { cols: res.cols, rows: res.rows };
      } catch {
        return null;
      }
    },
    [orderItems, pricing, updateTote],
  );

  // ── First unit: from the link (single unit / bestseller) or the default.
  //    Multi-unit links are loaded by useOrderCart; saved quotes by
  //    useServiceArea.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (Array.isArray(initialConfig?.units)) return;
    const cfg = initialConfig ?? {};
    if (typeof cfg.preset === "string" && BESTSELLER_PRESETS.some((p) => p.id === cfg.preset)) {
      void addBestseller(cfg.preset, typeof cfg.hasTotes === "boolean" ? cfg.hasTotes : undefined);
      return;
    }
    const pick = <T,>(v: unknown, ok: readonly T[], fallback: T): T => (ok.includes(v as T) ? (v as T) : fallback);
    const first = toteLine({
      cols: typeof cfg.cols === "number" ? cfg.cols : DEFAULT_TOTE_UNIT.cols,
      rows: typeof cfg.rows === "number" ? cfg.rows : DEFAULT_TOTE_UNIT.rows,
      toteType: pick(cfg.toteType, ["HDX", "GM"] as const, DEFAULT_TOTE_UNIT.toteType),
      toteColor: pick(cfg.toteColor, ["black", "clear"] as const, DEFAULT_TOTE_UNIT.toteColor),
      unitType: pick(cfg.unitType, ["standard", "mini"] as const, DEFAULT_TOTE_UNIT.unitType),
      orientation: pick(cfg.orientation, ["standard", "sideways"] as const, DEFAULT_TOTE_UNIT.orientation),
      hasTotes: typeof cfg.hasTotes === "boolean" ? cfg.hasTotes : DEFAULT_TOTE_UNIT.hasTotes,
      hasWheels: typeof cfg.hasWheels === "boolean" ? cfg.hasWheels : DEFAULT_TOTE_UNIT.hasWheels,
      hasTop: typeof cfg.hasTop === "boolean" ? cfg.hasTop : DEFAULT_TOTE_UNIT.hasTop,
    });
    // Decided inside the update: a saved quote restored on this same mount
    // (useServiceArea) lands first and must win over the default unit.
    setOrderItems((prev) => (prev.length > 0 ? prev : [first]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeIndex,
    setActiveIndex,
    repricing,
    addingPreset,
    updateTote,
    updateExtras,
    setIndoorDelivery,
    addToteUnit,
    addBestseller,
    setBestsellerTotes,
    removeItem,
    setQuantity,
    fitToWall,
  };
}
