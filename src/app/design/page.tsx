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
  const installerParam = typeof params.installer === "string" ? params.installer : "";
  const ref = typeof params.ref === "string" ? params.ref : "";
  const zip = typeof params.zip === "string" ? params.zip : "";
  const mode = typeof params.mode === "string" ? params.mode : "";

  // UUID detection — route ?installer=UUID to getInstallerById, not slug lookup
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const installerParamIsUUID = UUID_RE.test(installerParam);

  // ── Server-side installer resolution ────────────────────────────────
  let initialInstaller: AvailabilityResult | null = null;

  if (ref) {
    const res = await getInstallerByRef(ref);
    if (res.available) initialInstaller = res;
  } else if (installerId) {
    const res = await getInstallerById(installerId);
    if (res.available) initialInstaller = res;
  } else if (installerParam && installerParamIsUUID) {
    // ?installer=UUID → look up by ID
    const res = await getInstallerById(installerParam);
    if (res.available) initialInstaller = res;
  } else if (installerParam) {
    // ?installer=my-slug → look up by vanity slug
    const res = await getInstallerBySlug(installerParam);
    if (res.available) initialInstaller = res;
  }

  // ── Branding gate: Free plan installers get platform branding ────────
  // The installer ID is preserved for lead routing, but display identity
  // is stripped to enforce Pro-only custom branding.
  if (initialInstaller && !initialInstaller.installer_is_pro) {
    initialInstaller = {
      ...initialInstaller,
      installer_name: "Professional Grade Storage",
      installer_logo_url: null,
      installer_avatar_url: null,
    };
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
