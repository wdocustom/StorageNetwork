// ═══════════════════════════════════════════════════════════════════════════
// Request options — what a customer may ask an installer to quote
//
// Built from the installer's own settings so a customer is only ever offered
// what that installer sells:
//   • pricing_config  — product toggles (overhead, shelving, raised beds,
//                        chairs; totes_disabled / 2x4 rails for add-ons)
//   • services_config — the Services list (tote storage, clean-outs, custom
//                        services), defaulting to DEFAULT_SERVICES like the
//                        public profile page (/p/[slug]) does
// "Something else" is always offered.
//
// Pure — used by the request page's server actions to build the list, to
// validate a submission, and to label stored requests. Any future customer
// request form should use the same list.
// ═══════════════════════════════════════════════════════════════════════════

import type { InstallerPricing } from "@/types/viewModels";
import { DEFAULT_SERVICES, type ServiceOffering } from "@/config/services";

export interface RequestOption {
  /** Stored in quote_requests.wants. Services use `service:<id>`. */
  value: string;
  label: string;
}

export function requestOptionsFor(
  pricing: InstallerPricing | null | undefined,
  servicesConfig: ServiceOffering[] | null | undefined
): RequestOption[] {
  const p = pricing ?? {};
  const services = servicesConfig ?? DEFAULT_SERVICES;
  const enabled = services.filter((s) => s.enabled);
  const options: RequestOption[] = [];

  // Tote racks — the core product, unless the installer switched it off.
  if (enabled.some((s) => s.id === "tote_storage")) {
    options.push({ value: "rack", label: "Another storage rack" });
    const noTotes = p.totes_disabled === true || p.use_2x4_rails === true;
    options.push({ value: "addons", label: noTotes ? "Add a top or wheels" : "Add a top, wheels or totes" });
  }
  if (p.overhead_storage_enabled === true) options.push({ value: "overhead", label: "Overhead storage" });
  if (p.open_shelving_enabled === true) options.push({ value: "shelving", label: "Open shelving" });
  if (p.raised_bed_enabled === true) options.push({ value: "raised_bed", label: "Raised garden bed" });
  if (p.adirondack_chair_enabled === true) options.push({ value: "chair", label: "Adirondack chair" });

  // Clean-outs and the installer's own custom services.
  for (const s of enabled) {
    if (s.id === "tote_storage") continue;
    options.push({ value: `service:${s.id}`, label: s.name });
  }

  options.push({ value: "other", label: "Something else" });
  return options;
}

/**
 * Label for a stored want. Looks the value up in ALL of the installer's
 * services (enabled or not), so an old request still reads correctly after
 * a service is switched off or renamed.
 */
export function requestWantLabel(
  value: string,
  servicesConfig: ServiceOffering[] | null | undefined
): string {
  const fixed: Record<string, string> = {
    rack: "Another storage rack",
    addons: "Add a top, wheels or totes",
    overhead: "Overhead storage",
    shelving: "Open shelving",
    raised_bed: "Raised garden bed",
    chair: "Adirondack chair",
    other: "Something else",
  };
  if (fixed[value]) return fixed[value];
  if (value.startsWith("service:")) {
    const id = value.slice("service:".length);
    const svc = (servicesConfig ?? DEFAULT_SERVICES).find((s) => s.id === id);
    return svc?.name || id.replace(/_/g, " ");
  }
  return value;
}
