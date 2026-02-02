import { Suspense } from "react";
import {
  getInstallerById,
  getInstallerByRef,
  getInstallerBySlug,
  type AvailabilityResult,
} from "@/app/actions/customer";
import DesignConfigurator from "./DesignConfigurator";

// ═══════════════════════════════════════════════════════════════════════════
// Design Page — Server Component
//
// Resolves the installer profile SERVER-SIDE from URL params, then passes
// the result as a prop to the client component. This eliminates the
// "amnesia bug" where the page loaded generic before the useEffect fired.
// ═══════════════════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DesignPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const installerId = typeof params.installer_id === "string" ? params.installer_id : "";
  const installerSlug = typeof params.installer === "string" ? params.installer : "";
  const ref = typeof params.ref === "string" ? params.ref : "";
  const zip = typeof params.zip === "string" ? params.zip : "";
  const mode = typeof params.mode === "string" ? params.mode : "";

  // ── Server-side installer resolution ────────────────────────────────
  let initialInstaller: AvailabilityResult | null = null;

  if (ref) {
    const res = await getInstallerByRef(ref);
    if (res.available) initialInstaller = res;
  } else if (installerSlug) {
    const res = await getInstallerBySlug(installerSlug);
    if (res.available) initialInstaller = res;
  } else if (installerId) {
    const res = await getInstallerById(installerId);
    if (res.available) initialInstaller = res;
  }

  return (
    <Suspense>
      <DesignConfigurator
        initialInstaller={initialInstaller}
        initialZip={zip}
        mode={mode}
      />
    </Suspense>
  );
}
