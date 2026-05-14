"use server";

import zipcodes from "zipcodes";

import { getServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Inventory-mode gift delivery preview
//
// Computes the realtor-facing distance gate for inventory-mode gifts at
// form-fill time. The gate has three states:
//
//   • free      — distance ≤ 50 mi from a covering installer. No surcharge.
//   • surcharge — 51–75 mi. Realtor pays an extra $25 at checkout.
//   • inquire   — > 75 mi. No automatic dispatch; form offers a mailto.
//
// "Distance from a covering installer" — we look up an installer whose
// service_zips list contains the recipient's ZIP and measure the centroid
// distance (zipcodes.distance, the same library delivery-fee.ts uses). If
// no installer covers the ZIP at all, the preview returns 'no_coverage' so
// the form can show a clear empty state.
//
// This is a PREVIEW. The actual installer chosen by assignFulfillmentInstaller
// after recipient redeems may differ (stock, capacity, prio); however, the
// covering set is the same, so the distance tier is stable in practice. The
// computed surcharge is snapshotted onto the gift row at dispatch time
// (amount_cents on tote_rental_gifts) — see migration 115.
// ═══════════════════════════════════════════════════════════════════════════

// Internal-only — Next.js "use server" files can only export async functions.
// These constants are not exported; the values reach the client via the
// previewToteGiftDelivery() return value (DeliveryPreview.surchargeCents +
// the prebuilt `message` string).
const FREE_DELIVERY_RADIUS_MILES = 50;
const SURCHARGE_RADIUS_MILES = 75;
const SURCHARGE_CENTS = 2500; // $25 flat for the 51–75 mi band

export type DeliveryTier = "free" | "surcharge" | "inquire" | "no_coverage";

export interface DeliveryPreview {
  tier: DeliveryTier;
  distanceMiles: number | null;
  surchargeCents: number;
  installer: null | {
    id: string;
    displayName: string;
    email: string;
  };
  /** UI copy describing the tier, prebuilt so the client doesn't drift. */
  message: string;
}

export async function previewToteGiftDelivery(input: {
  deliveryZip: string;
}): Promise<DeliveryPreview> {
  const zip = (input.deliveryZip ?? "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return {
      tier: "no_coverage",
      distanceMiles: null,
      surchargeCents: 0,
      installer: null,
      message: "Enter a 5-digit delivery ZIP to preview pricing.",
    };
  }

  const db = getServiceClient();

  // Find an installer covering this ZIP. We don't filter by stock or capacity
  // here — this is a preview at form-fill time, not the routing decision.
  // is_pro / completed_jobs ordering mirrors findEligibleInstaller so the
  // preview is consistent with who will actually get assigned.
  const { data: candidates } = await db
    .from("profiles")
    .select("id, first_name, last_name, business_name, email, service_zip")
    .eq("tote_fulfillment_active", true)
    .contains("service_zips", [zip])
    .not("stripe_account_id", "is", null)
    .not("service_zip", "is", null)
    .order("is_pro", { ascending: false })
    .order("completed_jobs", { ascending: false })
    .limit(5);

  if (!candidates || candidates.length === 0) {
    return {
      tier: "no_coverage",
      distanceMiles: null,
      surchargeCents: 0,
      installer: null,
      message:
        "No installer covers that ZIP yet. We're expanding our network — " +
        "for now, please use Quick-send mode or contact support.",
    };
  }

  // Pick the closest covering installer (smallest centroid distance).
  // Ties broken by the original is_pro/completed_jobs ordering.
  let best: {
    profile: (typeof candidates)[number];
    distance: number;
  } | null = null;

  for (const profile of candidates) {
    const installerZip = profile.service_zip as string;
    const distance = zipcodes.distance(installerZip, zip);
    if (distance === null || distance === undefined) continue;
    if (best === null || distance < best.distance) {
      best = { profile, distance };
    }
  }

  if (!best) {
    return {
      tier: "no_coverage",
      distanceMiles: null,
      surchargeCents: 0,
      installer: null,
      message:
        "Couldn't resolve installer distance for that ZIP. " +
        "Please use Quick-send mode or contact support.",
    };
  }

  const distanceMiles = Math.round(best.distance);
  const installer = {
    id: best.profile.id as string,
    displayName:
      (best.profile.business_name as string | null) ||
      [best.profile.first_name, best.profile.last_name].filter(Boolean).join(" ") ||
      "Your local installer",
    email: best.profile.email as string,
  };

  if (distanceMiles <= FREE_DELIVERY_RADIUS_MILES) {
    return {
      tier: "free",
      distanceMiles,
      surchargeCents: 0,
      installer,
      message: `${distanceMiles} mi from your installer — delivery + pickup included.`,
    };
  }

  if (distanceMiles <= SURCHARGE_RADIUS_MILES) {
    return {
      tier: "surcharge",
      distanceMiles,
      surchargeCents: SURCHARGE_CENTS,
      installer,
      message:
        `${distanceMiles} mi from your installer. First ${FREE_DELIVERY_RADIUS_MILES} mi included; ` +
        `extended delivery adds a $${(SURCHARGE_CENTS / 100).toFixed(0)} surcharge.`,
    };
  }

  return {
    tier: "inquire",
    distanceMiles,
    surchargeCents: 0,
    installer,
    message:
      `${distanceMiles} mi exceeds our ${SURCHARGE_RADIUS_MILES}-mi delivery range. ` +
      `Email the installer directly to arrange this gift — they may agree to ` +
      `a custom delivery quote.`,
  };
}
