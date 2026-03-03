import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { zipCache } from "@/lib/cache";

const INSTALLER_SELECT =
  "id, business_name, stripe_account_id, avatar_url, phone, lead_time_days, working_days, tier";

/** CDN cache headers: serve cached for 60s, stale up to 5min while revalidating */
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

/**
 * GET /api/installers/search?zip=68105
 *
 * Public endpoint: searches for installers by ZIP code.
 * Uses service_zips array first, falls back to service_zip exact match.
 * Responses are cached at both CDN level (s-maxage) and in-memory (60s).
 */
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const zip = req.nextUrl.searchParams.get("zip")?.trim() ?? "";

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { available: false, installer: null, message: "Invalid ZIP code." },
      { status: 400 }
    );
  }

  const body = await zipCache.getOrFetch(`api:${zip}`, async () => {
    try {
      // Primary: search the service_zips array (covers radius)
      const { data, error } = await supabase
        .from("profiles")
        .select(INSTALLER_SELECT)
        .contains("service_zips", [zip])
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          available: true,
          installer: {
            id: data.id,
            name: data.business_name,
            stripe_account_id: data.stripe_account_id,
            avatar_url: data.avatar_url,
            phone: data.phone,
            lead_time_days: data.lead_time_days ?? 5,
            working_days: data.working_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
            tier: data.tier ?? "standard",
          },
          message: `${data.business_name ?? "A local installer"} serves your area.`,
        };
      }

      // Fallback: exact match on service_zip
      const { data: fallback, error: fbErr } = await supabase
        .from("profiles")
        .select(INSTALLER_SELECT)
        .eq("service_zip", zip)
        .limit(1)
        .maybeSingle();

      if (!fbErr && fallback) {
        return {
          available: true,
          installer: {
            id: fallback.id,
            name: fallback.business_name,
            stripe_account_id: fallback.stripe_account_id,
            avatar_url: fallback.avatar_url,
            phone: fallback.phone,
            lead_time_days: fallback.lead_time_days ?? 5,
            working_days: fallback.working_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
            tier: fallback.tier ?? "standard",
          },
          message: `${fallback.business_name ?? "A local installer"} serves your area.`,
        };
      }

      return {
        available: false,
        installer: null,
        message: "We aren\u2019t in this area yet. Join the waitlist?",
      };
    } catch {
      return {
        available: false,
        installer: null,
        message: "Search failed. Please try again.",
      };
    }
  });

  return NextResponse.json(body, { headers: CACHE_HEADERS });
}
