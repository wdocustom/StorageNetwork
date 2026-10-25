// ═══════════════════════════════════════════════════════════════════════════
// MY BUILDS — client-safe pieces of the plan library
// ═══════════════════════════════════════════════════════════════════════════

export const CONTACT_EMAIL = "contact@storage-network.app";

/** The buyer's library, reachable from any of their access tokens. */
export function libraryHref(token: string): string {
  return `/plans/library?token=${encodeURIComponent(token)}`;
}
