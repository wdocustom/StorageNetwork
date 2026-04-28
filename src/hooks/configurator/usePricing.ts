import { useCallback, useEffect, useMemo, useState } from "react";
import { getDepositAmount, getDepositLabel } from "@/app/actions/fee-engine";
import type { DeliveryFeeResult } from "@/app/actions/delivery-fee";
import type { PaintColorId, DesignPageViewModel } from "@/types/viewModels";
import type { UnitConfig } from "./types";

interface UsePricingParams {
  orderItems: UnitConfig[];
  deliveryFeeResult: DeliveryFeeResult | null;
  cleanoutPrice: number;
  paintFrameColor: PaintColorId | null;
  paintDoorColor: PaintColorId | null;
  paintSidePanelColor: PaintColorId | null;
  pricing: DesignPageViewModel["pricing"] | undefined;
  addonDefaults: DesignPageViewModel["addonDefaults"] | undefined;
  installerId: string;
}

export function usePricing({
  orderItems,
  deliveryFeeResult,
  cleanoutPrice,
  paintFrameColor,
  paintDoorColor,
  paintSidePanelColor,
  pricing,
  addonDefaults,
  installerId,
}: UsePricingParams) {
  const [discountInput, setDiscountInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{
    code: string; amount: number; discountType?: "fixed" | "percentage"; discountValue?: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  const buildTotal = useMemo(
    () => orderItems.reduce((sum, it) => sum + it.price * (it.quantity || 1), 0),
    [orderItems],
  );

  const deliveryFeeAmount = useMemo(
    () => (deliveryFeeResult?.applicable && deliveryFeeResult.fee > 0) ? deliveryFeeResult.fee : 0,
    [deliveryFeeResult],
  );

  const paintFramePrice = useMemo(
    () => paintFrameColor ? (pricing?.addon_pricing?.paint_frame_price ?? addonDefaults?.paint_frame_price ?? 75) : 0,
    [paintFrameColor, pricing?.addon_pricing?.paint_frame_price, addonDefaults?.paint_frame_price],
  );
  const paintDoorsPanelsPrice = useMemo(
    () => pricing?.addon_pricing?.paint_doors_panels_price ?? addonDefaults?.paint_doors_panels_price ?? 30,
    [pricing?.addon_pricing?.paint_doors_panels_price, addonDefaults?.paint_doors_panels_price],
  );
  const paintDoorCost = useMemo(() => paintDoorColor ? paintDoorsPanelsPrice : 0, [paintDoorColor, paintDoorsPanelsPrice]);
  const paintPanelCost = useMemo(() => paintSidePanelColor ? paintDoorsPanelsPrice : 0, [paintSidePanelColor, paintDoorsPanelsPrice]);
  const paintTotal = useMemo(() => paintFramePrice + paintDoorCost + paintPanelCost, [paintFramePrice, paintDoorCost, paintPanelCost]);

  const indoorDeliveryTotal = useMemo(
    () => orderItems.reduce((sum, it) => sum + (it.indoorDelivery && it.indoorDeliveryFee ? it.indoorDeliveryFee * (it.quantity || 1) : 0), 0),
    [orderItems],
  );

  const grandTotal = useMemo(
    () => Math.max(0, buildTotal + deliveryFeeAmount + cleanoutPrice + paintTotal + indoorDeliveryTotal - (discountApplied?.amount || 0)),
    [buildTotal, deliveryFeeAmount, cleanoutPrice, paintTotal, indoorDeliveryTotal, discountApplied?.amount],
  );

  const [depositAmount, setDepositAmount] = useState(0);
  const [depositLabelText, setDepositLabelText] = useState("15%");

  useEffect(() => {
    if (grandTotal > 0) {
      getDepositAmount(grandTotal, installerId || undefined).then(setDepositAmount);
    }
  }, [grandTotal, installerId]);

  useEffect(() => {
    getDepositLabel(installerId || undefined).then(setDepositLabelText);
  }, [installerId]);

  const handleApplyDiscount = useCallback(async () => {
    if (!discountInput.trim() || !installerId) return;
    setDiscountLoading(true);
    setDiscountError("");
    const { validateDiscountCode } = await import("@/app/actions/discount-codes");
    const result = await validateDiscountCode(
      discountInput.trim(),
      installerId,
      grandTotal,
      { unitCount: orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0) },
    );
    setDiscountLoading(false);
    if (result.valid) {
      setDiscountApplied({ code: result.code!, amount: result.discountAmount, discountType: result.discountType, discountValue: result.discountValue });
      setDiscountError("");
    } else {
      setDiscountApplied(null);
      setDiscountError(result.error || "Invalid code.");
    }
  }, [discountInput, installerId, grandTotal, orderItems]);

  const handleRemoveDiscount = useCallback(() => {
    setDiscountApplied(null);
    setDiscountInput("");
    setDiscountError("");
  }, []);

  return {
    discountInput, setDiscountInput,
    discountApplied,
    discountLoading,
    discountError, setDiscountError,
    buildTotal,
    deliveryFeeAmount,
    paintTotal,
    indoorDeliveryTotal,
    grandTotal,
    depositAmount,
    depositLabelText,
    handleApplyDiscount,
    handleRemoveDiscount,
  };
}
