import { useEffect, useMemo, useState } from "react";
import type { DesignPageViewModel } from "@/types/viewModels";
import { BESTSELLER_PRESETS } from "@/lib/presets";

function setInstallerCookie(id: string) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `installer_id=${encodeURIComponent(id)};path=/;expires=${expires};SameSite=Lax`;
}

export function getInstallerCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)installer_id=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export { setInstallerCookie };

interface UseInstallerContextParams {
  initialData: DesignPageViewModel | null;
}

export function useInstallerContext({ initialData }: UseInstallerContextParams) {
  const [demoToast, setDemoToast] = useState(false);
  const [installerId, setInstallerId] = useState(initialData?.routing.installerId || "");
  const [data, setData] = useState<DesignPageViewModel | null>(initialData);
  const [installerLocked, setInstallerLocked] = useState(!!initialData);
  const [installerLoading] = useState(false);

  useEffect(() => {
    if (initialData?.routing.installerId) {
      setInstallerCookie(initialData.routing.installerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripeAccountId = useMemo(() => data?.routing.stripeAccountId || null, [data?.routing.stripeAccountId]);

  const filteredPresets = useMemo(() => {
    const p = data?.pricing;
    if (!p) return BESTSELLER_PRESETS;
    return BESTSELLER_PRESETS.filter((preset) => {
      const key = `bestseller_${preset.id.replace(/-/g, "_")}_disabled` as keyof typeof p;
      return p[key] !== true;
    });
  }, [data?.pricing]);

  const shelvingEnabled = useMemo(() => data?.pricing?.open_shelving_enabled === true, [data?.pricing?.open_shelving_enabled]);
  const overheadStorageEnabled = useMemo(() => data?.pricing?.overhead_storage_enabled === true, [data?.pricing?.overhead_storage_enabled]);
  const raisedBedEnabled = useMemo(() => data?.pricing?.raised_bed_enabled === true, [data?.pricing?.raised_bed_enabled]);
  const chairEnabled = useMemo(() => data?.pricing?.adirondack_chair_enabled === true, [data?.pricing?.adirondack_chair_enabled]);
  const globalTotesDisabled = useMemo(() => data?.pricing?.totes_disabled === true, [data?.pricing?.totes_disabled]);
  const globalUse2x4Rails = useMemo(() => data?.pricing?.use_2x4_rails === true, [data?.pricing?.use_2x4_rails]);

  const effectiveLeadTime = useMemo(() => data?.routing.leadTime ?? 5, [data?.routing.leadTime]);

  return {
    demoToast, setDemoToast,
    installerId, setInstallerId,
    data, setData,
    installerLocked, setInstallerLocked,
    installerLoading,
    stripeAccountId,
    filteredPresets,
    shelvingEnabled,
    overheadStorageEnabled,
    raisedBedEnabled,
    chairEnabled,
    globalTotesDisabled,
    globalUse2x4Rails,
    effectiveLeadTime,
  };
}
