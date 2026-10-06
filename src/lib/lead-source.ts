// ═══════════════════════════════════════════════════════════════════════════
// Lead source → platform fee rate. SINGLE source of truth.
//
// Direct lead  — the installer brought the customer (their own booking link
//                or a manual quote): 3% maintenance fee.
// Network lead — the platform brought the customer: 15% fee. That includes
//                platform-sent marketing ("platform_campaign"): the email
//                came from Storage Network, so the order is a network lead
//                even though it books through the installer's page.
//
// Anything that is not explicitly direct is billed as network, so a new
// platform-driven source can never silently fall through to the 3% rate.
// To add a platform-driven source, add it to LeadSource and leave it OFF
// DIRECT_SOURCES.
// ═══════════════════════════════════════════════════════════════════════════

export type LeadSource =
  | "platform"
  | "partner_link"
  | "installer_manual"
  | "facebook_referral"
  | "platform_campaign";

export const DIRECT_FEE_RATE = 0.03;
export const NETWORK_FEE_RATE = 0.15;

const DIRECT_SOURCES: ReadonlySet<string> = new Set(["partner_link", "installer_manual"]);

/** Sources that are locked in once set — a client can never downgrade them. */
const PLATFORM_DRIVEN_SOURCES: ReadonlySet<string> = new Set(["platform_campaign"]);

export function isDirectLeadSource(source: string | null | undefined): boolean {
  return !!source && DIRECT_SOURCES.has(source);
}

export function platformFeeRateForSource(source: string | null | undefined): number {
  return isDirectLeadSource(source) ? DIRECT_FEE_RATE : NETWORK_FEE_RATE;
}

/** True for sources the platform itself attributed server-side (campaigns). */
export function isLockedPlatformSource(source: string | null | undefined): boolean {
  return !!source && PLATFORM_DRIVEN_SOURCES.has(source);
}
