"use server";

// ═══════════════════════════════════════════════════════════════════════════
// MY BUILDS — every plan a buyer owns, from any one of their access links
//
// Guest buyers have no account: each purchase is an access token emailed to
// them. Any valid token unlocks the library of purchases made with the same
// email, and each item opens with ITS OWN token — so access is exactly what
// was bought, nothing more.
// ═══════════════════════════════════════════════════════════════════════════

import { getServiceClient } from "@/lib/supabase-server";
import { checkPlanDevice } from "@/lib/server/plan-device";
import { getPlanById } from "@/lib/plans-config";
import {
  TOTE_PLAN_ID,
  TOTE_PLAN_TIERS,
  isTotePlanTier,
  parseTotePlanDesign,
  totePlanName,
  totePlanSummary,
} from "@/lib/tote-plans";
import { LADDER_JIG_NAME, LADDER_JIG_OWNER_PRICE, LADDER_JIG_PLAN_ID, LADDER_JIG_TAGLINE } from "@/lib/ladder-jig";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LibraryItem {
  kind: "tote" | "jig" | "chair";
  title: string;
  subtitle: string;
  badge?: string;
  purchasedAt: string;
  href: string;
}

export type LibraryResult =
  | {
      ok: true;
      /** Masked, for "Plans for jo•••@example.com" */
      emailHint: string;
      items: LibraryItem[];
      /** Shown when they own a tote plan but not the jig */
      jigOffer?: { href: string; price: number };
    }
  | { ok: false; error: string; verify?: { token: string; emailHint: string } };

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "your email";
  return `${user.slice(0, 2)}•••@${domain}`;
}

interface Row {
  access_token: string;
  email: string;
  plan_id: string;
  tier: string | null;
  build_config: unknown;
  purchased_at: string;
}

export async function listMyPlans(token: string): Promise<LibraryResult> {
  if (!token || !UUID_RE.test(token)) return { ok: false, error: "This link is invalid or has expired." };
  try {
    const db = getServiceClient();
    const { data: me } = await db
      .from("public_plan_purchases")
      .select("email")
      .eq("access_token", token)
      .maybeSingle();
    if (!me?.email) return { ok: false, error: "This link is invalid or has expired." };
    const device = await checkPlanDevice(me.email);
    if (!device.ok) {
      return {
        ok: false,
        error: "Confirm it's you to open your plans on this device.",
        verify: { token, emailHint: device.emailHint },
      };
    }

    const { data: rows } = await db
      .from("public_plan_purchases")
      .select("access_token, email, plan_id, tier, build_config, purchased_at")
      .eq("email", me.email)
      .order("purchased_at", { ascending: false });

    const items: LibraryItem[] = [];
    let firstToteToken: string | null = null;
    let ownsJig = false;

    for (const row of (rows ?? []) as Row[]) {
      if (row.plan_id === TOTE_PLAN_ID) {
        const design = parseTotePlanDesign(row.build_config);
        if (!design || !isTotePlanTier(row.tier)) continue;
        firstToteToken ??= row.access_token;
        items.push({
          kind: "tote",
          title: totePlanName(design),
          subtitle: totePlanSummary(design),
          badge: TOTE_PLAN_TIERS[row.tier].name,
          purchasedAt: row.purchased_at,
          href: `/plans/build?token=${row.access_token}`,
        });
      } else if (row.plan_id === LADDER_JIG_PLAN_ID) {
        ownsJig = true;
        items.push({
          kind: "jig",
          title: LADDER_JIG_NAME,
          subtitle: LADDER_JIG_TAGLINE,
          badge: "Plans",
          purchasedAt: row.purchased_at,
          href: `/plans/jig?token=${row.access_token}`,
        });
      } else {
        const plan = getPlanById(row.plan_id);
        if (!plan) continue;
        items.push({
          kind: "chair",
          title: plan.name,
          subtitle: plan.tagline,
          badge: "Build Plans",
          purchasedAt: row.purchased_at,
          href: `/plans/access?token=${row.access_token}`,
        });
      }
    }

    return {
      ok: true,
      emailHint: maskEmail(me.email),
      items,
      ...(firstToteToken && !ownsJig
        ? { jigOffer: { href: `/plans/jig?owner=${firstToteToken}`, price: LADDER_JIG_OWNER_PRICE } }
        : {}),
    };
  } catch (err) {
    console.error("[PlanLibrary]", err);
    return { ok: false, error: "We couldn't load your plans. Please try again." };
  }
}
