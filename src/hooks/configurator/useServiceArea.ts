import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkAvailability,
  rerouteToLocalInstaller,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapAvailabilityToViewModel } from "@/lib/mappers/installerMapper";
import { validateServiceArea, submitWaitlistRequest } from "@/app/actions/installer";
import { checkInstallerAtCapacity } from "@/app/actions/pro-trial";
import { calculateDeliveryFee, type DeliveryFeeResult } from "@/app/actions/delivery-fee";
import { calculateBuild, calculateCompoundBuild } from "@/app/actions/calculator";
import { BESTSELLER_PRESETS } from "@/lib/presets";
import type { DesignPageViewModel } from "@/types/viewModels";
import type { UnitConfig, ToteType, ToteColor, SavedSignalData } from "./types";
import { setInstallerCookie } from "./useInstallerContext";

interface UseServiceAreaParams {
  initialZip: string;
  initialData: DesignPageViewModel | null;
  initialInstallerAtCapacity: boolean;
  savedSignal: SavedSignalData | undefined;
  // Cross-hook state reads
  addrZip: string;
  deliveryZip: string;
  hasDifferentDelivery: boolean;
  orderItems: UnitConfig[];
  // Cross-hook setters
  setData: React.Dispatch<React.SetStateAction<DesignPageViewModel | null>>;
  setInstallerId: React.Dispatch<React.SetStateAction<string>>;
  setOrderItems: React.Dispatch<React.SetStateAction<UnitConfig[]>>;
  setFirstName: React.Dispatch<React.SetStateAction<string>>;
  setLastName: React.Dispatch<React.SetStateAction<string>>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  setReferringInstallerIdExternal?: undefined; // referringInstallerId is internal
}

