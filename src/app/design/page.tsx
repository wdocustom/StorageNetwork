import { Suspense } from "react";
import {
  getInstallerById,
  getInstallerByRef,
  getInstallerBySlug,
  type AvailabilityResult,
} from "@/app/actions/customer";
import { mapToDesignViewModel } from "@/lib/mappers/installerMapper";
import DesignConfigurator from "./DesignConfigurator";

// ═══════════════════════════════════════════════════════════════════════════
// Design Page — Server Component
//
// Resolves the installer SERVER-SIDE, maps to a DesignPageViewModel,
// then passes ONLY the view model to the client. The raw profile
// (including is_pro, business_name, logo_url) never reaches the browser.
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
  const fromNetwork = params.from === "network"; // Came from platform ZIP lookup

  // UUID detection — route ?installer=UUID to getInstallerById, not slug lookup
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const installerParamIsUUID = UUID_RE.test(installerParam);

  // ── Server-side installer resolution ────────────────────────────────
  let rawInstaller: AvailabilityResult | null = null;

  if (ref) {
    const res = await getInstallerByRef(ref);
    if (res.available) rawInstaller = res;
  } else if (installerId) {
    const res = await getInstallerById(installerId);
    if (res.available) rawInstaller = res;
  } else if (installerParam && installerParamIsUUID) {
    const res = await getInstallerById(installerParam);
    if (res.available) rawInstaller = res;
  } else if (installerParam) {
    const res = await getInstallerBySlug(installerParam);
    if (res.available) rawInstaller = res;
  }

  // Determine lead source:
  // - Direct lead (partner_link): customer used installer's custom link (ref param or slug)
  // - Network lead (platform): customer found installer via platform ZIP lookup (from=network)
  // If from=network is set, it's always a platform lead even if installer param exists
  const isDirectLead = !fromNetwork && !!(rawInstaller && (ref || installerId || installerParam));

  // ── Map to View Model — branding gate applied here ──────────────────
  // The raw installer object dies here. Only the view model is serialized
  // to the client. Free installers get platform branding; Pro gets theirs.
  const viewModel = mapToDesignViewModel(rawInstaller);

  return (
    <Suspense>
      <DesignConfigurator
        initialData={viewModel}
        initialZip={zip}
        mode={mode}
        leadSource={isDirectLead ? "partner_link" : "platform"}
      />
    </Suspense>
  );
}
