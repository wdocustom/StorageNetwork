"use server";

// ═══════════════════════════════════════════════════════════════════════════
// "Have a pro build it" — from the DIY plans designer back to an installer
//
//   findPlanBuilder   → who builds it: the installer who referred the
//                       customer (their link → ?ref / cookie), or the local
//                       installer for a ZIP, or nobody (waitlist)
//   quotePlanBuild    → that installer's price for the exact design
//   requestPlanBuild  → creates the lead (server-priced) and returns the
//                       quote page, where the customer adds their address
//                       and pays the deposit — the normal installer flow
//   joinPlanBuildWaitlist → ZIP with no installer
//
// Lead source decides the platform fee (src/lib/lead-source.ts):
//   referred installer   → "partner_link"  (direct, 3%)
//   ZIP-matched installer → "platform"     (network, 15%); when the customer
//                           was referred by an installer who doesn't serve
//                           their ZIP, that installer is the
//                           referring_installer_id (network bounty)
// ═══════════════════════════════════════════════════════════════════════════

import { cookies } from "next/headers";
import { getInstallerById } from "@/app/actions/customer";
import { gatekeeperCheck, joinWaitlist } from "@/app/actions/gatekeeper";
import { validateServiceArea } from "@/app/actions/installer";
import { checkInstallerAtCapacity } from "@/app/actions/pro-trial";
import { submitNetworkLead } from "@/app/actions/submit-lead";
import { enforceActionRateLimit, RateLimitError } from "@/lib/server/action-rate-limit";
import { priceDesignForInstaller } from "@/lib/server/plan-build-quote";
import { PLAN_REF_COOKIE, cleanReferralId } from "@/lib/plan-splits";
import { parseTotePlanDesign } from "@/lib/tote-plans";

export interface PlanBuilder {
  id: string;
  name: string;
  logoUrl: string | null;
  isPro: boolean;
  completedJobs: number;
  /** The customer came through this installer's link (direct lead) */
  referred: boolean;
  /** Installer sells totes with builds */
  totesAvailable: boolean;
}

export type FindPlanBuilderResult =
  | { status: "found"; builder: PlanBuilder; zip: string | null }
  | { status: "needs_zip" }
  | { status: "none"; zip: string };

async function referralId(rawRef: unknown): Promise<string | null> {
  const jar = await cookies();
  return cleanReferralId(rawRef) ?? cleanReferralId(jar.get(PLAN_REF_COOKIE)?.value);
}

async function builderFor(id: string, referred: boolean): Promise<PlanBuilder | null> {
  const inst = await getInstallerById(id);
  if (!inst.installer_id) return null;
  return {
    id: inst.installer_id,
    name: inst.installer_name || "Your installer",
    logoUrl: inst.installer_logo_url || inst.installer_avatar_url,
    isPro: inst.installer_is_pro,
    completedJobs: inst.installer_completed_jobs,
    referred,
    totesAvailable: inst.installer_pricing?.totes_disabled !== true,
  };
}

const ZIP = /^\d{5}$/;

/** Who would build this: the referring installer if they serve the ZIP, else the local one. */
export async function findPlanBuilder(input: { ref?: string | null; zip?: string | null }): Promise<FindPlanBuilderResult> {
  const ref = await referralId(input.ref);
  const zip = input.zip && ZIP.test(input.zip.trim()) ? input.zip.trim() : null;

  if (ref) {
    // Referred: go back to that installer — straight away, or once the ZIP checks out
    const inArea = zip ? (await validateServiceArea(ref, zip)).inArea : true;
    if (inArea) {
      const builder = await builderFor(ref, true);
      if (builder) return { status: "found", builder, zip };
    }
  }
  if (!zip) return { status: "needs_zip" };

  const local = await gatekeeperCheck(zip);
  if (local.available && local.installer_id) {
    const builder = await builderFor(local.installer_id, false);
    if (builder) return { status: "found", builder, zip };
  }
  return { status: "none", zip };
}

export interface PlanBuildQuoteView {
  total: number;
  totes: boolean;
  lines: { desc: string; price: number }[];
}

/** The installer's price for this exact design. */
export async function quotePlanBuild(input: {
  design: unknown;
  installerId: string;
  includeTotes: boolean;
}): Promise<PlanBuildQuoteView | null> {
  const design = parseTotePlanDesign(input.design);
  const id = cleanReferralId(input.installerId);
  if (!design || !id) return null;
  const inst = await getInstallerById(id);
  if (!inst.installer_id) return null;
  const quote = await priceDesignForInstaller(design, inst.installer_pricing ?? undefined, input.includeTotes);
  if (!quote) return null;
  return { total: quote.total, totes: quote.totes, lines: quote.units.map((u) => ({ desc: u.desc, price: u.price })) };
}

export type RequestPlanBuildResult =
  | { ok: true; leadId: string; waitlisted: boolean }
  | { ok: false; error: string };

/** Send the build to the installer as a lead, priced on the server. */
export async function requestPlanBuild(input: {
  design: unknown;
  installerId: string;
  zip: string;
  includeTotes: boolean;
  name: string;
  email: string;
  phone?: string;
  ref?: string | null;
}): Promise<RequestPlanBuildResult> {
  try {
    await enforceActionRateLimit({ action: "plan-build-request", limit: 5, window: "60 s", identify: "user-or-ip" });
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const design = parseTotePlanDesign(input.design);
  const installerId = cleanReferralId(input.installerId);
  const zip = input.zip?.trim() ?? "";
  if (!design || !installerId) return { ok: false, error: "Something's off with this design — refresh and try again." };
  if (!ZIP.test(zip)) return { ok: false, error: "Enter your 5-digit ZIP code." };

  const inst = await getInstallerById(installerId);
  if (!inst.installer_id) return { ok: false, error: "That installer isn't taking bookings right now." };
  const quote = await priceDesignForInstaller(design, inst.installer_pricing ?? undefined, input.includeTotes);
  if (!quote || quote.total <= 0) return { ok: false, error: "We couldn't price this build. Please try again." };

  const ref = await referralId(input.ref);
  const referred = ref === installerId;
  const capacity = await checkInstallerAtCapacity(installerId);

  const result = await submitNetworkLead({
    customer_name: input.name,
    customer_email: input.email,
    customer_phone: input.phone ?? "",
    address: "",
    address_zip: zip,
    quote_data: quote.units,
    grand_total: quote.total,
    installer_id: installerId,
    source: referred ? "partner_link" : "platform",
    ...(ref && !referred ? { referring_installer_id: ref } : {}),
    ...(capacity.atCapacity ? { waitlisted: true } : {}),
  });
  if (!result.success || !result.id) return { ok: false, error: result.error || "Something went wrong. Please try again." };
  return { ok: true, leadId: result.id, waitlisted: capacity.atCapacity };
}

/** No installer covers the ZIP yet — save their spot. */
export async function joinPlanBuildWaitlist(input: { zip: string; name: string; email: string }) {
  return joinWaitlist(input.email, input.zip, input.name);
}