export function useServiceArea({
  initialZip,
  initialData,
  initialInstallerAtCapacity,
  savedSignal,
  addrZip,
  deliveryZip,
  hasDifferentDelivery,
  orderItems,
  setData,
  setInstallerId,
  setOrderItems,
  setFirstName,
  setLastName,
  setEmail,
  setPhone,
}: UseServiceAreaParams) {
  const [zip, setZip] = useState(initialZip);
  const [zipChecking, setZipChecking] = useState(false);
  const [zipResult, setZipResult] = useState<AvailabilityResult | null>(null);

  const [zipOutOfArea, setZipOutOfArea] = useState(false);
  const [zipCheckMsg, setZipCheckMsg] = useState("");
  const [waitlistSending, setWaitlistSending] = useState(false);
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  const [deliveryFeeResult, setDeliveryFeeResult] = useState<DeliveryFeeResult | null>(null);

  const [referringInstallerId, setReferringInstallerId] = useState<string | null>(null);
  const originalInstallerId = useRef(initialData?.routing.installerId || "");
  const [handedOff, setHandedOff] = useState(false);
  const [handoffInstallerName, setHandoffInstallerName] = useState("");

  const [installerAtCapacity, setInstallerAtCapacity] = useState(initialInstallerAtCapacity);
  const [trialCapWaitlistSending, setTrialCapWaitlistSending] = useState(false);
  const [trialCapWaitlistSent, setTrialCapWaitlistSent] = useState(false);
  const [trialCapWaitlistError, setTrialCapWaitlistError] = useState("");

  const zipCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleZipCheckAuto = useCallback(async (zipCode: string) => {
    setZipChecking(true);
    setZipResult(null);
    try {
      const res = await checkAvailability(zipCode);
      setZipResult(res);
      if (res.available && res.installer_id) {
        const vm = mapAvailabilityToViewModel(res);
        if (vm) {
          setData(vm);
          setInstallerId(vm.routing.installerId);
          setInstallerCookie(vm.routing.installerId);
          checkInstallerAtCapacity(vm.routing.installerId).then((cap) => {
            setInstallerAtCapacity(cap.atCapacity);
          }).catch(() => {});
        }
      }
    } catch {
      setZipResult({
        available: false,
        installer_id: null,
        installer_name: null,
        installer_slug: null,
        installer_stripe_id: null,
        installer_avatar_url: null,
        installer_phone: null,
        installer_lead_time: 5,
        installer_working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        installer_scheduling_enabled: true,
        installer_is_pro: false,
        installer_completed_jobs: 0,
        installer_logo_url: null,
        installer_pricing: null,
        installer_services_config: null,
        message: "Unable to check availability.",
      });
    } finally {
      setZipChecking(false);
    }
  }, [setData, setInstallerId]);

  // Auto ZIP check on mount
  useEffect(() => {
    if (initialZip.length === 5 && !initialData) {
      handleZipCheckAuto(initialZip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleZipCheck = useCallback(async () => {
    if (zip.length < 5) return;
    await handleZipCheckAuto(zip);
  }, [zip, handleZipCheckAuto]);

  // Real-time ZIP validation when user enters installation ZIP
  useEffect(() => {
    if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    setZipOutOfArea(false);
    setZipCheckMsg("");
    setWaitlistSent(false);
    setWaitlistError("");
    setDeliveryFeeResult(null);

    const zipToCheck = hasDifferentDelivery ? deliveryZip : addrZip;
    const validationTargetId = originalInstallerId.current;
    if (!validationTargetId || !zipToCheck || zipToCheck.trim().length !== 5) return;

    let isActive = true;

    zipCheckRef.current = setTimeout(async () => {
      const trimmedZip = zipToCheck.trim();
      const result = await validateServiceArea(validationTargetId, trimmedZip);
      if (!isActive) return;

      if (!result.inArea) {
        const localResult = await rerouteToLocalInstaller(trimmedZip, validationTargetId);
        if (!isActive) return;

        if (localResult.available && localResult.installer_id) {
          setReferringInstallerId(validationTargetId);
          setHandedOff(true);
          setHandoffInstallerName(localResult.installer_name || "a local installer");
          const vm = mapAvailabilityToViewModel(localResult);
          if (vm) {
            setData(vm);
            setInstallerId(vm.routing.installerId);
            calculateDeliveryFee(vm.routing.installerId, trimmedZip)
              .then((r) => { if (isActive) setDeliveryFeeResult(r); })
              .catch(() => {});
          }
        } else {
          setZipOutOfArea(true);
          setHandedOff(false);
          setReferringInstallerId(null);
          setZipCheckMsg(
            "We don't have an installer in your area yet, but we'll notify you as soon as one is available.",
          );
        }
      } else {
        setReferringInstallerId(null);
        setHandedOff(false);
        setHandoffInstallerName("");
        calculateDeliveryFee(validationTargetId, trimmedZip)
          .then((r) => { if (isActive) setDeliveryFeeResult(r); })
          .catch(() => {});
      }
    }, 600);

    return () => {
      isActive = false;
      if (zipCheckRef.current) clearTimeout(zipCheckRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrZip, deliveryZip, hasDifferentDelivery]);

  // Re-price existing order items after handoff
  const prevPricingRef = useRef<DesignPageViewModel["pricing"] | undefined>(undefined);
  // We need to read data.pricing but can't include it in deps directly,
  // so we track it via a ref that's updated each render in the effect.
  useEffect(() => {
    // This effect receives data indirectly via the ref approach used in the original code.
    // Since we can't access data.pricing directly here (it's in another hook),
    // this effect is handled in the orchestrator where both data and orderItems are available.
  }, []);

  // Saved signal hydration
  const savedSignalHydrated = useRef(false);
  useEffect(() => {
    if (!savedSignal || savedSignalHydrated.current) return;
    savedSignalHydrated.current = true;

    if (savedSignal.sourceInstallerId) {
      setReferringInstallerId(savedSignal.sourceInstallerId);
    }

    if (savedSignal.customerName) {
      const parts = savedSignal.customerName.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (savedSignal.customerEmail) setEmail(savedSignal.customerEmail);
    if (savedSignal.customerPhone) setPhone(savedSignal.customerPhone);

    if (Array.isArray(savedSignal.quoteData) && savedSignal.quoteData.length > 0) {
      const restored = savedSignal.quoteData
        .map((raw) => {
          const u = raw as Record<string, unknown>;
          if (typeof u.cols !== "number" || typeof u.rows !== "number") return null;
          return {
            cols: u.cols,
            rows: u.rows,
            toteType: (u.toteType as ToteType) || "HDX",
            toteColor: (u.toteColor as ToteColor) || "black",
            unitType: u.unitType || "standard",
            orientation: u.orientation || "landscape",
            hasTotes: u.hasTotes === true,
            hasWheels: u.hasWheels === true,
            hasTop: u.hasTop === true,
            price: typeof u.price === "number" ? u.price : 0,
            totalW: typeof u.totalW === "number" ? u.totalW : 0,
            totalH: typeof u.totalH === "number" ? u.totalH : 0,
            depth: typeof u.depth === "number" ? u.depth : 0,
            desc: typeof u.desc === "string" ? u.desc : `${u.cols}×${u.rows}`,
          } as UnitConfig;
        })
        .filter((u): u is UnitConfig => u !== null);

      if (restored.length > 0) {
        setOrderItems(restored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    zip, setZip,
    zipChecking,
    zipResult, setZipResult,
    zipOutOfArea,
    zipCheckMsg,
    waitlistSending, setWaitlistSending,
    waitlistSent, setWaitlistSent,
    waitlistError, setWaitlistError,
    deliveryFeeResult, setDeliveryFeeResult,
    referringInstallerId, setReferringInstallerId,
    handedOff, setHandedOff,
    handoffInstallerName, setHandoffInstallerName,
    installerAtCapacity, setInstallerAtCapacity,
    trialCapWaitlistSending, setTrialCapWaitlistSending,
    trialCapWaitlistSent, setTrialCapWaitlistSent,
    trialCapWaitlistError, setTrialCapWaitlistError,
    handleZipCheck,
    handleZipCheckAuto,
  };
}
