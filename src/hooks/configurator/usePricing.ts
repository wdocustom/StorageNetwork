import { useCallback, useEffect, useMemo, useState } from "react";
import { getDepositAmount, getDepositLabel } from "@/app/actions/fee-engine";
import type { DeliveryFeeResult } from "@/app/actions/delivery-fee";
import type { UnitConfig } from "./types";

interface UsePricingParams {
  orderItems: UnitConfig[];
  deliveryFeeResult: DeliveryFeeResult | null;
  cleanoutPrice: number;
  installerId: string;
}

export function usePricing({
  orderItems,
  deliveryFeeResult,
  cleanoutPrice,
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

  const indoorDeliveryTotal = useMemo(
    () => orderItems.reduce((sum, it) => sum + (it.indoorDelivery && it.indoorDeliveryFee ? it.indoorDeliveryFee * (it.quantity || 1) : 0), 0),
    [orderItems],
  );

  const grandTotal = useMemo(
    // Paint is part of each unit's line price (the studio adds it per unit)
    () => Math.max(0, buildTotal + deliveryFeeAmount + cleanoutPrice + indoorDeliveryTotal - (discountApplied?.amount || 0)),
    [buildTotal, deliveryFeeAmount, cleanoutPrice, indoorDeliveryTotal, discountApplied?.amount],
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
    indoorDeliveryTotal,
    grandTotal,
    depositAmount,
    depositLabelText,
    handleApplyDiscount,
    handleRemoveDiscount,
  };
}
